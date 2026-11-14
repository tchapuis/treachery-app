# Treachery

Role and identity draw for the [Treachery](https://mtgtreachery.net/) variant of Magic: The Gathering.
Everyone opens the app on their phone, joins the room and marks themselves ready; the host starts the draw.
Each player only receives their own identity; the Leader is revealed to everyone.

## Development

Requirements: Go 1.27, Node 26 (`nvm use`).

```sh
cd web && npm install && npm run build && cd ..   # once: go:embed needs web/dist
go run ./backend                                  # server on :8080
cd web && npm run dev                             # frontend on :5173, proxies /ws and /api to :8080
```

Tests: `go test -race ./...` and `cd web && npm test && npm run typecheck`.

To refresh the cards from mtgtreachery.net: `go run ./tools/fetchcards`.

## CI and Docker image

GitHub Actions (`.github/workflows/ci.yml`) runs the Go and frontend tests on every push and pull request.
On `main`, the image is published to `ghcr.io/tchapuis/treachery-app` (tags `latest` and `sha-…`, plus `X.Y.Z` for a `vX.Y.Z` git tag).

## Deploying to a VPS

Requirements: Docker, a (sub)domain pointing to the VPS, ports 80 and 443 open.
The image is private: create a GitHub token (classic) with only the `read:packages` scope.

```sh
mkdir treachery && cd treachery
# copy docker-compose.yml and Caddyfile from the repo
echo 'DOMAIN=treachery.example.com' > .env
echo <TOKEN> | docker login ghcr.io -u tchapuis --password-stdin
docker compose pull && docker compose up -d
```

Caddy gets the HTTPS certificate automatically. To update: `docker compose pull && docker compose up -d`.
Rooms are saved to `/data/rooms.json` (the `app_data` volume) on every change and restored on startup, so a restart or redeploy does not end games in progress. Set `DATA_FILE` to change the path (default `rooms.json` outside Docker).

## Credits

Identities, texts and artwork: [mtgtreachery.net](https://mtgtreachery.net/). Each illustration belongs to its artist, credited on the card.
Magic: The Gathering © Wizards of the Coast. Unofficial project, private use.

## License

The code is under the [MIT License](LICENSE). It does not cover the card data (`backend/cards.json`) or the card images (`web/public/cards/`): those belong to their owners listed above.
