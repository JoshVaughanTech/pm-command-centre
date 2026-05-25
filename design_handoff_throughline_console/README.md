# Handoff: Throughline — Customizable PM Console

## Overview

Throughline is a project management command centre for delivery PMs (security/access-control/CCTV installers, but the model generalises). The Console is the main dashboard: a single screen showing the day's priority moves, portfolio health, active projects, open risks, inbox signals, and a deep-dive on a pinned project.

The defining feature is **customisable panels**: every block on the screen is a draggable, resizable, removable panel. Users curate their own dashboard, layout persists across sessions, and a light/dark theme switch is built in.

## About the Design Files

The files in this bundle are **design references created in HTML** — a working prototype showing intended look, behaviour, and interaction model. They are **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase's existing environment** (whatever framework, design system, and patterns it uses) — or, if there's no codebase yet, pick the most appropriate framework for the project (React + TypeScript would be a sensible default given the prototype) and implement there.

Read the HTML/CSS for exact layout, type, colour, spacing, and interaction details. Re-implement using the host codebase's idioms.

## Fidelity

**High-fidelity.** Pixel-level decisions are intentional:

- Specific colour tokens (warm-grey light theme + matching dark theme)
- Specific type pairing (Geist sans + Geist Mono) at specific sizes
- Hairline 1px borders, no shadows except popovers
- Status colour is reserved for high/med/low risk and budget/schedule deltas — never decorative
- No gradients, no decorative iconography, no emoji
- Numbers are always Geist Mono; UI labels are lowercased monospace where they're operational metadata (panel titles, table headers, time stamps, IDs)

Recreate pixel-perfect.

---

## Design Tokens

### Colours

**Light theme (default):**
```
--tl-bg:            #fbfaf9   /* page background, warm off-white */
--tl-surface:       #ffffff   /* panel background */
--tl-surface-alt:   #f6f5f3   /* hover, secondary surface */
--tl-line:          #e8e6e1   /* primary hairline */
--tl-line-2:        #ece9e4   /* secondary hairline (within panels) */
--tl-line-strong:   #d8d4cc   /* dashed dropzone, stronger divider */
--tl-text:          #15140f   /* primary text */
--tl-text-2:        #4a4842   /* body text, secondary */
--tl-text-3:        #807c72   /* muted, eyebrow, meta */
--tl-text-4:        #a8a39a   /* faintest, separator dots */
--tl-ink:           #15140f   /* primary button bg, accent */
```

**Dark theme:**
```
--tl-bg:            #0d0d0c
--tl-surface:       #131312
--tl-surface-alt:   #1a1a18
--tl-line:          #25241f
--tl-line-2:        #1d1d1a
--tl-line-strong:   #34322b
--tl-text:          #f3f1ea
--tl-text-2:        #b8b3a4
--tl-text-3:        #7d786c
--tl-text-4:        #555148
--tl-ink:           #f3f1ea
```

**Status (both themes):**
```
--tl-good:    #1d6b3d (light) / #3da75e (dark)   — green
--tl-warn:    #a8650a (light) / #d18b29 (dark)   — amber
--tl-bad:     #b5371f (light) / #e15a3e (dark)   — red

--tl-good-bg: #ecf3ec (light) / #18241a (dark)   — pill bg
--tl-warn-bg: #f6efe1 (light) / #2a1f0e (dark)
--tl-bad-bg:  #f7ebe7 (light) / #2a1814 (dark)
```

### Typography

- **Sans (body, headlines, UI)**: `Geist` (Google Fonts), fallback `-apple-system, "SF Pro Text", "Inter Tight", system-ui, sans-serif`
- **Mono (numbers, IDs, code, operational labels)**: `Geist Mono`, fallback `"JetBrains Mono", "SF Mono", ui-monospace, monospace`
- Default body size: **13px**
- Line height: **1.45**
- Letter spacing: **-0.005em** on body; **-0.015em to -0.03em** on display sizes (tightens as size increases)
- Font features: `"ss01", "ss02", "cv11"`
- Smoothing: `-webkit-font-smoothing: antialiased`

