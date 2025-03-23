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

type Room struct {
	Clients      map[string]*Client
	HostID       string
	ActiveVote   string
	CurrentVotes map[string]string
}

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients       = make(map[string]*Client)
	rooms         = make(map[string]*Room)
	roomLastMedia = make(map[string]map[string]interface{})
	roomLock      sync.Mutex
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
	log.Println("✅ Initialized client ID:", clientID)

	err = conn.WriteJSON(map[string]interface{}{
		"type":   "init",
		"userId": clientID,
	})
	if err != nil {
		log.Printf("❌ Failed to send init to %s: %v", clientID, err)
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
			log.Printf("📴 Read error from %s: %v", clientID, err)
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			log.Printf("⚠️ Invalid JSON from %s: %v", clientID, err)
			continue
		}

		switch msg["type"] {
		case "join":
			roomID, ok := msg["roomId"].(string)
			if !ok || roomID == "" {
				log.Printf("⚠️ Invalid join from %s: missing roomId", clientID)
				break
			}
			client.RoomID = roomID
			registerClient(roomID, client)

		case "offer", "answer", "ice-candidate":
			targetID, ok := msg["userId"].(string)
			if !ok {
				break
			}
			msg["from"] = client.ID
			forwardMessage(targetID, msg)

		case "leave":
			removeClient(client)

		case "share-media":
			url, ok := msg["url"].(string)
			mediaType, okType := msg["mediaType"].(string)
			if !ok || !okType {
				break
			}
			broadcastMessage(client.RoomID, map[string]interface{}{
				"type":      "shared-media",
				"userId":    client.ID,
				"url":       url,
				"mediaType": mediaType,
			})

		case "create-vote":
			question, ok := msg["question"].(string)
			if !ok {
				break
			}
			roomLock.Lock()
			room, exists := rooms[client.RoomID]
			if exists && room.HostID == client.ID {
				room.ActiveVote = question
				room.CurrentVotes = make(map[string]string)
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type":     "create-vote",
					"question": question,
				})
			}
			roomLock.Unlock()

		case "end-vote":
			roomLock.Lock()
			room, ok := rooms[client.RoomID]
			if ok && room.HostID == client.ID && room.ActiveVote != "" {
				log.Printf("🛑 Ending vote in room %s by host %s", client.RoomID, client.ID)
				room.ActiveVote = ""
				room.CurrentVotes = make(map[string]string)
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type": "end-vote",
				})
			} else {
				log.Printf("⚠️ Unauthorized or invalid end-vote from %s", client.ID)
			}
			roomLock.Unlock()

		case "vote":
			value, ok := msg["value"].(string)
			userID, okID := msg["userId"].(string)
			if !ok || !okID {
				break
			}
			roomLock.Lock()
			room, ok := rooms[client.RoomID]
			if ok && room.ActiveVote != "" {
				room.CurrentVotes[userID] = value
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type":   "vote",
					"userId": userID,
					"value":  value,
				})
			}
			roomLock.Unlock()

		case "speaking":
			isSpeaking, ok := msg["isSpeaking"].(bool)
			if !ok {
				break
			}
			broadcastMessage(client.RoomID, map[string]interface{}{
				"type":       "speaking",
				"userId":     client.ID,
				"isSpeaking": isSpeaking,
			})

		default:
			log.Printf("⚠️ Unknown message type from %s: %v", clientID, msg["type"])
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
		}
		rooms[roomID] = room
	}

	room.Clients[client.ID] = client

	// REBUILD full user list and broadcast it to ALL clients
	userList := []string{}
	for _, peer := range room.Clients {
		userList = append(userList, peer.ID)
	}

	for _, peer := range room.Clients {
		peer.Conn.WriteJSON(map[string]interface{}{
			"type":   "participants",
			"users":  userList,
			"hostId": room.HostID,
		})
	}

	// Also re-send shared media and vote state to rejoining client
	if mediaMsg, ok := roomLastMedia[roomID]; ok {
		client.Conn.WriteJSON(mediaMsg)
	}

	if room.ActiveVote != "" {
		client.Conn.WriteJSON(map[string]interface{}{
			"type":     "create-vote",
			"question": room.ActiveVote,
		})
		for userId, value := range room.CurrentVotes {
			client.Conn.WriteJSON(map[string]interface{}{
				"type":   "vote",
				"userId": userId,
				"value":  value,
			})
		}
	}
}

func forwardMessage(targetID string, msg map[string]interface{}) {
	roomLock.Lock()
	defer roomLock.Unlock()

	if target, ok := clients[targetID]; ok {
		_ = target.Conn.WriteJSON(msg)
	}
}

func broadcastMessage(roomID string, message map[string]interface{}) {
	roomLock.Lock()
	defer roomLock.Unlock()

	if message["type"] == "shared-media" {
		roomLastMedia[roomID] = message
	}

	room, exists := rooms[roomID]
	if !exists {
		return
	}

	for _, client := range room.Clients {
		_ = client.Conn.WriteJSON(message)
	}
}

func removeClient(client *Client) {
	roomLock.Lock()
	defer roomLock.Unlock()

	delete(clients, client.ID)

	if client.RoomID != "" {
		if room, ok := rooms[client.RoomID]; ok {
			delete(room.Clients, client.ID)

			userList := []string{}
			for _, c := range room.Clients {
				userList = append(userList, c.ID)
			}

			// Broadcast updated participant list to everyone
			for _, peer := range room.Clients {
				_ = peer.Conn.WriteJSON(map[string]interface{}{
					"type":   "participants",
					"users":  userList,
					"hostId": room.HostID,
				})
			}

			// Notify others that the user left
			for _, peer := range room.Clients {
				_ = peer.Conn.WriteJSON(map[string]interface{}{
					"type":   "leave",
					"userId": client.ID,
				})
			}

			if len(room.Clients) == 0 {
				delete(rooms, client.RoomID)
			}
		}
	}
}
