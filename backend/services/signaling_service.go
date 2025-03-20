package services

import (
	"log"
	"net/http"
	"sync"

	socketio "github.com/googollee/go-socket.io"
)

var rooms = make(map[string]map[string]bool)
var roomLock = sync.Mutex{}

func StartSignalingServer(port string, server *socketio.Server) {
    server.OnConnect("/", func(s socketio.Conn) error {
        log.Println("WebSocket Connected:", s.ID())
        return nil
    })

    server.OnError("/", func(s socketio.Conn, err error) {
        log.Println("WebSocket Error:", err)
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

    http.Handle("/socket.io/", server)
    log.Printf("✅ Signaling server started on :%s", port)
    if err := http.ListenAndServe(":"+port, nil); err != nil {
        log.Fatalf("🚨 HTTP server failed: %v", err)
    }
}

func CreateRoom(roomID string, server *socketio.Server) (string, int) {
    roomLock.Lock()
    defer roomLock.Unlock()

    if _, exists := rooms[roomID]; exists {
        log.Println("⚠️ Room already exists:", roomID)
        return "Room already exists", http.StatusConflict
    }

    rooms[roomID] = make(map[string]bool)
    log.Println("✅ Room created:", roomID)
    return "Room created", http.StatusOK
}

func CloseRoom(roomID string, server *socketio.Server) (string, int) {
    roomLock.Lock()
    defer roomLock.Unlock()

    if _, exists := rooms[roomID]; exists {
        delete(rooms, roomID)
        server.BroadcastToNamespace("/", "room-closed", roomID)
        log.Println("Room closed:", roomID)
        return "Room closed", http.StatusOK
    }

    log.Println("Room not found:", roomID)
    return "Room not found", http.StatusNotFound
}

func LeaveRoom(s socketio.Conn, roomID string, server *socketio.Server) {
    roomLock.Lock()
    defer roomLock.Unlock()

    if roomID == "" {
        for r, users := range rooms {
            if users[s.ID()] {
                roomID = r
                break
            }
        }
    }

    if rooms[roomID] != nil {
        delete(rooms[roomID], s.ID())
        server.BroadcastToRoom("/", roomID, "user-left", s.ID())

        if len(rooms[roomID]) == 0 {
            delete(rooms, roomID)
            log.Println("Room closed:", roomID)
            server.BroadcastToNamespace("/", "room-closed", roomID)
        }
    }

    s.Leave(roomID)
    log.Println("User left room:", s.ID())
}