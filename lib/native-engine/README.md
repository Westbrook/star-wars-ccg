# Native match engine

This is the scenario-independent implementation path for complete native matches.
It has no authored board, fixed opening hand, scenario ID, or turn limit. The
existing `native-proof` runner remains the regression/conformance reference and
continues to load its original saved versions.

## Implemented foundation

- Physical cards and explicit 40/60 deck sizes; 40 is an open-play format choice.
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

1. General setup: private simultaneous selections, collision/conversion,
   starting card effects, real shuffles and opening hands using this state.
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

Rule references: [Advanced Rulebook](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf),
Ch. 1 (Force, actions and destiny), Ch. 2 (turn order), Ch. 3 (activation),
Ch. 8 (draw phase and end of turn). Mandatory choices and unresolved effects must
not be skipped merely because a UI timer is available.
