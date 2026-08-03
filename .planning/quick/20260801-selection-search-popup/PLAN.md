---
slug: selection-search-popup
created: 2026-08-01
status: complete
---

# Selection-search popup

When a user highlights (selects) any text on the page - Malay, Arabic, or English - a small popup appears above the selection with a button to search that text in the existing search box.

## Scope

- **index.html** - add a hidden `.selection-popup` (toolbar role) containing one "Cari teks ini" button.
- **style.css** - QuestUI-styled popup: gold border, `--surface-raised` bg, focus-ring, reduced-motion guard. Uses existing `[hidden] { display:none !important }` rule.
- **app.js** - on selection-end (`mouseup` / `keyup`), position the popup above the selection's rect (flip below if near the viewport top); clicking the button writes the selected text to `#search-input` and calls `runSearch()`. Zero `innerHTML` (XSS gate preserved).

## Rules / edge cases

- Skip when `!state.ready` (index still loading).
- Skip empty selections and very long ones (> 200 chars).
- Skip selections inside `<input>` / `<textarea>` / `[contenteditable]` / the popup itself (avoid feedback loops).
- Hide on `scroll` (capture) and `Escape`.
- Button `mousedown` is `preventDefault`-ed so the native selection survives the click.

## Non-goals

- No inline editing, copy/share buttons, or toast notifications.
- No change to search ranking or the fold algorithms.
