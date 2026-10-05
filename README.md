# SWCCG · The Holotable

A responsive card archive and interface for the Players Committee's GEMP SWCCG rules engine. The earlier simplified game has been retired; card abilities and game legality are never inferred from catalog stats.

- **Archive:** 3,824 current Decipher/PC virtual records, printed text, original scans, expansion filters and both faces.
- **Decks:** four authored starter lists, available to inspect/customize without a rules connection. Open 60 uses the PC/GEMP Open Demo pair; GEMP Open 40 uses its beginner pair. Saving and starting games check the rules service. Custom decks retain separate outside-deck cards and save/readback checks.
- **Games:** GEMP computer and human opponents. Open 60 and explicitly labeled GEMP Open 40 formats. The battlefield currently embeds GEMP's complete client.
- **In progress:** custom battle UX for phone/tablet/desktop, guided sealed workflows and persistent hosted engine deployment.

Run `npm run engine:start`, set `GEMP_ORIGIN=http://127.0.0.1:17181` in `.env.local`, then `npm run dev`. Docker is required for the engine. Do not expose the development seed accounts remotely.

[Integration, checks, limitations and next steps](docs/OFFICIAL_RULES.md). Source metadata and MIT attributions are in `data/` and `engine/source.json`. This is an unofficial fan interface; SWCCG names and artwork belong to their respective owners.


### Captive lifecycle foundations

The native match engine now distinguishes an inactive captive and its retained attachments from active table cards. Ordinary escort movement carries the group; passenger capacity includes captives when evaluating current or prospective crew layouts. Losing an escort opens a persistent Light release choice. Rally reactivates attachments and may join an ongoing battle; escape returns the character to Used and orders its attachments in Lost. Whole-carrier/site destruction loses affected captives with the other casualties. Dark may deliver captives to prisons and take custody again through ordinary free Move-phase actions. The table UI displays custody and inactive status separately from active forces.

`tests/native-engine/captives.test.mjs` verifies these transitions, malformed saved states, uniqueness, capacity, retained movement/weapon limits and late battle participation. Seven component outcomes compare against unchanged pinned GEMP production effects; `gemp/captives-provenance.json` identifies the controlled fixtures and binds the evidence. Playwright exercises rally, escape and prison delivery through the actual HTTP/service/SQLite D1 path at 1440, 834 and 390px, including both-seat refresh. These are component continuations, not a complete capture match.

Subsequent integration added We Have A Prisoner, Tractor Beam, captured-ship custody, Besieged and ship sites. A complete shuffled capture game now replays 1,677 legal native commands through a 28-turn Life Force victory, matching 162 settled GEMP checkpoints. Saved custody states resume to the same result, and six desktop/phone browser flows exercise capture, crew seizure, escape and theft through the real service. GEMP's intermediate ownership-before-placement response ordering remains a documented limitation: the recorded windows are empty, and nonempty responses are not certified.

Executor and its Holotheatre site now support unlimited printed capacity, persistent unique-site relationships, current Holotheatre errata and free regular hull/site transfers. The [native engine notes](lib/native-engine/README.md) and test receipts describe the exact coverage and remaining limits. Production admission remains closed; full catalog and complete native gameplay requirements remain unfinished. Sites publication is on hold; completed checkpoints are delivered on GitHub `main`.