**Scale used throughout:**
| Token             | Size  | Weight  | Letter-spacing | Usage                       |
|-------------------|-------|---------|----------------|-----------------------------|
| Display (daybook) | 56px  | 500     | -0.03em        | "25 May" hero               |
| H1 (project)      | 26px  | 600     | -0.018em       | Project name                |
| H2 (block)        | 17px  | 600     | -0.01em        | Section headings            |
| H3 (card)         | 16px  | 600     | -0.012em       | "Recommended move" h        |
| Body              | 13px  | 400     | -0.005em       | Default                     |
| Small body        | 12.5px| 400     | 0              | Captions, meta              |
| Eyebrow (caps)    | 10.5px| 500     | 0.06em         | UPPERCASE section labels    |
| Mono small        | 11px  | 400     | 0              | IDs, codes                  |
| Mono micro        | 10.5px| 400     | 0              | Time stamps, panel titles   |
| Big number (mono) | 22-28px| 400-500| -0.015em       | Metric strip values, ledger |

### Spacing

8/12/14/16/20/24/28/32/40/56 — no rigid scale, but lean on these values. Default grid gap is **14px**, padding is **14px** at compact density and **18px** at roomy.

### Radius

- 3-4px: chips, tags, small buttons
- 5-6px: buttons, KV cells, menu items
- 8px: panel containers
- 50%: dots, pulse indicators

### Borders & elevation

- All borders are **1px hairlines** using `--tl-line` or `--tl-line-2`
- **No shadows on panels.** Only on floating popovers (e.g. add-panel menu):
  - Light: `0 12px 32px rgba(0,0,0,.10), 0 0 0 1px var(--tl-line-2)`
  - Dark: `0 12px 32px rgba(0,0,0,.5), 0 0 0 1px var(--tl-line)`

---

## Layout System

### The 12-column grid

The Console body is a 12-column CSS grid with 14px gap and 14px padding. Each panel claims a `w` (width) in grid columns. Allowed widths are panel-specific:

| Panel             | defaultW | allowedW          |
|-------------------|----------|-------------------|
| `daybook`         | 12       | [12]              |
| `moves`           | 8        | [6, 8, 12]        |
| `metrics`         | 12       | [12, 8, 6]        |
| `projects`        | 12       | [12, 8]           |
| `risks`           | 6        | [4, 6, 8, 12]     |
| `inbox`           | 6        | [4, 6, 8, 12]     |
| `pinned`          | 4        | [4, 6]            |
| `timeline`        | 12       | [12]              |
| `comms`           | 4        | [4, 6]            |

The "resize" button on a panel header cycles through `allowedW` in order. The currently-selected width is displayed as `1/3`, `1/2`, `2/3`, or `full`.

### Default layout (factory)

```
daybook (12)
metrics (12)
moves (8)        |  pinned (4)
projects (8)     |  risks (4)
inbox (8)        |  comms (4)
```

Timeline is not in the factory default but is available from the "+ add panel" menu.

### Row heights

Within a row, the row track height equals the tallest panel. To avoid awkward empty gaps:

- Each panel stretches to `height: 100%` so empty space falls *inside* the panel (looks intentional) rather than as a visible gap between panels.
- Panel bodies cap at `max-height: 520px` (`600px` for w-12 panels) and scroll internally; the daybook hero and metrics strip have `max-height: none` because they're naturally short.
- The default layout intentionally pairs panels of similar natural height (moves+pinned ≈ 340-380px; projects+risks ≈ 250-280px; inbox+comms ≈ 320-380px).

---

## Top Bar

Sticky header. Components left-to-right:

1. **Brand mark** — small filled square `T/L` in `--tl-ink`, plus lowercase wordmark "throughline" at 13px/500 weight, Geist sans.
2. **Vertical separator** — 1px × 18px in `--tl-line`.
3. **Breadcrumb** — monospace 11px, alternating key/val: `workspace delivery view console`. Keys in `--tl-text-4`, values in `--tl-text`.
4. **Centred status block** (margin auto either side) — monospace 11px: `Mon 25 May · 09:14`, a 6px pulsing green dot, the word `live` in `--tl-good`. Pulse is a 2.2s ease-in-out infinite animation on a box-shadow halo.
5. **Right side controls**:
   - Hint label `drag panel grips to rearrange` (mono 10.5px, very muted)
   - `+ add panel` button (mono 11.5px in a bordered chip; opens a dropdown menu of removed panels)
   - `↻` reset-layout icon button
   - Sun/moon theme toggle (sun = currently light, click for dark; moon = currently dark, click for light)

