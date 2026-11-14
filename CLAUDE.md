# Treachery app

Real-time role and identity draw for the MTG Treachery variant, for a group of friends playing around one table, each on their phone.

## Stack and versions
- Backend: Go 1.27, `main` package in `backend/` (`main.go`, `room.go`, `draw.go`, `persist.go`, `cards.json`, tests). Only dependency: `github.com/coder/websocket`.
- `go.mod` and `embed.go` (package `treachery`, exposes `Web`) stay at the root: `go:embed` cannot reach `../web/dist` from `backend/`.
- Frontend: React 19 + Vite 8 + TypeScript 7 in `web/`, built into `web/dist` and embedded with `go:embed`.
- Always target the latest stable versions (check online, not from memory).

## Rules
- Identity secrecy: a broadcast carries a player's card **if and only if** that player is unveiled (`Player.Unveiled`); the Leader is unveiled at the draw. A face-down identity only ever reaches its owner, through the `you` message. `TestGameFlowKeepsIdentitiesSecret` enforces it. Unveiling is self-service (the message carries no target), one-way and idempotent.
- `playerView` and `savedPlayer` are built with named fields on purpose: a positional literal would silently move a card to another seat the next time a field is added.
- No hardcoded UI text: everything goes through `web/src/i18n.ts` (`en` is the reference, `fr` is typed `Record<Key, string>` so it must be complete). The server only sends error codes (`appError{Code, Params}`), translated client-side via `error_<code>`; `TestEveryErrorCodeIsTranslated` enforces it.
- Cards and the role distribution live only in Go (`cards.json`, `distribution` in `draw.go`); the client reads them from `GET /api/catalog` (rules page, card gallery). Don't copy them into TS.
- The WebSocket message format is duplicated: Go structs in `room.go`, TS types in `web/src/types.ts`. Change both.
- Logs use `log/slog` (one line per handled message via `client.logAttrs`, plus one `dealt` line per player at start). They include tokens, roles and cards on purpose (owner's choice, friends-only app): log access is game-spoiling and lets anyone take a seat.
- Host-only actions (`start`, `reset`, `kick`, `transferHost`) are checked in `handle`, never trusted from the client. A kicked client keeps its socket but is detached and gets `{type:"kicked"}`.
- One global mutex guards all state; `handle` runs under that lock and is followed by `save()`.
- Rooms survive restarts via a JSON snapshot (`persist.go`, `DATA_FILE`). Snapshot types (`savedRoom`, `savedPlayer`) hold tokens and cards: never send them to clients. New `Player`/`Room` fields must be added to the snapshot too.
- `web/dist/.gitkeep` is committed and Vite uses `emptyOutDir: false`, so `go build` works on a fresh clone.
- Card images are English (`web/public/cards/<id>.jpg`): French ones are only published on Google Drive.
- Design docs under `docs/superpowers/` are local only (git-ignored).

## Commands
- `go test -race ./...`
- `cd web && npm test` (Vitest + jsdom; `FakeSocket` in `web/src/test/` drives the WebSocket)
- `cd web && npm run build` / `npm run dev` / `npm run typecheck`
- `go run ./backend`: server on :8080 (needs `web/dist` built once)
- `go run ./tools/fetchcards`: regenerates `backend/cards.json` and the images
- CI (`.github/workflows/ci.yml`) tests every push/PR and publishes `ghcr.io/tchapuis/treachery-app` from `main`
