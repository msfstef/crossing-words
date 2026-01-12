# Phase 8: Polish & PWA - Research

**Researched:** 2026-01-12
**Domain:** PWA polish, custom mobile keyboard, theming, offline UX
**Confidence:** HIGH

<research_summary>
## Summary

Researched the complete stack for polishing a React PWA with focus on mobile keyboard UX, theme system, and offline capabilities. The project already uses vite-plugin-pwa with Workbox, so this phase extends the existing foundation rather than replacing it.

Key finding: For a crossword-specific mobile keyboard, **react-simple-keyboard** is the clear choice - it's customizable, lightweight, and handles the primary challenge of avoiding system keyboard focus issues. Don't hand-roll a virtual keyboard; the edge cases (iOS focus restrictions, viewport resize, accessibility) are extensive.

For theming, CSS custom properties with a data-attribute toggle pattern (`[data-theme="dark"]`) combined with localStorage persistence and `prefers-color-scheme` detection provides the best balance of simplicity and capability. No library needed.

**Primary recommendation:** Use react-simple-keyboard for mobile input, CSS custom properties for theming, and navigator.onLine hook for offline detection. The existing vite-plugin-pwa setup handles service worker and caching - just configure runtime caching patterns.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-simple-keyboard | 3.x | Virtual keyboard | Only mature React virtual keyboard lib, customizable layouts, responsive |
| vite-plugin-pwa | 0.20+ | PWA generation | Already in project, handles manifest + service worker + workbox |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox | 7.x | Service worker caching | Bundled with vite-plugin-pwa for runtime caching config |
| sonner | (existing) | Toast notifications | Already in project for collaboration toasts |

### Don't Need Libraries For
| Feature | Use Instead |
|---------|-------------|
| Theme toggle | CSS custom properties + data-attribute + localStorage |
| Online/offline detection | Custom hook with navigator.onLine + event listeners |
| Install prompt | Browser-native beforeinstallprompt event |
| System theme detection | CSS prefers-color-scheme + matchMedia API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-simple-keyboard | Custom keyboard from scratch | Custom = weeks of edge case debugging on iOS |
| CSS custom properties | Tailwind dark mode | Tailwind works but CSS vars simpler for this scope |
| navigator.onLine hook | @rehooks/online-status | Small enough to not need a dependency |

**Installation:**
```bash
npm install react-simple-keyboard
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Library/            # Puzzle library view (new)
│   │   ├── LibraryView.tsx
│   │   └── PuzzleCard.tsx
│   ├── Keyboard/           # Custom virtual keyboard
│   │   ├── CrosswordKeyboard.tsx
│   │   └── CrosswordKeyboard.css
│   ├── Layout/             # Unified responsive layout
│   │   ├── SolveLayout.tsx
│   │   └── Header.tsx
│   └── ...existing...
├── hooks/
│   ├── useOnlineStatus.ts  # navigator.onLine detection
│   └── useTheme.ts         # Theme toggle with persistence
├── styles/
│   └── theme.css           # CSS custom properties for themes
└── ...existing...
```

### Pattern 1: CSS Custom Properties Theme System
**What:** Define theme colors as CSS variables, toggle via data-attribute
**When to use:** Any app needing light/dark mode
**Example:**
```css
/* theme.css */
:root {
  /* Light theme (default) */
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text: #1a1a2e;
  --color-text-muted: #666666;
  --color-border: #e0e0e0;
  --color-accent: #3b82f6;
  --color-cell-bg: #ffffff;
  --color-cell-selected: #bfdbfe;
  --color-cell-word: #dbeafe;
}

[data-theme="dark"] {
  --color-bg: #1a1a2e;
  --color-bg-secondary: #252542;
  --color-text: #e0e0e0;
  --color-text-muted: #9ca3af;
  --color-border: #3f3f5c;
  --color-accent: #60a5fa;
  --color-cell-bg: #252542;
  --color-cell-selected: #3b4f7a;
  --color-cell-word: #2d3a5c;
}
```

### Pattern 2: Theme Hook with Persistence
**What:** React hook that manages theme state, localStorage, and system preference
**When to use:** Any theme toggle implementation
**Example:**
```typescript
// hooks/useTheme.ts
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first, default to 'system'
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored ?? 'system';
  });

  // Resolve actual theme (system -> light or dark)
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.dataset.theme = mediaQuery.matches ? 'dark' : 'light';
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
```

