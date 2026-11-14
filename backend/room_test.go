package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type testClient struct {
	t    *testing.T
	conn *websocket.Conn
	msgs []map[string]any
}

func dial(t *testing.T, srv *httptest.Server) *testClient {
	t.Helper()
	conn, _, err := websocket.Dial(context.Background(), "ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return &testClient{t: t, conn: conn}
}

func (c *testClient) send(v map[string]any) {
	b, _ := json.Marshal(v)
	if err := c.conn.Write(context.Background(), websocket.MessageText, b); err != nil {
		c.t.Fatal(err)
	}
}

// waitFor reads messages until one matches type and pred; every message read is kept in c.msgs.
func (c *testClient) waitFor(typ string, pred func(map[string]any) bool) map[string]any {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	for {
		_, b, err := c.conn.Read(ctx)
		if err != nil {
			c.t.Fatalf("waiting for %s: %v", typ, err)
		}
		var m map[string]any
		json.Unmarshal(b, &m)
		c.msgs = append(c.msgs, m)
		if m["type"] == typ && (pred == nil || pred(m)) {
			return m
		}
	}
}

func playersReady(n int) func(map[string]any) bool {
	return func(m map[string]any) bool {
		ps, _ := m["players"].([]any)
		ready := 0
		for _, p := range ps {
			if p.(map[string]any)["ready"] == true {
				ready++
			}
		}
		return ready == n
	}
}

func setupRoom(t *testing.T, srv *httptest.Server) (string, []*testClient, []map[string]any) {
	host := dial(t, srv)
	host.send(map[string]any{"type": "create", "nickname": "Alice", "playerCount": 4, "rarities": []string{"U", "R", "M"}})
	w := host.waitFor("welcome", nil)
	code := w["code"].(string)
	clients := []*testClient{host}
	welcomes := []map[string]any{w}
	for _, name := range []string{"Bob", "Chloé", "Dan"} {
		c := dial(t, srv)
		c.send(map[string]any{"type": "join", "code": strings.ToLower(code), "nickname": name})
		welcomes = append(welcomes, c.waitFor("welcome", nil))
		clients = append(clients, c)
	}
	return code, clients, welcomes
}

func TestGameFlowKeepsIdentitiesSecret(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	_, clients, _ := setupRoom(t, srv)
	host := clients[0]

	for _, c := range clients[:3] {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	host.waitFor("room", playersReady(3))
	host.send(map[string]any{"type": "start"})
	if e := host.waitFor("error", nil); errCode(e) != "notAllReady" {
		t.Fatalf("start with a player not ready: %v", e)
	}

	clients[3].send(map[string]any{"type": "ready", "value": true})
	host.waitFor("room", playersReady(4))
	host.send(map[string]any{"type": "start"})

	seen := map[float64]bool{}
	for _, c := range clients {
		you := c.waitFor("you", nil)
		card := you["card"].(map[string]any)
		id := card["id"].(float64)
		if seen[id] {
			t.Fatalf("card %v dealt twice", id)
		}
		seen[id] = true
		var leader float64
		for _, m := range c.msgs {
			if m["type"] == "room" && m["phase"] == "playing" {
				up := faceUp(m)
				if len(up) != 1 {
					t.Fatalf("%d face-up identities at the start of a game, want 1 (the Leader)", len(up))
				}
				for name, card := range up {
					if card["role"] != "Leader" {
						t.Fatalf("%s is face up with a %v identity at the start", name, card["role"])
					}
					leader = card["id"].(float64)
				}
			}
		}
		if leader == 0 {
			t.Fatal("no playing room with a face-up Leader received")
		}

		for _, m := range c.msgs {
			if m["type"] == "you" {
				continue
			}
			b, _ := json.Marshal(m)
			for _, other := range allCards {
				if float64(other.ID) != id && float64(other.ID) != leader && strings.Contains(string(b), `"name":"`+other.Name+`"`) {
					t.Fatalf("message leaks identity %s: %s", other.Name, b)
				}
			}
		}
	}
}

func TestResumeReturnsSameCard(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	code, clients, welcomes := setupRoom(t, srv)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})
	before := clients[1].waitFor("you", nil)["card"].(map[string]any)["id"]

	clients[1].conn.CloseNow()
	again := dial(t, srv)
	again.send(map[string]any{"type": "resume", "code": code, "token": welcomes[1]["token"]})
	after := again.waitFor("you", nil)["card"].(map[string]any)["id"]
	if before != after {
		t.Fatalf("resume gave card %v, want %v", after, before)
	}

	bad := dial(t, srv)
	bad.send(map[string]any{"type": "resume", "code": code, "token": "nope"})
	if e := bad.waitFor("error", nil); errCode(e) != "seatNotFound" {
		t.Fatalf("got %v", e)
	}
}

func TestJoinRejectsFullRoom(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	code, _, _ := setupRoom(t, srv)
	late := dial(t, srv)
	late.send(map[string]any{"type": "join", "code": code, "nickname": "Eve"})
	if e := late.waitFor("error", nil); errCode(e) != "roomFull" {
		t.Fatalf("got %v", e)
	}
}

