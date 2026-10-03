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

The native service and full-match client are implemented, but production deck
admission remains closed. A passing kernel test is not evidence that a card's
printed behavior is implemented.

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
4. Extend the connected native service/client beyond its authored 60-card lobby
   to custom 40/60-card decks and sealed play. Complete independent scheduling,
   applicable game clocks and capacity validation.
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

### Scanning Crew and acknowledged inspection

`scan.ts` implements Scanning Crew's paid ordinary action (also during weapons),
inspection of the opponent's current hand, and optional selection of one Rebel
Character to put on top of that player's Used Pile. Declining and hands without
Rebels leave the hand unchanged. The source remains playing throughout the effect
and finishes Used, or Lost if its play is canceled. An inspection prevention
window precedes disclosure; a chosen Rebel is revealed before removal and checked
again before being moved. Removal is neither character loss nor Force loss.

The Advanced Rulebook p10, Peeking At Cards, explicitly supersedes printed time
limits on older cards. Scanning Crew therefore waits for **Finish viewing**;
there is no ten-second deadline, countdown or automatic transition. Elapsed server
or browser time and refresh preserve the inspection. Old saved `expiresAt` fields
are ignored. The usual revision/receipt protections apply to acknowledgment.
The hand owner already sees their own hand; the inspecting seat receives the
inspection and exclusive choices. After acknowledgment, only eligible Rebels
remain in the inspection view, and after selection only the chosen card is
disclosed for responses. Completion/concession revoke this temporary disclosure.

The former printed-timer interpretation was incorrect. Fresh pinned GEMP checks
agree with acknowledgment and all six recorded outcomes; the harness explicitly
leaves one inspection pending past eleven seconds. Native regressions cover
elapsed time, legacy saves, refresh, private choices, source disposition,
selection/declining, no Rebels, prevention and departures. SQLite service tests
verify concurrent reads make no timer move and duplicate acknowledgments commit
once. Generic service deadline tests now use a synthetic test-only expiry provider,
so timer CAS remains exercised without inventing a time limit for a real card.
Playwright verifies an open dialog survives elapsed time, reload recovers the same
choice and explicit completion removes inspection. Evidence is in
`tests/native-engine/gemp/scan-timing-provenance.json`.

General text modification, Rebel identity modifiers, targeting/replacement and
inspection/removal prevention cards remain unfinished. GEMP/proof paths are
unchanged; full native deck admission remains closed.


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
those native tests injected cancellation at the shared pending-react boundary.
The later Sense/Alter checkpoint below implements actual native card plays. The shared outcome, paid costs, hand return
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

Identity coverage is not universal. Later checkpoints below extend firing, react
permissions, destiny, retrieval, duels and ground travel. Remaining search targets,
other card effects, persona replacement and conversion need their specific rules.
Full-match conformance, broader catalog behavior and the remaining service/UI
requirements above are still required.


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
timing, physical pile counts, source disposal and Dice eligibility. That native
fixture injects cancellation; actual Sense/Alter plays now have separate evidence
below. Reference zone interventions are explicit, not played removal cards.
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
the regular suite, checks saved-boundary recovery, recovers a reached Scanning Crew
inspection across elapsed time and acknowledgment, and rejects corrupted transcripts/commands after completion.

This is integration and recovery evidence, not full-game GEMP parity or exhaustive
card certification. The exploration policy is not the production strategic CPU.
Remaining work still includes reachable cross-card conformance/adjudication,
identity/modifier coverage, custom/open/sealed client workflows and capacity
validation. The responsive CPU/PvP client is implemented below; existing GEMP
paths and studies remain.

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

Dispatch is request-driven. The native client below requests advancement and
handles recovery; this is not an independent background scheduler. The
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
local automation. Scanning Crew inspection waits for acknowledgment under the
current rules; dialogs remain bound to the current authorized card projection.
Concession is a confirmed server command and final results freeze the controls.

Run `npm run test:engine:client` with the normal local preview running at 5173
(or set `NATIVE_UI_ORIGIN`). Playwright is pinned to 1.62.1, Chromium revision
1234; install it with `npx playwright install chromium` (CI/Linux may need
`--with-deps`). Browser fixtures intercept only the match HTTP boundary and
execute the real handlers, native service and isolated SQLite adapter under
test-only admission. They never seed shared/production storage. Tests cover
lost-response recovery through refresh, receipts, CPU dispatch, two identities
joining, concession, empty timers/keyboard, untimed inspection recovery/acknowledgment, production gate,
and screenshots at 1440, 834 and 390 pixels. This is client integration evidence,
not exhaustive card conformance or an end-to-end production match certification.

### Duel participant lifecycle

