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
4. Connect the implemented durable native service, assigned seats and computer
   dispatcher to the full-match client. Add shared match delivery and saved
   deadline handling in the responsive gameplay UI.
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
redirection, zone-change target identity, per-draw/per-Force cost windows,
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


### Tusken Scavengers

`scavenge.ts` adds the paid ordinary/weapons action, shared destiny and a strict
comparison with the current on-table Tusken Raider count. A successful draw offers
the printed optional search. Accepting opens inspection responses, snapshots and
reveals the opposing Used Pile to both seats, and requires loss of each original
vehicle, weapon or device still present. The turn player orders multiple placements
under AR p11; cards left in Used retain their order. Each off-table loss has its
own before/after response boundary and is not a reducible loss of units of Force.
Canceling one placement still allows the remaining losses. The source goes Lost
after its responses, unless the game has already ended.

The JSON continuation survives serialization. Inspection does not expose later
arrivals; leaving targets are revalidated rather than substituted. An equipment-free
search sets the same-title/function restriction for that turn (AR p12); another
copy may still pay and draw, but cannot repeat the failed search. Concession and
Life Force exhaustion revoke the reveal.

Twenty component checks plus nine fresh pinned GEMP comparisons cover successful,
failed and zero destiny, all three equipment types, both placement orders, no
eligible equipment, both turns and weapons timing. Native cancellation, prevention,
mutated piles, terminal results, stale commands and corrupt-state checks supplement
those outcomes. GEMP does not offer the printed optional search and assigns ordering
to Dark even on Light's turn; native follows the card and AR p11. Exact comparison
scope and source provenance are in `tests/native-engine/gemp/scavenge-provenance.json`.

`data/native-engine/additional-cards.json` adds sourced Lift Tube metadata for the
Vehicle classification in off-table effects. It does not enable vehicle gameplay
or alter the existing proof manifest. Broader Tusken identity, text modification,
the stealing variant, prevention/replacement cards and per-Force timing remain
unfinished. Full deck admission remains closed; no new Rules Lab study is added.


### It’s Worse and nested loss cancellation

`worse.ts` implements both functions: cancel an opponent's pending It Could Be
Worse with optional X Force (including zero), or add one damage after the opponent
loses a unit of Force to battle damage. Cancellation targets the exact saved
Interrupt continuation and its original loss context. The canceled Used Interrupt
goes Lost immediately, exposes its cancellation result, and cannot be disposed a
second time if a response moves it. Paid costs remain spent when either Interrupt
is canceled. A later It Could Be Worse may still reduce the original loss.

The increase modifies the existing loss; it never starts another Force drain or
reopens react/Assault opportunities. Battle payment can reach zero and then become
payable again before the battle ends. Added battle damage may be covered by
forfeiture. Noncumulative history stays on the original ground loss/battle across
individual payments and resets with a new loss/battle. A zero increase adds no
modifier. Full loss arithmetic with other continuous modifiers remains required.

Twenty-seven component tests and nine fresh GEMP observations cover both modes,
zero/one/five paid Force, cancellation, repeated copies, nested loss contexts,
terminal results, serialization, invalid choices and target validation. Seven GEMP
outcomes fully agree. Two battle observations agree for the first play but reveal
GEMP's cumulative second-copy increase; native follows AR pp28–29/147 and retains
the first modifier. The actual divergence is recorded in
`tests/native-engine/gemp/worse-provenance.json`, rather than hidden as conformance.

This checkpoint does not implement cancellation-prevention cards, alternate
Interrupt disposal, generic target identity, individual Force-use response windows,
continuous loss modifiers or full service/UI integration. Public card/deck admission
remains closed. Existing GEMP paths and studies remain intact.

### We’re Doomed and shared loss accounting

`loss.ts` preserves each loss's original base, reduction, increase and amount paid.
Ground Force losses and battle damage now use this ledger, so continuing payments
never halve the shrinking remainder. We’re Doomed applies until the end of the
opponent's turn, rounds up by default and down while the current C-3PO/R2-D2
identity is on the table. The less-than-fifteen Life Force condition is checked
when played; resolving the Used Interrupt does not switch it off at fifteen.
Copies halve only once. Costs and irreducible Force losses are not halved.

It’s Worse modifies the drain amount before halving its loss; its general-loss
and battle-damage increases apply afterward. Other reductions also apply after
halving. Forfeiture credit, paid units and excess reduction stay recorded when
rounding changes. Public battle projections calculate live damage without mutating
saved state, and completed battle balances stay frozen. Attrition is separate.

