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
- Continuous docking-bay transit selects any eligible ground party before paying
  once for the group, preserves attached equipment, consumes each regular move,
  and exposes simultaneous arrivals to minefield triggers.
- Docking Control Room searches select a legal bay/placement from Reserve, deploy
  or convert it, and save the shuffled remainder atomically. Failed searches allow
  opponent verification without revealing pile order and disable that function
  until the next turn. Mos Eisley city sites stay grouped during placement.
- Run Luke's movement mode brings Luke into either player's newly initiated battle
  for free, with a dynamic noncumulative +2 unless Vader is present/adjacent.
  Narrow Escape attempts individual regular moves in the owner's chosen order,
  with paid costs, legal separate destinations and partial results when blocked
  or out of Force. Battle membership/end conditions update after these effects.
- Cost continuations may yield for private decisions and result responses before
  the paid action becomes respondable. Cancellation does not refund these costs.
- Retrieval is a serialized action with initiation, before-retrieval and per-card
  result windows. Ordinary retrieval takes the top Lost card; specific retrieval
  selects eligible cards without rearranging the remainder. Retrieved identities
  are public, while Used order stays private. Both Reinforcements cards connect
  their paid ordinary destiny to retrieval of the current starter troopers.
- Han's Dice cancels and redraws a just-drawn battle destiny. Its Interrupt and
  original destiny finish before the replacement, which can itself be redrawn.
  Replacements still count as one battle destiny for Takeel; exhausted Reserve
  supplies no destiny rather than a zero.
- The Bith Shuffle and Ommni Box target either player's nonempty Reserve, Lost or
  Used Pile. Server entropy, saved order and rollback are atomic. These ordinary
  Interrupts are available in either player's phase opportunities and during the
  weapons segment, not unrelated responses, start/end or power/damage windows.

- Vader's mandatory losing-battle choke runs once in the winner/loser response
  window. Zero through four leave Imperials alone; higher or failed destiny
  requires an eligible Imperial to be lost, including Vader himself. Targeting,
  pre-loss responses, simultaneous attachment loss and owner ordering survive
  JSON reconstruction. Loss supplies no forfeit credit. If it removes the last
  presence during power, the battle ends and hit cards are lost; calculated
  balances are retained in history but no longer payable.

- Vader's Obsession connects an actual adjacent Vader arrival during Dark's move
  phase to a serialized duel. Dark draws twice, then Light; current individual
  power is used, followed by winner retrieval, loser's Force loss, and character
  loss. Ties and two failed destiny sets cause no losses. Results survive reloads,
  honor ordinary loss reduction, and stop immediately at Life Force exhaustion.
  A participant leaving before results ends the duel. Run Luke cancels Obsession
  before draws and shares its unique-per-turn limit with its movement function.
  One-sided failed destiny is explicitly incomplete: its rulebook winner is
  recorded, but the unverified Force-difference amount cannot be applied.

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
2. Implement remaining reachable starter effects and all their timing: remaining
   Interrupt modes, retrieval/revival modifiers and prevention, other destiny effects and remaining
   duel rules (including the failed-destiny Force amount), among others.
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

## Travel checkpoint

`travel.test.mjs` adds party selection/cancellation, all eight bay departure costs,
attachments and minefields on group arrival, successful/failed/converted Reserve
searches, private membership versus hidden order, entropy-failure rollback and
repeat limits. Battle movement checks both initiators, Vader's dynamic suppression,
Barrier/regular-move/battle restrictions, split destinations, partial/no escape,
guards/droids, cancellation cleanup, and Run Luke followed by Narrow Escape.

The suite compares five previously recorded GEMP transit/search observations in
`tests/native-proof/gemp/location-oracle-result.json`. Two new JUnit tests record
five additional observations in `tests/native-engine/gemp/travel-results.json`:
Run Luke with/without adjacent Vader, plus Narrow Escape with 0/1/2 Force.
`travel-provenance.json` records the pinned source and reproduction command.
These are component boards; full-match and complete response timing parity remain
unproven. Commands round-trip JSON; service/process/browser recovery remains pending.

Normative references: Advanced Rulebook pp12 (search and verification), 66
(docking transit), 70–71 (move away and separate paid regular moves), and 184
(Mos Eisley grouping). Pinned GEMP sources include `Card101_003`, `Card101_004`,
`Card1_098`, the four docking-bay classes, `MoveCardsAwayEffect`,
`DeployCardFromPileEffect`, and `DeployLocationEffect`.

Run Luke's alternative cancellation is now implemented with the duel
implementation. Neither Run Luke nor any full deck is admitted merely because
its movement mode passes. Transit here covers ground characters and their attached
cards; vehicle/capacity rules remain part of the broader engine work. Current
location metadata covers the starter sites, not all systems and special layouts.

## Retrieval and Interrupt checkpoint

`interrupts.test.mjs` exercises both Reinforcements cards, reusable ordinary and
specific retrieval, Han's Dice and both pile shufflers. It checks exact pile order,
partial/zero/failed results, cancellation and costs, private seats, stale commands,
invalid saved continuations, entropy rollback, all six pile targets, timing windows,
repeat redraws and interaction with Takeel. Every command reconstructs JSON and
compares both player projections. This is not process/database recovery evidence.