func TestCreateRejectsImpossibleSettings(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	c := dial(t, srv)
	c.send(map[string]any{"type": "create", "nickname": "Alice", "playerCount": 8, "rarities": []string{"S"}})
	e := c.waitFor("error", nil)["error"].(map[string]any)
	if e["code"] != "notEnoughIdentities" || e["params"].(map[string]any)["role"] != "Leader" {
		t.Fatalf("got %v", e)
	}
}

func errCode(m map[string]any) any { return m["error"].(map[string]any)["code"] }

// faceUp returns the identities a room broadcast carries, keyed by player name.
func faceUp(m map[string]any) map[string]map[string]any {
	out := map[string]map[string]any{}
	for _, p := range m["players"].([]any) {
		pm := p.(map[string]any)
		if card, ok := pm["card"].(map[string]any); ok {
			out[pm["name"].(string)] = card
		}
	}
	return out
}

func upCount(n int) func(map[string]any) bool {
	return func(m map[string]any) bool { return len(faceUp(m)) == n }
}

// playGame sets a room up, readies everyone and starts the draw.
// It returns the clients and the role each one was dealt, in seat order.
func playGame(t *testing.T, srv *httptest.Server) ([]*testClient, []string) {
	t.Helper()
	_, clients, _ := setupRoom(t, srv)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})
	roles := make([]string, len(clients))
	for i, c := range clients {
		roles[i] = c.waitFor("you", nil)["role"].(string)
	}
	return clients, roles
}

// seatNames mirrors the order setupRoom seats the players in.
var seatNames = []string{"Alice", "Bob", "Chloé", "Dan"}

// hiddenSeats returns the seats that were not dealt the Leader, so still face down.
func hiddenSeats(t *testing.T, roles []string) []int {
	t.Helper()
	var seats []int
	for i, r := range roles {
		if r != "Leader" {
			seats = append(seats, i)
		}
	}
	if len(seats) < 2 {
		t.Fatalf("roles %v: want at least two seats without the Leader", roles)
	}
	return seats
}

func TestUnveilShowsTheCardToEveryone(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	clients, roles := playGame(t, srv)
	i := hiddenSeats(t, roles)[0]

	clients[i].send(map[string]any{"type": "unveil"})

	for _, c := range clients {
		up := faceUp(c.waitFor("room", upCount(2)))
		card, ok := up[seatNames[i]]
		if !ok {
			t.Fatalf("%s unveiled but their card is missing from the broadcast: %v", seatNames[i], up)
		}
		if card["role"] != roles[i] {
			t.Fatalf("%s is face up as %v, want %v", seatNames[i], card["role"], roles[i])
		}
	}
}

func TestUnveilIsIgnoredInLobby(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	_, clients, _ := setupRoom(t, srv)

	clients[1].send(map[string]any{"type": "unveil"})
	clients[1].send(map[string]any{"type": "ready", "value": true})

	m := clients[1].waitFor("room", playersReady(1))
	if up := faceUp(m); len(up) != 0 {
		t.Fatalf("unveil in the lobby put %v face up", up)
	}
}

func TestUnveilIsOneWayAndIdempotent(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	clients, roles := playGame(t, srv)
	seats := hiddenSeats(t, roles)
	i, j := seats[0], seats[1]

	clients[i].send(map[string]any{"type": "unveil"})
	clients[i].waitFor("room", upCount(2))
	clients[i].send(map[string]any{"type": "unveil"}) // repeat: must neither hide it nor duplicate it
	clients[j].send(map[string]any{"type": "unveil"})

	up := faceUp(clients[0].waitFor("room", upCount(3)))
	if card := up[seatNames[i]]; card == nil || card["role"] != roles[i] {
		t.Fatalf("after a repeated unveil, %s is %v, want %v", seatNames[i], card, roles[i])
	}
}

func TestNewGameHidesIdentitiesAgain(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	clients, roles := playGame(t, srv)
	i := hiddenSeats(t, roles)[0]
	clients[i].send(map[string]any{"type": "unveil"})
	clients[0].waitFor("room", upCount(2))

	clients[0].send(map[string]any{"type": "reset"})

	m := clients[i].waitFor("room", func(m map[string]any) bool { return m["phase"] == "lobby" })
	if up := faceUp(m); len(up) != 0 {
		t.Fatalf("new game left %v face up", up)
	}
}

func TestSweepKeepsBrieflyAwayPlayers(t *testing.T) {
	s := NewServer()
	now := time.Now()
	host, away, gone := newPlayer("Alice"), newPlayer("Bob"), newPlayer("Chloé")
	host.client = &client{send: make(chan []byte, 32)}
	away.leftAt = now.Add(-time.Minute)
	gone.leftAt = now.Add(-lobbyGrace - time.Second)
	s.rooms["ABCD"] = &Room{Code: "ABCD", Phase: "lobby", HostID: host.ID, Players: []*Player{host, away, gone}, touched: now}

	s.sweep(now)
	if got := len(s.rooms["ABCD"].Players); got != 2 {
		t.Fatalf("got %d players, want 2 (only the one away past lobbyGrace removed)", got)
	}
	if lobbyGrace < 5*time.Minute {
		t.Fatalf("lobbyGrace = %v: locked phones on the table must not lose their seat", lobbyGrace)
	}
}
