# Star Wars CCG · The Holotable

A cinematic, responsive fan adaptation of Star Wars Customizable Card Game. Includes a 36-card playable catalog, a deck workshop, 40/60-card formats, sealed expeditions, computer battles, online invitation tables, and shared-device pass-and-play.

## Run locally

Use Node 22.13 or newer. Install with `npm run install:ci`, then `npm run dev` (port 5173).

The app uses a Cloudflare D1 database for decks, sealed pools and matches. The logical `DB` binding is declared in `.openai/hosting.json`. The private guest-pilot identity lives in an HttpOnly cookie; game and deck state lives in the database. Clearing cookies creates a new pilot archive. No account email or external API key is required.

For a fresh local database, run `npm run build`, then apply `drizzle/0000_medical_abomination.sql` once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_medical_abomination.sql
```

Publishing through Sites applies the schema migrations to its hosted database. Keep `sites()` in `vite.config.ts`. Build output is `dist/server/index.js` and `dist/client`.

## Play

- **Computer:** Choose Light/Dark, 40/60 cards, your starter or saved deck, and Cadet/Commander difficulty.
- **Online:** Create a table and share its 8-character code or invitation link. The second player selects an opposite-side, matching-size deck or uses an automatically matched starter. Both players need access to the deployed Site. Sealed tables require both players to bring decks from their own sealed pools.
- **Pass & play:** Choose a matching deck for each player and share one device; a handoff curtain hides the next player's hand until they are ready.
- **Deck workshop:** Search/filter cards, inspect their Holotable stats, add/remove copies, auto-fill and save. Open decks permit four copies per card.
- **Sealed:** Six 15-card packs for a 40-card deck or eight packs for a 60-card deck. Decks must use only copies from that saved pool and retain its side and size. The computer gets a separately generated sealed deck; online opponents bring their own sealed deck.

Phone play shows one selected location and a scrollable hand with persistent bottom navigation. Tablet play uses an icon rail and compact three-location battlefield. Desktop play has the full command rail, larger table overview and adjacent deck composition panel.

## Holotable rules

This is a streamlined adaptation, not the full tournament SWCCG engine. It includes six phases, card-based Life Force, deck activation/spending/recirculation, deployment, uncontested drains, power/destiny battles, movement, drawing, and game completion. There are three fixed locations. Card stats/effects, pilots, weapons, casualty selection and activation are simplified; complete printed abilities and attrition are not implemented. The in-game Field Manual and card inspector explain the exact executable rules. Original card scans are reference artwork rather than the authority for this adaptation's mechanics.

## Validation

```sh
npx tsc --noEmit
node --import tsx tests/engine.test.ts
# Against a running local preview; creates isolated test-pilot data:
node --import tsx tests/api.test.mjs
npm run build
```

Engine checks cover legality, Force handling, sealed validation, hidden information and complete automated matches. API checks cover database persistence, owner isolation, invitations, turn enforcement, optimistic concurrency and hand redaction.

The optional browser WebMCP tools are `read_holotable_collection` and `start_deck_customization`; they feature-detect `document.modelContext`. No compatible validation context was available in this build session. Browser UI automation was not run because it was not requested.

## Artwork and references

The three cinematic environment images are original generated artwork. The classic card scans are from the public SWCCG Players Committee archive; exact source URLs are recorded in `public/cards/sources.json`. The catalog/rules source is https://www.starwarsccg.org/the-basics/ and the public `swccgpc/swccg-card-json` repository. Star Wars is a property of Lucasfilm. This is an unofficial fan experience.

## Progress report

The independent project report is located through `.progress-report/project.json`. It runs separately from the app. App links opened with the presence flag `?progress-report` show a Developer UI return link to the trusted local report at port 4187. Normal game entry does not show it. The report's persistent state, review checkpoints, feedback and handoff live outside this checkout.
