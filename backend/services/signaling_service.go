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

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	clients  = make(map[string]*Client)
	rooms    = make(map[string]map[string]*Client)
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

	clientID := uuid.New().String()
	client := &Client{ID: clientID, Conn: conn}
	clients[clientID] = client

	log.Println("🔌 Connected:", clientID)

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
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("📴 Read error from %s: %v", clientID, err)
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
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
			log.Printf("🚪 %s joining room %s", clientID, roomID)
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
			log.Printf("👋 %s is leaving room", clientID)
			removeClient(client)

		default:
			log.Printf("⚠️ Unknown message type from %s: %v", clientID, msg["type"])
		}
	}
}

func registerClient(roomID string, client *Client) {
    roomLock.Lock()
    defer roomLock.Unlock()

    if rooms[roomID] == nil {
        rooms[roomID] = make(map[string]*Client)
    }

    rooms[roomID][client.ID] = client

    // Generate updated participant list
    userList := []string{}
    for _, peer := range rooms[roomID] {
        userList = append(userList, peer.ID)
    }

    // 🔄 Broadcast updated participant list to everyone in the room
    for _, peer := range rooms[roomID] {
        peer.Conn.WriteJSON(map[string]interface{}{
            "type":  "participants",
            "users": userList,
        })
    }

    // 📢 Notify others (if needed) - optional since "participants" now handles it
    for _, peer := range rooms[roomID] {
        if peer.ID != client.ID {
            peer.Conn.WriteJSON(map[string]interface{}{
                "type":   "user-joined",
                "userId": client.ID,
            })
        }
    }
}

func forwardMessage(targetID string, msg map[string]interface{}) {
	if target, ok := clients[targetID]; ok {
		err := target.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("❌ Failed to send to %s: %v", targetID, err)
		}
	}
}

func removeClient(client *Client) {
	roomLock.Lock()
	defer roomLock.Unlock()

	delete(clients, client.ID)

	if client.RoomID != "" {
		if room, ok := rooms[client.RoomID]; ok {
			delete(room, client.ID)
			for _, peer := range room {
				peer.Conn.WriteJSON(map[string]interface{}{
					"type":   "leave",
					"userId": client.ID,
				})
			}
			if len(room) == 0 {
				delete(rooms, client.RoomID)
			}
		}
	}
}
