# AI Director · Design Language (TE-inspired)

> **Aesthetic**: Polymer-plastic-white injection-molded creative instrument.
> **Inspiration**: Teenage Engineering OP-1 / OP-Z / TX-6.
> **Core principle**: This is not a UI theme. It's an *instrument*. Every surface should feel like something you can pick up and operate.

---

## 0. Mental model

Treat the screen as **the top face of a physical device**. You are not "designing a webpage" — you are laying out a control panel on a piece of injection-molded ABS plastic. Three consequences:

1. **Functional zones are physically separate** — panels, not flexbox-only flows.
2. **Affordances are tactile** — keys depress, knobs rotate, tape spins. Every interactive surface has a visible state change.
3. **Whitespace is the chassis** — empty bone-white area is not "wasted space," it's the device body. Don't fill it.

---

## 1. Foundations

### 1.1 Typography

| Token | Stack | Use for |
|-------|-------|---------|
| `font-te` | Inter → Helvetica Neue → Arial | All body / labels / button text |
| `font-te-mono` | JetBrains Mono → IBM Plex Mono → ui-monospace | Technical metadata, IDs, timestamps, prompt text |
| `font-lcd` | VT323 → ui-monospace | LCD content only |

**Rules**:
- **All-lowercase** by default. Title-case is a code smell here.
- Prefer micro sizes: `text-[9px]` (label), `text-[11px]` (body), `text-[15px]` (heading).
- Tracking: tight on Helvetica labels, **wide on uppercase mono** (`tracking-[0.2em]` for category headers).
- Never bold body text. Use weight `font-semibold` only for the project name / product wordmark.

### 1.2 Color

#### Surface (the chassis)

| Token | Hex | Use |
|-------|-----|-----|
| `te-bone` | `#F4F2EC` | Default device surface |
| `te-bone-dim` | `#E8E5DC` | Recessed groove (knob bay, key bed) |
| `te-bone-deep` | `#D6D2C6` | Deeper recess (tape well) |
| `te-bone-edge` | `#BCB6A6` | Borders / dividers |
| `te-charcoal` | `#161616` | Text + active key fill |
| `te-charcoal-soft` | `#262626` | Secondary text on bone |

#### LCD palette (read-only display)

| Token | Hex | Use |
|-------|-----|-----|
| `te-lcd-bg` | `#1F2418` | LCD background (dark olive) |
| `te-lcd-fg` | `#B8C77A` | LCD primary glow (signal green) |
| `te-lcd-dim` | `#7A8A4A` | LCD dim text / gridlines |

#### Functional accents (semantic colors)

These colors are **never decorative**. Each maps to a single semantic dimension. Mixing them up is a hard NO.

| Token | Hex | Semantic |
|-------|-----|----------|
| `te-knob-blue` | `#2D5BA8` | **Motion** (camera / movement) |
| `te-knob-orange` | `#E8862A` | **Lens** (framing / focal length) — UI default accent |
| `te-knob-red` | `#D63031` | **Mood** + `record` / destructive |
| `te-knob-white` | `#FAFAF7` | Knob body (uniform) — *not* a semantic accent |

> **Knob policy**: knob bodies are **uniformly polymer white**. Function is encoded by a 4px colored *dot beside the label*, not by tinting the knob body. This keeps the chassis visually quiet and reads as professional studio gear rather than a toy.

#### Status

| Token | Hex | Use |
|-------|-----|-----|
| `te-ok` | `#7FB069` | Completed / ready |
| `te-warn` | `#FCBF49` | Pending review |
| `te-err` | `#E63946` | Failure / danger |

> **Forbidden**: arbitrary brand colors, gradients on surfaces, drop-shadows under text, hex literals outside this table.

### 1.3 Grid

**8px base.** Every padding, gap, height, width derives from `8 × n`. Common values:

```
gap-1 (4px)  — inside compact key clusters
gap-2 (8px)  — default panel internal
gap-3 (12px) — between component groups
gap-5 (20px) — between major regions
gap-8 (32px) — page-level sections
```

Never use `gap-1.5` / `gap-2.5` etc unless aligning to existing TE component internal spacing.