Forty-four tests include 27 component cases and 17 fresh GEMP observations from
four JUnit tests. They cover thresholds, duration, cancellation, both droids,
payments, increases, reductions, forfeiture, reconstruction and invalid commands.
The reference harness uses controlled drain modifiers and droid interventions.
For the departure after a one-unit rounded loss, GEMP has already auto-settled the
loss before returning control; the native comparison uses that same completed
boundary. Reopening within native's final-unit response is separately tested and
is not claimed as an executed equivalent GEMP window. See
`tests/native-engine/gemp/doomed-provenance.json` for precise evidence and limits.

Supplemental droids are metadata-only, excluded from deployment and production
admission. Other personas, permanent astromechs, inactive/captured/immune targets,
full droid abilities, fractional loss values, generic modifier ordering and
replacement/prevention remain required. No new study or full native match route
is enabled by this component checkpoint.

### Battle stakes: Chances and Bad Feeling

`stakes.ts` implements Don't Underestimate Our Chances and You Overestimate
Their Chances as opponent-battle-initiation responses, plus each card's response
to the other pending Interrupt. Base damage is tripled for whichever side loses;
responding with the opposing card triples that result to ninefold damage. Same
title copies targeting the same result do not multiply it again. Target identity
and stack index survive reconstruction, cancellation does not create a modifier,
and source disposal cannot revoke an already scheduled battle modifier.

I've Got A Bad Feeling About This requires Light to have just initiated a battle
with strictly less current participating power (including defending modifiers).
It doubles Dark's resulting damage if Light wins, or triples it with the selected
Han present. Conditions and factor are determined at initiation; Han remains a
required target through responses, while later arrivals do not upgrade the
selected factor. The Used Interrupt's successful result persists through battle.

`Battle.damageMultipliers` records scheduled source/factor/affected-side entries.
The shared loss ledger applies these after We’re Doomed's halving/rounding and
before later damage-segment increases/reductions. Already paid Force and full
forfeiture credit are subtracted afterward. Power, destiny and attrition remain
unchanged. A new battle starts with no inherited multipliers; canceled/premature
battles do not create payable losses.

Fifty tests include 36 component cases and fourteen fresh GEMP observations from
four JUnit tests. Thirteen complete outcomes match. The deeper alternating chain
(base Chances → opposing boost → boost of that booster) is explicitly unresolved:
GEMP ignores the booster’s own triple-result flag and records damage27 from base3.
A recursive reading of the text would produce damage81. Until that interaction is
adjudicated, native rejects its ambiguous resolution atomically, preserving the
save rather than asserting either outcome as official. Tests retain both the
GEMP evidence and that guard. This gap remains required work, not excluded scope.
See `tests/native-engine/gemp/stakes-provenance.json`.

Han Solo metadata is supplemental and cannot deploy or enter a production deck.
Other personas, permanent pilots, targetability/capture, complete Han abilities,
full modifier/prevention/replacement infrastructure and native match delivery
remain unfinished. No new standalone study or full native route is enabled.

### Gaderffii Stick and weapon choice for the turn

`gaderffii.ts` implements deployment and transfer for 2 Force to an own Tusken
Raider, without requiring a Warrior icon. It offers free firing when either
player initiates a battle at that site, targeting an armed opposing participant.
Two serial weapon destiny draws use the shared draw-completion and Used-placement
windows, followed by one total. Location bonuses apply to each draw. A total
strictly greater than 5 captures the target's attached weapons and prevents their
use for the rest of that battle. Weapons stay attached; the target is not hit.
The restriction survives departure of the stick and expires with the battle.

`weapon-state.ts` shares turn-level weapon choice between blasters and the stick.
A normal character can use only one different weapon during a turn. Multiple
printed Warrior icons allow that many different weapons, without repeated use;
icons added by training do not increase capacity. Attempted firing records use
even if canceled, while the existing battle record retains each weapon's attempt.
History and draw continuations survive JSON reconstruction. Full native admission
remains closed, so this does not alter existing proof save versions.

Forty-nine tests include 36 component cases and thirteen fresh matching GEMP
observations from three JUnit tests. Both initiators, threshold/zero/failed draws,
location modifiers, deployment and transfer, both target weapons, unaffected
opposing weapons, retained attachment, Force costs and Used order are compared.
Native component checks also cover cancellation, departure, end-of-battle expiry,
turn reset, printed-versus-added icons, malformed saves and concession. See
`tests/native-engine/gemp/gaderffii-provenance.json` for the exact boundary.

