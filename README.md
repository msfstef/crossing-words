# Crossing Words

A cross-platform, peer-to-peer multiplayer crossword application where people can solve crosswords together simultaneously and collaboratively.

**[Try it now at msfstef.dev/crossing-words](https://msfstef.dev/crossing-words/)**

## Features

- **Real-time collaboration** - Solve puzzles together with friends, seeing each other's inputs instantly
- **Peer-to-peer sync** - No central server storing your data; puzzle state syncs directly between devices
- **Cross-platform** - Works on any device with a modern browser (desktop, tablet, mobile)
- **Offline-capable** - Install as a PWA and solve puzzles offline; changes sync when you reconnect
- **Multiple puzzle sources** - Download puzzles from Universal Crossword, Washington Post, Wall Street Journal, and more

## How It Works

Crossing Words uses WebRTC for peer-to-peer communication, allowing puzzle state to sync directly between collaborators without going through a central server. The app uses CRDTs (Conflict-free Replicated Data Types) via Yjs to handle concurrent edits gracefully.

### Network Considerations

Since the app relies on WebRTC for peer-to-peer connections:

- **Firewalls & VPNs** - Strict corporate firewalls or VPNs may block WebRTC connections, preventing collaboration from working
- **NAT traversal** - The app uses a TURN relay server as fallback, but some network configurations may still cause issues
- **Local-only mode** - If P2P connections fail, you can still solve puzzles locally; they'll sync when connectivity is restored

## Built with Claude Code

This project was built entirely using [Claude Code](https://claude.ai/code), Anthropic's agentic coding tool. From initial scaffolding to feature implementation, bug fixes, and documentation - every line of code was written through conversational AI pair programming.

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
