package services

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	Conn   *websocket.Conn
	RoomID string
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
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients  = make(map[string]*Client)
	rooms    = make(map[string]*Room)
	roomLock sync.Mutex
)

func StartSignalingServer(port string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleWebSocket)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		log.Println("✅ WebSocket signaling server running on ws://localhost:" + port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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
		srv.Shutdown(ctx)
	}()
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("❌ Upgrade error:", err)
		return
	}

	_, msgBytes, err := conn.ReadMessage()
	if err != nil {
		log.Println("❌ Failed to read init message:", err)
		conn.Close()
		return
	}

	var initMsg map[string]interface{}
	if err := json.Unmarshal(msgBytes, &initMsg); err != nil {
		log.Println("❌ Invalid JSON in init message:", err)
		conn.Close()
		return
	}

	if initMsg["type"] != "init" {
		log.Println("❌ First message must be 'init'")
		conn.Close()
		return
	}

	providedID, _ := initMsg["userId"].(string)
	clientID := providedID
	if clientID == "" {
		clientID = uuid.New().String()
	}

	client := &Client{ID: clientID, Conn: conn}
	clients[clientID] = client

	log.Println("🔌 Connected:", clientID)

	err = conn.WriteJSON(map[string]interface{}{
		"type":   "init",
		"userId": clientID,
	})
	if err != nil {
		conn.Close()
		return
	}

	defer func() {
		removeClient(client)
		conn.Close()
		log.Println("❌ Disconnected:", clientID)
	}()

	for {
		_, rawMessage, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			continue
		}

		switch msg["type"] {
		case "join":
			roomID, ok := msg["roomId"].(string)
			if ok {
				client.RoomID = roomID
				registerClient(roomID, client)
			}

		case "offer", "answer", "ice-candidate":
			targetID, ok := msg["userId"].(string)
			if ok {
				msg["from"] = client.ID
				forwardMessage(targetID, msg)
			}

		case "leave":
			removeClient(client)

		case "share-media":
			url, ok := msg["url"].(string)
			mediaType, ok2 := msg["mediaType"].(string)
			if ok && ok2 {
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

		case "create-vote":
			question, ok := msg["question"].(string)
			if ok {
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
			userID, ok1 := msg["userId"].(string)
			value, ok2 := msg["value"].(string)
			if ok1 && ok2 {
				roomLock.Lock()
				if room, exists := rooms[client.RoomID]; exists && room.ActiveVote != "" {
					room.CurrentVotes[userID] = value
					broadcastRoomState(client.RoomID)
				}
				roomLock.Unlock()
			}

		case "speaking":
			isSpeaking, ok := msg["isSpeaking"].(bool)
			if ok {
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type":       "speaking",
					"userId":     client.ID,
					"isSpeaking": isSpeaking,
				})
			}
		}
	}
}

func registerClient(roomID string, client *Client) {
	roomLock.Lock()
	defer roomLock.Unlock()

	room, exists := rooms[roomID]
	if !exists {
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
		log.Printf("🔁 Joined room %s: %s", roomID, client.ID)
	}

	room.Clients[client.ID] = client
	broadcastRoomState(roomID)
}

func removeClient(client *Client) {
	roomLock.Lock()
	defer roomLock.Unlock()

	delete(clients, client.ID)

	if room, exists := rooms[client.RoomID]; exists {
		delete(room.Clients, client.ID)

		for _, peer := range room.Clients {
			peer.Conn.WriteJSON(map[string]interface{}{
				"type":   "leave",
				"userId": client.ID,
			})
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

	if client, ok := clients[targetID]; ok {
		client.Conn.WriteJSON(msg)
	}
}

func broadcastMessage(roomID string, msg map[string]interface{}) {
	if room, ok := rooms[roomID]; ok {
		for _, client := range room.Clients {
			client.Conn.WriteJSON(msg)
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

		client.Conn.WriteJSON(state)
	}
}
