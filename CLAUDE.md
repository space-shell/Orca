# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from the `desktop/` directory:

```bash
cd desktop
npm install       # Install dependencies
npm start         # Run the Electron app
npm run fix       # Auto-fix linting issues (uses StandardJS)
npm run docs      # Regenerate docs from operator info fields
```

Build distributable packages (outputs to `~/Documents/`):
```bash
npm run build_osx
npm run build_linux
npm run build_win
```

There is no test suite.

## Architecture

Orca is an esoteric programming language / livecoding environment. The grid is a 2D array of single characters (glyphs) stored as a flat string in `Orca.s`. Every letter of the alphabet is an operator: lowercase runs only on bang (`*`), uppercase runs every frame (passive).

### Core Engine (`desktop/sources/scripts/core/`)

- **`orca.js`** — The `Orca` class: holds the grid state (`w`, `h`, `f`, `s`), runs the parse→operate loop each frame, and manages the lock system (used to prevent double-execution of cells). Values use base-36 (0–9, a–z = 0–35). Key methods: `run()`, `load()`, `write()`, `parse()`, `operate()`.

- **`operator.js`** — Base `Operator` class all operators inherit from (via `Operator.call(this, ...)`). Handles `listen()` (read a port), `output()`, `bang()`, `move()`, and port management. Ports are declared as `{ x, y }` offsets relative to the operator's position. The `run()` method calls `operation()`, locks input ports, and dispatches output.

- **`library.js`** — Defines all operators (`library.a` through `library.z`, plus `*`, `#`, `:`, `%`, `!`, `?`, `;`, `=`, `$`). Each is a constructor that calls `Operator.call(this, ...)`, declares its ports, and implements `operation()`. Numbers 0–9 are registered as no-op operators to prevent them from being treated as glyphs.

- **`io.js`** — `IO` aggregates the output drivers (MIDI, Mono, CC, UDP, OSC). Each driver has `push()`, `run()`, `clear()`, and `silence()`. Called by `client.run()` each frame.

- **`io/midi.js`**, **`io/mono.js`**, **`io/cc.js`**, **`io/udp.js`**, **`io/osc.js`** — Individual output protocol implementations.

- **`transpose.js`** — Lookup table for converting Orca note glyphs to MIDI note numbers.

### Application Layer (`desktop/sources/scripts/`)

- **`client.js`** — The central `Client` class: owns all subsystems (`orca`, `io`, `cursor`, `commander`, `clock`, `theme`, `acels`, `source`, `history`), handles the canvas rendering loop, and wires up all keyboard shortcuts. The main loop is `client.run()` → `clock.run()` → `orca.run()` → `io.run()` → `client.update()`.

- **`clock.js`** — Drives the frame loop (BPM-based), supports MIDI clock sync.

- **`cursor.js`** — Selection and editing state on the grid.

- **`commander.js`** — In-app command-line prompt (`CmdOrCtrl+K`). Commands like `bpm:140`, `inject:file`, `osc:7777`. All commands have a 2-character shorthand.

### Electron Entry Point

`desktop/main.js` — Electron `main` process. Loads `desktop/sources/index.html`. DevTools can be toggled by uncommenting `app.inspect()`.

### Browser Version

The root `index.html` + `sw.js` provide a web-based version (used at hundredrabbits.github.io/Orca). Shares the same core scripts but the IO layer differs (no UDP/OSC in browser; uses WebMIDI).

## Key Conventions

- **Linting**: StandardJS (no semicolons, 2-space indent). Run `npm run fix` from `desktop/`.
- **Operator ports**: Ports with `clamp: { min: 1 }` default their minimum to 1 when `listen(..., true)` (toValue mode) is called. Ports with a `default` field use that value when the cell is `.` or `*`.
- **Uppercase operators** (passive=true): run every frame. **Lowercase** (passive=false): run only when a `*` bang is adjacent.
- **Lock system**: After an operator runs, its input ports are locked so downstream operators in the same frame cannot overwrite them.
- **Base-36**: `orca.valueOf(g)` converts a glyph to 0–35. `orca.keyOf(n)` converts back. All arithmetic wraps via `% 36`.
