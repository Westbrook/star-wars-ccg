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
- Continuous ground battles: initiation and react responses, weapons, optional
  battle destiny, Takeel, power totals, alternating damage/attrition/forfeits,
  Talz rescue, end-of-battle and battle-ended windows, then the ongoing turn.
  Battle history enforces one battle per location/participant each turn.
- Four character blasters/rifles deploy and transfer with paid costs. Hits retain
  presence, ability and return fire; firing and bearer limits, destiny modifiers,
  pre-hit/hit/fired responses, attachment loss ordering and early battle endings
  are explicit serialized steps. Both sides' balances remain publicly available.
- Equipment components: both utility belts (noncumulative world-dependent power
  and forfeit), both warrior-training Effects (persistent selected mode), paid
  device transfers, private Electrobinoculars/Macroscan peeks, one-different-device
  usage per bearer per turn, and continuous Comlink deploy-react permission.
- Timer Mines resolve at the next owner turn through ordinary destiny and the
  opponent's casualty choices. Mining droids can defuse either player's mines.
  Exterior planet minefields can contain hidden mines or duds, reveal on arrival,
  allow applicable pre-explosion defusing, and resolve multiple mine/loss choices.
  Ground presence is supported here; enclosed vehicles and other mine types still
  require the broader vehicle/weapon implementation.
- Cost continuations may yield for private decisions and result responses before
  the paid action becomes respondable. Cancellation does not refund these costs.

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
`initiate` runs with its resolution already on the stack. It may put cost
continuations above that resolution; `awaitingResponses` remains true until
those finish. A cost-result event is distinct from a response to the action
itself. Response handlers must check the actual event and pending action stage.

## Remaining implementation (not optional scope)

No production rules package or native full-game API is enabled yet. A passing
kernel test is not evidence that a card's printed behavior is implemented.

1. Extend ordinary setup to Objectives, Starting Effects/Interrupts and other
   starting-card effects. `LocationSetupRules.ordinarySetup` rejects these until
   their sequence exists. Premiere starter setup metadata is implemented; this
   does not admit those decks' later card behaviors.
2. Implement remaining reachable starter effects and all their timing: special
   movement, docking transit/search, remaining Interrupts, retrieval,
   destiny replacement, Vader's forced choke and duel rules, among others.
3. Complete interactions among deployment, control/drains, battle, movement,
   reactions, destiny, loss/retrieval and victory across randomized full decks. Vehicles,
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
The production Premiere rules package still admits no full-match decks: the
components above do not imply support for every effect in those decks.

`tests/native-engine/battle.test.mjs` covers battle phases, reactions, Barrier,
weapon timing and modifiers, destiny privacy/order, Takeel, both loss balances,
Talz's forfeit cost, simultaneous attachment loss ordering, early endings and
Life Force victory. Each command reconstructs JSON and preserves its input.
`weapon-conformance.test.mjs` replays all 18 recorded GEMP weapon branches using
the continuous engine. Only the physical input cards/piles are copied from the
old fixture; no old gameplay resolver runs. This is comparison to prior Java
execution at `bbd94d183b29c2e82458293df0327c3b946f3d85`, not a new GEMP run.
Source references include GEMP `BattlePowerSegmentAction`,
`BattleDamageSegmentAction`, `HitCardEffect`, and cards `Card1_031`, `Card1_152`,
`Card1_153`, `Card1_269`, `Card1_284`. Unsupported cards, immunity, vehicles and
additional destiny types remain gated; full match conformance is not claimed.

Rule references: [Advanced Rulebook](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf),
Ch. 1 (Force, actions and destiny), Ch. 2 (turn order), Ch. 3 (activation),
Ch. 6 (battle sequence, hit/forfeit/attrition/damage), Ch. 8 (draw phase and end of
turn), and Ch. 9 (weapons). Mandatory choices and unresolved effects must
not be skipped merely because a UI timer is available.

## Equipment checkpoint

`equipment.test.mjs` exercises continuous turns, deployment/transfer restrictions,
noncumulative modifiers, training modes, hidden peeks and minefields, reusable
versus different devices, both Timer Mine sides, zero/failed destiny, owner-selected
casualties, multiple mine ordering, attachments leaving simultaneously, defusing,
Comlink battle chains, drain cancellation, CZ-3 host restrictions and site conversion.
Every command reconstructs JSON and compares private projections; these are engine
checks, not database/process or browser checks. Nighttime is a serialized condition
hook tested with synthetic producers; nighttime-producing cards remain pending.

The pinned GEMP reference is `bbd94d183b29c2e82458293df0327c3b946f3d85`.
Card sources `Card1_018`, `Card1_035`, `Card1_040`, `Card1_064`, `Card1_162`,
`Card1_186`, `Card1_201`, `Card1_207`, `Card1_221`, `Card1_224`, and `Card1_322`,
plus `Reacts`, `AbstractDeployable`, `UseDeviceEffect` and `Filters.canUseDevice`,
provide the implementation reference. Official Advanced Rulebook printed pp29,
80, 95 and 169–171 govern cumulative modifiers, devices, transfer, mines and reacts.
Comlink's continuous permission is distinct from using Electrobinoculars; it does
not spend the bearer's one-different-device action allowance.

The new JUnit harness in `tests/native-engine/gemp` checks both belt boards and
zero-destiny mine disposal. Its recorded observations are compared by the native
suite. These targeted comparisons do not establish full timing parity or complete
GEMP equivalence. No standalone study or full-game admission was added.