Obsession captures both original table instances when its action is initiated.
Before duel results, departure invalidates that participation even if the same
physical card returns before the next continuation. An already drawn destiny
finishes cleanup, but no further duel draws, retrieval or losses occur. Pending
Interrupts also cannot start a duel with a returned replacement instance. Saved
references are validated and excluded from player projections; older native
snapshots with a pending duel but no references are rejected. Separate Rules Lab
snapshots are unaffected.

This follows the Advanced Rulebook p166, Dueling step 4. Twelve fresh pinned GEMP
observations are recorded in `tests/native-engine/gemp/duel-identity-results.json`:
eight final outcomes agree, while four pre-result returns continue in GEMP because
its duel state retains mutable physical-card references and checks only current
location. The native engine follows the explicit departure rule for those cases.
The harness uses controlled zone interventions, not implemented return cards.

Determined results still finish through later participant departure. Current
post-result physical-card targeting follows the pinned GEMP observations; general
later loss target identity, persona replacement, conversion and duel modifiers
remain required work. One-sided failed-destiny Force difference remains guarded.
This checkpoint does not open production card or full-match admission.

### Retrieval cancellation and Secret Plans

Each retrieval has a unique saved action identity. Cancellation targets that
exact suspended retrieval, including nested retrievals from the same source.
Already retrieved cards remain in their destination; the parent Interrupt still
finishes its own disposal. Pending native retrieval snapshots without the new
identity are rejected. Separate Rules Lab snapshots are unchanged.

Secret Plans Defensive Shield (13_86) now implements its table trigger: before
Light retrieves its first eligible card, Light must use the full retrieval amount
or cancel that retrieval. A smaller Lost Pile does not reduce the payment. Empty
Lost Piles and zero retrievals do not reach the trigger. Payment uses the shared
per-Force response boundaries and resumes through serialized state. One retrieval
is charged once, including specific-card selection across multiple cards.

Seven fresh pinned GEMP outcomes in `tests/native-engine/gemp/secret-plans-results.json`
agree on payment, retrieval, decision count and Used order, including source
departure after trigger initiation. They use the actual shield and production
retrieval/payment effects with a fixture-supplied retrieval action. Native tests
also cover nested cancellation, specific retrieval, parent Interrupt disposal,
selected-card departure, hidden information and invalid continuations.

This implements the shield's table text, not shield setup/play or full card
admission. The Effect version, X modifiers, retrieval immunity/prevention and
replacement, and fractional costs remain required work. Production deck and
full-match admission stays closed.

### Retrieval quantity and permissions

`retrieval-policy.ts` combines rule-owned additions/reductions, unmodifiable
resets, and source-specific Secret Plans immunity. The lowest applicable reset
wins over arithmetic modifiers; quantities floor at zero. Modifiers can last
through the current turn or require their original table instance. Same-title,
same-function registrations are noncumulative unless explicitly granted otherwise.
Blueprint selectors and player ownership keep effects scoped to their retrieval.

Each retrieval now saves its initial and finalized amount. Finalization occurs
after initiation responses and before the first selection/payment. Per-card
responses do not recompute it. This also means reductions affect named-card
retrieval and the amount Secret Plans charges. Pending native snapshots lacking
these new fields are rejected; separate Rules Lab snapshots are unchanged.

Navy Trooper Fenson's On The Edge/Off The Edge reduction and Sergeant Tarl's
Noble Sacrifice reduction now supply actual continuous table modifiers. Their
other text and source Interrupt gameplay remain outside current admission.
An explicit rule-owned uncancelable retrieval permission makes cancellation fail
without emitting a cancellation event. This differs from Secret Plans immunity:
immunity suppresses the trigger, while an uncancelable retrieval can receive the
payment decision and survive a refusal. No current granting card is claimed for
that permission hook.

Twelve fresh pinned GEMP comparisons agree on retrieved quantity, Force spent,
payment decision count and Used order. Fenson, Tarl and Secret Plans use actual
card classes; other grants and the retrieval action are controlled fixtures.
Native tests cover saved continuations, modifier lifetimes, per-card freezing,
selector scope, duplicate registrations, and invalid saved values. General
fractional arithmetic, source-card admission, text cancellation/inactive states,
replacement destinations, Code Clearance grabbing, Objectives and shield setup
remain required. Full native deck admission is still closed.


### Movement target instances

Docking-bay transit, Run Luke, Run! and Narrow Escape retain their original
table-instance references across costs, responses and saved continuations. A
card leaving and returning does not inherit its previous movement permission.
Transit moves other valid members of its paid party; a failed member does not
refund the cost. Each Narrow Escape movement likewise retains a paid cost if
that original target leaves during its responses.