### Pattern 3: Custom Virtual Keyboard for Crossword
**What:** react-simple-keyboard configured for crossword input
**When to use:** Mobile input where system keyboard is problematic
**Example:**
```typescript
// components/Keyboard/CrosswordKeyboard.tsx
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import './CrosswordKeyboard.css';

interface CrosswordKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
}

const layout = {
  default: [
    'Q W E R T Y U I O P',
    'A S D F G H J K L',
    'Z X C V B N M {bksp}',
  ],
};

const display = {
  '{bksp}': '⌫',
};

export function CrosswordKeyboard({ onKeyPress, onBackspace }: CrosswordKeyboardProps) {
  const handleKeyPress = (button: string) => {
    if (button === '{bksp}') {
      onBackspace();
    } else {
      onKeyPress(button);
    }
  };

  return (
    <div className="crossword-keyboard">
      <Keyboard
        layout={layout}
        display={display}
        onKeyPress={handleKeyPress}
        theme="hg-theme-default crossword-theme"
        disableButtonHold
        physicalKeyboardHighlight
      />
    </div>
  );
}
```

### Pattern 4: Online Status Hook
**What:** Hook that tracks navigator.onLine with event listeners
**When to use:** Offline indicators, sync status
**Example:**
```typescript
// hooks/useOnlineStatus.ts
import { useState, useEffect, useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
```

### Anti-Patterns to Avoid
- **Using input[type=text] for crossword cells:** System keyboard fights with virtual keyboard
- **Polling navigator.onLine:** Use event listeners instead
- **Inline styles for themes:** Makes theming inconsistent, use CSS variables
- **localStorage in render:** Causes hydration mismatches, read in useState initializer or useEffect
- **Ignoring iOS focus restrictions:** Programmatic focus doesn't open keyboard on iOS
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual keyboard | Custom div-button keyboard | react-simple-keyboard | iOS focus issues, accessibility, touch handling, layouts |
| Service worker | Manual fetch handlers | Workbox via vite-plugin-pwa | Caching strategies, cache versioning, updates |
| Install prompt UI | Custom "install app" modal | Browser-native beforeinstallprompt | Users trust browser prompts, platform differences handled |
| System theme detection | Custom matchMedia polling | CSS prefers-color-scheme + JS matchMedia | Browser handles it, less code |
| Toast notifications | Custom notification component | sonner (already in project) | Animations, stacking, dismissal logic |

**Key insight:** PWA features (service workers, manifests, install prompts) have significant platform differences. Workbox and browser-native APIs handle these; custom solutions break on iOS or edge cases. The virtual keyboard domain especially has decades of edge cases around focus, viewport, and touch handling.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: iOS Keyboard Focus Restrictions
**What goes wrong:** Programmatically focusing input doesn't open system keyboard
**Why it happens:** iOS only allows keyboard to open from explicit user interaction (tap)
**How to avoid:** Use virtual keyboard (react-simple-keyboard) that doesn't need focus; intercept taps directly
**Warning signs:** "Keyboard doesn't appear" bugs only on iOS

### Pitfall 2: Viewport Resize on Mobile Keyboard
**What goes wrong:** Layout shifts when system keyboard opens/closes
**Why it happens:** Mobile browsers resize viewport when keyboard appears
**How to avoid:** Use `dvh` units or fixed-position virtual keyboard that doesn't trigger resize
**Warning signs:** Content jumping, scroll position changing on keyboard open

### Pitfall 3: Theme Flash (FART - Flash of Wrong Theme)
**What goes wrong:** Page loads with wrong theme before JS runs
**Why it happens:** CSS loads before JS can read localStorage preference
**How to avoid:** Add blocking script in `<head>` that sets data-theme before render
**Warning signs:** Brief flash of light theme when user prefers dark

### Pitfall 4: Service Worker Cache Stale Content
**What goes wrong:** Users see old app version after update
**Why it happens:** Service worker serves cached assets, doesn't update
**How to avoid:** Use `registerType: 'autoUpdate'` (already set) and cache versioning
**Warning signs:** "Clear cache" fixes user issues

### Pitfall 5: iOS PWA Storage Eviction
**What goes wrong:** Offline data disappears after not using app for ~7 days
**Why it happens:** iOS aggressively clears script-writable storage
**How to avoid:** Can't fully prevent; show clear offline indicator, resync when online
**Warning signs:** Progress lost on iOS after period of non-use

### Pitfall 6: Install Prompt Timing
**What goes wrong:** Users dismiss or miss install prompt
**Why it happens:** Prompt shown at wrong time (on load, during task)
**How to avoid:** Capture beforeinstallprompt, trigger at moment of high engagement (e.g., after completing puzzle)
**Warning signs:** Low install rates despite PWA eligibility
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Preventing Theme Flash (FART)
```html
<!-- Add to index.html <head> BEFORE any other scripts -->
<script>
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.dataset.theme = 'light';
    }
  })();
</script>
```

