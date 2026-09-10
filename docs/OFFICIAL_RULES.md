# Official rules integration

The previous 36-card TypeScript prototype changed the rules. It has been removed from the active application; `/api/holo` returns 410 and its old D1 records are preserved. The replacement delegates card execution, timing, legal actions, deck formats and hidden information to the unmodified Players Committee GEMP engine. Printed catalog data never executes a card.

The normative sources are the [Players Committee rules page](https://www.starwarsccg.org/rules/), its [2023 Advanced Rulebook](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf), current rulings and errata. GEMP is an established implementation, not a claim that every ruling or card implementation is bug-free.

## Runtime

- Upstream: `https://github.com/PlayersCommittee/gemp-swccg-public`, pinned in `engine/source.json`.
- MIT license: `data/GEMP-LICENSE`. No upstream rules or card classes are modified.
- Java 21, MariaDB 11; Docker required. The engine is a persistent service, not part of the Cloudflare Worker bundle.
- Run `npm run engine:start` to fetch/build/start the pinned engine. Database volumes are retained by `npm run engine:stop`.
- Local `.env.local`: `GEMP_ORIGIN=http://127.0.0.1:17181`. `engine/.env` holds local source location and generated DB credentials, and is ignored.
- Only the app port is published, bound to localhost. MariaDB has no host port.
- Upstream seed accounts are local development fixtures. This compose setup must not be exposed remotely with those accounts. A hosted deployment needs its own controlled GEMP instance, account setup and backups.
- Each engine process starts non-operational. The startup script enables games once through the existing admin endpoint before play. Bonus abilities remain disabled.

The app proxies `/gemp-swccg/*` and `/gemp-swccg-server/*` to the fixed server-side `GEMP_ORIGIN`. Only the GEMP session cookie is forwarded; Sites identity and unrelated application cookies are excluded. Dynamic responses are not cached. The frontend never supplies an arbitrary upstream URL.

## Current interface

The custom archive contains 3,824 current PC card records: 2,546 Decipher and 1,278 virtual. Main Light/Dark files are pinned, with source hashes and attribution in `data/catalog-manifest.json`. Historical legacy virtual files are excluded; alternate art may share a blueprint. Record count is not verified playable-card count.

The custom deck editor preserves main/outside cards, asks GEMP for format checks, rejects unknown IDs before save, and reads saved cards back to detect loss. There is no invented four-copy restriction. Open uses 60 cards; Open 40 is labeled as GEMP's variant. Actual table creation validates the selected format again.

The CPU launcher uses official Death Star II preconstructed decks or GEMP's defined 40-card starters. CPU decisions run inside GEMP. Multiplayer and the battlefield currently use the complete existing GEMP client inside the app, with presentation-only CSS. This retains all seven decision types and complete board behavior. The frame owns the game channel exclusively. The custom responsive battle renderer remains unfinished; an iframe is not completion of that original UX scope.

Sealed products, collation and isolated league collections must come from GEMP. Existing sealed leagues permit human opponents and reject CPU play. Sealed CPU practice with strict pool validation is still unfinished; the app does not invent a replacement format or silently treat an unrestricted deck as sealed.

## Validation

`tests/official-engine-smoke.py` checks actual 60/40 starter persistence, CPU game creation and an engine-provided starting-location decision through the app proxy. `tests/official-pvp-smoke.py` checks opposite-side joining and rejection of a third player from a private game. `tests/official-sealed-smoke.py` checks the engine’s OTSD product, nested boosters and rejection of opening an already-consumed product. These are integration checks, not exhaustive rulebook or full-match tests.

The browser presentation has not been tested interactively. All current checks are compilation, source, data and HTTP checks.

## Remaining work

1. A persistent hosted GEMP endpoint is required for gameplay on the published site. A local preview can use the existing local runtime.
2. Replace the embedded battle presentation with a complete device-specific client that preserves every GEMP decision/event, without calculating legality in the UI.
3. Complete a guided sealed experience using real engine products/collections; preserve the engine's format and ownership checks. Decide how to implement CPU practice without claiming engine league support.
4. Run full-match regression cases and user-authorized browser checks before claiming a complete polished official-rules game.