Narrow Escape selects its qualifying Rebel and move-away group during initiation
(AR pp14–15,70–71), with an explicit Rebel choice when several qualify. The
original group remains eligible after that Rebel leaves, but later arrivals and
returned replacements are excluded. Each member's normal movement eligibility
and destination are checked at its own movement step.

Seven fresh GEMP records are retained in `gemp/travel-identity-results.json`:
three outcomes match, three differ, and one reports a production exception. The
pinned reference moves returned Luke and a late Narrow Escape arrival; native
keeps the original targets. The two return differences apply the native identity
model and still need independent card-specific adjudication before admission;
the late-arrival group difference follows AR pp70–71. Removing Run Luke's target without returning it
causes a null-action exception in the reference; native finishes Interrupt
cleanup with no movement. These differences are explicit tests, not claimed
conformance passes. Provenance records the untouched 6,820 production files.
Additional native tests cover transit partial success, nested movement response
boundaries, multiple qualifying Rebels, serialization and rejected references.

This covers ground character targets, not vehicles, general redirection, location
conversion identity, every movement modifier or complete card admission. Pending
native movements missing their new references are rejected rather than inferred;
the separate published proof saves are unchanged.


### Shared character characteristics and identity filters

`definitions.ts` centralizes the explicit native definitions; `characteristics.ts`
uses reviewed constructor metadata in `identities.json`. That checkpoint covered 93
definitions, including 11 additional metadata-only fixtures. It does not infer
characteristics from lore substrings: BoShek's permission to make Kessel Runs in
place of a smuggler does not make him a smuggler. Trooper, Stormtrooper, Scout and
guard families follow their explicit subtype rules; restricted characters count
as non-unique. Species and starship models have separate queries.

Rule-owned characteristic grants/removals are saved with original source/target
references. Removal overrides grants and printed keywords; derived families still
consult each surviving specialized keyword. A resolved turn effect survives its
source leaving; a continuous source effect does not. Both stop for a target that
leaves play. No client command can register these changes. Printed species/model
and uniqueness metadata are not a dynamic modifier implementation.

Mos Eisley gives Dark's qualifying characters power and forfeit +1 exactly once,
including a character with multiple qualifying traits. Jundland forfeit, Tusken
Scavengers and Gaderffii eligibility use the shared Raider species, including
unique Raiders. Ordinary Raider power text still requires non-unique Raiders.
Reinforcements now selects verified Rebel troopers/Y-wings or Stormtroopers/TIE-ln
from Lost, preserving choice, payment, responses, pile order and cleanup. Ship
retrieval does not enable ship deployment or movement. Gambler's Luck reads the
gambler trait; its Lando mode now uses the explicit persona registry below.

`gemp/characteristics-provenance.json` records 22 fresh matching observations:
18 actual identity/filter records (16 also check Mos Eisley stat deltas), two
explicit synthetic keyword modifier checks and two actual Reinforcements plays
with variant troopers and ships. GEMP's control location has equal Dark Force
icons to isolate Djas Puhr's own icon-based power; that complete card text is not
claimed. All 6,820 production reference files remain unchanged. Additional native
integration covers instance/turn/source expiry, JSON recovery, private projections,
invalid saved modifiers, unique Raider equipment/search and granted gamblers.

Broader characteristic providers, species/model/uniqueness changes, text
cancellation, inactive/aboard rules, broader persona behavior and complete metadata-only card text
remain required. Production admission and the separate proof studies are unchanged.


### Persona, uniqueness and initiated plays

`persona.ts` uses explicit constructor uniqueness and persona metadata for 98
current definitions. Ordinary table placement checks shared title limits, the
owner's existing persona and relevant out-of-play characters/ships/vehicles.
Per-turn play history is private, serialized and recorded when an actual play or
deployment begins; cancellation and returning to hand do not restore an allowance.
A new turn resets the count. Restricted cards count every initiated play, not just
copies still on the table. Ordinary plays and Reserve docking-bay deployment use
this boundary. Transfers, losses from hand and revivals do not count as new plays.

Starter Luke/Vader now count every reviewed opposing unique Character, excluding
restricted characters. Old Ben excludes the Obi-Wan persona and checks table
eligibility at selection, response resolution and placement. Revival does not use
the character's per-turn deployment allowance. Pending ordinary deployment also
rechecks table eligibility, preserving paid costs if it cannot enter play.
Gambler's Luck and We're Doomed query explicit Lando and C-3PO/R2-D2 personas.

`gemp/persona-provenance.json` records 15 production-query observations: 14 agree,
while the persona-per-turn case is an explicit discrepancy. AR p75 includes persona
in the turn restriction; pinned GEMP records and checks titles only. Native applies
the rulebook's persona restriction. These are controlled table/pile placements and
production play-counter calls, not complete reference deployment/cancellation
plays. Native runtime tests cover ordinary deployment, restricted repeated plays,
next-turn reset, save/projection recovery, revival and pending conflict handling.
All 6,820 reference production files remain unchanged.