This is ground combat and explicit Raider identity coverage. Permanent weapons,
other Raider identities, inactive/captured/aboard targets, external firing such as
Sniper, repeated firing, zone-change identity, redirection, prevention/replacement
and full match delivery remain required. GEMP suppresses firing; native expresses
the printed prohibition on weapon use. Only firing availability is compared here.
No new standalone study or full native match route is enabled.

### Starter audit and deploy-react integration

`data/native-engine/starter-coverage.json` inventories all 68 current starter
card definitions, their reviewed functions, implementation/test pointers and
remaining requirements. It is a source/evidence audit, not a supported-card list.
Every entry retains component-only status; full native admission remains closed.
Shared work includes complete destiny/cost timing, zone-instance identity,
prevention/replacement, modifier infrastructure, full-match conformance and the
service/UI. Broader cards and the original product scope remain required.

The audit exposed Gaderffii Stick missing from Comlink's deployment reacts.
It now deploys from hand for 2 Force onto an own Raider at the reacting battle
site, provided the same/adjacent source is legal and the card has not reacted
already. Each deployment is separate. Once it resolves, the stick may fire in
that same battle-initiation window. It cannot transfer as a react, deploy on a
remote/ineligible host, or receive a free deployment through this permission.

Shared canceled-react handling now returns a deploying card from playing to hand,
keeps costs spent, and records both the physical attempt and a turn-long title
restriction for non-unique cards. Character, blaster/rifle, device, mine and stick
react providers all consult that restriction. Canceled movement retains its
source position and locks only that physical card against further reacts; it
does not complete a regular move. Unique cards retain only the physical react
restriction under the AR wording. The pinned GEMP cancellation handler uses a
title filter even for unique cards; that branch is not claimed as parity.

Twenty-one tests include fifteen native component cases and six fresh GEMP
comparisons. The reference executes actual Comlink deployment and Sense plays;
native tests inject cancellation at the shared pending-react boundary because
Sense itself is not yet implemented. The shared outcome, paid costs, hand return
and other-copy availability agree for all five non-unique deployment types. The
sixth reference confirms deployment followed by firing. Tests reconstruct every
command and cover range/host/cost restrictions, separate multiple reacts, source
movement, expiry, malformed history, stale/foreign commands and concession.
See `tests/native-engine/gemp/react-weapons-provenance.json`.

Original-zone restoration is currently for hand deployment. Pile/stack deploy
reacts, their reshuffles, simultaneous pilots, vehicles, generic persona/identity
and cancellation prevention still require implementation. No new study or full
native gameplay route is enabled by this checkpoint.

### Card instances and leave-table state

`identity.ts` now distinguishes permanent deck IDs from individual visits to a
zone. `moveCard` increments a private, JSON-persisted version only when the zone
changes; ordinary movement, equipment transfer and pile reordering preserve that
version. References capture ID, zone and version and cannot match a card that
leaves and returns. No instance registry or handler references enter seat views.
Existing snapshots without an instance registry start at version zero. Older
native pending actions lacking newly required references are rejected rather
than guessing their original target; published Rules Lab versions are separate
and unchanged. Full native matches have never been admitted.

Stun checks the original target before drawing, after destiny and before return.
Barrier and ordinary ground movement retain original target/card instances.
`attachment.ts` shares deployment/transfer revalidation across blasters/rifles,
devices/training and Gaderffii Stick: a returned host or source does not satisfy
the old action. Transfers still require the original attachment and co-location;
deployment can follow a host that moves without leaving play. Paid costs remain
spent, failed deployment goes to Lost if its source is still playing, and a source
that has already left is not pulled back by the old continuation. Old Ben also
requires the original Lost Pile visit, not just the same physical card in Lost.

`lifecycle.ts` expires movement and Barrier restrictions, prior-instance battle
history, bearer weapon/device allowances, training modes and mine timers when
those instances leave table. Weapon/device histories retain the identity of used
equipment: returning a weapon while its bearer stays does not bypass the bearer's
one-different-weapon limit. A returning bearer starts a new allowance. Hits and
Gaderffii suppression no longer follow departed card instances. The old participation ends even if removal and return happen before battle
synchronization; a new instance can join before power (see below). Prior title limits, canceled-react restrictions, completed loss
credit and effects with independent durations are not cleared indiscriminately.