Add-panel dropdown is right-aligned beneath the button, 220px min-width, 6px radius, with a "add panel" header label and one row per available panel. Each row shows the panel's id in mono on the left and its title on the right.

---

## Panel Anatomy

Every panel uses a common shell:

```
┌─────────────────────────────────────────────────┐
│ ⋮⋮ panel title              full ×              │  ← header (draggable)
├─────────────────────────────────────────────────┤
│                                                 │
│  panel body                                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Header

- 7px vertical padding, 10px right padding, 8px left padding
- 1px bottom border `--tl-line-2`
- Background `--tl-surface`
- Mono 11px text in `--tl-text-2`
- Title displayed in lowercase (CSS `text-transform: lowercase`)
- **Whole header is the drag handle** (`draggable={true}`); cursor is `grab`, becomes `grabbing` on press
- Grip dots: 6 dots in 2×3 grid, 10×14px, in `--tl-text-4` (darkens on header hover)
- Right-side buttons (width cycle + remove ×) appear in mono 10.5px, square hit areas, hover bg `--tl-surface-alt`

### Body

- `flex: 1` to fill remaining vertical space
- `overflow: auto` with `max-height` cap as described
- No padding by default — each panel controls its own internal padding

### Drag-and-drop interaction

- HTML5 native drag-and-drop (`draggable={true}`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`)
- Dragged panel goes to `opacity: 0.35`
- Drop-target panel gets a 2px ink-coloured outer ring and a subtle shadow
- During drag, a full-width dashed dropzone appears at the bottom of the grid: "drop here to move to end"
- On drop: source panel is spliced out and inserted before the target panel (or appended if dropped on the end-zone)

---

## Panel Catalog

Each panel takes optional props: `pinnedProjectId`, `onPin(id)`, `density`.

### 1. Daybook (`daybook`)

The editorial "Today" hero. Two-column grid (`1fr 360px`, 40px gap, 28px×32px padding):

**Left:**
- Eyebrow: "MONDAY" — 11px uppercase, 0.12em letter-spacing, `--tl-text-3`
- Title: "25 May**, 2026**" — 56px Geist 500, -0.03em letter-spacing, the year in `--tl-text-3`
- Lede: 14px body in `--tl-text-2`, max-width 520px, `text-wrap: pretty`

**Right (separated by a left border):**
- Four ledger rows. Each row: mono number (20px, width 64px) + small label (11.5px, `--tl-text-3`). 7px vertical padding, 1px bottom border `--tl-line-2`.
- Rows: active projects, portfolio health (%), high/open risks (red), saved this week (h).

### 2. Priority Moves (`moves`)

Numbered list of top 3 priority projects (sorted by ascending health).

Each row: `grid-template-columns: 44px 1fr auto; gap: 16px; padding: 18px 20px;` with a `--tl-line-2` bottom border.

- **Number column**: "01" / "02" / "03" in 22px mono, `--tl-text-4`
- **Body column**:
  - Meta line: risk pill (mini caps mono badge, see Pills below) + mono code + bullet + client + bullet + mono `nextWhen` (bold)
  - Heading: 16px Geist 500, -0.012em, balanced text wrap
  - Paragraph: 12.5px `--tl-text-2`, max-width 580px, pretty wrap
- **Action column** (stacked, right-aligned): `draft` and `snooze` buttons (see Buttons below)

### 3. Portfolio Metrics (`metrics`)

Six equal cells, no padding on the panel itself. Each cell: 12px×16px padding, 1px right border `--tl-line-2` (last cell no border).