This is not complete persona/card admission. Diamond system limits explicitly
reject unsupported queries. Dynamic uniqueness/persona modifiers, compound titles,
permanent personas, capture/stolen control, persona replacement and special
conversion remain required. The five extra characters are metadata-only. Legacy
native component snapshots without play history start with an empty ledger;
production full matches remain closed, and separate proof saves are unchanged.


### Sense, Alter and suspended-action cancellation

Both Premiere mirrors of Sense and Alter now execute through `cancellation.ts`.
Sense can target an initiated Interrupt or one paid react; Alter can target an
Effect/Utinni Effect on table or during deployment. Neither can interrupt the
subsequent execution of an Effect's text. Their direct counterplay functions need
no character or destiny. Destiny modes offer each tied highest positive-ability
Character; droids and permanent pilots do not qualify. Success requires a strict
less-than comparison, so equality and an empty Reserve fail. Sense/Alter go Used
when resolved and Lost when canceled. Paid costs are retained.

The cancel-result continuation binds the exact pending action and response-window
serial. `retireAction` leaves an inert validated frame, preserving suspended
indices while disposal/results resolve. Once the canceling action finishes, the
old response window and retired frame disappear together without reopening the
canceled action. Nested Sense–Alter–Sense preserves the original Interrupt and
correctly resumes the restored Sense. Failed Sense permits a second attempt.
React cancellation delegates to the existing physical/title restrictions and
original-zone restoration. Printed Alter immunity protects both training Effects
on table and during deployment.

Twenty fresh executed GEMP observations include sixteen matching outcomes:
mirrored success/equality/empty draws, direct and nested counters, Macroscan table
and deployment cancellation, Ket Maliss immunity and paid movement/deployment
react cancellation. Four controlled character leave/return records differ:
GEMP retains the physical highest-ability target, while native requires its
original table instance. These are not played removal-card comparisons and need
independent adjudication; they are not claimed as parity or complete admission.
All 6,820 production reference files are unchanged. Native tests also exercise
Sai'torr immunity, repeated attempts, target reentry, invalid saved references,
private projection and JSON recovery at every command, including retired frames.
See `gemp/cancellation-provenance.json` and `cancellation.test.mjs`.

The Sense/Alter checkpoint brought the registry to 102 explicit definitions.
The following checkpoint implements For Luck/Dark Forces retargeting. General
ability modifiers,
conditional immunity and cancellation prevention/replacement, alternate cleanup,
inactive/captured/aboard rules and broader cancellation-result triggers remain.
The production full-match gate, GEMP routes and existing studies remain unchanged.

### For Luck / Dark Forces and live retargeting

`force-effects.ts` implements deployment and both functions of 102_1/102_6 in
continuous matches. Their optional exclusion selects one or more qualifying
characters before paying X Force. The original Sense/Alter gets an action-local
exclusion list; its owner immediately chooses a new highest-ability character
when needed, including ties. With no remaining target the destiny still draws
and the Interrupt fails. A later Sense/Alter starts with a fresh target set.
The Effect cannot influence Alter while its own deployment is still pending.

The runtime now supports explicitly unrespondable results without suppressing
Force-use cost responses. Selection, costs, retargeting and the suspended
Interrupt are JSON continuations with validated response identities. Nested
counterplay retains paid costs and does not revive an excluded ability target.

For Luck / Dark Forces can also pay 1 Force in response to the opponent's
Counter/Surprise Assault. The opponent draws one extra general destiny after the
Assault player's draws; it is added to frozen power, not the attacking destiny
or battle destiny. Each side's sequence, Used placement, failed draws, total
responses and Force loss use the shared rules pipeline. Canceling Assault after
the bonus was paid suppresses both sets of draws without refunding either cost.

Evidence: `tests/native-engine/force-effects.test.mjs` and
`tests/native-engine/gemp/force-effects-provenance.json`. Sixteen actual card
comparisons match the unchanged GEMP engine. Two additional injected test
actions execute GEMP's production return-to-hand effect and confirm that its
Sense still uses the removed character's printed ability. Native requires the
original table instance, so these two observations remain explicit differences;
they rule out the earlier simple fixture-movement bypass as the sole cause, not
adjudicate the rule. Returning-to-table cases still need independent resolution.

That checkpoint brought the registry to 107 explicit definitions. Jedi qualification
uses printed side and current ability >= 6; the next section adds shared ability
modifiers. Inactive/aboard/captured targets, broader immunity/prevention and full
card/deck admission remain unfinished. Yoda, Emperor Palpatine and Jedi Knight
Luke have explicit metadata for these targeting fixtures; their complete card
text is not implemented or admitted. Existing studies and GEMP routes remain.

