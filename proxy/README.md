# Crossing Words Proxy

Cloudflare Worker providing CORS proxy and WebRTC signaling server for peer-to-peer collaboration.

## Features

- **WebRTC Signaling Server**: Durable Object-based signaling for y-webrtc
- **Puzzle Proxy**: CORS proxy for fetching crossword puzzles from external sources

## Deployment

### Prerequisites

1. Cloudflare account
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Authenticated with Wrangler (`wrangler login`)

### Manual Deployment

```bash
cd proxy
npm install
wrangler deploy
```

### GitHub Actions Deployment

The proxy is automatically deployed when changes are pushed to the `main` branch.

Required GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`: API token with Workers Deploy permission
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in wrangler.toml)

To set up:
1. Go to Cloudflare Dashboard → Profile → API Tokens
2. Create token with "Edit Cloudflare Workers" template
3. Add token as `CLOUDFLARE_API_TOKEN` in GitHub repo settings → Secrets
4. Add account ID as `CLOUDFLARE_ACCOUNT_ID`

## Architecture

### Signaling Server

The signaling server uses Cloudflare Durable Objects for WebSocket connections:

- **Endpoint**: `wss://crossing-words-proxy.msfstef.workers.dev/signaling`
- **Protocol**: y-webrtc signaling protocol
- **Hibernation API**: Cost-efficient - only billed during message processing

### Puzzle Proxy

Fetches puzzles from external sources with CORS headers:

- **Endpoint**: `POST /puzzle`
- **Body**: `{ "source": "universal", "date": "2024-01-15" }`

## Development

Local testing with Wrangler:

```bash
cd proxy
npm install
wrangler dev
```

This starts the proxy at `http://localhost:8787`.

To test locally with the frontend:

1. Start the proxy: `cd proxy && wrangler dev`
2. Set env var: `VITE_SIGNALING_SERVER=ws://localhost:8787/signaling`
3. Start frontend: `npm run dev`

## Configuration

See `wrangler.toml` for configuration.
