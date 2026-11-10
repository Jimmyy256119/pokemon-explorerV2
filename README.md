# Pokémon Explorer (merged)

React + Vite frontend (`src/`) with an Express backend (`server.js`) over PokéAPI.

## Run

```bash
npm install
npm run dev      # Express on :3001 + Vite dev server (proxies /api to :3001)
npm run build    # tsc --noEmit && vite build  -> dist/
npm start        # serve dist/ + API from Express
```

## What was merged

| Source | What it contributed |
| --- | --- |
| MemberA (V2) | Base of the project: React/Vite app, hardened server (input validation, PokéAPI cache, de-duplicated requests) |
| MemberC | Older copy of the same V2 app — everything in it is already in A, so nothing was added (see notes) |
| MemberB | Trie autocomplete (`/api/search`) — ported into the React search box; original HTML/JS version kept in `legacy-v1/` |

- `server.js`: `Trie` class + `GET /api/search?q=` (built once from the PokéAPI name list).
- `src/pokemon.ts`: `fetchPokemonSuggestions()` / `normalizeSuggestionQuery()`.
- `src/PokemonSearchBox.tsx`: 250 ms debounce + abort of stale requests; shows Trie prefix results first and falls back to the existing fuzzy (Levenshtein) matching for typos.
- `legacy-v1/`: Member B's original HTML/JS + Express version (autocomplete + stat bars). Not served; useful for the Before → After part of the presentation.

## Notes on conflicts

- `server.js`, `src/pokemon.ts`, `src/DetailsPage.tsx`, `src/styles.css`: A and C differ; A's version was kept (superset of C's validation/caching; horizontally scrollable evolution row instead of C's hard `slice(0, 3)` cap).
- B's stat bars already exist in the React version (`base-stat-chart` in `DetailsPage.tsx`), so they were not ported again.