### Current ability and battle Effects

`ability.ts` supplies current Character ability to presence/control, battle
initiation and premature ending, weapon defense, Sense/Alter, Jedi qualification,
Smoke Screen, Han's Dice, deployment and movement conditions. Trusted providers
can register source/turn-scoped additions, resets, and the ability portion of
base doubling. Resets take precedence; the lowest competing reset wins. Fractional
values remain fractional. Droids compare as unmodifiable zero (AR pp21,77).
This is not yet the full doubled-card rule, defined printed ability, Jedi Test
floors, permanent pilots, creature vehicles, or every ability-modifying card.

Battle-destiny ability is a separate query. `battle-effects.ts` implements the
ordinary table functions of Scramble (4_37), K'lor'slug (1_53) and Molator (1_225).
Scramble restricts opposing pilots present at sites, except Vader, without
changing ordinary ability or presence. All opposing pilots at sites, including
Vader and excluded pilots, prevent its mandatory cancellation. K'lor'slug and
Molator offer a once-per-battle weapons action: pay an integer amount up to
ordinary ability present and available Force, add it to total power, and subtract
it from ability available for battle destiny. Costs settle before the result;
resolved bonuses survive source loss and end with that battle. Deployments obey
unique/per-turn play limits and can be canceled with Alter.

Sense/Alter retain the highest-ability character selected at initiation unless
an effect explicitly retargets them. A later numerical change can alter the
comparison, but cannot silently substitute a new character. Ability application
prevention is checked after determining highest ability; it does not make a
lower character eligible. Existing original-instance departure/return differences
remain unresolved and are not hidden by this change.

Evidence: 37 focused tests in `tests/native-engine/ability.test.mjs`, including
serialized recovery, corruption rejection, fractional presence, source/turn
expiry, successive battles, current weapon defense and Alter counterplay.
`gemp/ability-provenance.json` records 19 fresh observations from the unchanged
6,820-file GEMP production tree. Eighteen match; the synthetic droid-reset probe
reports ability 5 in GEMP because AbstractDroid inherits an ability attribute.
Native follows the explicit official unmodifiable-zero rule. The probe does not
establish a legal named-card route that can grant ability to a droid.

The registry now has 111 definitions. Darth Vader (1_168) is metadata-only for
the pilot/persona exception check; his other text is not admitted. Dejarik and
holosite behavior, dynamic icons, inactive/captured/aboard states, broader
prevention/immunity, additional providers and full card/deck admission remain
unfinished. No new standalone study or production admission bypass was added.

### Location-wide ability and Affect Mind

`location-ability.ts` applies modifiers to a location's total without changing any
individual Character. Presence/control, battle initiation and premature ending
use the appropriate contributing group and then the adjusted total. Battle
destiny applies its separate adjustments before total resets. A reduction
prevention skips general reductions and decreasing resets; it does not suppress
battle-destiny-only reductions. Competing eligible resets choose the lowest
value, and fractional values remain exact. Source/turn lifetimes and original
location references survive JSON recovery.

`ability-effects.ts` implements Affect Mind (1_43) deployment: choose an own Jedi,
pay 1 Force, allow deployment responses, then attach to that original character.
The chosen host can move or change numerical ability during responses; an
original instance that leaves cannot be replaced by a new visit to table. The
Effect follows its bearer, leaves with it, obeys unique/per-turn play limits and
can be canceled by Alter. Its current erratum applies only while present at a
site (AR p103), and a Dark Jedi present suppresses the reduction. Later loss of
Jedi ability does not detach an already deployed Effect.

Ordinary ability **present** for K'lor'slug/Molator costs remains the sum of
individual ability, matching GEMP's distinct query. Thus four Stormtroopers under
Affect Mind have total ability 2, but can still use 4 Force with Molator; this
adds 4 power and leaves zero ability available for battle destiny. A general
ability reset is applied after that battle-only subtraction. Sense and weapon
defense still read the individual character, never the modified location total.

Evidence: `tests/native-engine/location-ability.test.mjs` (32 focused tests) and
`gemp/location-ability-provenance.json` (19 fresh matching observations; 6,820
production reference files unchanged). Actual card comparisons cover deployment
costs and attachment, opposing ability 1–4, Dark Jedi suppression, a host's
numerical change during deployment, and Molator. General modifier grants are
explicitly synthetic production-query checks. Additional native tests cover
Alter, source/turn expiry, bearer movement/loss, saved corruption, presence loss,
and successive Comlink reacts that cancel a drain only when presence is restored.

