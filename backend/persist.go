package main

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"time"
)

// Snapshot types are separate from Player/Room on purpose: they hold tokens and
// cards, so they must never be reused for anything sent to clients.
type savedPlayer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Token    string `json:"token"`
	Ready    bool   `json:"ready"`
	Unveiled bool   `json:"unveiled,omitempty"`
	Card     *Card  `json:"card,omitempty"`
}

type savedRoom struct {
	Code     string        `json:"code"`
	Phase    string        `json:"phase"`
	HostID   string        `json:"hostId"`
	Settings Settings      `json:"settings"`
	Players  []savedPlayer `json:"players"`
	Touched  time.Time     `json:"touched"`
}

// load restores rooms from path and enables saving to it. A missing file is a
// fresh start; a corrupt one is logged and ignored rather than blocking boot.
func (s *Server) load(path string, now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.file = path
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return
	}
	var saved []savedRoom
	if err == nil {
		err = json.Unmarshal(data, &saved)
	}
	if err != nil {
		slog.Error("ignoring room snapshot", "file", path, "error", err)
		return
	}
	for _, sr := range saved {
		room := &Room{Code: sr.Code, Phase: sr.Phase, HostID: sr.HostID, Settings: sr.Settings, touched: sr.Touched}
		for _, sp := range sr.Players {
			// everyone is disconnected after a reboot: give them the full lobby grace from now
			// a Leader is face up by the rules, which also upgrades snapshots written before Unveiled existed
			unveiled := sp.Unveiled || (sp.Card != nil && sp.Card.Role == "Leader")
			room.Players = append(room.Players, &Player{ID: sp.ID, Name: sp.Name, token: sp.Token, Ready: sp.Ready, Unveiled: unveiled, card: sp.Card, leftAt: now})
		}
		s.rooms[room.Code] = room
	}
	slog.Info("rooms restored", "count", len(saved), "file", path)
}

// save must be called with s.mu held.
// ponytail: rewrites the whole file under the global lock on every change, fine for a few rooms.
func (s *Server) save() {
	if s.file == "" {
		return
	}
	saved := make([]savedRoom, 0, len(s.rooms))
	for _, r := range s.rooms {
		sr := savedRoom{Code: r.Code, Phase: r.Phase, HostID: r.HostID, Settings: r.Settings, Touched: r.touched}
		for _, p := range r.Players {
			sr.Players = append(sr.Players, savedPlayer{ID: p.ID, Name: p.Name, Token: p.token, Ready: p.Ready, Unveiled: p.Unveiled, Card: p.card})
		}
		saved = append(saved, sr)
	}
	data, _ := json.Marshal(saved)
	// write then rename so a crash mid-write never leaves a truncated snapshot
	tmp := s.file + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		slog.Error("saving rooms failed", "error", err)
		return
	}
	if err := os.Rename(tmp, s.file); err != nil {
		slog.Error("saving rooms failed", "error", err)
	}
}
