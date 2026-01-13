# Crossing Words

A cross-platform, peer-to-peer multiplayer crossword application where people can solve crosswords together simultaneously and collaboratively.

## Goals

- **Cross-platform**: Run on web, desktop, and mobile
- **Peer-to-peer**: No central server required for gameplay
- **Real-time collaboration**: Multiple players solving the same puzzle simultaneously
- **Collaborative**: Work together to complete crosswords as a team

## Development

### Prerequisites

- Node.js 18+
- npm

### Running the app

```bash
npm install
npm run dev
```

### P2P Collaboration Testing

P2P collaboration requires a WebRTC signaling server for peers to discover each other. In development, use the bundled y-webrtc signaling server.

1. Start the signaling server (in one terminal):
   ```bash
   npm run signal
   ```

2. Start the app (in another terminal):
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 in multiple browser windows

4. In one window, click **Share** and copy the link

5. Paste the link in another window to join the session

Both windows should now show connected collaborators and sync entries in real-time.

### Running Tests

```bash
# Run all Playwright tests (auto-starts signaling server)
npx playwright test

# Run collaboration-specific tests
npx playwright test e2e/collaboration.spec.ts
```

Note: Playwright tests automatically start the signaling server via `playwright.config.ts`.

## Deployment

The app consists of two components that need to be deployed:

### 1. Frontend (GitHub Pages)

The frontend is automatically deployed to GitHub Pages when changes are pushed to `main`.

- **URL**: `https://msfstef.dev/crossing-words/`
- **Workflow**: `.github/workflows/deploy.yml`

### 2. Proxy/Signaling Server (Cloudflare Workers)

The Cloudflare Worker provides:
- WebRTC signaling server for peer-to-peer collaboration
- CORS proxy for fetching puzzles

**Important**: The proxy MUST be deployed for peer-to-peer collaboration to work in production.

#### Required GitHub Secrets

Set these in your GitHub repository settings:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers Deploy permission
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

#### Manual Deployment

```bash
cd proxy
npm install
wrangler deploy
```

See [`proxy/README.md`](./proxy/README.md) for detailed deployment instructions.
