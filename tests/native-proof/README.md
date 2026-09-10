# Sites-native focused proof

The `/proof` lab executes nine **closed conformance scenarios**, backed by a TypeScript Cloudflare Worker and D1. It is the beginning of the accepted proof, not a complete SWCCG game engine. Existing GEMP paths remain available.

## Verified in this iteration

| Scenario | Implemented/exercised | Fixed assumptions / exclusions |
|---|---|---|
| Activation | Optional one-card activation, priority, top-to-top pile movement | Generation is fixed at personal 1 + one site icon; no modifiers or hand actions |
| Force drain | Drain attempt recorded, response opportunities, loss from hand or top Reserve/Force/Used | A Stormtrooper controls an uncontested one-icon site; generic control/eligibility not implemented |
| Battle | Initiation cost, optional destiny, unresolved destiny, power, attrition, damage, alternating forfeits/losses | Four printed troopers per side, no weapons, interrupts or modifiers |
| Recirculation | Both players, current player first, Used appended under Reserve in order | Fixed end-of-turn checkpoint, no end-of-turn card effects |
| Weapons / Blasters at the ready / Return fire | Deploy/transfer weapons, firing, hit participants, mandatory hit forfeits, attachment cleanup and owner-selected Lost order | Four ordinary troopers per side; two weapon profiles, no other playable hand actions, ends after one battle |
| Deployment / Reinforcements under fire / The Imperial blockade | Printed deployment, just-deployed Barrier response, restricted battle/movement, optional draw, recirculation and expiry | Mirrored one-turn fixtures, two ordinary troopers in hand, one opposing trooper, two adjacent sites, one Barrier; no other card actions |
| Takeel / A turn of destiny | Optional response, Force cost, pending played Interrupt, destiny-number switch, Lost disposition | Separate four-trooper battle; one Takeel in Dark hand, no other Interrupts or modifiers |

Each scenario preserves all 120 physical cards from the authored GEMP `Precon Premiere Intro 2PG (Light/Dark)` lists. These are fixture inventories, **not** a claim that all 68 unique card behaviors are supported. Full-game card implementation status remains pending in `data/native-proof/manifest.json`; Takeel, both Barriers, four weapons, troopers and the two study sites record bounded scenario conformance separately; full-match creation is unavailable and rejected by the API. Fixtures have controlled pile order, not randomized opening hands. No native AI or sealed engine is implemented.

## Validation and evidence

Run `node --test tests/native-proof/engine.test.mjs`. Fifteen tests cover every decision's JSON reconstruction, card conservation, activation choices, four Force-loss sources, both optional destiny decisions, two battle-loss strategies (eight battle paths), pile order, stale/illegal commands, seat filtering and top-only Lost visibility.

The retained `gemp/NativeProofBattleOracleTests.java` ran against GEMP commit `bbd94d183b29c2e82458293df0327c3b946f3d85`; its JUnit result is `gemp/oracle-result.txt`. It loads the same authored lists and constructs the corresponding four-trooper board. The actual GEMP **both-draw, forfeit-first** branch agrees with native assertions: destiny Light 3 / Dark 1, power 7 / 5, attrition 1 / 3, Dark damage 2, alternating forfeits Dark → Light → Dark, Lost counts Dark 2 / Light 1. Both destiny cards resolve to Used and initiation spends one Force. The remaining native branches have invariant/source checks, not executed differential GEMP comparisons. Selected empty windows are retained; complete timing-window parity is not established.

To reproduce the oracle, place the Java test in GEMP's `gemp-swccg-server/src/test/java/com/gempukku/swccgo/rules/battle/` directory, mount that checkout at `/opt/gemp-swccg`, and run from `/opt/gemp-swccg/src`:

```sh
mvn -q -pl gemp-swccg-server -am -Dtest=NativeProofBattleOracleTests -Dsurefire.failIfNoSpecifiedTests=false test
```

Official rules and current rulings remain normative: <https://www.starwarsccg.org/rules/>. GEMP is the executable reference: <https://github.com/PlayersCommittee/gemp-swccg-public/tree/bbd94d183b29c2e82458293df0327c3b946f3d85>. Conflicts must be reconciled with the official rules, never silently copied.


## Takeel response coverage

