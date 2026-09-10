# SWCCG · The Holotable

A responsive card archive and interface for the Players Committee's GEMP SWCCG rules engine. The earlier simplified game has been retired; card abilities and game legality are never inferred from catalog stats.

- **Archive:** 3,824 current Decipher/PC virtual records, printed text, original scans, expansion filters and both faces.
- **Decks:** custom editor with GEMP validation, separate outside-deck cards and save/readback checks.
- **Games:** GEMP computer and human opponents. Open 60 and explicitly labeled GEMP Open 40 formats. The battlefield currently embeds GEMP's complete client.
- **In progress:** custom battle UX for phone/tablet/desktop, guided sealed workflows and persistent hosted engine deployment.

Run `npm run engine:start`, set `GEMP_ORIGIN=http://127.0.0.1:17181` in `.env.local`, then `npm run dev`. Docker is required for the engine. Do not expose the development seed accounts remotely.

[Integration, checks, limitations and next steps](docs/OFFICIAL_RULES.md). Source metadata and MIT attributions are in `data/` and `engine/source.json`. This is an unofficial fan interface; SWCCG names and artwork belong to their respective owners.
