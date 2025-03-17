package services

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
)

// Track active rooms and users
var rooms = make(map[string]map[string]bool)
var roomLock = sync.Mutex{}

func StartSignalingServer() *socketio.Server {
	server := socketio.NewServer(nil) // ✅ FIX: No options struct

	server.OnConnect("/", func(s socketio.Conn) error {
		log.Println("✅ WebSocket Connected:", s.ID())
		return nil
	})

	server.OnError("/", func(s socketio.Conn, err error) {
		log.Println("❌ WebSocket Error:", err)
	})

	server.OnEvent("/", "join-room", func(s socketio.Conn, room string) {
		s.Join(room)
		roomLock.Lock()
		if rooms[room] == nil {
			rooms[room] = make(map[string]bool)
		}
		rooms[room][s.ID()] = true
		roomLock.Unlock()

		log.Println("🔹 User", s.ID(), "joined room:", room)
		server.BroadcastToRoom("/", room, "user-joined", s.ID())
	})

	server.OnEvent("/", "leave-room", func(s socketio.Conn, room string) {
		LeaveRoom(s, room, server)
	})

	server.OnEvent("/", "close-room", func(s socketio.Conn, room string) {
		CloseRoom(room, server)
	})

	server.OnDisconnect("/", func(s socketio.Conn, reason string) {
		log.Println("🚪 User disconnected:", s.ID(), "| Reason:", reason)
		LeaveRoom(s, "", server)
	})

	go func() {
		if err := server.Serve(); err != nil {
			log.Fatalf("⚠️ Socket.io server failed: %v", err)
		}
	}()
	defer server.Close()

	// ✅ GIN Router
	router := gin.Default()

	// ✅ FIX: **CORS Middleware to prevent 403 errors**
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		// ✅ Fix WebSocket handshake issue
		if c.Request.Header.Get("Upgrade") == "websocket" {
			c.Next()
			return
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// ✅ FIX: **Correct WebSocket Upgrade Handling**
	router.GET("/socket.io/*any", func(c *gin.Context) {
		log.Println("🌍 WebSocket Upgrade Request from:", c.Request.RemoteAddr)
		server.ServeHTTP(c.Writer, c.Request)
	})

	router.POST("/socket.io/*any", gin.WrapH(server))

	// ✅ HTTP API to create a room
	router.POST("/create-room", func(c *gin.Context) {
		var req struct {
			Room string `json:"roomId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		roomLock.Lock()
		if _, exists := rooms[req.Room]; !exists {
			rooms[req.Room] = make(map[string]bool)
			log.Println("✅ Room created:", req.Room)
		} else {
			log.Println("⚠️ Room already exists:", req.Room)
		}
		roomLock.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "Room created"})
	})

	// ✅ HTTP API to close a room
	router.POST("/close-room", func(c *gin.Context) {
		var req struct {
			Room string `json:"roomId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		message, status := CloseRoom(req.Room, server)
		c.JSON(status, gin.H{"message": message})
	})

	log.Println("✅ Signaling server started on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatalf("🚨 HTTP server failed: %v", err)
	}

	return server
}

// ✅ Function to close a room
func CloseRoom(room string, server *socketio.Server) (string, int) {
	roomLock.Lock()
	defer roomLock.Unlock()

	if _, exists := rooms[room]; exists {
		delete(rooms, room)
		server.BroadcastToNamespace("/", "room-closed", room)
		log.Println("✅ Room closed:", room)
		return "Room closed", http.StatusOK
	}

	log.Println("❌ Room not found:", room)
	return "Room not found", http.StatusNotFound
}

// ✅ Function to handle user leaving a room
func LeaveRoom(s socketio.Conn, room string, server *socketio.Server) {
	roomLock.Lock()
	if room == "" {
		for r, users := range rooms {
			if users[s.ID()] {
				room = r
				break
			}
		}
	}
	if rooms[room] != nil {
		delete(rooms[room], s.ID())
		server.BroadcastToRoom("/", room, "user-left", s.ID())

		if len(rooms[room]) == 0 {
			delete(rooms, room)
			log.Println("🔻 Room closed:", room)
			server.BroadcastToNamespace("/", "room-closed", room)
		}
	}
	roomLock.Unlock()
	s.Leave(room)
	log.Println("❌ User left room:", s.ID())
}