`A turn of destiny` uses `native-proof-2`. The four prior scenarios retain `native-proof-1`, unchanged; a source comparison checked 17 legacy routes and 270 saved states, including both player projections. Existing saved games are not upgraded implicitly.

Dark starts with two Force: one to initiate battle and one for the optional Takeel. Both players must actually finish exactly one battle destiny; zero is a valid value, skipping is not a draw. Light receives the first response to the both-complete event. Dark's subsequent Play/Pass choice never auto-continues. Passing retains the card and Force. Playing atomically pays one Force to Used and moves Takeel into a public off-table `playing` zone, held by a persisted Interrupt frame. The result waits for Light and Dark responses, then switches the destiny values and moves Takeel to Lost. The original response opportunity resumes with Light and zero consecutive passes. Empty before-use-Force, Force-used and pile-placement windows settle internally because no card in this fixture can respond to them; broad timing parity is not claimed.

The UI compares drawn and current destiny numbers, shows the played card while it resolves, previews the switch beside the Play action, and explains skipped-destiny ineligibility. It preserves optional drawing, private hands, existing countdown guards and restart links.

- Normative rules: [Advanced Rulebook pp15–17,55,83 and Takeel ruling p153](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf#page=153).
- Executable reference: pinned [Card1_269](https://github.com/PlayersCommittee/gemp-swccg-public/blob/bbd94d183b29c2e82458293df0327c3b946f3d85/src/gemp-swccg-cards/src/main/java/com/gempukku/swccgo/cards/set1/dark/Card1_269.java), `PlayInterruptAction`, `SwitchBattleDestinyNumbersEffect`, `BattleState`, and `PlayoutOptionalAfterResponsesEffect`.
- `node --test tests/native-proof/response.test.mjs`: 13 tests cover legal timing, play/pass, all missing-destiny combinations, zero destiny, insufficient Force, both loss strategies, saved pending resolution, private projection, conservation and engine version checks; the final test compares native outcomes with all six branches in the recorded GEMP result.
- `node tests/native-proof/response-smoke.mjs`: starts a fresh local built Worker on port8792, makes 155 API requests, races eight copies of one paid play plus competing Play/Pass choices, restarts the process while Takeel is unresolved, checks retries after resolution cannot swap again, and verifies shared-seat privacy. No new D1 schema is required.
- `gemp/NativeProofTakeelOracleTests.java`: four executed GEMP tests exercise play, decline, all three missing-draw combinations and unavailable Force. The play branch confirms pending VOID, payment, Lost disposition, physical destiny ownership, switched values1/3, power5/7, attrition3/1 and Light damage2. First Light forfeit leaves attrition1/damage0. Results retained in `gemp/takeel-oracle-result.txt`.

The draw modifiers, cancellation cards, repeated copies, arbitrary decks and full native matches are outside this closed slice. No browser interaction/visual QA or hosted capacity benchmark was performed.


## Deployment and Barrier turn studies

`Reinforcements under fire` (Dark deploys, Rebel Barrier) and `The Imperial blockade` (Light deploys, Imperial Barrier) use `native-proof-3`. The prior five fixtures retain their engine versions and exact state/projection behavior: an independent current-vs-HEAD audit compared 95 routes, 2,217 commands, 2,312 states and 23,120 byte-equality checks.

Both start in Deploy with two ordinary troopers in hand and five in Force; the opponent has a trooper at Light Docking Bay 327, one in Force and one matching Barrier in hand. Dark Detention Block Corridor is adjacent. All remaining authored cards stay in Reserve. Dark can initially deploy at either site. Light can deploy at the Bay but cannot initially deploy at the Corridor (no Light icon/presence); regular movement there is legal. The troopers' free-deploy condition is inactive.

Each trooper costs one Force. The opponent may play or pass Barrier for that exact newly deployed trooper. Passing the first response still allows targeting the second deployment. Barrier pays one Force, remains public off-table while responses resolve, then goes to Used above its payment. It leaves the target at its site with ordinary presence, excludes it from battle and prevents movement until turn end. A sole barred trooper cannot initiate battle; a second eligible trooper can battle without it. At most two ability participates, so no base battle destiny is offered. A two-versus-one unbarred battle causes one damage, zero attrition, payable with Force or forfeit.

Regular adjacent movement costs one Force per character, once per turn; battle does not consume that move. Draw is optional, one top Force card at a time, with alternating action priority. The study ends after active-then-opponent recirculation; only then do Barrier restrictions expire. It does not offer movement during the new opponent turn. This is a closed turn study, not general turn setup or full card support.

Selected meaningful continuations are persisted. Unavailable Force-cost, movement-in-progress, pile-placement and recirculation response windows settle internally in this exact fixture. GEMP observes these windows, but no fixture card can respond; complete timing-window parity is not claimed. New playable cards require revisiting those internal settlements.

- Normative reference: [Advanced Rulebook pp17–20,47,61,66–67,73](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf). Printed Rebel/Imperial Barrier and trooper texts are retained in the manifest.
- Executed reference: `gemp/NativeProofBarrierOracleTests.java`, pinned GEMP commit `bbd94d183b29c2e82458293df0327c3b946f3d85`. Six JUnit tests cover 15 mirrored play/pass/no-Force, target, battle-loss and destination branches, with zero failures/errors (4.155 seconds). Results: `gemp/barrier-oracle-result.json` and `.txt`. Run with the same Maven command above, substituting `NativeProofBarrierOracleTests`.
- `node --test tests/native-proof/barrier.test.mjs`: 17 tests, including direct native outcome comparisons with all 15 recorded GEMP branches. JSON reconstruction occurs after every decision. The total native suite now has 51 passing tests.
- `node tests/native-proof/barrier-smoke.mjs`: 407 requests to a fresh built Worker on port8793; both mirrored scenarios, eight concurrent retries per play, competing Play/Pass, paid-Barrier process restarts, full-turn recovery and authenticated opposing-seat privacy. No database migration required.

The UI shows both locations, exact troop IDs, pending Barrier, restrictions, excluded participants, move usage and expiry. Layout adapts to narrow phone, tablet and desktop widths. Type/build/source and local HTTP checks pass; browser interaction/visual QA and hosted capacity testing were not performed.


## Character weapons and hit results

`Blasters at the ready` (Dark active) and `Return fire` (Light active) use `native-proof-4`. Both begin in Deploy, with four ordinary troopers per side at Light Docking Bay 327. The active side has the basic Blaster and Rifle in hand plus eight Force; the defender has a basic weapon on trooper1, Rifle on trooper2, four Force and no hand. All 120 authored cards are conserved. After table/hand setup, each Reserve begins with a remaining trooper (destiny1), Jawa (3), location (0); Force is allocated from the remaining authored Reserve order. These are private controlled fixtures. Weapon shots consume real Reserve cards; later battle destiny draws the next actual card, not a scripted replacement.

`lib/native-proof/weapon-rules.ts` contains reusable explicit profiles for Light Blaster1_152 / Imperial Blaster1_317 (deploy, transfer, fire1; no bonus) and both Blaster Rifles1_153 /1_312 (deploy, transfer, fire2; +1 weapon destiny). Each requires a strict greater-than result against trooper defense1. Deployment and transfer allow multiple weapons on one warrior; it may use only one different weapon per turn, and each weapon fires at most once per battle. Insufficient Force or empty Reserve makes firing unavailable. Already-hit participating targets remain legal.

The persisted shot has paid cost/target, then a revealed destiny continuation, then its result. A hit does not remove power/ability or prevent return fire and does not change printed forfeit. Damage resolution retains mandatory hit forfeits after numerical debts reach zero, while allowing ordinary legal losses first. Forfeiting an armed trooper removes it and every attachment together into a held `leaving` zone. A saved owner decision places cards on top of Lost one at a time; the final card is automatic. Only the trooper's forfeit credits attrition/damage. All six orders of a bearer plus two weapons are supported.

The UI identifies bearer/weapon/target, shows pending and resolved shots, retains hit markers and weapon-use status, and calls out mandatory hit forfeits separately from damage/attrition. The primary loss guidance does not claim all losses are cleared while hits remain. A phone layout uses compact paired trooper columns; tablet and desktop retain attachment detail.

- Official source: [Advanced Rulebook pp11,53–56,79,94–96](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf), plus the four printed card texts. Pinned GEMP references include `FireSingleWeaponAction`, `HitCardEffect`, `BattleDamageSegmentAction`, `ForfeitCardsFromTableSimultaneouslyEffect` and `PutCardsInCardPileEffect`.
- `gemp/NativeProofWeaponOracleTests.java`: eight executed JUnit tests /18 mirrored branches, zero failures/errors (7.195 seconds) on pinned GEMP. Results retained in `gemp/weapon-oracle-result.json` and `.txt`; reproduce with the Maven invocation above substituting `NativeProofWeaponOracleTests`.
- `node --test tests/native-proof/weapons.test.mjs`: 19 tests, including native comparisons with all18 recorded oracle branches; saved-state reconstruction after each choice, strict thresholds, affordable use limits, return fire, hit-loss sequencing and all six attachment orders.
- `node tests/native-proof/weapons-smoke.mjs`: 669 requests against a fresh built Worker on port8794. Mirrored eight-way firing/order retries, conflicting choices, process restarts at paid shots, revealed destiny, full/partial three-card Lost ordering, complete battle recovery and separate-seat privacy. No schema migration required.
- Independent audits compared all seven old scenarios against the prior release:241 routes,6,040 decisions,6,281 states and62,810 byte-equality comparisons. A further400 seeded weapon runs /12,267 decisions checked conservation, projection privacy,261 shots and110 ordering prompts. No hit obligation remained at a completed battle.

Unavailable internal Force-use, destiny-cost, about-to-hit/hit and about-to-leave responses settle internally in this closed fixture. General cancellation/modifier timing is not claimed. Other weapons, creature/vehicle targets, other warrior text, and full starter matches remain gated. The study ends after battle so unsupported Force cards cannot be drawn into playable hands. Browser interaction/visual QA and hosted capacity testing were not performed.

## Durable service

`proof_matches` stores versioned snapshots and continuation frames. `proof_commands` stores immutable request hashes and receipt versions. A D1 transaction inserts a uniquely claimed receipt and conditionally advances the expected match revision. Duplicate requests cannot advance twice; conflicting choices receive 409. A retry returns state at least as recent as its accepted command. The UI keeps an unconfirmed command's original ID for retry, including refresh in the same tab. Server state is the authority.

Sites supplies authenticated user headers. Anonymous requests are rejected in both development and production. Local preview sign-in uses the existing Sites sign-in plugin. Shared rooms assign Dark to their creator and Light to the first authenticated invitee; two-seat study lets one owner follow both decisions. Shared invitation links require site access and should be treated as invitations. The owner-private deployment intentionally remains owner-only, so a second real account cannot join until access is separately authorized.

Client projections omit private pile identities and the opposing hand. Only top Lost cards are visible. Mutation bodies are bounded and same-origin checked. Full snapshots stay below 160 KB for this closed scope; resolution has a 40-step bound. These bounds are proof constraints, not measured general-engine capacity.

Build the Worker, apply generated migrations to local D1, and start Wrangler on loopback port 8788 with `--local --persist-to .wrangler/state`. Then run `node tests/native-proof/http-smoke.mjs`. The test is restricted to localhost and supplies gateway-equivalent test identities directly to the built Worker. The Vite preview deliberately strips forged identity headers, so this multi-identity test targets Wrangler rather than Vite.

The production-code HTTP run performed 179 API requests, recovering all 49 scenario decisions, eight concurrent duplicate requests, competing choices, seat ownership, hidden hands, third-player exclusion, invalid formats/modes, anonymous rejection and cross-origin rejection. Local observed latency was p50 3 ms / p95 8 ms; this is **not** a hosted capacity benchmark. `node tests/native-proof/restart-smoke.mjs` also verifies all four pending continuations survive a full local Worker-process restart and accept the next choice. Browser interaction/visual QA has not been performed.

## Remaining accepted proof work

Extend the closed deployment/movement/draw slice to complete setup and every reachable behavior of the 68-card pair; preserve all timing and modifiers; add bounded legal CPU play; execute full games and broader GEMP differential traces; extend fresh-worker reconstruction tests to full games, and test resource limits and hosted concurrency at realistic load. Keep native full matches gated until that work passes. Do not upgrade live snapshots to new rules implicitly: retain their engine version or provide a verified migration.
