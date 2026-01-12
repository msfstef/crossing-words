# UAT Issues: Phase 9 Plan 01

**Tested:** 2026-01-12
**Source:** .planning/phases/09-ui-refinements/09-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: FAB and options have unequal edge distances

**Discovered:** 2026-01-12
**Resolved:** 2026-01-12
**Phase/Plan:** 09-01
**Severity:** Minor
**Feature:** FAB position and layout
**Description:** FAB button has unequal distance from bottom and right edges. The expanded options (Download/Import buttons) are centered above the FAB but are wider, making the overall alignment look off.
**Expected:** FAB and options should be right-aligned with equal margins from screen edge
**Actual:** Unequal distances, likely because options are centered above FAB
**Fix applied:** Changed `.fab` from `align-items: center` to `align-items: flex-end` so options right-align with FAB button edge.

### UAT-002: PuzzleCard layout doesn't match LoadingCard layout

**Discovered:** 2026-01-12
**Resolved:** 2026-01-12
**Phase/Plan:** 09-01
**Severity:** Minor
**Feature:** Optimistic UI ghost→real transition
**Description:** LoadingCard shows source name prominently with subtitle, but PuzzleCard shows different layout (title + progress bar). This causes visual jarring when ghost entry transitions to real card.
**Expected:** Smooth transition where card layout stays consistent
**Actual:** Layout jumps/changes during transition
**Fix applied:** Added consistent `min-width: 32px` to both progress areas, added spacer element to LoadingCard matching PuzzleCard's delete button width for identical card widths.

### UAT-003: Header alignment issues at 390px mobile viewport

**Discovered:** 2026-01-12
**Resolved:** 2026-01-12
**Phase/Plan:** 09-01
**Severity:** Minor
**Feature:** Mobile header layout
**Description:** At 390px viewport width, the gear/settings icon is no longer aligned with the title, and there's too much vertical space in the header.
**Expected:** Compact header with title and gear icon properly aligned
**Actual:** Gear icon misaligned, excess vertical padding
**Fix applied:** Removed `flex-wrap: wrap` and `width: 100%` on library-actions, reduced header padding to 0.75rem, keeping single-row layout since FAB handles import/download now.

---

*Phase: 09-ui-refinements*
*Plan: 01*
*Tested: 2026-01-12*
*Fixed: 2026-01-12*
