---
phase: 06-collaboration
plan: 06-FIX
type: fix
---

<objective>
Fix 2 UAT issues from Phase 6 Collaboration testing.

Source: 06-ISSUES.md
Priority: 0 critical, 1 major, 1 minor
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/06-collaboration/06-ISSUES.md

**Original plans for reference:**
@.planning/phases/06-collaboration/06-02-PLAN.md
@.planning/phases/06-collaboration/06-04-PLAN.md

**Existing code:**
@src/App.tsx
@src/collaboration/sessionUrl.ts
@src/collaboration/timelineStorage.ts
@src/crdt/puzzleStore.ts
@src/hooks/useCrdtPuzzle.ts
@src/lib/puzzleStorage.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix UAT-001 - Sync puzzle data to recipients via CRDT</name>
  <files>src/crdt/puzzleStore.ts, src/collaboration/puzzleSync.ts, src/hooks/useCrdtPuzzle.ts, src/App.tsx</files>
  <action>
The core issue: When User B clicks a shared link, they don't have the puzzle downloaded. The current system loads the sample puzzle because there's no puzzle data for that puzzleId.

**Solution:** Sync the puzzle metadata via Yjs awareness or a separate Y.Map, so recipients automatically receive the puzzle data when they join a room.

1. Create src/collaboration/puzzleSync.ts:
   - Store puzzle metadata (title, author, width, height, grid, clues) in a Y.Map("puzzle") in the same Y.Doc
   - Export function to set puzzle in the CRDT: setPuzzleInCrdt(doc: Y.Doc, puzzle: Puzzle)
   - Export function to get puzzle from CRDT: getPuzzleFromCrdt(doc: Y.Doc): Puzzle | null
   - Puzzle data syncs automatically via y-webrtc when peers connect

2. Update src/crdt/puzzleStore.ts:
   - Add a Y.Map("puzzle") to store serialized puzzle metadata
   - When store is created and puzzle is loaded, write puzzle to CRDT if not present
   - When store syncs from remote, read puzzle from CRDT if local puzzle is sample/default

3. Update src/hooks/useCrdtPuzzle.ts:
   - Subscribe to puzzle map changes
   - When remote puzzle data arrives and local puzzle is sample, emit event or callback to update App's puzzle state

4. Update src/App.tsx:
   - When joining via shared URL (timelineId from URL):
     - Create puzzle store even without local puzzle (use puzzleId from URL)
     - Wait for CRDT sync to receive puzzle data
     - Once puzzle data arrives via CRDT, set it as the active puzzle
     - Save received puzzle to local storage for future use

**Key insight:** The sharer's puzzle gets serialized into the CRDT. When the recipient connects, Yjs syncs the puzzle data along with the entries. The recipient then has both the puzzle structure and any filled entries.

**Don't forget:**
- Handle case where puzzle already exists locally (compare, prefer remote if joining shared session)
- Show loading state while waiting for puzzle sync
- Store synced puzzle to IndexedDB so it persists after leaving session
  </action>
  <verify>
1. npm run build passes
2. Open app in Window A, download/import a puzzle, share link
3. Open shared link in new incognito Window B
4. Window B should show "Loading puzzle..." briefly then display the shared puzzle
5. Both windows should show same puzzle with synced entries
  </verify>
  <done>Recipients who don't have a puzzle receive it via CRDT when joining shared session</done>
</task>

<task type="auto">
  <name>Task 2: Fix UAT-002 - Add signaling server documentation</name>
  <files>README.md, package.json</files>
  <action>
Update README.md with P2P development instructions:

1. Add a "Development" section if not present
2. Document that P2P collaboration requires a signaling server:
   ```
   ## Development

   ### Running the app
   npm run dev

   ### P2P Collaboration Testing
   P2P collaboration requires a WebRTC signaling server. To test collaboration features:

   1. Start the signaling server:
      npm run signal

   2. Start the app:
      npm run dev

   3. Open http://localhost:5173 in multiple browser windows
   4. Share a link from one window and open in another
   ```

3. Update package.json scripts:
   - Add "signal": "node node_modules/y-webrtc/bin/server.js"
   - This makes it easy to start the signaling server

4. Optionally mention that Playwright tests auto-start the signaling server via playwright.config.ts
  </action>
  <verify>
1. npm run signal starts the signaling server on port 4444
2. README.md includes clear P2P testing instructions
  </verify>
  <done>Clear documentation for running signaling server in dev mode</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Puzzle sync via CRDT and signaling server documentation</what-built>
  <how-to-verify>
    1. Run: npm run signal (in one terminal)
    2. Run: npm run dev (in another terminal)
    3. Window A: Download a puzzle (e.g., NYT or use File picker)
    4. Window A: Fill in a few letters
    5. Window A: Click Share, copy link
    6. Window B (incognito, no local data): Paste shared link
    7. Verify: Window B shows "Connecting..." or similar briefly
    8. Verify: Window B receives the puzzle (same title, grid, clues)
    9. Verify: Window B shows the letters that Window A filled in
    10. Window B: Fill in more letters
    11. Verify: Window A sees Window B's letters
    12. Verify: Both windows show collaborator avatars
  </how-to-verify>
  <resume-signal>Type "approved" if puzzle sync works, or describe issues</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] All critical issues fixed (none)
- [ ] All major issues fixed (UAT-001 puzzle sync)
- [ ] Minor issues fixed (UAT-002 documentation)
- [ ] Original acceptance criteria from issues met
- [ ] npm run build succeeds
- [ ] Playwright tests still pass
</verification>

<success_criteria>
- All UAT issues from 06-ISSUES.md addressed
- Tests pass
- Ready for re-verification
</success_criteria>

<output>
After completion, create `.planning/phases/06-collaboration/06-FIX-SUMMARY.md`
</output>