There are now 112 explicit definitions. This does not admit complete decks or
all Affect Mind interactions: vehicle/aboard/captured/inactive and crossing-over
rules, other provider cards, broader prevention/replacement, full match
conformance and the complete original product scope remain unfinished. Existing
GEMP and Rules Lab paths remain intact; no new standalone study was added.

### Phase boundaries and successful deployments

`runtime.ts` now represents every phase start/end with a saved continuation.
An end-of-Deploy effect resolves with the turn still in Deploy; only afterward
can Battle begin. Empty boundaries settle automatically after checking required
actions and both players' legal responses. Draw-phase end precedes recirculation.
Boundary source snapshots retain original instances, so a newly entering card
cannot retroactively claim the boundary. Existing ordinary-phase saves remain
valid and enter the new boundary handling on their next transition.

`deployment.ts` records successful table entry before arrival responses. It
freezes the deployed card's current individual ability and active observer
instances, distinguishes canceled attempts, transfers, setup and revival, and
retains only the latest recorded turn. Departure or numerical changes do not
rewrite a completed deployment. Observer lists sort by physical ID so setup deck
input order and storage reconstruction produce identical snapshots. This is
rule-owned private state, not player-supplied action data.

`phase-effects.ts` implements the ground-character behavior of Ability, Ability,
Ability (`5_110`): free unique deployment, Alter immunity, mandatory 2-Force loss
when no qualifying opposing deployment was observed during Deploy, and self-loss
when opposing cards with positive individual ability outnumber its owner's.
Current totals and battle exclusion do not replace that individual-card query.
Normal Force-loss responses, reduction, pile choices and concession still apply.
Blaster transfers now emit `weapon-transferred`, rather than `deployed`.

Evidence: `tests/native-engine/phase-effects.test.mjs` and
`tests/native-engine/gemp/phase-effects-provenance.json`: four fresh JUnit tests,
nine matching observations, unchanged 6,820 GEMP production files. The named
Effect was actually deployed; character/droid arrivals were actual deployments.
Departure and numerical changes were explicit fixture interventions.

This does not certify vehicles/permanent pilots, inactive/captured/aboard rules,
all boundary-timing cards, broader continuous-trigger infrastructure or full
matches. These remain in scope. `premiereRules.supports` remains closed.

### Duel draw counts and total modifiers

`duel-modifiers.ts` binds resolved draw additions and continuous total modifiers
 to a saved duel identity. Continuous sources also bind their original table
instance; returning sources cannot revive expired grants. Each side freezes its
draw count when that side begins drawing. Totals remain live until the result,
then freeze before retrieval and losses. Existing physical draw caps, failed
extra draws, response windows and saved recovery still apply.

Focused Attack (`5_141`) and Courage Of A Skywalker (`5_41`) now implement their
duel-destiny addition functions during the duel modification step. They use the
normal unique/per-turn play restrictions, Sense cancellation and Lost disposal.
Their ground battle functions are documented below; both remain component-only definitions.
There are 115 explicit definitions, and production deck admission remains closed.

Evidence: `tests/native-engine/duel-modifiers.test.mjs` and
`tests/native-engine/gemp/duel-modifiers-provenance.json`. Six of seven complete
reference outcomes agree. The fractional-total case retains an explicit rulebook
difference: AR Appendix B, Brainiac (p139), rounds a small winning duel margin to
zero Force while still losing the defeated character. Pinned GEMP instead
retrieves/loses one Force. The raw reference record is retained unchanged.

Failed Obsession destiny remains separately unresolved: AR Failed Destiny Draws
establishes the loser, but the numerical Force difference after exactly one side
fails has not been verified. The general undefined-value rule excludes values
that literally do not exist, including failed destiny. The March 2021 official
failed-destiny clarification does not supply this arithmetic either. Preserve
the guard rather than inferring a number from GEMP's contradictory winner.
No new standalone study or complete-match certification is implied.

### Battle courage and attrition immunity

The battle functions of Focused Attack and Courage Of A Skywalker now target
eligible represented ground personas during ordinary weapons opportunities.
Immunity must exist when the action starts. On resolution the target's current
ability becomes a fixed power bonus for the rest of the turn, its immunity is
canceled, and its ability cannot contribute toward battle destiny. Ordinary
ability, presence and weapon defense remain unchanged. Removing immunity during
responses does not undo the other already-initiated results. Sense cancels all
three results; a departing/reentered target follows the existing original-instance
policy. Resolved modifiers survive the Interrupt entering Lost, expire at turn
end, and cannot follow the target through a new table visit.

`combat-modifiers.ts` provides ground power additions, immunity thresholds, full
immunity and cancellation with separate source/turn lifetimes. Multiple immunity
grants use the highest value; cancellation overrides them. Explicit ground
providers cover the fixed immunities in the current metadata registry, Ardan's
opposing Aliens present and Jedi Luke's alone branch. The lightsaber branch and
other unimplemented card text remain unverified and unadmitted.

