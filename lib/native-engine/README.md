# Native match engine

This is the scenario-independent implementation path for complete native matches.
It has no authored board, fixed opening hand, scenario ID, or turn limit. The
existing `native-proof` runner remains the regression/conformance reference and
continues to load its original saved versions.

## Implemented foundation

- Physical cards and explicit 40/60 deck sizes; 40 is an open-play format choice.
- Ordinary starting-location setup: simultaneous private choices, both conversion
  consents, repeated physical-card reselection, legal placement choices, real
  server shuffles and simultaneous eight-card hands continuing into turn one.
  Converted locations keep only the top version active; an attempted conversion
  of an unconvertible starting location puts the converting card out of play.
- Ordered Reserve, Force, Used, Lost, hand and unresolved destiny zones; atomic
  validation of payments by both players and order-preserving recirculation.
- Server entropy with unbiased Fisher–Yates shuffling. Save the resulting order
  in the command transaction; do not publish random seeds or hidden card IDs.
- Version-bound, JSON-only match snapshots, pending actions and private decisions.
- Six repeating phases, start/end timing, mandatory action ordering, alternating
  optional opportunities, costs before responses, nested responses, cancellation
  cleanup, and continuations that yield for player decisions.
- Activation counted after start actions; optional activation/drawing one card at
  a time; both Used Piles recirculate before end effects. Cards used during those
  effects wait until the next recirculation.
- Private projections, revision checks, concession and Life Force exhaustion.
- The existing production proof now shares the shuffle primitive.
- Ground components: character/location deployment and conversion, presence and
  control, site drains, ordinary movement with attachments, CZ-3/Wolfman drain
  reactions, Barrier timing/expiry and It Could Be Worse loss reduction. These
  compose with the runtime rather than depending on named study fixtures.
- Dynamic starter character/site modifiers, including restricted-three copy
  limits and Core Shaft's erratum granting Luke +2 power on any world.

`Rules` is a **server code interface**, not client-supplied configuration. The
rules package supplies card definitions, setup completion checks, generation,
legal actions, automatic actions, effect initiation/resolution, private choices,
and additional state invariants. Its ID is pinned in every match. The service
must keep the corresponding implementation available for saved matches.

A handler must explicitly distinguish initiation, a valid response, result and
cleanup. It may push a JSON decision continuation during resolution. It must
provide only valid responses in response windows and only start/end actions at
those boundaries. A handler that cancels an Interrupt still resolves the
appropriate cleanup; cancellation does not refund paid costs.

## Remaining implementation (not optional scope)

No production rules package or native full-game API is enabled yet. A passing
kernel test is not evidence that a card's printed behavior is implemented.

1. Extend ordinary setup to Objectives, Starting Effects/Interrupts and other
   starting-card effects. `LocationSetupRules.ordinarySetup` rejects these until
   their sequence exists. Premiere starter setup metadata is implemented; this
   does not admit those decks' later card behaviors.
2. Migrate verified ground behavior into composable, scenario-free handlers;
   implement the remaining reachable starter effects and all their timing.
3. Integrate continuous deployment, control/drains, battle, movement, reactions,
   destiny, loss/retrieval and victory across randomized full decks. Vehicles,
   pilots, passengers and broader catalog effects remain required for broader
   engine coverage; they are not implicitly admitted by these primitives.
4. Bind native matches to durable service transactions, command receipts and
   authenticated seats. The proof service has this machinery, but it is not yet
   wired to this engine. Add native CPU decisions and shared match delivery.
5. Verify full-match GEMP/rule conformance, process recovery, concurrency,
   performance and phone/tablet/desktop gameplay before opening the game gate.

`createMatch` rejects cards not admitted by `Rules.supports`. Do not mark a card
supported based on a closed study: every reachable behavior of that card must be
implemented in the selected rules version. The complete catalog remains the
ultimate scope; starter integration is the first usable milestone.

## Evidence

Run `npm run test:engine` and `npx tsc --noEmit`.

`tests/native-engine/core.test.mjs` uses **synthetic rule handlers** to exercise
interpreter semantics, private decisions, cancellation, payment rollback and
serialized recovery across 29 complete turns. It does not assert SWCCG card
conformance or database/process recovery. Existing `tests/native-proof` tests
retain their independently recorded GEMP comparisons.

`tests/native-engine/setup.test.mjs` runs the full authored starter decks through
ordinary setup in a setup-only test adapter. All 81 initial physical pairs match
the existing executed GEMP fixtures for board, Dark generation and hand/Reserve
counts. Both conversion consents, privacy, 40-card sizes, exhausted choices,
six reselections, second-shuffle rollback and 80 randomized shuffles are tested.
No new GEMP execution is claimed. Shuffle orders are independent; tests compare
conservation, not GEMP random-number parity. AR Example 5 permits an unused
duplicate after both players decline; pinned GEMP excludes the whole title, so
the native code intentionally follows the rulebook on that documented edge.

No-location handling is checked against the pinned GEMP starting process, which
marks a side without a valid location and continues. The unconvertible-location
test covers the AR starting-setup exception with synthetic metadata; neither is
claimed as a new executed GEMP fixture.

`tests/native-engine/ground.test.mjs` verifies the ground components with private
test-only deck admission, JSON reconstruction, immutable commands and comparisons
against previously conformed boards. Pinned GEMP card source informs costs,
copy limits and modifiers; no new Java execution is claimed. Core Shaft uses the
Advanced Rulebook Appendix A erratum, not the archive's original printed text.
Battle, weapons and remaining card effects still need integration, so the
production Premiere rules package admits no full-match decks yet.

Rule references: [Advanced Rulebook](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf),
Ch. 1 (Force, actions and destiny), Ch. 2 (turn order), Ch. 3 (activation),
Ch. 8 (draw phase and end of turn). Mandatory choices and unresolved effects must
not be skipped merely because a UI timer is available.