Two fresh GEMP JUnit tests record seven observations in
`tests/native-engine/gemp/interrupt-results.json`; the native suite compares all
seven. Both Reinforcements cards are run with destiny 0, 2 and 5 and two eligible
Lost troopers. Han's Dice confirms the Used order: replacement, original destiny,
then Interrupt. GEMP's duplicate blueprint selection takes the nearer eligible
physical card first; the native comparison selects those same copies. The harness
uses component boards and filler decks, not full starter matches. See
`interrupt-provenance.json` for reproduction and limitations.

Normative sources are the Advanced Rulebook pp11–12 (retrieval/revelation), 30–32
(destiny cancellation and completion) and 54–55 (weapons versus power segment
actions). Pinned GEMP classes are `Card1_106`, `Card1_251`, `Card1_084`, `Card1_115`,
`Card1_262`, `ForceRetrievalEffect` and `CancelDestinyAndCauseRedrawEffect`.
The public Lost Pile makes an empty specific retrieval independently inspectable;
native does not add GEMP's extra empty-search acknowledgment dialog.

The current retrieval eligibility lists cover starter Rebel Troopers and
Stormtroopers. Other trooper identities, Y-wings/TIE/lns, retrieval prevention,
replacement destinations and other destiny modifiers remain required before
broader deck admission. The generic primitive currently accepts integer amounts.
Full-card and complete timing conformance are not implied by this checkpoint.


### Vader choke checkpoint

`character-triggers.test.mjs` covers required timing and turn-player ordering,
zero/high/failed/canceled destiny, target eligibility, excluded versus late-arriving
Imperials, both seats, source removal, cancellation before loss, attachment ordering,
nonzero attrition, subsequent forfeits, early battle termination, stale commands
and corrupt snapshots. Every command reconstructs state and checks both projections.
`gemp/NativeEngineChokeOracleTests.java` executes eight comparative outcomes; its
results and pinned-source provenance are beside the harness.

Rules-source discrepancy: the AR's explicit power-segment presence rule and pinned
GEMP both end battle when Vader chokes the last presence before damage. The AR p59
Physical Choke example instead proceeds to damage after the last presence leaves.
This implementation follows GEMP and the explicit segment rule; the conflicting
example is retained in `choke-provenance.json`, not silently treated as agreement.
Full card admission remains closed while remaining interactions are implemented.


### Duel checkpoint and admission gap

`duel.ts` stores the complete pending duel and public draw history; `duel.test.mjs`
checks both normal winners, ties, draw order, successful zero versus failed draws,
partial Reserve exhaustion, Interrupt cancellation/uniqueness, movement eligibility,
participant departure, equipment power, retrieval/loss order, reduction, attached
loss ordering, final Life Force defeat and saved-state validation. Test commands
reconstruct JSON and verify both seat projections. Five complete outcomes match
fresh pinned GEMP executions in `gemp/duel-results.json`.

The three empty-Reserve observations are kept as discrepancy evidence, not claimed
as parity. GEMP's DuelState compares base power even when all duel draws failed.
AR p31 instead makes a player with no successful draw lose automatically; if both
fail, there is no result. Native follows those winner rules. When exactly one
player fails, the amount for Obsession's Force difference has not been established
from an authoritative ruling: `difference: null` preserves that uncertainty and
attempting retrieval raises an explicit error without committing partial effects.
This internal engine branch must be completed before admitting Obsession or full
starter matches. It is not a new scenario or a public gameplay path. Broader duel
modifiers, destiny-completion/total response hooks and other duel cards remain in
scope. See `gemp/duel-provenance.json` for exact evidence and limitations.


### Revival and regeneration checkpoint

`revival.ts` implements Old Ben's paid response to a character forfeited from a
Tatooine site and Kintan Strider's paid response to an opponent's character lost
from table. Old Ben returns the exact physical card, retains its original forfeit
credit, leaves attachments in Lost, and exposes a prevention window before removal
from Lost. Placement in play is neither deployment nor Force retrieval. The
Interrupt stays in play through its result responses and is then lost.

Battle state now remembers departed participants. Returning to the same site does
not reinstate battle membership or a former hit; a revived character cannot be
forfeited again in that battle. Per-turn battle history still applies, while a new
turn's battle can include the character normally. Premature battle-end hit losses
now expose table-loss responses before ending the battle.

Kintan retrieves the nearest-to-top eligible character to hand, without allowing
a different selection or rearranging Lost. Characters lost as units of Force do
not qualify as its trigger. An unsuccessful character search disables the same
Kintan function, including other copies, until the next turn. Lost piles are public,
so failed-search verification does not need GEMP's extra acknowledgment dialog.
The current search restriction is specific to Kintan; a broader title/function
search registry remains necessary when adding other such effects.