- Lowercase mono label (10.5px, `--tl-text-3`): `portfolio.health`, `projects.active`, `risks.open`, `risks.high`, `comms.due`, `ai.hours_saved`
- Row beneath: big mono value (22px, -0.015em) on left, **inline sparkline** on right (56×14px SVG line, 1.5px tail dot, in metric's state colour)
- Status colours applied to value + sparkline based on metric (risks.open=warn, risks.high=bad, ai.hours_saved=good)

### 4. Projects (`projects`)

Sortable table. Columns:

| · | code | project | client | stage | health | budget | schedule | comms | risks | next |

- `·` = a 6px risk dot (high=red, medium=amber, low=green)
- `code` = mono 11px
- `project` = 12px/500 weight, max-width 240px
- `stage` = small mono badge in `--tl-surface-alt` background
- `health` = mono number + 36px inline bar (good/warn/bad colour)
- `budget`, `schedule` = mono, coloured by their `*State` field (good/warn/bad)
- `comms` = same pattern as health
- `risks` = a high-count chip (red bg, `2H`) plus a total-count chip (grey bg, `3`)
- `next` = small mono when ("3:00 PM" or "Overdue" in red) + body text below

**Behaviour:**
- Clicking a row sets it as the pinned project (`onPin(id)`)
- The pinned project's row has `--tl-surface-alt` background + a 2px inset `--tl-ink` left border
- Hover: background `--tl-surface-alt`
- Sortable: clicking the "health" or "comms" header changes the sort; sorted header gets a `↓` arrow and slightly darker text

Headers are mono 10.5px, uppercase, 0.04em letter-spacing, sticky-positioned to the top of the panel body, in `--tl-text-4`.

### 5. Risks (`risks`)

Same table pattern as Projects but tighter. Columns: `sev | id | title | project | owner | age`.

- `sev`: a 22×18 square chip with single letter `H` (bg `--tl-bad`, white text) or `M` (bg `--tl-warn-bg`, text `--tl-warn`)
- All other cells follow the same conventions as Projects

### 6. Inbox (`inbox`)

List of email signals. Each row: `grid-template-columns: 16px 1fr auto; gap: 10px; padding: 10px 16px;`

- **State dot column**: a 6px dot positioned 6px from top
  - `new` = `--tl-ink`
  - `reply` = `--tl-good`
  - `stale` = `--tl-warn`
  - `overdue` = `--tl-bad` with a 3px subtle halo
- **Body column**:
  - Top line: bold from-name (12.5px) + org (11.5px muted) + age (mono 10.5px, pushed right with `margin-left: auto`)
  - Subject (12.5px)
  - Snippet (11.5px `--tl-text-3`, 1.5 line height)
- **Tag column**: project code in a small bordered chip (mono 10.5px)

### 7. Pinned Project (`pinned`)

Single-project deep view. Three stacked blocks inside 14px×16px padding:

**Head:**
- Eyebrow: risk dot + mono code + middle dot + stage + (right-pushed) "PINNED" label in mono 10px uppercase
- Title: 16px/600 -0.01em
- Sub: client name 12px in `--tl-text-2`

**Key-value grid** (2×3):
- 1px outer border, 6px radius
- Each cell: 6px×10px padding, 1px right/bottom border `--tl-line-2`, last column no right border, last row no bottom border
- Label in mono 10.5px `--tl-text-3`, value in 11.5px/500 weight, justified between

**Recommended move block:**
- Bordered card with a header strip ("recommended move" + sparkle icon)
- Heading + paragraph + actions row (primary "draft & send" + ghost "snooze")

### 8. Weekly Timeline (`timeline`)

Gantt-ish weekly schedule. Header row: `220px repeat(5, 1fr)` grid, days labelled `Mon` through `Fri` with their dates `25-29` in muted mono.

Rows: same grid template. Left cell: dot + code + project name (truncated). Right 5 cells: each a 38px-min-height cell with a bordered task bar if there's a milestone that day.

Task bar colours by state:
- `done` = `--tl-good-bg` bg, `--tl-good` text
- `active` = `--tl-ink` bg, `--tl-bg` text
- `blocked` = `--tl-bad-bg` bg, `--tl-bad` text
- `planned` = `--tl-surface-alt` bg, `--tl-text-3` text

### 9. Comms Health (`comms`)

Per-client communication health. Each row: `grid-template-columns: 1fr 100px 32px; gap: 12px; padding: 10px 16px;`

- **Left**: client name (12.5px/500) + sub line "Contact name · last touch" (11px `--tl-text-3`)
- **Middle**: 4px-tall progress bar (good/warn/bad fill)
- **Right**: mono 14px score (coloured)

---

## Buttons & Pills

### Buttons

**Primary**: `--tl-ink` bg, `--tl-bg` text, 4-6px padding, 4-5px radius, 11-12.5px font (mono in console contexts, sans elsewhere), gap 5-6px from icon.

**Ghost**: transparent bg, 1px border `--tl-line`, `--tl-text-2` text. Hover: `--tl-surface-alt` bg + `--tl-text` text.

**Top-bar buttons (`.console-tbtn`)**: mono 11.5px, 4×9px padding, 4px radius, 1px border `--tl-line`, `--tl-bg` bg, `--tl-text-2` text. The "+ add panel" button switches to inverted (ink bg / bg text) when its menu is open. Disabled state is 0.5 opacity, not-allowed cursor.

### Pills (used in moves panel + others)

10.5px mono 600 weight, 1-2px×5-7px padding, 3-4px radius, uppercase 0.03em letter-spacing. Backgrounds match the status family (`--tl-good-bg` etc.) with text in the matched status colour.

### Sev chips (used in tables)

Square 22×18px with single letter (H/M/L), 3px radius, mono 11px 600 weight. `H` is the only solid one (`--tl-bad` bg, white text); `M` is `--tl-warn-bg` bg with `--tl-warn` text.

---

## State Management

### What needs to be stateful

```ts
type PanelId =
  | 'daybook' | 'moves' | 'metrics' | 'projects'
  | 'risks' | 'inbox' | 'pinned' | 'timeline' | 'comms';

type LayoutEntry = { id: PanelId; w: 4 | 6 | 8 | 12 };

interface ConsoleState {
  layout: LayoutEntry[];                  // ordered list of visible panels
  pinnedProjectId: string;                // currently-pinned project (drives PinnedPanel)
  theme: 'light' | 'dark';
  density: 'compact' | 'comfortable';
  // transient (not persisted):
  draggingId: PanelId | null;
  dragOverId: PanelId | null;
  addMenuOpen: boolean;
}
```

### Persistence

In the prototype, the four persistent keys (layout, pinned, theme, density) are written to `localStorage`. In production:

- These should belong to the **user's saved view** (per-user, server-persisted), or per-team default with per-user override
- A workspace could have multiple saved views ("My day", "All projects", "High risk only") — out of scope for this handoff, but the data model should anticipate this
- Treat each panel's `w` as ephemeral preference, not domain data

### Mutations the UI fires

| Action                | State change                                                            |
|-----------------------|-------------------------------------------------------------------------|
| Drag panel A onto B   | Splice A out of layout, insert before B's index                         |
| Drop panel onto end-zone | Splice A out, push to end of layout                                  |
| Click width chip      | Cycle `w` through `allowedW[id]`                                        |
| Click × on panel      | Remove from layout                                                      |
| "+ add panel" → row   | Append `{ id, w: defaultW[id] }`                                        |
| Click project row     | `pinnedProjectId = clickedId`                                           |
| Click theme button    | Toggle `theme`                                                          |
| Tweaks: density radio | Set `density`                                                           |
| Tweaks: panel toggle  | Add/remove panel (same as × or "+ add panel")                           |
| Reset layout          | Restore `DEFAULT_LAYOUT`                                                |

---

## Data Shape

The prototype uses these fixtures (see `throughline-data.jsx`):

```ts
interface Project {
  id: string;                  // "TL-1042"
  code: string;                // "ACC-VIN" — short mono code shown in tables
  name: string;
  client: string;
  stage: 'Planning' | 'Delivery' | 'Commissioning' | string;
  phase: number;               // 1-8 progress
  health: number;              // 0-100
  risk: 'High' | 'Medium' | 'Low';
  next: string;                // "Client witness test pack due today"
  nextWhen: string;            // "3:00 PM" | "Today" | "Fri" | "Overdue"
  budget: string;              // "+4.2%" — pre-formatted
  budgetState: 'good' | 'warn' | 'bad';
  schedule: string;            // "+3 days"
  scheduleState: 'good' | 'warn' | 'bad';
  comms: number;               // 0-100 communication health
  lastTouch: string;           // "4d ago"
  owner: string;
  contact: string;
  channel: string;             // "Email" | "Teams + Email" | ...
  move: string;                // AI-suggested next move headline
  moveBody: string;            // longer explanation
  actions: string[];           // checklist of 3-5 suggested actions
  timeline: Array<{
    d: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
    k: string;                 // task name
    s: 'done' | 'active' | 'blocked' | 'planned';
  }>;
}

interface Risk {
  id: string;                  // "R-21"
  title: string;
  project: string;             // matches Project.code
  owner: string;
  age: string;                 // "22h" | "2d" | "7d"
  severity: 'high' | 'med' | 'low';
  impact: string;
  action: string;
}

interface InboxMessage {
  from: string;
  org: string;
  subj: string;
  snip: string;                // first ~150 chars of body
  at: string;                  // age "1h" | "3d"
  project: string;             // matches Project.code
  state: 'new' | 'reply' | 'stale' | 'overdue';
}

interface PortfolioSummary {
  health: number;              // 0-100
  active: number;              // count of active projects
  risksOpen: number;
  risksHigh: number;
  updatesDue: number;
  hoursSaved: number;          // AI-attributed time savings
}
```

In production these would come from APIs. The `move`, `moveBody`, `actions`, `next` fields are LLM-generated and should refresh on a cadence (every project event, or N minutes).

---

## Interactions & Behaviour

### Drag-to-reorder

- Use HTML5 native drag-and-drop, not a library, unless your codebase already has one (react-dnd, dnd-kit, etc. are all fine drop-ins)
- The whole panel header is the handle (`draggable={true}` on the header `<div>`); the panel body itself is not draggable
- During drag: source panel `opacity: 0.35`; hovered drop target has `box-shadow: 0 0 0 2px var(--tl-ink), 0 8px 24px rgba(0,0,0,.06)`
- End-of-grid dropzone is a separate full-width target with `border: 1.5px dashed var(--tl-line-strong); border-radius: 8px;` that only appears while a drag is in progress
- Drop animation: instant. No spring physics needed (kept restrained on purpose)

### Width cycle

- Each click cycles to the next valid width in the panel's `allowedW`
- The current width is displayed textually (`full`, `2/3`, `1/2`, `1/3`) — no graphical width picker
- Transition: instant. CSS grid handles the reflow

### Add panel menu

- Opens beneath the "+ add panel" button, right-aligned
- Clicking the trigger toggles open
- Clicking outside (`onMouseLeave` on the menu) closes — in production prefer click-outside via a `useClickAway` hook
- Disabled state when all panels are visible (button greyed out, menu not openable)

### Theme switch

- Click sun/moon icon to toggle
- Apply `console-root--dark` class on the root container
- `color-scheme: dark` is set on the root in dark mode so native scrollbars/form-controls follow
- Theme transitions are instant — no fade. The CSS already handles per-element border/background swaps cleanly.

### Density

- Two values: `compact` (default) and `comfortable`
- Applied as `console-root--d-compact` / `console-root--d-comfortable` modifier classes
- Affects: grid gap/padding, table cell padding, panel internal padding (see CSS — search for `console-root--d-comfortable`)

### Pinned project

- Clicking any row in the Projects panel sets that project as pinned
- The PinnedPanel rerenders with that project's data
- Persists via `localStorage`

### Keyboard (not implemented yet — recommended for production)

- `j/k` to move row selection in tables
- `Enter` to open pinned project (or open a dedicated detail page once it exists)
- `⌘K` for a command palette (project search, action search) — not in prototype but is in the visual mock as a hint chip in earlier explorations

---

## Tweaks Panel (production: settings menu)

The prototype uses a side-panel widget (from a shared `tweaks-panel.jsx` starter) for theme/density/per-panel-visibility/reset. **This is a prototype mechanism — do not ship it as-is.**

In production:
- Move "Theme" + "Density" into a user settings menu (top-right avatar dropdown)
- Move "Per-panel visibility" into the "+ add panel" menu (already covers add; the × button covers remove)
- Move "Reset layout" into the same settings menu

The Tweaks panel exists in the prototype because the design environment renders a Tweaks toggle in its chrome — irrelevant in production.

---

## Empty States

- Layout with 0 panels → centred message: "No panels. Add one with the + Add panel button above." (currently styled as a dashed-border 60px-padded cell)
- Risks table with 0 entries → row reading "No open risks on this project." in `--tl-text-3`
- Inbox with 0 entries → "No project-linked threads"
- Pinned panel with no pinned project (falls back to the first project — should not happen in normal use)

---

## Animations

- **Drag opacity transition** on `.console-cell`: `opacity .14s`
- **Pulse dot** in top bar (live indicator): 2.2s ease-in-out infinite, animating a box-shadow halo between `0 0 0 3px rgba(29,107,61,.14)` and `0 0 0 6px rgba(29,107,61,.05)`
- **Panel head grip** colour transition on hover: instant, no transition
- **Hover transitions** on buttons/rows: `background .12s` and `color .12s`

No spring physics, no large staggered animations, no Framer Motion required for the core experience. Keep restraint.

---

## Accessibility (gaps to close in production)

The prototype is **not yet accessible** — flag for the implementer:

- Panel drag should support keyboard reordering (`Space` to pick up, arrows to move, `Space` again to drop, `Esc` to cancel). Use `dnd-kit` or `@dnd-kit/sortable` which has good a11y semantics built in.
- All status-by-colour cues (good/warn/bad) need a secondary signal — already present in most cases (pill text, mono delta sign), but verify exhaustively
- Table sort headers need `aria-sort`
- Add-panel menu needs `role="menu"` + `aria-expanded` on trigger
- Theme toggle needs `aria-pressed` or a clearer label

---

## Files Bundled

```
design_handoff_throughline_console/
├── README.md                       — this file
├── Throughline Console.html        — main prototype entry (open this)
├── throughline.css                 — shared design tokens + base styles
├── throughline-console.css         — console-specific styles
├── throughline-data.jsx            — fixture data (the schema lives here)
├── throughline-icons.jsx           — inline SVG icon set (16px viewBox)
├── console-app.jsx                 — main ConsoleApp + drag system + top bar
├── console-panels.jsx              — the 9 panel components + helpers
├── tweaks-panel.jsx                — prototype Tweaks widget (do not ship)
└── screenshots/
    ├── 01-top-light.png            — daybook + metrics + moves/pinned
    ├── 02-middle-light.png         — projects + risks tables
    ├── 03-bottom-light.png         — inbox + comms health
    ├── 01-top-dark.png             — same sections in dark theme
    ├── 02-middle-dark.png
    └── 03-bottom-dark.png
```

Open `Throughline Console.html` in a browser to see the working prototype. All state is in `localStorage` — clear it to reset.

---

## Implementation Notes

### Recommended stack (if greenfield)

- **React + TypeScript** — the prototype is React-based and translates 1:1
- **CSS Modules** or **Tailwind with theme tokens** — both work; CSS variables for theme switching are essential either way
- **dnd-kit** — for drag-and-drop with accessibility
- **TanStack Table** — for sortable/filterable tables; the prototype tables are simple but in production you'll want column visibility, column reorder, filters
- **Geist** + **Geist Mono** from `@vercel/fonts` or Google Fonts (CDN works)

### Don't

- Don't reach for chart libraries for the sparklines — they're tiny inline SVGs (see the `CPSpark` component in `console-panels.jsx`), ~30 lines, do not need Recharts or anything heavier
- Don't add gradients, soft shadows, glassmorphism, or decorative emoji
- Don't introduce a third accent colour; the system is monochrome with three status hues
- Don't use rounded-corner card containers within panels — the panel itself is the only chrome; internal blocks use hairline 1px borders only
- Don't animate panel reordering with a spring — instant feels more responsive at this density

### Do

- Build each panel as a fully isolated component that takes only its needed data + `pinnedProjectId`/`onPin` if relevant
- Treat the layout state as a single source of truth (an ordered array of `{id, w}`), not as nested rows — the row chunking is purely a render-time concern
- Use CSS variables for theming end-to-end so the dark theme is free
- Test at 1440px width (the intended design viewport) and 1920px width (real desktop)
- The 56px hero number ("25 May") and the 22-28px ledger numbers are the design anchors — don't compromise them for narrow viewports; introduce horizontal scroll or wrap the layout to 1 column first

---

Questions? The conversation that produced this design is the canonical source for intent. The prototype is faithful to it.