### 1.4 Shadow / depth

Five canonical shadows (defined in `tailwind.config.ts`):

| Token | Use |
|-------|-----|
| `shadow-te-key` | Resting key (slight lift + rim light) |
| `shadow-te-key-active` | Pressed key (recessed inset) |
| `shadow-te-knob` | Knob (rim light + drop) |
| `shadow-te-panel` | Floating panel on chassis |
| `shadow-te-lcd` | LCD recessed inside bezel |

Custom shadows require a written justification in the PR.

### 1.5 Radius

| Element | Radius |
|---------|--------|
| Knob | `rounded-full` |
| Key | `rounded-md` (6px) |
| Panel | `rounded-lg` (8px) |
| LCD | `rounded-md` (6px) |
| Page sections | `rounded-lg` |

No `rounded-xl` / `rounded-2xl` / `rounded-3xl`. Hard rule.

---

## 2. Components

All TE components live under [src/shared/ui/te/](src/shared/ui/te/) and export from [src/shared/ui/te/index.ts](src/shared/ui/te/index.ts).

### 2.1 Knob

```tsx
<Knob color="orange" label="lens" sublabel="70%" value={v} onChange={setV} />
```

- 4 colors only — see semantic table above.
- Always paired with a lowercase label below; sublabel optional (current value).
- Interactions: vertical drag (200px = full range), scroll wheel, ↑↓←→ on focus.
- 56px default size. Don't go below 40px (loses tactile feel).

### 2.2 Key

```tsx
<Key variant="text">shift</Key>
<Key variant="numbered" indicator="pulse">03</Key>
<Key variant="rec" indicator="rec" onClick={record}>●</Key>
```

Variants:
- **text** — labeled action key (`shift`, `option`, mode toggles).
- **numbered** — slot keys (1–16 shot keys).
- **transport** — playback (▶ ◀ ■).
- **rec** — record / generate (always reserves red).
- **wide** — labeled wide key (e.g. `enter`).

Indicator dot top-right: `off` / `on` / `pulse` / `rec`. Use sparingly — at most 1 in 4 keys lit.

### 2.3 LCD / LCDPixelArt / LCDBars

```tsx
<LCD title="now" meta="mode · board" height={120}>
  <LCDPixelArt rows={['shot 03/12', 'neon · alley', '░▒▓██████▓▒░']} />
</LCD>
```

- **Never** put HTML controls inside an LCD. It's a *display*. Read-only.
- Content rendered in `font-lcd` (VT323) with `text-te-lcd-fg`.
- Scanlines + CRT vignette are baked in — don't disable.
- Recommended sizes: `height={70}` (status), `120` (info), `160` (rich preview).

### 2.4 ModeTab / ModeRail

```tsx
<ModeRail modes={[{label:'idea'}, {label:'script'}, ...]} activeIndex={2} onSelect={setMode} />
```

- 8 slots maximum (T1–T8). If you need more, you've broken the metaphor.
- Active state: charcoal fill, orange T-number tag.
- Place on the **left** edge. Always.

### 2.5 Panel / Divider

```tsx
<Panel title="shot cards" meta="12 shots">
  ...
</Panel>
```

Variants: `default` (raised), `recessed` (inset), `flat` (no shadow). Header strip optional with `title` and right-aligned `meta`.

### 2.6 Tape

```tsx
<Tape playing={isPlaying} position={0.35} />
```

- 4-track, fixed: `vid` / `dlg` / `mus` / `sfx`. Don't add a 5th.
- Reels spin only when `playing`. Static when paused — preserves the metaphor.
- Position is normalized 0..1.

### 2.7 ShotCard

```tsx
<ShotCard index={3} location="neon alley · pov" shotType="wide" status="generating" />
```

- LCD preview at top (120px), metadata middle, action keys bottom.
- Status maps to a colored dot top-right + pixel-art animation in LCD.

---

## 3. Composition rules

### 3.1 The canonical workspace layout

