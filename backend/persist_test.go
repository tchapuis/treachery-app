package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func persistentServer(t *testing.T, path string) (*Server, *httptest.Server) {
	s := NewServer()
	s.load(path, time.Now())
	srv := httptest.NewServer(routes(s))
	t.Cleanup(srv.Close)
	return s, srv
}

// settle waits for the in-flight message: replies are queued inside handle,
// before save runs under the same lock.
func settle(s *Server) {
	s.mu.Lock()
	s.mu.Unlock()
}

func TestRoomsSurviveRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rooms.json")
	first, before := persistentServer(t, path)
	code, clients, welcomes := setupRoom(t, before)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})
	card := clients[2].waitFor("you", nil)["card"].(map[string]any)["id"]
	settle(first)

	_, after := persistentServer(t, path)
	c := dial(t, after)
	c.send(map[string]any{"type": "resume", "code": code, "token": welcomes[2]["token"]})
	room := c.waitFor("room", nil)
	if room["phase"] != "playing" || len(faceUp(room)) != 1 || len(room["players"].([]any)) != 4 {
		t.Fatalf("restored room = %v", room)
	}
	if got := c.waitFor("you", nil)["card"].(map[string]any)["id"]; got != card {
		t.Fatalf("card after restart = %v, want %v", got, card)
	}
}

func TestRestoredLobbyPlayersGetFullGrace(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rooms.json")
	first, before := persistentServer(t, path)
	code, _, _ := setupRoom(t, before)
	settle(first)

	boot := time.Now().Add(time.Hour) // snapshot is old, reboot happens much later
	s := NewServer()
	s.load(path, boot)
	s.sweep(boot.Add(lobbyGrace - time.Second))
	if len(s.rooms[code].Players) != 4 {
		t.Fatal("players dropped before lobbyGrace after reboot")
	}
	s.sweep(boot.Add(lobbyGrace + time.Second))
	if _, ok := s.rooms[code]; ok {
		t.Fatal("abandoned lobby kept after lobbyGrace")
	}

	reloaded := NewServer()
	reloaded.load(path, time.Now())
	if len(reloaded.rooms) != 0 {
		t.Fatal("sweep did not persist the removed room")
	}
}

// A redeploy mid-game must not turn a face-up identity face down again.
func TestUnveiledIdentitySurvivesRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rooms.json")
	first, before := persistentServer(t, path)
	code, clients, welcomes := setupRoom(t, before)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})

	i := 0
	for j, c := range clients {
		if c.waitFor("you", nil)["role"] != "Leader" {
			i = j
			break
		}
	}
	clients[i].send(map[string]any{"type": "unveil"})
	clients[i].waitFor("room", upCount(2))
	settle(first)

	_, after := persistentServer(t, path)
	c := dial(t, after)
	c.send(map[string]any{"type": "resume", "code": code, "token": welcomes[i]["token"]})

	up := faceUp(c.waitFor("room", nil))
	if len(up) != 2 || up[seatNames[i]] == nil {
		t.Fatalf("face up after the restart: %v, want the Leader and %s", up, seatNames[i])
	}
}

func TestCorruptSnapshotStartsEmpty(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rooms.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	s, srv := persistentServer(t, path)
	if len(s.rooms) != 0 {
		t.Fatalf("got %d rooms from a corrupt file", len(s.rooms))
	}
	setupRoom(t, srv)
	settle(s)
	reloaded := NewServer()
	reloaded.load(path, time.Now())
	if len(reloaded.rooms) != 1 {
		t.Fatal("snapshot not rewritten after a corrupt start")
	}
}
