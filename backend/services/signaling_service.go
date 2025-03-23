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

	clients  = make(map[string]*Client)
	rooms    = make(map[string]*Room)
	roomLastMedia = make(map[string]map[string]interface{})
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

		log.Printf("📨 RAW MESSAGE from %s: %s", clientID, rawMessage)

		var msg map[string]interface{}
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			log.Printf("⚠️ Invalid JSON from %s: %v", clientID, err)
			continue
		}

		log.Printf("📨 Received from %s: %v", clientID, msg)

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
				log.Printf("⚠️ Invalid signaling message from %s: missing userId", clientID)
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
				log.Printf("⚠️ Invalid share-media from %s", clientID)
				break
			}
			broadcastMessage(client.RoomID, map[string]interface{}{
				"type":      "shared-media",
				"userId":    clientID,
				"url":       url,
				"mediaType": mediaType,
			})

	case "create-vote":
		question, ok := msg["question"].(string)
		if !ok {
			log.Printf("⚠️ Invalid create-vote message from %s", clientID)
			break
		}
		roomLock.Lock()
		room, exists := rooms[client.RoomID]
		if exists {
			if room.HostID == client.ID {
				log.Printf("✅ Host %s creating vote in room %s: %s", clientID, client.RoomID, question)
				room.ActiveVote = question
				room.CurrentVotes = make(map[string]string)
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type":     "create-vote",
					"question": question,
				})
			} else {
				log.Printf("⚠️ User %s is not host, cannot create vote", clientID)
			}
		} else {
			log.Printf("⚠️ Room not found for create-vote: %s", client.RoomID)
		}
		roomLock.Unlock()

		case "vote":
			log.Printf("✅ VOTE PAYLOAD: %v", msg)

			value, ok := msg["value"].(string)

			log.Printf("📨 Full vote payload: %+v", msg)

			if !ok {
				log.Printf("⚠️ Invalid vote message from %s: missing value", clientID)
				break
			}
		
			userID, ok := msg["userId"].(string)
			if !ok {
				log.Printf("⚠️ Invalid vote message from %s: missing userId", clientID)
				break
			}
		
			roomLock.Lock()
			room, ok := rooms[client.RoomID]
			if ok && room.ActiveVote != "" {
				log.Printf("✅ Received vote from %s in room %s: %s", userID, client.RoomID, value)
				room.CurrentVotes[userID] = value
				broadcastMessage(client.RoomID, map[string]interface{}{
					"type":   "vote",
					"userId": userID,
					"value":  value,
				})
			} else {
				log.Printf("⚠️ Vote rejected for %s: no active vote in room %s", userID, client.RoomID)
			}
			roomLock.Unlock()

		case "speaking":
			isSpeaking, ok := msg["isSpeaking"].(bool)
			if !ok {
				log.Printf("⚠️ Invalid speaking message from %s", clientID)
				break
			}
			broadcastMessage(client.RoomID, map[string]interface{}{
				"type":       "speaking",
				"userId":     clientID,
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

	userList := []string{}
	for _, peer := range room.Clients {
		userList = append(userList, peer.ID)
	}

	// Send full room state to the newly joined client
	client.Conn.WriteJSON(map[string]interface{}{
		"type":   "participants",
		"users":  userList,
		"hostId": room.HostID,
	})

	// Resend shared media if available
	if mediaMsg, ok := roomLastMedia[roomID]; ok {
		client.Conn.WriteJSON(mediaMsg)
	}

	// Send voting state
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

	// Notify all other users about updated participant list
	for _, peer := range room.Clients {
		if peer.ID != client.ID {
			peer.Conn.WriteJSON(map[string]interface{}{
				"type":   "participants",
				"users":  userList,
				"hostId": room.HostID,
			})
		}
	}
}

func forwardMessage(targetID string, msg map[string]interface{}) {
	roomLock.Lock()
	defer roomLock.Unlock()

	if target, ok := clients[targetID]; ok {
		err := target.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("❌ Failed to send message to %s: %v", targetID, err)
		}
	}
}

func broadcastMessage(roomID string, message map[string]interface{}) {
	roomLock.Lock()
	defer roomLock.Unlock()

	// Save shared media
	if message["type"] == "shared-media" {
		roomLastMedia[roomID] = message
	}

	room, exists := rooms[roomID]
	if !exists {
		return
	}

	for _, client := range room.Clients {
		err := client.Conn.WriteJSON(message)
		if err != nil {
			log.Printf("❌ Failed to broadcast to %s: %v", client.ID, err)
		}
	}
}

func removeClient(client *Client) {
	roomLock.Lock()
	defer roomLock.Unlock()

	delete(clients, client.ID)

	if client.RoomID != "" {
		if room, ok := rooms[client.RoomID]; ok {
			delete(room.Clients, client.ID)

			for _, peer := range room.Clients {
				peer.Conn.WriteJSON(map[string]interface{}{
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
