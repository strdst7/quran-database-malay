---
slug: selection-search-popup
created: 2026-08-01
status: complete
---

# Selection-search popup - done

Implemented the highlight-to-search popup. Three source files changed:

- **index.html** - added `.selection-popup` div with one `#selection-popup-btn` ("Cari teks ini"), `hidden` by default, `role="toolbar"`.
- **style.css** - `.selection-popup` + `.selection-popup__btn` using QuestUI tokens (gold border, `--surface-raised` bg, `--focus-ring` on focus-visible, `prefers-reduced-motion` guard).
- **app.js** - new functions `handleSelectionEnd`, `positionSelectionPopup`, `searchSelectedText`, `hideSelectionPopup`; wired in `init()` on `mouseup` / `keyup` / `scroll` (capture) / `Escape`. The button's `mousedown` is `preventDefault`-ed so the selection survives into the `click`.

## Behaviour

- Works for Malay, Arabic, and English selections (any text node in the body, incl. verse cards and featured verses).
- Popup appears above the selection; flips below if the selection is within ~8px of the viewport top, and clamps horizontally into the viewport.
- Clicking the button (or focusing it and pressing Enter) sets `#search-input.value` to the selected text, clears the native selection, calls `runSearch()`, and focuses the input.
- Skips: empty selections, selections > 200 chars, and selections inside form fields / the popup / `contenteditable`.
- Hides on scroll and Esc.

## Verification

- `node --check app.js` - parses OK (no syntax errors).
- `node --test app.test.mjs` - 10/10 pass (no regressions; new code is DOM-gated, not exercised under Node).
- `grep -c innerHTML app.js` = **0** - XSS gate preserved (all DOM via `createElement` / `textContent` / `setAttribute`).
- Local HTTP smoke - root 200, popup div present in served HTML.
- Interactive browser QA (selection positioning, RTL Arabic selections, mobile touch) deferred to the user.

## Notes

- No `git push` performed here; the change is a local commit only (the user pushes when ready).
- Follows the existing XSS-safe rendering pattern; no new dependencies.