The fresh GEMP harness has two tests/four observations: three controlled registry
interventions and an actual Old Ben play. This corrects an older component test
that wrongly retained Old Ben's character in turn-wide battle history. A character revived in the damage segment cannot rejoin that battle, but the
old appearance no longer bars later battles. Source provenance is in `gemp/identity-provenance.json`; the
production reference files are unchanged. Native tests additionally exercise
stale targets at response boundaries, paid failures, recursive attachment return,
JSON recovery, malformed references and private projections.

Identity coverage is not yet universal: pending weapon firing, react permission
sources, event snapshots, retrieval/search/inspection targets, group movement,
duels and other card effects still need the shared references. Persona replacement
and conversion need their specific identity-preserving rules. Per-draw and
individual-Force cost timing, full-match conformance and service/UI work remain next.


### Initiated firing and battle reentry

Initiation conditions are not result-time cancellation conditions (AR p15).
Gaderffii Stick now completes its two draws after its weapon, bearer or target
leaves during responses. As with blasters, the result still needs a target that
can receive it. Removing Comlink does not undo an already initiated deploy-react.
Costs remain spent, actual cancellation still stops a shot, and shared destiny
responses and cleanup still run.

`syncBattle` uses the current instance's battle history to distinguish a fresh
entry before power from returning the same instance after ordinary movement.
A new instance before power can participate and receive the pending shot. Entry
at power or later cannot participate; the existing actual Old Ben damage test
continues to verify that boundary. The old hit never returns with the card.

`gemp/firing-identity-provenance.json` records 27 matching observations from two
fresh JUnit tests. The 24 firing cases compare draws, paid Force, hits, weapon
suppression and current participation after controlled zone interventions; three
Comlink cases compare departure, return and movement of the permission source.
Native tests serialize at every command, compare seat views, and cover all four
battle stage boundaries plus ordinary movement that must retain battle history.
These are integrated engine checks, not new lab studies or full deck admission.


### Shared before-draw responses

Every implemented physical destiny draw now passes through `destiny:draw`.
A serialized `about-to-draw-destiny` response window precedes reveal when Reserve
is nonempty. Its event contains side, category and source, never the next card.
The continuation reads the current top card after responses: nested draws,
changes to the top card and an emptied Reserve do not use a stale reservation.
An empty Reserve does not open this window; a failed or prevented draw supplies
no value, completed-draw trigger or total. Every serial draw and Dice redraw gets
its own opportunity. Existing battle and weapon event names/response handlers
are preserved by callbacks from the shared reveal step.

Weapon location modifiers are read at reveal rather than frozen before responses.
Battle destiny handles Reserve becoming empty after its optional draw was chosen.
The remaining completion sequence is unchanged: drawn responses, completed draw,
physical Used placement, total responses, then the dependent action result.

`tests/native-engine/gemp/before-destiny-provenance.json` records eight fresh
matching traces from four JUnit tests on unmodified GEMP. General zero/one/empty,
rifle zero, both location bonuses, ordinary battle and an actual Han's Dice redraw
are compared. Native tests additionally cover top-card changes, nested draws,
Reserve depletion, prevention, privacy, recovery and terminal concession. No new
study or production deck admission was added. Per-draw costs (which precede this
window), substitution, draw-X/choose-Y, complete automatic modifiers, and specific
cards using these facilities are still required scope.


### Substituted destiny and Smoke Screen

`Draw` now distinguishes a failed draw from a successful substituted value with
no physical card. Shared substitution records the supplying source and locked
value on the exact pending draw. It leaves Reserve untouched, emits drawn and
completed-draw responses, ignores individual draw modifiers/cancellation/reset,
and permits later total modifiers. Zero remains a successful destiny. Serial
callers and their saved-state validators accept substituted draws; battle and
weapon adapters preserve the substitution through their result timing.

`substitution.ts` implements Smoke Screen (5_69): at a site, respond to your
pending battle destiny with one of your participating characters that has
ability. Its current ability supplies the substitute on resolution; the Lost
Interrupt then goes to Lost. Empty Reserve prevents initiation. Canceling the
Interrupt retains the ordinary draw; once substituted, Han's Dice cannot cancel
or redraw the value. A nested action cannot substitute the wrong pending draw.

