package services

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	ws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type Client struct {
	ID     string
	Conn   *ws.Conn
	RoomID string
	mu     sync.Mutex
}

type PastVote struct {
	Question    string `json:"question"`
	TotalVotes  int    `json:"totalVotes"`
	YesCount    int    `json:"yesCount"`
	NoCount     int    `json:"noCount"`
}

type Room struct {
	Clients      map[string]*Client
	HostID       string
	ActiveVote   string
	CurrentVotes map[string]string
	LastMedia    map[string]interface{}
	PastVotes    []PastVote
}

var (
	roomLock sync.Mutex
	rooms    = make(map[string]*Room)
	clients  = make(map[string]*Client)
)

func StartSignalingServer(port string) {
	app := fiber.New()

	app.Use("/ws", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws", ws.New(HandleWebSocket))

	app.Use("/dashboard", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/dashboard", ws.New(HandleDashboardSocket))

	go func() {
		log.Println("✅ Fiber WebSocket signaling server running on ws://localhost:" + port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("❌ Server error: %v", err)
		}
	}()

	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop

		log.Println("🛑 Shutting down WebSocket server...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_ = app.ShutdownWithContext(ctx)
		log.Println("✅ Server shutdown gracefully")
		os.Exit(0)
	}()
}

func handleMessage(client *Client, msg map[string]interface{}) {
	switch msg["type"] {
	case "join":
		if roomID, ok := msg["roomId"].(string); ok {
			isCreator := false
			if v, ok := msg["isCreator"].(bool); ok && v {
				isCreator = true
			}
			client.RoomID = roomID
			registerClient(roomID, client, isCreator)
		}
	case "offer", "answer", "ice-candidate":
		if targetID, ok := msg["userId"].(string); ok {
			msg["from"] = client.ID
			log.Printf("📡 Forwarding %s from %s to %s", msg["type"], msg["from"], targetID)
			forwardMessage(targetID, msg)
		}
	case "leave":
		removeClient(client)
	case "share-media":
		if url, ok := msg["url"].(string); ok {
			if mediaType, ok2 := msg["mediaType"].(string); ok2 {
				roomLock.Lock()
				if room, exists := rooms[client.RoomID]; exists {
					room.LastMedia = map[string]interface{}{
						"type":      "shared-media",
						"userId":    client.ID,
						"url":       url,
						"mediaType": mediaType,
					}
					broadcastRoomState(client.RoomID)
				}
				roomLock.Unlock()
			}
		}
	case "create-vote":
		if question, ok := msg["question"].(string); ok {
			roomLock.Lock()
			if room, exists := rooms[client.RoomID]; exists && room.HostID == client.ID {
				room.ActiveVote = question
				room.CurrentVotes = make(map[string]string)
				broadcastRoomState(client.RoomID)
			}
			roomLock.Unlock()
		}
	case "end-vote":
		roomLock.Lock()
		if room, exists := rooms[client.RoomID]; exists && room.HostID == client.ID {
			if room.ActiveVote != "" {
				vote := PastVote{
					Question:   room.ActiveVote,
					TotalVotes: len(room.CurrentVotes),
				}
				for _, v := range room.CurrentVotes {
					if v == "yes" {
						vote.YesCount++
					} else if v == "no" {
						vote.NoCount++
					}
				}
				room.PastVotes = append(room.PastVotes, vote)
			}
			room.ActiveVote = ""
			room.CurrentVotes = make(map[string]string)
			broadcastRoomState(client.RoomID)
		}
		roomLock.Unlock()
	case "vote":
		if userID, ok1 := msg["userId"].(string); ok1 {
			if value, ok2 := msg["value"].(string); ok2 {
				roomLock.Lock()
				if room, exists := rooms[client.RoomID]; exists && room.ActiveVote != "" {
					room.CurrentVotes[userID] = value
					broadcastRoomState(client.RoomID)
				}
				roomLock.Unlock()
			}
		}
	case "speaking":
		if isSpeaking, ok := msg["isSpeaking"].(bool); ok {
			broadcastMessage(client.RoomID, map[string]interface{}{
				"type":       "speaking",
				"userId":     client.ID,
				"isSpeaking": isSpeaking,
			})
		}
	}
}

func HandleWebSocket(c *ws.Conn) {
	clientID := ""
	defer func() {
		if clientID != "" {
			client, exists := clients[clientID]
			if !exists || client == nil {
				log.Printf("⚠️ Skipping cleanup: client %s already nil or removed", clientID)
				return
			}
			removeClient(client)
			log.Println("❌ Disconnected:", clientID)
		}
	}()

	_, msgBytes, err := c.ReadMessage()
	if err != nil {
		log.Println("❌ Failed to read init message:", err)
		return
	}

	var initMsg map[string]interface{}
	if err := json.Unmarshal(msgBytes, &initMsg); err != nil {
		log.Println("❌ Invalid JSON in init message:", err)
		return
	}

	if initMsg["type"] != "init" {
		log.Println("❌ First message must be 'init'")
		return
	}

	providedID, _ := initMsg["userId"].(string)
	clientID = providedID
	if clientID == "" {
		clientID = uuid.New().String()
	}

	client := &Client{ID: clientID, Conn: c}
	clients[clientID] = client
	log.Println("🔌 Connected:", clientID)

	_ = c.WriteJSON(map[string]interface{}{"type": "init", "userId": clientID})

	for {
		_, rawMessage, err := c.ReadMessage()
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			continue
		}

		handleMessage(client, msg)
	}
}

func registerClient(roomID string, client *Client, isCreator bool) {
	roomLock.Lock()
	defer roomLock.Unlock()

	room, exists := rooms[roomID]

	if !exists {
		if isCreator {
			room = &Room{
				Clients:      make(map[string]*Client),
				HostID:       client.ID,
				ActiveVote:   "",
				CurrentVotes: make(map[string]string),
				LastMedia:    nil,
				PastVotes:    []PastVote{},
			}
			rooms[roomID] = room
			log.Printf("👑 Created room %s (host: %s)", roomID, client.ID)
		} else {
			log.Printf("⛔ Rejected guest trying to join non-existent room %s", roomID)
			_ = client.Conn.WriteJSON(map[string]interface{}{
				"type":  "error",
				"error": "Room does not exist",
			})
			return
		}
	} else {
		log.Printf("🔁 Joined room %s: %s", roomID, client.ID)
	}

	if room.HostID == "" && isCreator {
		room.HostID = client.ID
		log.Printf("⚠️ Host reassigned to %s (allowed as creator)", client.ID)
	} else if room.HostID != client.ID {
		log.Printf("🛡️ Preserving host %s, %s is guest", room.HostID, client.ID)
	}

	room.Clients[client.ID] = client
	broadcastRoomState(roomID)
}

func removeClient(client *Client) {
	if client == nil {
		log.Println("⚠️ Tried to remove nil client")
		return
	}

	roomLock.Lock()
	defer roomLock.Unlock()

	log.Printf("Closing connection for client %s", client.ID)

	err := client.Conn.Close()
	if err != nil {
		log.Printf("Error closing WebSocket connection for client %s: %v", client.ID, err)
	} else {
		log.Printf("Successfully closed WebSocket connection for client %s", client.ID)
	}

	delete(clients, client.ID)

	if room, exists := rooms[client.RoomID]; exists {
		delete(room.Clients, client.ID)

		for _, peer := range room.Clients {
			peer.mu.Lock()
			_ = peer.Conn.WriteJSON(map[string]interface{}{
				"type":   "leave",
				"userId": client.ID,
			})
			peer.mu.Unlock()
		}

		if len(room.Clients) == 0 {
			log.Printf("🕒 Room %s is now empty (host %s preserved)", client.RoomID, room.HostID)
		} else {
			broadcastRoomState(client.RoomID)
		}
	}
}

func forwardMessage(targetID string, msg map[string]interface{}) {
	roomLock.Lock()
	defer roomLock.Unlock()

	// 🔒 Ignore self-targeting
	if fromID, ok := msg["from"].(string); ok && fromID == targetID {
		log.Printf("⚠️ Skipping self-forward of %s to %s", msg["type"], targetID)
		return
	}

	if client, ok := clients[targetID]; ok {
		err := client.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("❌ Failed to forward %s to %s: %v", msg["type"], targetID, err)
		}
	}
}

