# Snakes & Ladders (1 to 4 players, local)

Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No install needed.

- `data/config.json`: colors, default names, default rules
- `data/boards.json`: boards. Add your own by copying an entry (ladders go up, snakes go down, no square used twice).
- `js/fallback-data.js`: copy of the JSON so the game also works when opened directly from disk. After editing the JSON, either run a local server (`python -m http.server`) or update this file to match.

Controls: Space or the Roll button. Tick CPU for computer players. One player = solo run (fewest rolls, best is saved).