When entering the damage segment, `battle.ts` saves the original instances that
are protected against that battle's total attrition. Later forfeits and immunity
changes cannot recalculate the protection. Unpaid attrition can be ignored only
when all remaining participants are protected; hits and battle damage still
require resolution. Immune cards may be voluntarily forfeited, crediting both
balances. Legacy damage saves without the new snapshot retain their old behavior;
production full-native admission was and remains closed.

Evidence: `tests/native-engine/battle-courage.test.mjs` and
`tests/native-engine/gemp/battle-courage-provenance.json`: four executed JUnit
methods produce 22 matching observations, with 6,820 production reference files
unchanged. Actual Interrupt actions, fractional current ability and missing
immunity during responses are covered; numeric interventions are explicit.
Damage-boundary records compare native frozen protection with GEMP's frozen
threshold. Native tests additionally verify cancellation, original-instance
lifetime, voluntary forfeiture, shrinking attrition, hit/damage obligations and
saved-state validation/recovery. Full cards, vehicles/aboard protection,
exact-value immunity, general immunity modifiers, text cancellation, targeting
immunity/redirection, and full native match certification remain in scope.

### Immunity policy and Trooper Assault

`combat-modifiers.ts` now handles exact-value immunity, changes to existing
immunity, less-than caps and immunity that cannot be canceled. Changes do not
create immunity where none exists. Less-than and exact grants retain the pinned
GEMP query ordering; caps affect less-than immunity, including full immunity,
and leave exact immunity alone. Cancellation protection blocks cancellation
without granting immunity by itself. Duplicate additive functions remain
noncumulative. Yoda's represented printed full immunity is now included.
Battle protection evaluates exact immunity at the frozen damage boundary, and
Focused Attack/Courage's implied-target check recognizes exact immunity too.

Trooper Assault (`5_159`) is a Used Interrupt offered in the response to battle
initiation at a site. It collects the owner's participating troopers when it
resolves, then gives those original table instances +2 power and full immunity
for the rest of the turn. Later arrivals do not join the resolved grant; later
loss of the trooper characteristic does not remove it. Duplicate copies do not
stack the power bonus. Existing immunity cancellation suppresses the immunity
but leaves the power bonus intact. Sense cancels both results and sends the
Interrupt to Lost; ordinary resolution sends it to Used, including when all
eligible recipients have departed.

Evidence is in `tests/native-engine/immunity.test.mjs` and
`tests/native-engine/gemp/immunity-provenance.json`. Queries use production
GEMP modifier classes; actual Trooper Assault plays cover normal resolution,
Sense, duplicate copies, immunity cancellation and controlled changes to battle
participants during responses. These controlled arrivals are mechanism checks,
not assertions that a particular movement/deployment card is verified. A complete
battle also checks that an unprotected character can pay losses while an immune
trooper survives the remaining attrition.

There are 116 explicit definitions. Full admission remains closed. This does not
implement Tusken Breath Mask's Utinni Effect lifecycle, all source cards for these
modifiers, general game-text cancellation, immunity transfer to passengers,
vehicles, wider personas or the still-required full-engine/product scope.

### Premiere lightsabers and weapon forfeiture resets

Jedi Lightsaber (`1_155`), Obi-Wan's Lightsaber (`1_157`), and Vader's
Lightsaber (`1_324`) now have ground-character deployment, transfer, react
permission, and battle firing implementations. Named weapons require their
matching persona; Jedi Lightsaber requires a warrior and calculates its cost
from current ability. The pinned reference uses rounding up for fractional
deployment payment and truncation for this weapon's firing cost; that fractional
case is not part of the executed comparison yet.

Each firing uses one saved weapon-destiny sequence for both draws, including
costs, limits, individual draw responses, substitutions, cancellation and total
responses. A surviving successful draw still contributes when the other fails.
Current ground-character ability is the represented defense value. Successful
named lightsaber hits reset forfeit to zero; generic Jedi Lightsaber only hits.
Hit prevention also prevents the reset. Weapon resets override ordinary bonuses,
survive the weapon's departure and turn changes, and expire on restoration to
normal or departure of the target's original table instance. Talz restoration
now clears both hit status and the weapon reset, so restored cards regain their
ordinary forfeiture value. A zero-forfeit hit still requires loss but pays no
battle damage or attrition.

