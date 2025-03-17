package services

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
	"github.com/rs/cors"
)

// Track active rooms and users
var rooms = make(map[string]map[string]bool)
var roomLock = sync.Mutex{}

// WebRTC Signaling Server
func StartSignalingServer() {
	server := socketio.NewServer(nil)

	server.OnConnect("/", func(s socketio.Conn) error {
		log.Println("New user connected:", s.ID())
		return nil
	})

	server.OnEvent("/", "join-room", func(s socketio.Conn, room string) {
		s.Join(room)

		// Track user in room
		roomLock.Lock()
		if rooms[room] == nil {
			rooms[room] = make(map[string]bool)
		}
		rooms[room][s.ID()] = true
		roomLock.Unlock()

		log.Println("User", s.ID(), "joined room:", room)
		server.BroadcastToRoom("/", room, "user-joined", s.ID())
	})

	server.OnEvent("/", "offer", func(s socketio.Conn, data map[string]string) {
		server.BroadcastToRoom("/", data["room"], "offer", data)
	})

	server.OnEvent("/", "answer", func(s socketio.Conn, data map[string]string) {
		server.BroadcastToRoom("/", data["room"], "answer", data)
	})

	server.OnEvent("/", "ice-candidate", func(s socketio.Conn, data map[string]string) {
		server.BroadcastToRoom("/", data["room"], "ice-candidate", data)
	})

	// Handle disconnection and cleanup
	server.OnDisconnect("/", func(s socketio.Conn, reason string) {
		log.Println("User disconnected:", s.ID(), "Reason:", reason)

		roomLock.Lock()
		for room, users := range rooms {
			if users[s.ID()] {
				delete(users, s.ID())
				server.BroadcastToRoom("/", room, "user-left", s.ID())
				log.Println("User", s.ID(), "left room:", room)

				// If room is empty, delete it
				if len(users) == 0 {
					delete(rooms, room)
					log.Println("Room closed:", room)
				}
				break
			}
		}
		roomLock.Unlock()
	})

	go server.Serve()
	defer server.Close()

	// Set up HTTP server for WebSocket connection
	router := gin.Default()
	router.GET("/socket.io/*any", gin.WrapH(server))
	router.POST("/socket.io/*any", gin.WrapH(server))

	// Enable CORS
	handler := cors.AllowAll().Handler(router)

	log.Println("Signaling server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
