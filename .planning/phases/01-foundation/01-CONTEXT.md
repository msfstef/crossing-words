# Phase 1: Foundation - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

A minimal shell to start building on. Just enough structure to write the first feature — Vite + TypeScript + React, nothing more. The app runs, hot reloads, and is ready to become a PWA.

No over-engineering upfront. Add tools and complexity as the project demands them, not because "we might need them later."

</vision>

<essential>
## What Must Be Nailed

- **Clean project structure** - Folders and conventions that won't need reorganizing later
- **Fast dev experience** - Hot reload, quick builds, minimal friction when iterating
- **PWA basics** - Service worker and manifest ready, installable from day one

All three matter equally. A solid foundation across the board.

</essential>

<boundaries>
## What's Out of Scope

- Complex state management (add it when multiplayer arrives)
- Routing (single-screen app initially)
- UI component libraries (build what's needed)
- CI/CD pipelines (deploy manually for now)

Scope is flexible — include what makes sense for a clean minimal start, defer what doesn't.

</boundaries>

<specifics>
## Specific Ideas

- React as the framework (mature ecosystem, good for this use case)
- Vite for builds (fast, modern, good PWA plugin support)
- TypeScript (obviously)

No specific requirements beyond that — open to standard approaches.

</specifics>

<notes>
## Additional Context

No additional notes

</notes>

---

*Phase: 01-foundation*
*Context gathered: 2026-01-11*