```
┌─Header────────────────────────────────────────────────────────┐
│ [● proj]  ai director                          [time / status] │
├──┬─────────────────────────────────────────┬──────────────────┤
│T1│ HERO  · 4 knobs · LCD now · transport    │ COMMANDER        │
│T2│                                          │  · model select  │
│T3│ CONTENT  (mode-dependent)                │  · prompt input  │
│T4│   board:  shot grid                      │  · api config    │
│T5│   cast :  character bible                │  · generate ●    │
│T6│   set  :  scene bible                    │                  │
│T7│   mix  :  full tape                      │                  │
│T8│                                          │                  │
│  │ TAPE  (compact, always visible)          │                  │
└──┴─────────────────────────────────────────┴──────────────────┘
```

- **Mode rail**: 80px fixed.
- **Commander**: 280–320px fixed.
- **Center**: fluid.
- Hero strip is **always** at top. Tape strip is **always** at bottom. The middle changes by mode.

### 3.2 When NOT to use a component

| Don't | Do |
|-------|-----|
| Use Knob for a 0/1 toggle | Use a Key with `active` |
| Use LCD as a content area for editable text | Use a Panel + textarea |
| Use ModeTab for tabs that aren't full-screen modes | Use Key with `active` |
| Wrap Tape inside LCD | Tape lives on bone, LCD is read-only display |

### 3.3 Density

If the user can't squint at a 1280×800 screen and immediately distinguish the 3 main zones (mode rail / canvas / commander), the layout is too dense. Default response: **delete a row, don't shrink fonts**.

---

## 4. Anti-patterns (instant rejection)

1. ❌ **Mixed casing** — `Generate Script` instead of `generate script`
2. ❌ **Decorative knob colors** — orange knob for "style" violates semantics
3. ❌ **Glassmorphism / `backdrop-blur`** — leftover from the old aesthetic, kills the plastic feel
4. ❌ **Gradients on surfaces** — chassis is solid bone color, period
5. ❌ **Emoji in labels** — `🎬 generate` is not TE. Use a colored dot or no icon
6. ❌ **`text-2xl`+ headings** — no display sizes. Even the product wordmark stays under 24px
7. ❌ **Drop-shadows on text**
8. ❌ **Pure white `#FFFFFF`** — always tint toward bone. Pure white reads as "screen", not "object"
9. ❌ **Curved progress bars / gauges** — TE uses bars and ticks, not dials (except for actual knobs)
10. ❌ **Material Design icons / Lucide rounded icons** — geometric primitives only (▶ ■ ● ◀ + 1px stroke SVG)

---

## 5. Audio (yes, audio)

Half of TE's identity is sound design. Future versions of this app should add (priority order):

1. Soft mechanical click on `Key` press
2. Synth pluck on `record` start
3. Tape rewind sound on undo
4. Generation-complete chime (single mid-range tone)

Library: [Tone.js](https://tonejs.github.io/) recommended. Volume default at 30%, user-toggleable mute in header.

---

## 6. File map

| Concern | Location |
|---------|----------|
| Component primitives | [src/shared/ui/te/](src/shared/ui/te/) |
| Tokens | [tailwind.config.ts](tailwind.config.ts) `theme.extend` |
| Fonts | [src/pages/_document.tsx](src/pages/_document.tsx) (Google Fonts links) |
| Sandbox / reference | [src/pages/te-lab.tsx](src/pages/te-lab.tsx) — open `/te-lab` to see every component |
| Live workspace | [src/pages/workspace.tsx](src/pages/workspace.tsx) |

---

## 7. PR review checklist

Before merging UI work, walk this list:

- [ ] All copy is lowercase
- [ ] Knob colors match semantic table
- [ ] No `rounded-2xl` / `rounded-3xl` / `bg-[#...]` arbitrary hex
- [ ] No `backdrop-blur` / glassmorphism
- [ ] Spacing aligns to 8px grid
- [ ] Each interactive element has a visible state change
- [ ] No emoji in functional copy
- [ ] LCDs contain no editable elements
- [ ] If a new component was added, it lives in `src/shared/ui/te/` and is documented here

---

> **Last word**: when in doubt, open `/te-lab` and copy from there. The sandbox is the canonical implementation.