Four fresh GEMP comparisons cover actual Smoke Screen, targeted-character removal,
Reserve depletion after initiation, and actual Sense cancellation. All compare
timing, physical pile counts, source disposal and Dice eligibility. Native Sense
is not implemented: its cancellation is injected in the corresponding native
fixture. Reference zone interventions are explicit, not played removal cards.
Native-only shared primitive tests include zero, total changes, immunity to draw
cancellation/modification, malformed saves, serial and weapon draws, and private
recovery. See `tests/native-engine/gemp/substitution-provenance.json`.

Smoke Screen is supplemental component coverage; starter deck definitions and
production admission remain unchanged. General ability/targetability modifiers,
other substitution providers, limits on physical draws, draw-X/choose-Y and
per-draw costs remain required. This checkpoint does not complete full matches.

### Shared draw-X/choose-Y batches

`destiny-selection.ts` uses the existing before/drawn/completed destiny pipeline
for each candidate. Successful draws remain unresolved until selection;
canceled draws go to Used immediately and cannot be selected. The player chooses
up to Y successful values, including zero or substituted values, and only those
values supply the shared total. If Reserve runs out, the batch ends with its
available candidates. The caller may specify that unchosen draws go to hand.

Choices and callbacks are serialized and validated, including nested batches,
seat/revision checks and concession. Physical cleanup uses the original visit to
the unresolved zone, so moving a card away and back cannot recapture it. Its
recorded value survives relocation. `redrawDestiny` replaces a canceled general
draw in its existing selection slot; the original has no completed-draw trigger.
Substituted values cannot be redrawn. Existing battle Dice adapters are preserved.

The fresh pinned-GEMP harness directly schedules production `DrawDestinyEffect`:
eight complete outcome comparisons agree; two retain an ordering discrepancy.
AR p32 step 2 resolves selected draws, then step 3 puts remaining draws in Used
in draw order. Native resolves chosen cards in the player's selection order,
then the remainder. GEMP instead cleans up every candidate in original draw
order, and normalizes multi-selection into original order. Totals and response
traces agree for those cases; pile order does not. See
`tests/native-engine/gemp/selection-provenance.json` for raw evidence and scope.

