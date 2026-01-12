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
