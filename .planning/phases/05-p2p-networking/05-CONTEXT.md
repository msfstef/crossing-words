# Phase 5: P2P Networking - Context

**Gathered:** 2026-01-11
**Status:** Ready for research

<vision>
## How This Should Work

Rather than "rooms," collaboration is built around **timelines**. A user is solving their puzzle in their own timeline, and can choose to open it up to others by sharing a link or QR code. The timeline owner controls whether collaboration is enabled or disabled.

When someone joins via link, there's a **gentle handoff** — a brief "connecting..." moment that acknowledges something is happening, then they're in together seeing the same puzzle state.

If collaboration is disabled when someone tries the link, it simply doesn't work — they get a message like "This timeline isn't accepting collaborators."

Connections should **just work offline** — if peers disconnect or go offline, they keep solving locally and the CRDT syncs everything when they reconnect. No fuss, no manual intervention.

Each timeline has a **persistent link** — the same link always works whenever collaboration is enabled. Toggle on, that link works. Toggle off, it doesn't. Simple.

</vision>

<essential>
## What Must Be Nailed

- **Connection reliability** — It just works across NATs, firewalls, mobile networks
- **Low latency sync** — When someone types, others see it instantly
- **Simple setup** — No accounts, minimal server infrastructure, truly peer-to-peer
- **Offline-first** — Keep solving locally, sync catches up when reconnected

All four are equally important — this is the foundation everything else builds on.

</essential>

<boundaries>
## What's Out of Scope

- **Presence & identity** — Cursors, avatars, names, who typed what → Phase 6 (Collaboration)
- **Spectator mode** — Watch-only viewing without persistence → good idea, but defer
- **Session history/persistence** — Reconnecting to past sessions → later concern

This phase is pure plumbing: get peers connected and CRDT state syncing reliably.

</boundaries>

<specifics>
## Specific Ideas

- **Minimal signaling** — Cloudflare Worker (consistent with Phase 3.1's proxy approach)
- **Public TURN servers** — Google's or other free TURN for NAT traversal
- **No hard peer limit** — Let WebRTC mesh handle whatever works
- **Simplicity first** — Get basic P2P working, handle edge cases as needed
- **Playwright tests** — Set up multi-browser-context tests to simulate peers connecting, syncing, disconnecting — improve development feedback loop

</specifics>

<notes>
## Additional Context

**Concern raised:** Signaling infrastructure costs. Keep minimal — Cloudflare Workers free tier should help, but worth being mindful during research.

**Future idea captured:** Spectator mode where invited person can watch but doesn't save the timeline to their device. Not for this phase, but good to keep in mind for Phase 6.

**Development approach:** Prioritize setting up Playwright tests early to validate P2P behavior across multiple simulated peers.

</notes>

---

*Phase: 05-p2p-networking*
*Context gathered: 2026-01-11*
