# Nazrie Heat-Map Matrix - Development Log

## Project summary

This project converts `nazrie file.xlsx` into a responsive, static web application built with HTML, CSS, and vanilla JavaScript. It can run locally or be hosted directly with GitHub Pages.

## Source data

- Main matrix: 108 rows by 29 columns.
- Matrix row and column positions, including blank cells, are preserved.
- Tier/Day table:
  - Tier 1: 3 fixed rows
  - Tier 2: 10 fixed rows
  - Tier 3: 10 fixed rows
- Codes are stored and compared as strings.
- Consecutive leading `O` characters are normalized to zeros:
  - `O247` becomes `0247`
  - `OO11` becomes `0011`
  - `OOOO` becomes `0000`
- An `O` appearing after the leading characters is not replaced.

## Initial implementation

Created:

- `index.html`
- `styles.css`
- `script.js`
- `README.md`

The initial interface included:

- Tier/Day selection table above the matrix
- Spreadsheet-style matrix with sticky headers
- Horizontal scrolling on smaller screens
- Drag selection of Tier/Day cells
- Clear Selection button
- Exact-match and surrounding-cell heat map
- Search box
- Selection and match statistics
- Add Day button

## Feature changes

### Editable Tier/Day table

- Added an **Edit Table** button.
- The table is read-only during normal selection mode.
- Clicking **Edit Table** changes the button to **Done Editing**.
- All Tier/Day code cells become editable.
- Edit mode disables drag selection so clicks can focus cells correctly.
- Clicking an editable cell selects its current text for quick replacement.
- `Enter` commits the value.
- `Tab` moves to the next cell.
- `Shift+Tab` moves to the previous cell.
- Invalid codes are visually flagged.
- Heat-map and probability calculations update after edits.

### Add Day

- **Add Day** appends Day-4, Day-5, and later columns.
- Tier row counts remain fixed.
- New day cells are editable through Edit Table mode.
- New day columns are included automatically in probability calculations.

### Date selection

- Each day header includes a native date field.
- Dates can be selected using the calendar icon.
- Dates can also be entered manually using the browser-supported date format.
- Each newly added day receives its own empty date field.
- Selected dates are retained when the Tier/Day table is re-rendered during the session.

### Pattern probability

The probability summary was added beneath the Tier rows and merged into the same table so all day columns align exactly.

Supported patterns:

| Pattern | Meaning | Example |
|---|---|---|
| ABCD | Four different digits | `1234` |
| AABC | One pair and two different digits | `1123` |
| AABB | Two pairs | `1122` |
| AAAB | Three matching digits | `1112` |
| AAAA | Four matching digits | `1111` |

For each day, the application:

1. Collects valid codes across all three tiers.
2. Classifies each code by its digit pattern.
3. Calculates the percentage for each pattern.
4. Displays a green intensity scale.
5. Shows the total number of valid codes.

The percentages update after editing codes or adding days.

### Tier-specific heat-map colors

Each selected tier now has a separate heat-map color:

| Tier | Exact match | Surrounding cells |
|---|---|---|
| Tier 1 | Strong red | Light red |
| Tier 2 | Strong blue | Light blue |
| Tier 3 | Strong orange | Light orange |

Rules:

- Every exact normalized matrix match is highlighted.
- The eight adjacent cells are highlighted using the matching tier's light color.
- Exact matches take priority over surrounding highlights.
- Matrix boundaries are respected.
- Removing a selection recalculates the complete heat map.
- The legend updates to show active tiers.
- Statistics include selected-code counts for each tier.

### Search improvements

The top search box now searches both:

- Main number-pattern matrix
- Tier/Day selection table

Search behavior:

- Matching cells receive a temporary outline.
- Search does not alter heat-map selections.
- Leading `O` normalization applies to searches.
- All duplicate matches are outlined.
- Search highlighting persists when a day is added or the selection table is re-rendered.
- Clearing the search removes outlines from both tables.

## Current controls

| Control | Behavior |
|---|---|
| Add Day | Appends the next day column with a date field and empty code cells |
| Edit Table | Enables editing for all Tier/Day code cells |
| Done Editing | Commits editing mode and restores selection behavior |
| Clear Selection | Removes all selected Tier/Day cells and heat-map highlights |
| Search | Outlines matching codes in both tables |
| Clear Search | Removes all temporary search outlines |

## Current heat-map statistics

The statistics panel shows:

- Number of selected codes
- Number of exact matrix matches
- Number of surrounding cells
- Tier 1 selected-code count
- Tier 2 selected-code count
- Tier 3 selected-code count

## Validation performed

The application was opened and tested directly in a browser. Verified behavior includes:

- Matrix and Tier/Day data rendering
- Leading-zero normalization
- Editable Tier/Day cells
- Edit-mode focus and text replacement
- Add Day behavior
- Date entry
- Pattern percentage calculation
- Tier-specific exact and surrounding highlights
- Search matches in both tables
- Search persistence after adding a day
- Responsive horizontal scrolling

## Current project files

| File | Purpose |
|---|---|
| `index.html` | Semantic page structure and controls |
| `styles.css` | Responsive layout, tables, heat-map colors, and edit states |
| `script.js` | Data, rendering, editing, selection, search, probability, and heat-map logic |
| `README.md` | Setup, usage, deployment, and data replacement instructions |
| `log.md` | Development history and current feature summary |

