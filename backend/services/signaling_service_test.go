package services

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestVotingFlow(t *testing.T) {
	// Start a test server
	server := httptest.NewServer(http.HandlerFunc(handleWebSocket))
	defer server.Close()

	// Convert HTTP -> WS
	url := "ws" + server.URL[len("http"):] + "/ws"

	// Dial first client (host)
	hostConn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Host failed to connect: %v", err)
	}
	defer hostConn.Close()

	// Init host
	hostID := "host-123"
	err = hostConn.WriteJSON(map[string]interface{}{
		"type":   "init",
		"userId": hostID,
	})
	if err != nil {
		t.Fatalf("Host failed to send init: %v", err)
	}

	// Wait for init reply
	var initResp map[string]interface{}
	hostConn.ReadJSON(&initResp)

	// Join room
	roomID := "test-room"
	hostConn.WriteJSON(map[string]interface{}{
		"type":   "join",
		"roomId": roomID,
	})

	time.Sleep(100 * time.Millisecond)

	// Create vote
	question := "Do you agree?"
	hostConn.WriteJSON(map[string]interface{}{
		"type":     "create-vote",
		"question": question,
		"userId":   hostID,
	})

	time.Sleep(100 * time.Millisecond)

	// Dial guest
	guestConn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Guest failed to connect: %v", err)
	}
	defer guestConn.Close()

	guestID := "guest-456"
	guestConn.WriteJSON(map[string]interface{}{
		"type":   "init",
		"userId": guestID,
	})
	guestConn.ReadJSON(&initResp)

	guestConn.WriteJSON(map[string]interface{}{
		"type":   "join",
		"roomId": roomID,
	})

	time.Sleep(100 * time.Millisecond)

	// Send vote
	guestConn.WriteJSON(map[string]interface{}{
		"type":   "vote",
		"userId": guestID,
		"value":  "yes",
	})

	time.Sleep(100 * time.Millisecond)

	// Verify server stored vote
	roomLock.Lock()
	defer roomLock.Unlock()

	room, ok := rooms[roomID]
	if !ok {
		t.Fatalf("Room not found")
	}

	if room.ActiveVote != question {
		t.Errorf("Expected active vote %q, got %q", question, room.ActiveVote)
	}

	vote, ok := room.CurrentVotes[guestID]
	if !ok {
		t.Fatalf("No vote found for guest")
	}
	if vote != "yes" {
		t.Errorf("Expected vote 'yes', got %q", vote)
	}
}