func broadcastMessage(roomID string, msg map[string]interface{}) {
	if room, ok := rooms[roomID]; ok {
		for _, client := range room.Clients {
			client.mu.Lock()
			err := client.Conn.WriteJSON(msg)
			client.mu.Unlock()
			if err != nil {
				log.Printf("❌ Failed to send message to %s: %v", client.ID, err)
			}
		}
	}
}

func broadcastRoomState(roomID string) {
	room, ok := rooms[roomID]
	if !ok {
		return
	}

	users := []string{}
	for id := range room.Clients {
		users = append(users, id)
	}

	for _, client := range room.Clients {
		state := map[string]interface{}{
			"type":         "room-state",
			"users":        users,
			"hostId":       room.HostID,
			"activeVote":   room.ActiveVote,
			"currentVotes": room.CurrentVotes,
		}

		if room.LastMedia != nil {
			state["sharedMedia"] = room.LastMedia
		}

		if client.ID == room.HostID {
			state["voteHistory"] = room.PastVotes
		}

		client.mu.Lock()
		_ = client.Conn.WriteJSON(state)
		client.mu.Unlock()
	}
}

func HandleDashboardSocket(c *ws.Conn) {
	for {
		time.Sleep(2 * time.Second)

		roomLock.Lock()
		var summaries []map[string]interface{}
		for roomID, room := range rooms {
			summary := map[string]interface{}{
				"roomId":           roomID,
				"hostId":           room.HostID,
				"participantCount": len(room.Clients),
			}
			if room.ActiveVote != "" {
				yes, no := 0, 0
				for _, v := range room.CurrentVotes {
					if v == "yes" {
						yes++
					} else if v == "no" {
						no++
					}
				}
				summary["activeVote"] = map[string]interface{}{
					"question": room.ActiveVote,
					"yes":      yes,
					"no":       no,
				}
			}
			summaries = append(summaries, summary)
		}
		roomLock.Unlock()

		err := c.WriteJSON(map[string]interface{}{
			"type":  "dashboard-summary",
			"rooms": summaries,
		})
		if err != nil {
			log.Println("❌ Write error:", err)
			break
		}
	}
}
