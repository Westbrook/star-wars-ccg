# Sites-native focused proof — milestone 1

The `/proof` lab executes four **closed conformance scenarios**, backed by a TypeScript Cloudflare Worker and D1. It is the beginning of the accepted proof, not a complete SWCCG game engine. Existing GEMP paths remain available.

## Verified in this iteration

| Scenario | Implemented/exercised | Fixed assumptions / exclusions |
|---|---|---|
| Activation | Optional one-card activation, priority, top-to-top pile movement | Generation is fixed at personal 1 + one site icon; no modifiers or hand actions |
| Force drain | Drain attempt recorded, response opportunities, loss from hand or top Reserve/Force/Used | A Stormtrooper controls an uncontested one-icon site; generic control/eligibility not implemented |
| Battle | Initiation cost, optional destiny, unresolved destiny, power, attrition, damage, alternating forfeits/losses | Four printed troopers per side, no weapons, interrupts or modifiers |
| Recirculation | Both players, current player first, Used appended under Reserve in order | Fixed end-of-turn checkpoint, no end-of-turn card effects |

Each scenario preserves all 120 physical cards from the authored GEMP `Precon Premiere Intro 2PG (Light/Dark)` lists. These are fixture inventories, **not** a claim that all 68 unique card behaviors are supported. Every card's implementation status remains pending in `data/native-proof/manifest.json`; full-match creation is unavailable and rejected by the API. Fixtures have controlled pile order, not randomized opening hands. No native AI or sealed engine is implemented.

## Validation and evidence

Run `node --test tests/native-proof/engine.test.mjs`. Fifteen tests cover every decision's JSON reconstruction, card conservation, activation choices, four Force-loss sources, both optional destiny decisions, two battle-loss strategies (eight battle paths), pile order, stale/illegal commands, seat filtering and top-only Lost visibility.

The retained `gemp/NativeProofBattleOracleTests.java` ran against GEMP commit `bbd94d183b29c2e82458293df0327c3b946f3d85`; its JUnit result is `gemp/oracle-result.txt`. It loads the same authored lists and constructs the corresponding four-trooper board. The actual GEMP **both-draw, forfeit-first** branch agrees with native assertions: destiny Light 3 / Dark 1, power 7 / 5, attrition 1 / 3, Dark damage 2, alternating forfeits Dark → Light → Dark, Lost counts Dark 2 / Light 1. Both destiny cards resolve to Used and initiation spends one Force. The remaining native branches have invariant/source checks, not executed differential GEMP comparisons. Selected empty windows are retained; complete timing-window parity is not established.

To reproduce the oracle, place the Java test in GEMP's `gemp-swccg-server/src/test/java/com/gempukku/swccgo/rules/battle/` directory, mount that checkout at `/opt/gemp-swccg`, and run from `/opt/gemp-swccg/src`:

```sh
mvn -q -pl gemp-swccg-server -am -Dtest=NativeProofBattleOracleTests -Dsurefire.failIfNoSpecifiedTests=false test
```

Official rules and current rulings remain normative: <https://www.starwarsccg.org/rules/>. GEMP is the executable reference: <https://github.com/PlayersCommittee/gemp-swccg-public/tree/bbd94d183b29c2e82458293df0327c3b946f3d85>. Conflicts must be reconciled with the official rules, never silently copied.

## Durable service

`proof_matches` stores versioned snapshots and continuation frames. `proof_commands` stores immutable request hashes and receipt versions. A D1 transaction inserts a uniquely claimed receipt and conditionally advances the expected match revision. Duplicate requests cannot advance twice; conflicting choices receive 409. A retry returns state at least as recent as its accepted command. The UI keeps an unconfirmed command's original ID for retry, including refresh in the same tab. Server state is the authority.

Sites supplies authenticated user headers. Anonymous requests are rejected in both development and production. Local preview sign-in uses the existing Sites sign-in plugin. Shared rooms assign Dark to their creator and Light to the first authenticated invitee; two-seat study lets one owner follow both decisions. Shared invitation links require site access and should be treated as invitations. The owner-private deployment intentionally remains owner-only, so a second real account cannot join until access is separately authorized.

Client projections omit private pile identities and the opposing hand. Only top Lost cards are visible. Mutation bodies are bounded and same-origin checked. Full snapshots stay below 160 KB for this closed scope; resolution has a 40-step bound. These bounds are proof constraints, not measured general-engine capacity.

Build the Worker, apply generated migrations to local D1, and start Wrangler on loopback port 8788 with `--local --persist-to .wrangler/state`. Then run `node tests/native-proof/http-smoke.mjs`. The test is restricted to localhost and supplies gateway-equivalent test identities directly to the built Worker. The Vite preview deliberately strips forged identity headers, so this multi-identity test targets Wrangler rather than Vite.

The production-code HTTP run performed 179 API requests, recovering all 49 scenario decisions, eight concurrent duplicate requests, competing choices, seat ownership, hidden hands, third-player exclusion, invalid formats/modes, anonymous rejection and cross-origin rejection. Local observed latency was p50 3 ms / p95 8 ms; this is **not** a hosted capacity benchmark. `node tests/native-proof/restart-smoke.mjs` also verifies all four pending continuations survive a full local Worker-process restart and accept the next choice. Browser interaction/visual QA has not been performed.

## Remaining accepted proof work

Implement complete setup/deploy/movement/draw and every reachable behavior of the 68-card pair; preserve all timing and modifiers; add bounded legal CPU play; execute full games and broader GEMP differential traces; extend fresh-worker reconstruction tests to full games, and test resource limits and hosted concurrency at realistic load. Keep native full matches gated until that work passes. Do not upgrade live snapshots to new rules implicitly: retain their engine version or provide a verified migration.