Seventeen tests in `tests/native-engine/revival.test.mjs` reconstruct JSON after
every command and inspect both seat projections. They cover both card modes,
attachments, retained damage credit, cancellation and prevention, target/timing
restrictions, costs, pile order, turn expiry, Talz's asynchronous forfeiture cost,
mine casualties, premature ending, later battles, and invalid commands/saves.
Four outcomes match fresh pinned GEMP execution: Old Ben with and without attached
blaster/belt, successful Kintan retrieval and failed character search. Evidence,
harness hash and scope are recorded in `gemp/revival-provenance.json`.

Sources: Advanced Rulebook pp12, 26, 60–61, 123 and 150; GEMP `Card1_100`,
`Card1_254`, `TriggerConditions.justLost`, `PlaceAtLocationFromLostPileEffect`,
`PlaceCardInPlayEffect` and `ChooseCardsFromPileEffect`. These component checks do
not admit complete cards or decks. Wider prevention/replacement, persona/copy-limit
interactions, cancellation cards and broader loss causes still need implementation
and conformance evidence. Existing GEMP paths and saved proof versions are unchanged.

### Set For Stun and persistent drain cancellation

`stun.ts` adds Set For Stun as a paid ordinary action, including the weapons
segment. It targets an opposing Character, uses 2 Force, resolves through shared
individual/total destiny windows and compares strictly against current ability.
A Droid has zero ability; a failed draw is not a successful zero. A successful
return includes descendants in their owners' hands, without loss/forfeit credit
or Kintan/Old Ben responses. The Interrupt remains in play through return responses
and then goes to Lost. Battle synchronization clears departed hits/participants;
removing the last presence ends the battle after the Interrupt finishes.

`table.ts` shares recursive attachment removal between simultaneous loss and
return-to-hand, preserving Lost ordering only for actual losses. Tests reconstruct
JSON and compare both seat projections after each command. They cover costs,
timing, cancellation, prevention, empty/canceled draws, target departure, current
ability, mixed-owner nested equipment, battle termination, outside-battle targets,
stale/opponent/forged commands and thirteen matching GEMP outcomes.

Successful movement/deployment reacts now permanently mark their parent Force
drain canceled as soon as they bring presence. Ordinary arrival responses remain
available, followed by the cancellation result window. Removing the reacting card
in a later response cannot revive the drain, enable another react or offer an
Assault against it. Droid-only arrival and canceled move-react do not cancel it.
The official AR p170 governs this behavior. A fresh pinned GEMP observation shows
its `ForceDrainState.canContinue()` changing from false to true when reacting
presence is removed by a fixture intervention. This is documented as a discrepancy,
not described as matching conformance or a playable removal response.

Evidence: `tests/native-engine/gemp/stun-*`, `react-cancellation-*` and their Java
harnesses. Sources: official AR pp18 and 170, GEMP `Card1_268`,
`ReturnCardToHandFromTableEffect` and `ForceDrainState`.

The engine remains incomplete. General ability modifiers, targeting immunity and
redirection, zone-change target identity, before-draw/per-Force cost windows,
replacement/prevention cards and aboard/captured targeting still require work.
No full card/deck is admitted by this checkpoint. Existing proof versions and GEMP
routes remain intact; this adds engine behavior without new study UI.

### Scanning Crew and timed private inspection

`scan.ts` implements Scanning Crew's paid ordinary action (also during weapons),
inspection of the opponent's current hand, and optional selection of one Rebel
Character to put on top of that player's Used Pile. Declining and hands without
Rebels leave the hand unchanged. The source stays in play throughout the effect
and finishes Used, or Lost if its play is canceled. An inspection prevention
window precedes disclosure; a chosen Rebel is revealed before removal and checked
again before being moved. Removal is neither character loss nor Force loss.

The printed ten-second glance is a serialized deadline. `Context.now` is trusted
server time, supplied outside the player command. `project(..., now)` immediately
redacts an expired full-hand view even before a timer transaction has run.
`advanceTime(..., now)` moves an expired inspection to optional Rebel selection
(or finishes when no Rebel was found), incrementing the revision exactly once.
The service must commit this using its command compare-and-swap path. Early
acknowledgment is allowed; neither reads nor recovery start another ten seconds.
Only the inspecting seat receives hand details and private choices. After the
inspection, only eligible Rebels are offered, and after selection only the chosen
card is disclosed for responses. Concession revokes inspection/selection views.

Nineteen native tests cover both seats' projections and JSON restoration, deadline
boundaries/idempotence, stale commands, payment, legal timing, second copies,
selection and declining, no Rebels, cancellation/prevention, departing targets,
later hand arrivals, wrong-seat/forged choices and corrupt state. Six fresh pinned
GEMP outcomes match hand changes, inspected counts, cost and Used disposition.
GEMP itself uses an untimed acknowledgment; native uses the printed ten seconds.
Sources and exact scope are in `tests/native-engine/gemp/scan-provenance.json`.

This remains engine implementation, without new Rules Lab studies. The native
service's authenticated timer scheduling/CAS and browser countdown are still
required along with full-match API and UI integration. General text modification,
Rebel identity modifiers, hand-removal/inspection prevention cards, target immunity,
replacement and individual Force-use response timing remain unfinished. Existing
GEMP/proof paths are unchanged and full native deck admission remains closed.