This is an integrated rules-runtime component, not a new Rules Lab or a claim
that a granting card is playable. Card permissions (such as Gambler's Luck),
battle/weapon-specific draw response adapters, dynamic physical draw limits,
per-draw costs and broader modifier/prevention interactions remain required.
Production full-match admission stays closed. No UI or existing proof-version
migration is part of this checkpoint.

### Multiple battle destinies and Gambler's Luck

The battle adapter now carries retained draw-X/choose-Y candidates through its
ordinary response windows, including Han's Dice redraw and Smoke Screen
substitution. A saved draw plan combines selected values with an ordinary
ability-based draw, then exposes one aggregate total for power and attrition.
The player accepts all scheduled draws or skips all of them. Existing hard site
ability requirements still prohibit drawing; an added destiny otherwise does
not require the ordinary ability-four base draw.

The supplemental Gambler's Luck component grants one added destiny for the
reviewed Han/Lando identities, or two for Lando, while defending alone at a site.
Its successful addition survives later character departure. Unique-title turn
history is consumed on initiation, including canceled plays, and survives saves.
Lando is metadata-only; his other abilities and full deck admission are absent.

Ten fresh actual-card GEMP observations compare before/drawn/completed/total
traces, unresolved counts, initial damage/attrition and physical Used/Lost
outcomes. They cover one/two additions, an ordinary base draw, departure,
skipping, Dice, short Reserve, actual reference Sense cancellation and refusal
of a second unique copy. Native comparison fixtures stop before Vader's separate
post-result choke. See `tests/native-engine/gemp/gamblers-luck-provenance.json`.

The selection group is now optional at the actual about-to-draw response. A
player may pass and use it at a later eligible draw. Conversion rewrites the
pending draw's callback, preserving its existing response window and avoiding
an extra before-draw event. Smoke Screen before conversion blocks it for that
draw while preserving a later opportunity; after conversion it can substitute a
candidate. Conversion use is recorded at initiation and cannot loop within its
own group. Saved pending conversions bind the exact draw and actor.

Fourteen fresh observations now include declining conversion, delayed conversion
after the ordinary ability draw, and actual Smoke Screen followed by conversion.
Thirteen agree at the documented boundary. One records a GEMP defect/ambiguity:
with only one scheduled draw remaining, Lando's choose-two conversion draws two
candidates, never permits choosing, and leaves them unresolved. Native currently
withholds that branch pending a normative outcome. This is an explicit coverage
guard, not a claim about official legality. Regression tests retain both outcomes.

This remains partial card coverage. That last-draw branch, general physical draw
limits, other personas, per-draw costs and prevention/modifier interactions remain
required. The earlier selection-order discrepancy remains documented. No new
study or public match route is added, and full-match admission stays closed.

### Resumable Force payments

Action payments now use a kernel continuation that validates affordability for
both players before initiation, records the source/targets, and finishes costs
before opening the parent action's response step. Each positive payment exposes
a before-use window and each unit moved to Used exposes a Force-used response.
The next unit reads the current top of Force after those responses. A nested paid
response finishes its own payment before the parent resumes. Jawa's opposing
payment is paid first, matching GEMP's deployment cost ordering.

Docking-bay transit and each Narrow Escape move use this same path after their
private party/destination choices. Cancellation after payment keeps paid costs;
concession freezes the remaining continuation. Pending frames bind the exact
parent and reject duplicate, malformed or foreign payment state. Force and Used
card identities remain private. Cost windows settle immediately only when neither
seat has a legal response or mandatory action, rechecking after every unit.

Five fresh GEMP observations compare before/after-unit traces, remaining Force
counts and Used ordering, including an actual Jawa deployment. Native synthetic
handlers additionally test nested responses, changing Force order, malformed
saves, source timing, privacy and cancellation. These are kernel checks, not
claims that arbitrary response cards are implemented. See
`tests/native-engine/gemp/payment-provenance.json`.

Remaining work includes Force borrowing/redirection, prevention/replacement,
fractional/separate costs, and destiny-specific cost/failure handling. A response
that depletes still-owed Force currently raises an explicit coverage guard instead
of granting an unpaid action. Full card/deck admission remains closed.

### Pre-draw costs

Every shared destiny caller checks `destiny-cost` before `about-to-draw-destiny`.
Cost providers can yield for decisions and use the runtime payment continuation,
including each Force-use response. `failDestinyCost` binds the exact pending draw
and records voluntary refusal separately from inability to pay. A skipped draw
reveals no card and has no failed/completed-draw event; multi-draw and battle
continuations still advance. Redraws and selection candidates each check costs.
An empty Reserve cannot incur a draw cost, and cost windows with no legal action
auto-settle. Eight mechanism observations agree with pinned GEMP.

Cost prevention/replacement and card-specific tax providers remain required before
full admission; this mechanism does not certify Gold Leader or other tax cards.

### Physical destiny limits

`destiny-limits.ts` stores independent draw sequences for each side of a battle,
selection group, duel side, weapon action and Assault. Physical draws consume
allowance; substitutions do not. Plain cancellation keeps its slot, while a
cancel-and-redraw continuation releases it before the replacement's cost check.
Skipped costs are recorded separately and count against the numeric cap, matching
GEMP. Limits are checked before costs, before substitution opportunities and again
before physical reveal. A resolved substitution remains a value if the limit
changes afterward. Nested sequences cannot consume the parent's allowance.

Required draw-and-choose groups stop at the cap and resolve surviving candidates;
optional conversions require room for all X draws at initiation and resolution.
Gambler’s Luck, Smoke Screen and both Dice paths share the battle sequence. Thirteen
fresh reference observations match. Cap-granting cards and turn-wide prohibitions
remain required; battle-specific aggregation and overrides are described below.
The numeric setter is a rules-provider API, not a client command.


### Battle destiny permissions

`battle-destiny.ts` separates scheduled draws from physical limits. Resolved
optional additions last through the battle; continuous providers require their
original table instance and can require participation. Same-title/function
additions are noncumulative unless explicitly permitted. Ability conditions block
ordinary and added draws. “If unable to otherwise” supplies a minimum instead of
adding extra draws, can override caps and ability restrictions, and limits a draw
group when it is the source of the entitlement. No-limit text removes numeric
caps without creating entitlement. The first-draw plan preserves scheduled draws
after an automatic addition ceases to apply.

Lieutenant Commander Ardan supplies his actual ground-site fallback permission.
His remaining text is unimplemented, so he stays metadata-only and cannot enter
production decks. Registry entries are written by rule providers, never by player
commands; each provider remains responsible for its printed conditions.

An involuntary pre-draw cost failure can use current fallback permission. A
voluntary refusal cannot. The sequence also counts substituted values for this
cost check, even though they consume no physical cap. Plain cancellation consumes
the attempt, while redraw releases its slot before the replacement cost check.
The override belongs to the active battle's exact side/scope and power segment.

Fourteen executed GEMP observations match counts, caps, events, totals and cleanup;
see `tests/native-engine/gemp/battle-draw-policy-provenance.json`. Native battle
adapters, source departure/reentry, noncumulative grants and malformed saved states
have additional tests. These checks do not admit complete cards or decks. Remaining
work includes actual cap/tax providers, broader ability modifiers and exclusions,
prevention/replacement, general granting-card integration and full-match delivery.


### Whole-match integration and replay

The test-only match driver now runs ordinary 40/60 setup, shuffled decks and
continuing turns to an actual Life Force victory. It never arranges a mid-game
board, concedes to force an ending, changes card effects, or skips a rules error.
Production admission remains unchanged. The 60-card lists are the introductory
manifest lists; the 40-card test derivatives preserve every unique definition and
remove duplicate copies, and are not represented as official starter lists.

Run `npm run test:engine:matches -- --size 60 --seed 1 --count 10 --replay`
(or `--size 40`). Use `--output <private-directory>` for complete command traces
and saved states. Output defaults to the operating system's temporary directory.
Each receipt records command/time/entropy inputs, handler coverage and final-state
hashes. Failures stop immediately and preserve the exact state and attempted
command. Treat full traces as private: they include hidden piles for replay.

Twenty recorded runs cover 56,279 commands and end with normal victories;
`tests/native-engine/audit/starter-match-results.json` records summaries, source
fingerprints and final/transcript hashes. Every recorded run replayed from setup
to an identical final state. `full-match.test.mjs` keeps six seeded 40/60 runs in
the regular suite, checks saved-boundary recovery, replays a reached Scanning Crew
deadline, and rejects corrupted transcripts/commands after completion.

This is integration and recovery evidence, not full-game GEMP parity or exhaustive
card certification. The exploration policy is not the production strategic CPU.
Remaining work still includes reachable cross-card conformance/adjudication,
identity/modifier coverage, CPU/PvP client delivery, capacity validation
and responsive full-match presentation. Existing GEMP paths and studies remain.

### Durable native match service

`service.ts` persists native matches independently of the Rules Lab and GEMP.
`/api/matches` lists the signed-in player's matches and accepts creation requests;
`/api/matches/:id` restores the assigned seat or accepts `join`/`command` operations.
Sites gateway identity supplies the actor. JSON cannot choose an actor, seat,
snapshot, rules implementation, entropy or clock. Responses are private/no-store.

Creation supplies `{id, mode, side, deckSize, deck}`; CPU mode also supplies
`computerDeck`. Decks contain blueprint IDs and pass the server's rules admission
before storage. PvP initially stores only the creator's private deck. An invited
opponent submits `{operation:"join", commandId, inviteToken, deck}` for the
opposite side; the two decks then enter ordinary starting setup. Concurrent joins
claim one seat exactly once. Only the waiting owner sees the invitation token.
A future UI should share it in a URL fragment and keep the stable match ID as the
refresh/deeplink identity; tokens must not be exposed in public listings or logs.

Commands contain `{operation:"command", commandId, revision, choice}`. The server
assigns the seat, checks the current legal prompt and computes a new snapshot with
server entropy. Receipt insertion and the conditional snapshot update occur in a
single D1 batch transaction. A random per-invocation claim prevents simultaneous
retries from both updating the game. Repeating an accepted request returns its
original `acceptedRevision` plus the current private projection. Reusing an ID for
a different actor/choice or sending an old revision returns a conflict. SQL/rules
failures cannot leave a partially applied move. Keep receipt IDs across retries.

Each HTTP request starts a D1 `first-primary` session and retains sequential
consistency through the transaction and response. Expired engine decisions are
advanced by the trusted server clock on reads/commands, with their own revision
and transactional receipt. A late command sees the advanced revision; repeated
reads cannot restart deadlines or apply a timer twice. This settles persisted
engine deadlines on interaction; autonomous CPU scheduling and game clocks remain
future required service work.

The internal `readComputer`/`computerCommand` methods expose only the computer's
seat to trusted server code. HTTP accepts an authorized advance request, never
a client-selected computer move. The bounded policy and dispatcher are described
below; independent background scheduling remains outstanding.
Production still uses `premiereRules.supports() === false`, so creating full
matches returns `DECK_NOT_ADMITTED` until the reachable rules gate is satisfied.
Existing saved proof games, proof URLs and GEMP routes are unchanged.

Migration `drizzle/0002_native_match_sessions.sql` adds only `native_matches` and
`native_commands`. Tests run the production SQL in real SQLite (including disk
reopen and rollback), persist complete 40-card PvP/60-card computer-seat command
traces, and check seat privacy, invitation races, duplicates, stale revisions,
concession, timer races, oversized/foreign requests and the production gate.
`npm run test:engine:service` additionally runs an isolated Miniflare D1/workerd
instance with real batch rollback/concurrency and first-primary sessions. It uses
the installed runtime's pinned compatibility date and touches no shared database.

### Server-controlled computer opponent

`computer.ts` chooses only from a seat's projected legal prompt. It receives no
raw match, opponent hand or hidden pile ordering, and consumes no engine random
numbers. The first deterministic policy favors Force generation, spreading
characters, drains, favorable printed-power battles, weapons and preserving
Life Force during draws. Printed statistics are strategic estimates, not new
rules or claims of optimal play. Unknown optional actions pass; required choices
still resolve using an offered action. Transfers require a strict printed-power
improvement, and party choices confirm rather than repeatedly toggle.

`POST /api/matches/:id` with exactly `{"operation":"advance"}` authorizes the
owner and runs at most 24 CPU attempts. Each successful move uses the ordinary
revision-bound transaction and a separate computer receipt namespace. Concurrent
requests share deterministic receipts; stale revisions reload, while rule and
storage failures remain failures. The returned game is always the human's
projection. `computer.status` is `waiting`, `ready` (request another batch), or
`finished`; `steps` counts this request's newly committed computer moves. A
restart resumes from saved state, with no process-local bot memory.

Dispatch is request-driven. The native client still needs to request advancement
and wire timers/recovery; this is not an independent background scheduler. The
production starter admission gate remains closed. CPU self-play and durable
service runs exercise complete 40/60-card test decks under test-only admission;
they do not establish full card-text coverage, optimal strategy or GEMP parity.

### Native match client

`/matches` lists the signed-in player's saved matches and reads starter admission
from the server. `/matches/:id` restores an assigned-seat projection on every
refresh. The lobby currently offers the authored 60-card Premiere Introductory
pair; 40-card/custom/sealed deck selection remains to be connected. No browser
flag or test fixture opens the production rules gate. Existing GEMP and Rules Lab
routes remain separate.

`client.ts` serializes requests, rejects older/cross-match snapshots and retains
uncertain commands with their original receipts in session storage. Refresh
exposes an explicit safe retry. Deterministic rejection reloads the current view;
authentication failure preserves pending work. CPU advancement is requested by
the visible client, including simultaneous private starting selections. Private
PvP invitations carry their token in the URL fragment, are retained only in that
tab for sign-in/retry, and disappear from the URL after a successful join.

The screen displays the location layout, attached and in-progress cards, own
hand, public piles, setup icons, legal choices and both sides' battle debts.
Desktop uses a decision sidebar; tablets compact that layout; phones have
Table/Hand/Actions tabs. Empty opportunities pass after two seconds (pause and
ArrowRight supported). Polling runs after that interval so it cannot continually
restart the timer. Dialogs, hidden tabs, errors and uncertain writes suspend
local automation. Server deadlines still expire: the countdown uses trusted
`serverTime`, and a private inspection/card dialog is redacted at its deadline.
Concession is a confirmed server command and final results freeze the controls.

Run `npm run test:engine:client` with the normal local preview running at 5173
(or set `NATIVE_UI_ORIGIN`). Playwright is pinned to 1.62.1, Chromium revision
1234; install it with `npx playwright install chromium` (CI/Linux may need
`--with-deps`). Browser fixtures intercept only the match HTTP boundary and
execute the real handlers, native service and isolated SQLite adapter under
test-only admission. They never seed shared/production storage. Tests cover
lost-response recovery through refresh, receipts, CPU dispatch, two identities
joining, concession, empty timers/keyboard, inspection expiry, production gate,
and screenshots at 1440, 834 and 390 pixels. This is client integration evidence,
not exhaustive card conformance or an end-to-end production match certification.