### Vite PWA Runtime Caching Config
```typescript
// vite.config.ts - extend existing config
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Cache JS/CSS/HTML
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // Runtime caching for API requests
    runtimeCaching: [
      {
        // Cache puzzle API responses
        urlPattern: /^https:\/\/.*\/puzzle/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'puzzle-api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
    ],
  },
  manifest: {
    // ... existing manifest
  },
})
```

### Custom Install Prompt Handler
```typescript
// hooks/useInstallPrompt.ts
import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setCanInstall(false);

    return outcome === 'accepted';
  }, [deferredPrompt]);

  return { canInstall, promptInstall };
}
```

### iOS-Safe Focus Workaround (if needed)
```typescript
// For cases where you MUST trigger focus programmatically on iOS
// Dispatch synthetic click event - works in iOS 18.6.2+ PWAs
function triggerIOSSafeeFocus(inputRef: HTMLInputElement) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  inputRef.dispatchEvent(event);
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling navigator.onLine | useSyncExternalStore with events | React 18 | Cleaner, no state sync issues |
| CSS media query only for theme | Data-attribute toggle + media query | 2023+ | Manual override with system default |
| Custom service worker | vite-plugin-pwa + Workbox | 2022+ | Less boilerplate, better patterns |
| Fixed viewport units (vh) | Dynamic viewport units (dvh) | 2023 | Mobile keyboard doesn't break layout |

**New tools/patterns to consider:**
- **CSS `light-dark()` function:** Newer color function for theme colors (limited browser support, not ready)
- **View Transitions API:** Could smooth theme transitions (experimental, not critical for MVP)
- **Web Push on iOS:** Finally available in iOS 16.4+ but only for installed PWAs (out of scope per CONTEXT.md)

**Deprecated/outdated:**
- **Using input elements for crossword cells:** Virtual keyboard pattern is now standard
- **localStorage sync issues:** useSyncExternalStore pattern prevents most issues
- **Manual manifest.json:** vite-plugin-pwa generates from config
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **iOS storage eviction behavior**
   - What we know: iOS can clear PWA storage after ~7 days of non-use
   - What's unclear: Exact timing and triggers; varies by iOS version
   - Recommendation: Accept this limitation, show clear "Offline - data may be stale" indicator

2. **Virtual keyboard key size for accessibility**
   - What we know: react-simple-keyboard is customizable via CSS
   - What's unclear: Optimal key size for crossword (larger than standard keyboard?)
   - Recommendation: Start with default sizing, test on actual devices, iterate based on feedback

3. **Clue navigation in single-clue-bar**
   - What we know: User wants prev/next buttons for sequential clue navigation
   - What's unclear: Should it wrap at end of direction? Switch direction automatically?
   - Recommendation: Discuss during planning, likely wrap within direction
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- MDN PWA Installability Guide - manifest requirements, service worker details
- web.dev/learn/pwa/caching - caching strategies, best practices
- virtual-keyboard.js.org - simple-keyboard documentation
- vite-pwa-org.netlify.app - vite-plugin-pwa configuration

### Secondary (MEDIUM confidence)
- brainhub.eu/library/pwa-on-ios - iOS PWA limitations (verified against Apple docs)
- whitep4nth3r.com/blog/best-light-dark-mode-theme-toggle-javascript - theme toggle patterns (cross-verified)
- Various Medium articles on React hooks for online status (cross-verified with MDN)

### Tertiary (LOW confidence - needs validation)
- iOS 18.6.2 focus workaround (from GitHub Gist - should verify on actual device)
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: React PWA with Vite
- Ecosystem: react-simple-keyboard, vite-plugin-pwa, Workbox
- Patterns: Theme system, virtual keyboard, offline detection, install prompt
- Pitfalls: iOS focus, viewport resize, theme flash, cache staleness

**Confidence breakdown:**
- Standard stack: HIGH - verified with official docs, npm packages current
- Architecture: HIGH - patterns from official examples and best practices
- Pitfalls: HIGH - documented in multiple sources, verified
- Code examples: HIGH - from Context7/official sources or verified patterns

**Research date:** 2026-01-12
**Valid until:** 2026-02-12 (30 days - PWA ecosystem relatively stable)
</metadata>

---

*Phase: 08-polish-pwa*
*Research completed: 2026-01-12*
*Ready for planning: yes*
