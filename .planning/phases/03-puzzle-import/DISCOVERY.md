# Phase 3: Puzzle Import - Discovery

**Discovered:** 2026-01-11
**Level:** 2 - Standard Research
**Status:** Complete

## Research Question

How to parse .puz, .ipuz, and .jpz crossword file formats in a browser-based TypeScript/React app?

## Findings

### Recommended Library: xd-crossword-tools

**npm package:** `xd-crossword-tools`
**GitHub:** https://github.com/puzzmo-com/xd-crossword-tools

**Why this library:**
- TypeScript, runs in browsers, React Native, and Node
- Supports .puz and .jpz parsing
- Uses vendored 'puzjs' ported to TypeScript
- Actively maintained (powers puzzmo.com)
- Converts to intermediate xd format, then to JSON

**Available functions:**
- `puzToXD(buffer)` - Parse .puz binary to xd format
- `jpzToXD(xmlString)` - Parse .jpz XML to xd format
- `xdToJSON(xdString)` - Convert xd to structured JSON

### ipuz Format

**No library needed** - ipuz is a JSON-based format.

Parse directly using `JSON.parse()`. The format includes:
- `dimensions` - width/height
- `puzzle` - 2D array of cell data (numbers, blocks)
- `solution` - 2D array of letters
- `clues` - Object with Across/Down arrays

### File Format Overview

| Format | Type | Parser Approach |
|--------|------|-----------------|
| .puz | Binary | xd-crossword-tools `puzToXD` |
| .ipuz | JSON | Native `JSON.parse()` |
| .jpz | Zipped XML | xd-crossword-tools `jpzToXD` |

### Alternative Libraries Considered

1. **@confuzzle/puz-crossword** - .puz only, last updated 4 years ago
2. **jscrossword** - Not on npm, harder to integrate
3. **crosswordnexus/crossword-tools** - Deprecated

## Implementation Strategy

1. **Install xd-crossword-tools** for .puz and .jpz parsing
2. **Create format-specific parsers:**
   - `parsePuz(buffer: ArrayBuffer): Puzzle`
   - `parseIpuz(json: string): Puzzle`
   - `parseJpz(buffer: ArrayBuffer): Puzzle`
3. **Unified import function** that detects format and delegates
4. **File picker UI** for user to select local files

## Don't Hand-Roll

- .puz binary parsing (use xd-crossword-tools)
- .jpz XML parsing and unzipping (use xd-crossword-tools)

## Safe to Implement Directly

- ipuz JSON parsing (it's just JSON with known schema)
- Format detection by file extension and magic bytes
- Conversion from xd/ipuz structures to our Puzzle type

## Sources

- [xd-crossword-tools GitHub](https://github.com/puzzmo-com/xd-crossword-tools)
- [ipuz Format Specification](http://www.ipuz.org/)
- [Crossword Nexus HTML5 Solver](https://github.com/crosswordnexus/html5-crossword-solver)
- [xd-crossword-tools npm](https://www.npmjs.com/package/xd-crossword-tools)