The drain bonus is an optional response to the owner's initiated drain. The
saved drain continuation records attempted and resolved sources, permitting each
physical weapon once; same-title copies do not stack their +1. A resolved bonus
uses the weapon for the bearer's turn allowance, which permits subsequent use of
the same weapon but blocks a different weapon for a single-warrior-icon bearer.
Printed Jedi Luke (`9_24`) now queries attached lightsabers for power +2 and his
armed immunity branch, including the combined alone-and-armed value.

Evidence: `tests/native-engine/lightsabers.test.mjs` has 51 tests, including exact
comparisons to 21 fresh observations from five GEMP JUnit tests. The harness runs
actual deployments, weapon actions, optional drain actions, and Talz restoration;
all 6,820 production reference files remain byte-identical. See
`tests/native-engine/gemp/lightsaber-provenance.json` for scope and limitations.

This is component coverage, not full card admission. Creatures, aboard/captured
and vehicle targets, permanent weapons, general defense-value and forfeiture
modifiers/prevention, broader weapon targeting/cancellation and character text
remain unfinished. Existing physical-target behavior is retained; this does not
resolve the previously recorded target-departure/reentry differences. All full
native deck admission remains closed. No new Rules Lab studies were added.

### Current defense and forfeiture values

`stat-modifiers.ts` supplies saved, original-instance ground Character modifiers
for armor, maneuver, defense and forfeit. Turn grants survive source departure;
continuous source grants expire with their source. Duplicate title/function
grants are noncumulative unless explicitly declared otherwise. Additions do not
invent absent attributes. Armor can be defined or reset; maneuver modifiers
require a character with a printed maneuver attribute.

`defenseValue` selects the greatest applicable current ability, armor, maneuver
or explicit special defense value, then applies defense modifiers. Defense-only
changes leave the underlying attributes unchanged. Reduction prevention may
restrict either player or both; minimum/maximum constraints and competing resets
follow the separately tested reference ordering. The `base-cap` operation caps
at the value of current underlying attributes before defense-only modifiers; it
is deliberately distinct from a literal printed-stat cap. Both blasters and
lightsabers query the current defense when their result resolves.

Forfeit now supports defined values, doubled base, signed bonuses, resets,
prevention of increases/reductions, limits above printed forfeit and a printed
cap. Existing Luke, location and equipment bonuses pass through this same
calculation. Weapon resets consult reduction protection when the hit occurs:
protection present then prevents storing a reduction; protection added later
suppresses an existing reset while it remains active. Neither prevents the hit
itself. Actual battle damage/attrition payments use the resulting forfeit value.

Evidence: `tests/native-engine/stat-values.test.mjs` has 60 focused tests. The
pinned GEMP harness executes 51 current-stat query cases and two actual protected
lightsaber attacks. Exact outputs are checked by the native tests. Dams Denna
(`14_9`) is added as **metadata-only**, solely to exercise a real Character's
printed maneuver; its deployment/download and creature-vehicle text are not
implemented or admitted. The definition registry now contains 120 cards.

These APIs are mechanisms, not implementations of every provider card. The
`DoubledModifier` reference fixture is represented by separate native ability,
armor, maneuver and forfeit grants; comprehensive doubled-card text/power is
still unfinished. Vehicle piloting/unpiloted values, creatures/Dejarik,
conditional text cancellation, broad provider cards and full native admission
remain in scope. No new standalone Rules Lab scenario is introduced.

### Attached armor and definition/reset context

Mandalorian Armor (`5_109`) now deploys/transfers for 3 Force onto eligible own ground Imperials/aliens, excluding Vader and Boba Fett personas. It participates in existing deployment responses, Comlink reacts, cancellation, uniqueness, original-instance validation and attachment loss. Its continuous power +2, armor 5 and immunity to attrition < 3 feed actual weapon defense and battle damage queries. Production full-match admission remains closed.

An attachment record binds source and bearer table instances and preserves whether armor **defined** a missing attribute or **reset** an existing one when deployment/transfer resolved. Transfers replace that record; removal ends its effects. AR p28 explicitly uses Mandalorian Armor as the example: newly defined armor can be modified, while pre-existing armor is reset to an unmodifiable value. Additive-only armor does not invent an attribute. A defined zero remains an existing attribute.

`armor-equipment.test.mjs` includes 30 checks of deployment legality/cost, transfer/cancellation/react, saved identity and privacy, definition/reset ordering, actual lightsaber hits and immunity at damage entry. The four executed tests in `gemp/NativeEngineArmorOracleTests.java` produce 13 observations: 11 agree, while two show the pinned engine's unconditional `ResetArmorModifier` disregarding the official modifiable-definition example. `armor-provenance.json` records the official adjudication and unchanged 6,820 production-source files. The reference inputs arrange component boards; they do not certify a full deck or every native regression. Crossing-over, persona replacement, inactive/aboard/captured states, text cancellation and additional providers remain required engine scope. No new study was added.
