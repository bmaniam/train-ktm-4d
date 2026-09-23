# Nazrie Heat-Map Matrix

An interactive single-page heat-map website that reproduces the number-pattern matrix and Tier/Day selection table from **nazrie file.xlsx**.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and layout |
| `styles.css` | All visual styling (CSS classes, no inline styles) |
| `script.js` | All interactivity – data, rendering, heat-map logic |
| `scripts/serve.py` | Runs the tool locally and fetches Magnum results for it |
| `README.md` | This file |

---

## Setup (local)

No build step and nothing to install. Recommended — run the helper, which also
enables one-click **Fetch Magnum results**:

```bash
python3 scripts/serve.py
# then open http://localhost:8000
```

Browsers don't let a page read another website's data unless that site
allows it, and Magnum doesn't. `serve.py` serves the tool *and* fetches
Magnum's results on its behalf, so the button works. It only forwards
Magnum's past-results addresses and only listens on your own machine.

You can also open `index.html` directly, or serve it with
`python -m http.server 8080`. Everything works that way except the
automatic fetch — use **Paste JSON instead** there (see below).

---

## Loading real Magnum results into the Tier/Day table

In the Tier/Day card, pick **Up to date** and **Number of draws** (e.g. 10
or 100), then click **Fetch Magnum results**. This requests:

```
https://www.magnum4d.my/results/past/between-dates/null/<date>/<count>
```

and replaces the Tier/Day table with one column per draw:

| Magnum field | Goes to |
|---|---|
| `DrawID` | column header (e.g. `421/26`) |
| `DrawDate` | the column's date picker |
| `FirstPrize`, `SecondPrize`, `ThirdPrize` | Tier 1, rows 1–3 |
| `Special1` … `Special10` | Tier 2, rows 1–10 |
| `Console1` … `Console10` | Tier 3, rows 1–10 |

Day-1 is the first draw Magnum returns — the most recent one. Empty prize
slots (e.g. `----`) are left blank. Loading replaces the table and clears
any selection.

**Paste JSON instead** (works everywhere, no helper needed): open the
address shown in the panel in a new tab, select all, copy, paste, and click
**Load pasted results**.

---

## GitHub Pages deployment

1. Push the four files to the root of a GitHub repository (or a `/docs` folder).
2. Go to **Settings → Pages**.
3. Under **Source**, choose the branch and folder (`/ (root)` or `/docs`).
4. Click **Save**. GitHub will publish the site at:
   `https://<your-username>.github.io/<repo-name>/`

No other configuration is needed – the site is fully static.

---

## Replacing the matrix data

All data lives in **`script.js`** near the top, clearly marked with `↓↓↓ Replace … here ↓↓↓` comments.

### Main matrix

Find the `MATRIX_ROWS` constant. Each entry is:

```js
{ label: "R1", cells: ["1123", "1112", null, …] }
```

- `label` – the row identifier shown in the sticky left column.
- `cells` – exactly 29 values matching columns C1–C29.
- Use `null` for empty cells.
- Use string values so leading zeros are preserved (e.g. `"0247"` not `247`).
- You may also use the original Excel "O" prefix (e.g. `"O247"`); the app normalises it automatically.

### Tier/Day data

Find the `TIER_DATA` constant. Structure:

```js
const TIER_DATA = {
  tier1: [
    ["Day1value", "Day2value", "Day3value"],
    …
  ],
  tier2: [ … ],
  tier3: [ … ]
};
```

- Each inner array represents one row; indices map to Day-1, Day-2, Day-3 (and Day-4+ if added).
- Tier 1 has **3 rows**, Tier 2 has **10 rows**, Tier 3 has **10 rows** (fixed – do not add/remove rows).
- Use `null` for blank cells.

### Column headers / pattern types

Edit `COL_HEADERS` and `PATTERN_TYPES` near the top of `script.js` if your column labels change.

---

## Usage

### Selecting codes
- **Click** a cell in the Tier/Day table to select it (turns blue).
- **Click and drag** across multiple cells to select them all at once.
- Dragging over already-selected cells **deselects** them.
- Click **✕ Clear Selection** to deselect everything.

### Heat map
- After selecting cells, the main matrix instantly highlights:
  - **Strong red** – cells whose value exactly matches a selected code.
  - **Light red** – the eight cells immediately surrounding each exact match.
- Statistics at the top show the count of selected codes, exact matches, and surrounding cells.

### Search
- Type a 4-digit code in the search box and press **Enter** or click **Search**.
- Matching cells are outlined in blue without affecting the heat-map selection.
- Click **✕** next to the search box to clear the outline.

### Adding days
- Click **＋ Add Day** to append a new day column (Day-4, Day-5, …).
- New cells are editable – click a cell and type a 4-digit code.
- Codes with a leading uppercase or lowercase "O" are automatically converted to "0".
- Invalid entries (not exactly 4 digits) are flagged with a red border.

### Editing existing day cells
- Day-4 and beyond are editable by default.
- Press **Enter** or click outside the cell to commit the value.

---

## Leading-zero handling

Excel silently removes leading zeros from numbers. The source data uses the letter **"O"** as a substitute for a leading zero. For example, `O247` represents `0247`.

The app's `normalizeCode()` function converts any initial `O` (upper or lower case) to `0` automatically. This happens at display time and during comparison – the raw data in `script.js` is unchanged.

---

## Browser support

All modern browsers (Chrome, Edge, Firefox, Safari). No polyfills or transpilation needed.
