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
4. Complete sealed pools and pack-backed deck construction; custom open 40/60-card
   selection and private saved drafts are connected below. Complete independent scheduling,
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
These restrictions now use the shared title/function/player/pile policy in
`search-policy.ts`; legacy per-card flags remain readable without query mutation.

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
engine deadlines on interaction. Optional durable PvP clocks are implemented below;
autonomous CPU scheduling and timed CPU matches remain required service work.

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

### Delevar forfeiture protection and recovery

`medics.ts` implements Corporal Delevar (`8_5`) for current ground characters: own-character forfeiture reduction protection at his location, the Echo Med Lab extension to Hoth sites, and optional once-per-turn recovery of a same-site just-forfeited character while with an own FX-7. Protection feeds signed modifiers and weapon resets. Protection already active at a lightsaber hit prevents storing its reduction; protection arriving later suppresses an existing reset only while present.

Recovery spends the original source instance's allowance at initiation and survives departure of the medic or supporting droid. It binds the target's original Lost-Pile visit, exposes the existing just-lost removal response boundary, and places only that character on top of Used. It neither retrieves Force nor refunds the already paid forfeiture; attachments remain lost. Forfeiture events now carry a saved card reference, also used by Old Ben to reject reopening an old opportunity after the card leaves and returns to Lost. Legacy events without references retain Old Ben's prior behavior.

`medics.test.mjs` has 29 checks. Three executed `NativeEngineDelevarOracleTests` methods produce 16 matching observations covering seven actual recovery branches, six protection contexts, two actual lightsaber attacks, and usage/source-instance resets. See `gemp/delevar-provenance.json` for controlled fixture interventions and the 6,820 unchanged reference production files.

Definitions now include metadata-only FX-7 (`3_9`), Echo Med Lab (`3_60`) and Echo Docking Bay (`3_59`) for these interactions. Their own text is not implemented, and they are excluded from deployment offerings. FX-7 metadata uses the official AR p113 erratum rather than the pinned engine's older ordinary-loss text. Source metadata currently follows Delevar's GEMP constructor for ground icons (Warrior); the broader catalog additionally lists Pilot, which remains to be independently adjudicated before pilot admission. Aboard/inactive/captured contexts, permanent FX droids, general loss replacement/prevention, text cancellation, full Hoth gameplay and full deck admission remain required work. No new study or production match admission was added.

### FX forfeiture destination replacement

`forfeiture.ts` now persists an original-instance pre-forfeiture response window after crediting the battle payment. Empty windows advance automatically after checking both seats and mandatory triggers. FX-7 (`3_9`) and FX-10 (`3_86`) can use this window once per source instance per turn to send an own hit non-droid character at the same or adjacent ground site to Used instead of Lost. Usage is spent at initiation, including cancellation; a departed source does not cancel an already initiated effect. Original-target departure invalidates the pending placement without refunding the paid value.

Attachments leave simultaneously with the character, are ordered in their owners' Lost Piles, and do not follow the character to Used. Pending ordering and destination survive serialization. Used placement neither triggers just-lost Delevar/Old Ben recovery nor counts as retrieval. Talz's forfeiture cost uses the same boundary and can still restore another character after going to Used. Legacy `battle:forfeit-result` saves retain their existing continuation.

`fx-droids.test.mjs` has 28 checks, including real blaster hits for both sides, Talz cost, attachment ordering, cancellation, identity/turn renewal and forged-save rejection. Eight observations from one executed `NativeEngineFXOracleTests` method match credited payment and destination for both droids at same/adjacent sites, decline and source departure. The comparison matrix uses controlled native hit setup; the reference uses actual blaster actions. See `gemp/fx-provenance.json`. All 6,820 reference production files remain unchanged.

Official AR p113 restricts these effects to forfeiture; older ordinary-loss wording in the pinned GEMP constructors is not implemented. FX-7 is promoted from metadata-only to component coverage, and FX-10 is added (126 definitions). FX-7's Bacta Tank variable modifier remains pending. Aboard/inactive/captured contexts, permanent FX droids, general loss replacement/prevention, text cancellation, Hoth site text and all other full-engine requirements remain unfinished. Full native match admission stays closed. No standalone study was added.

### Bacta Tank and inactive patients

Bacta Tank (`3_32`) deploys for 4 Force and can place an own just-lost non-droid character on the Effect after Lost-Pile ordering and the just-lost removal response. It has one patient slot. During the owner's deploy phase, its once-per-phase action spends the patient's deploy value to return it to hand. Active own FX-7 droids cumulatively reduce X by 2, across locations, with a zero floor. An asterisk deploy value is zero under the specific AR p138 exception. Site deployment discounts and permissions do not apply to this attribute query.

Patients use a saved, face-up `stacked` zone and host relation, distinct from active attachments. They contribute no location presence or active text, remain outside Life Force, and retain title/persona uniqueness restrictions. Losing the Tank includes the patient in simultaneous departure and Lost-Pile ordering. The public match projection exposes the patient, and the responsive card UI labels it “Patient · Inactive.” Returning it to hand removes that badge and restores the normal hidden-hand boundary.

All table-loss response windows now snapshot their original Lost-Pile card references. Bacta Tank and Old Ben cannot reopen an old loss opportunity after a target leaves and returns. Bacta initiation and pending placement bind both target and Tank instances; patient return spends its phase allowance and Force before responses. Losing the Tank during recovery cannot return the now-lost patient to hand. Attachments stay lost, and neither stacking nor patient return is Force retrieval.

`bacta.test.mjs` exercises deployment, cost/cancellation, capacity, inactive uniqueness, loss-instance references, host departure, attachments, public projection and serialization. `bacta-browser.mjs` uses Playwright 1.62.1 with isolated real-engine command/projection fixtures at 1440, 834 and 390 pixels; it verifies patient inspection, recovery and refresh. Seven observations from one executed GEMP JUnit test cover the native lifecycle outputs and inactive state: six agree exactly. The Jawa recovery cost is an explicit official-rule exception: GEMP charges 1 through its general defined deploy-cost query, while native follows AR p138 and charges 0 for the printed asterisk. All 6,820 reference production files remain unchanged; see `gemp/bacta-provenance.json` for fixture scope and limits.

This checkpoint adds the first inactive stacked-card lifecycle, not every stacked-card rule. Supporting/face-down stacks, aboard/captured/crossed-over cards, Redemption deployment, general global deploy-cost providers and cancellation/prevention remain required. Current Bacta deploy-value queries cover represented printed values plus its explicit asterisk exception and FX-7 reductions; global providers such as Bad Feeling Have I remain unimplemented. Full Hoth site behavior, wider catalog, full native deck admission and all other entire-engine scope remain unfinished. No new standalone study was added.

### Global deployment values and Echo Med Lab

`deploy-costs.ts` separates current deploy attributes from deployment-only adjustments. Bad Feeling Have I (`4_116`) deploys for free, increases the deploy values of its named personas by 2 in every represented card state, and prevents its opponent from playing titles containing “bad feeling.” Ordinary character deployment and Bacta Tank recovery query the same global value; site discounts remain confined to deployment. Source departure removes the continuous modifier and prohibition, while already initiated payments keep their committed amount. Named persona matches apply once even when a card has multiple matching personas; duplicate automatic copies are noncumulative.

Echo Med Lab (`3_60`) now has component coverage and can be deployed as a location. Light's first successful medical-droid deployment observed by the active Lab each turn receives -2, wherever that droid deploys. The existing serialized deployment records bind the observing Lab instance, so deploying the Lab after an earlier droid leaves its allowance available. Retired/unsuccessful deployment does not consume that success-based allowance. An ordinary droid or Dark medical droid neither qualifies nor consumes it. The site's Dark text adds 1 to its Force drain only while Dark controls it with an Imperial present.

Automated native tests exercise global values across hand/Lost/table, actual Effect/character deployment, patient costs, actual Interrupt offering, payment persistence, the Lab's deployment history, location eligibility and conditional drains. The fresh GEMP harness runs attribute queries, actual deployment, actual patient return with zero/one/two FX-7 droids, conditional drain queries, and complete battle-initiation opportunities with/without the play prohibition. See `gemp/deploy-cost-provenance.json` for the exact comparison scope.

There are now 128 explicit definitions. This does not implement every named persona card, all deploy-cost providers, free-deployment policies, multi-card costs, text cancellation, pilot/passenger/vehicle contexts or captured/crossed-over ownership. The Lab's retired-deployment check is a controlled runtime retirement fixture, not an implemented general character-deployment cancellation card. Echo Docking Bay remains metadata-only. Full native match admission and the entire engine's remaining scope stay open; no standalone study was added.

### Echo Docking Bay transit and conversion

Both Echo Docking Bay versions (`3_59` and `3_147`) now have component coverage. Transit calculates the entire route before offering a party: departure cost plus the Light version's Dark-side arrival surcharge of 4 Force. The selected group pays once. Dark's explicitly free departure from Death Star Docking Bay 327 remains free even when arriving at the Light Echo bay; “free” cannot be increased under AR pp66/70. The displayed confirmation and committed payment use the same route query. Existing response, original-character references, regular-move usage and saved continuation behavior remain in place.

Normal location deployment can convert either Echo version into the other. Occupants stay at the active replacement, while the current version supplies its Force icons, departure cost and arrival surcharge. War Room Reserve search now finds and can deploy the Dark Echo bay over the Light version. Covered versions cannot supply routes or cost queries.

`echo-transit.test.mjs` compares 47 observations from four executed GEMP JUnit tests: 32 actual two-character transits (both versions/sides/directions and all four earlier bays), two conversions, one search/conversion and 12 independent affordability fixtures. Additional native checks cover confirmation labels, serialized continuation, costs at insufficient/exact Force, zero-Force free transit, cancellation, private seat choices and the closed production admission gate. See `tests/native-engine/gemp/echo-transit-provenance.json`; all 6,820 reference production files are byte-identical to the pinned source archive.

There are now 129 explicit definitions. This verifies ground-character transit components; vehicle/aboard movement, movable site weapons, broader movement-cost providers, collapsed sites and text cancellation remain required. Full native match admission remains closed pending all reachable behavior and timing verification. The entire-engine objective, custom open40/60 and sealed workflows, CPU/PvP, durable recovery/clocks/capacity, responsive gameplay and broader catalog remain in scope. No standalone study was added.

### C-3PO's distinct pairs and R2-D2's forfeit

C-3PO (`1_5`) now has ground component coverage and can deploy for its printed 3 Force. `protocol-droid.ts` adds 2 to total power for each distinct own Rebel/droid pair present, including C-3PO. A card cannot be reused in another pair (AR p139); excess droids/Rebels, opposing droids and aliens do not create extra pairs. This modifies total power only, preserving each card's individual power for other calculations.

An active, present C-3PO also gives the represented R2-D2 persona +2 forfeit. The shared forfeit calculation applies existing reset, increase-prevention and cap rules afterward. Hand, Lost, stacked and attached cards cannot supply these ground-present modifiers. Excluded/nonparticipating characters at the current battle site supply neither text nor pairs; outside that battle, or after it completes, their ordinary location modifiers apply again. Source departure immediately removes the bonuses. Power already finalized for battle remains frozen, while each later forfeiture uses its current value: R2-D2 pays 6 if C-3PO remains present and 4 if C-3PO was forfeited first.

`participation.ts` shares the existing Barrier and battle-member state queries without loading action handlers. This avoids a board/battle import cycle and adds no saved-state fields.

`protocol-droid.test.mjs` has 41 focused checks, including actual deployment/Imperial Barrier, both forfeiture orders, full battle completion/reactivation, serialization, source return, hit status and existing statistic restrictions. The executed GEMP harness supplies 32 matching observations across four JUnit tests. It samples power at the reference engine's documented pre-damage boundary and fully resolves its before-exclusion window. All 6,820 production reference files remain unchanged; see `tests/native-engine/gemp/protocol-provenance.json`.

At the C-3PO checkpoint, R2-D2 remained metadata-only; the next section supersedes its Scomp-link and drawn-destiny coverage. Aboard-starfighter bonuses remain required, as do broader aboard/captured/crossed-over contexts and complete exclusion/prevention timing. This checkpoint does not open full-match admission or replace any existing GEMP path/study. The entire native-engine objective remains unfinished.

### R2-D2 printed destiny and Scomp-link responses

R2-D2 (`2_14`) now has ground component coverage. Every shared physical destiny draw pauses for its owner to choose printed 2 or 5 before modifiers and just-drawn responses. The decision, continuation and selected printed value survive JSON recovery. Values bind to the physical card's current unresolved-zone visit; retained selection draws keep independent choices, while cleanup/cancellation/redraw cannot reuse an old choice for a new visit. Battle and weapon adapters share this implementation. The metadata's erroneous Nav Computer icon is removed to match the pinned card constructor.

At a ground Scomp-link site, R2 may respond once to each opponent's just-drawn destiny: current value 1–3 activates one Force; 4–6 draws the current Reserve top into hand. Eligibility reads the suspended draw's current modified/substituted value and cancellation status, rather than a stale event copy. Own, failed, canceled, completed, out-of-range and empty-Reserve opportunities are absent. Excluded battle participants and inactive/attached characters cannot provide this ground response. Using it consumes that draw's opportunity even if the response is canceled; source departure does not undo an initiated effect. Card-text activation does not consume the turn's Force-generation allowance.

`astromech.test.mjs` supplies 57 checks, including actual ground deployment, battle/weapon draws, retained choice, redraw, current values, source departure/reentry, canceled responses, exclusion, owner-only decisions, corrupted snapshots and serialized recovery. Fourteen observations from two executed GEMP JUnit tests match native execution: both printed choices with drawn/completed/total and pile timing, plus twelve Scomp/non-Scomp responses at values 0/1/3/4/6/7. See `tests/native-engine/gemp/r2-provenance.json`; all 6,820 reference production files remain unchanged. The full 2,001-test engine/proof suite, TypeScript check and Sites runtime build pass.

This covers ground components, not every R2 behavior. Aboard-starship bonuses and Scomp links, action-scoped active-table choices, locked drawn-to-stacked destiny, generic draw/activation restrictions and their response hooks, text cancellation and broader ship/vehicle/pilot/passenger rules remain required. Native-only edge checks are distinguished from fresh GEMP observations in provenance. Full-match admission remains closed; the entire engine/product scope, existing GEMP paths, studies and saves remain intact. No new standalone study was added.

### Han, Tarkin and Praji ground interactions

Han Solo (`1_11`), Grand Moff Tarkin (`1_179`) and Commander Praji (`1_167`) now have ground component coverage and ordinary printed-cost deployment. Han can pay 1 Force once per battle to cancel and redraw his owner's just-drawn destiny while participating. Tarkin can cancel one opponent's just-drawn destiny per battle while participating with Vader. Both apply to ordinary, battle and weapon destiny during that battle (AR p144), not only battle destiny. Excluded/absent sources, missing participating Vader, failed draws, substituted values and already canceled draws produce no action. Han's usage is consumed at initiation and his Force payment uses the existing saved cost pipeline. Source departure does not undo an initiated effect; a canceled response still consumes its allowance. A fresh battle has a fresh allowance.

`destiny-response.ts` binds the exact live pending draw and centralizes its current value/cancellation query for R2, Han, Tarkin and Han's Dice. Han's Dice now also refuses an already canceled draw. Weapon adapters preserve their original `DrawFlow`, including sequence limit, physical reference and modifiers. Cancel-and-redraw replaces the original sequence slot and cleans up its physical card before revealing the replacement; plain cancellation keeps the slot consumed. Older pending ordinary weapon draws recover their newest saved matching sequence under the engine's existing once-per-weapon battle rule. Pre-sequence saves retain their original unlimited behavior.

Praji's presence supplies a text-cancellation provider for C-3PO and R2-D2 at that location. Mandatory cancellation/restoration actions persist target-instance references, allow the turn player to order simultaneous targets, and expose result response windows. Text cancellation removes C-3PO's pair power/forfeit contribution and R2's Scomp response, without changing their icons, attributes, identity, or R2's printed 2/5 choice when subsequently drawn. Excluding Praji from a battle removes his provider during that battle. Source departure restores the droids through the same rule-action boundary. An already initiated droid effect survives later text cancellation.

The 47 focused character tests include all three draw paths, deployments, both mandatory orders, costs and usage, source/target eligibility, serialized decisions, saved-state validation, a second actual battle, empty replacement Reserve, and legacy limited weapon saves. Eleven observations from two executed GEMP JUnit tests match native traces and attribute queries; Praji queries occur after the reference has processed its table-change rules. All 6,820 production reference files remain unchanged; details and native-only checks are in `tests/native-engine/gemp/character-destiny-provenance.json`.

There are now 131 explicit definitions. This checkpoint adds ground components and no new study. Pilot/starship bonuses for these characters, aboard targeting, general cancellation providers/prevention/ordering interactions, full source-reentry conformance, stacked/action-scoped printed destiny and the broader engine/product scope remain required. Full native match admission remains closed; existing GEMP paths, Rules Lab studies and saves remain in place.

Final validation for this checkpoint: all 2,048 engine/proof tests pass, along with TypeScript and the Sites production-runtime build. Full-game admission and full-engine completion are not implied by these component results.

### Mine losses, buried duds and private inspections

Equipment losses now pause before removal, including mine casualties, defusing and the mine's own discard. The casualty owner retains choice and loss attribution, matching GEMP; source/target departure or movement during an initiated defuse retains the existing reference behavior, including a returned physical target. The new table-loss group query exposes attached dependents before removal, and the loss continuation waits until all Lost Pile ordering finishes before emitting a complete, instance-bound event. A retrieved/re-lost casualty cannot resurrect its earlier just-lost opportunity.

Revealed non-mine duds now go directly from their buried state through Lost ordering. They never become deployed/active locations, characters or devices, and their event is distinct from losing a character from table. This matters in complete matches where a player buries location or attachment cards as duds. The initial full-match audit exposed an invalid transient table state after the new response boundary; the dedicated regression covers all three card types.

Electrobinoculars cannot initiate against an empty Reserve Deck under the explicit implied target rule (AR p21). An already paid peek whose pile becomes empty finishes without an inspection or a refund. Saved private inspections validate their source, seat and exact ordered pile prefix, so corrupted state cannot inspect an arbitrary card. GEMP's Card1_035 still offers an empty-pile peek; this is a recorded difference, not a parity claim.

The fresh reference harness has three executed JUnit tests and ten observations: seven defuse source/target cases, complete casualty event attribution including an attached weapon, and empty/nonempty Electrobinoculars eligibility. Nine observations match; the empty-pile difference is explicit. All 6,820 reference production files remain byte-identical to the pinned archive. Native tests additionally cover saved choices, stale loss responses, invalid private snapshots, multiple casualties, and buried duds. See `tests/native-engine/gemp/mine-identity-provenance.json`.

The starter inventory now records the exact intro-list identities and next full-match verification work. The one-failed-destiny-set Obsession guard, remaining reachable timing, and full-match GEMP comparisons remain required before introductory admission. Broader mines/prevention, vehicles/aboard targets and the entire catalog/product scope remain required. No standalone study or production admission gate was added or opened.

Final validation: all 2,070 engine/proof tests pass, including 22 new focused tests; TypeScript and Sites runtime build pass. Two fresh 60-card matches (seeds 21/22) completed 48/34 turns and 3,627/3,017 commands with exact transcript replay. The saved audit includes source hashes. These integrated native runs use test-only admission and do not substitute for GEMP full-match certification.


### Shared failed-search policy

`search-policy.ts` records verified failures by searching player, source title,
declared function, pile owner, pile and turn (AR p12). Kintan Strider, Docking
Control Room 327 and Tusken Scavengers now use it. Source departure, another
physical copy, a reshuffle or new eligible cards do not lift the restriction.
Other functions, titles, players and piles stay independent; the next turn clears
the restriction. Repeated records are idempotent and expired records are pruned
on subsequent writes. Empty-pile legality and action timing stay with providers.

Old per-card failed-search flags are interpreted on reads so an existing save,
including a suspended Control Room verification, resumes correctly. New failures
write the shared history. Prompt/projection do not migrate or expose that history.
Malformed, duplicate and future-turn records are rejected before command mutation.

Fresh GEMP evidence is in `gemp/search-policy-provenance.json`: 12 matching
observations from two JUnit tests, including a real failed docking-bay search.
The nine modifier queries isolate title/copy/function/player/pile/turn semantics;
they are not nine additional implemented cards. Existing actual Kintan and
Scavengers fixtures were also rerun (13 unchanged observations). Scavengers'
previously documented optionality/order differences remain; its failure recurrence
is verified natively against the official rule, not by that reference fixture.

The complete native suite passes 2104 tests, including 34 new regressions.
Compound or dynamic titles, stack/hand searches, external search prevention and
broader provider cards remain required. Full-match production admission is still
closed; the failed-destiny Obsession Force amount is still guarded. No new study
was added.

## Complete introductory match comparison

Two full 60-card GEMP games now replay through native commands with matching
checkpoints and final outcomes. Ground A ends with Dark winning after 30 turns
(1,558 native commands, 150 checkpoints); Ground B ends with Light winning after
77 turns (2,513 commands, 207 checkpoints). Together they exercise nine battles
and 47 Force drains. These are selected-path comparisons, not full-deck admission.

`tests/native-engine/gemp/complete-match-provenance.json` records exact fixture,
source and deck identities. The Java harness drives an unmodified pinned GEMP
engine using the actual introductory lists, without helper cards, forced destiny
packs or mid-game state changes. Native setup supplies a lawful shuffle that
reproduces the recorded opening. Ordered piles, site adjacency, occupants, current
character values, battle damage/initial attrition and the winner are compared.
Hands and the layout order of separate systems are normalized; within-system
site order and every pile order are preserved.

Run the fixed regressions with:

```sh
node --test tests/native-engine/gemp-match.test.mjs
node tests/native-engine/gemp-match-replay.mjs tests/native-engine/gemp/complete-matches/ground-b.json.gz
```

To generate a fresh reference, copy the Java harness into the pinned GEMP
server's `src/test/java/com/gempukku/swccgo/rules/devices/` directory, mount the
reference workspace at `/opt/gemp-swccg`, and copy `data/native-proof/manifest.json`
to `/opt/gemp-swccg/match-manifest.json`. Run the Maven command recorded in
provenance from the source root. Output is
`/opt/gemp-swccg/complete-match-results.json`. Fresh GEMP runs use fresh random
shuffles and may encounter a decision the current adapter does not yet handle;
unmapped decisions fail rather than being silently skipped.

Ground A's exact earlier harness is retained beside its fixture. Ground B uses
the current harness, which distinguishes ordinary drawing from an Interrupt's
"Draw destiny" action and restricts ordinary deployment to hand cards. Both
fixtures validate their selected action labels during replay. Regression tests
also reject incomplete games, altered deck lists, changed pile order and an
incorrect final winner. All 6,820 reference production files were byte-verified
unchanged. The complete 2,112-test native/proof suite and TypeScript check pass.

The policy passes optional responses and does not choose card-text actions,
equipment, movement or additional location deployment. It does not exhaustively
compare offered legal actions or remaining attrition. Broader timing, failed
Obsession adjudication, vehicles/space, special setup and the entire product
scope remain required. Production `supports()` remains false; existing GEMP
paths, studies and saved games are unchanged. This checkpoint changes validation
and documentation only and does not require a website deployment.

## Expanded full-match paths and empty-Reserve weapon fire

Three further complete GEMP games replay natively: 35, 66 and 27 turns,
8,456 native commands and 913 compared checkpoints. These introduce weapon
shots/hits, 195 movements, 15 site deployments (including conversions), and
player-chosen simultaneous loss ordering for attached weapons. Snapshot v3
compares attachment hosts and hit flags as well as the earlier values. Exact
reference sources, fixture hashes and limitations are recorded in
`tests/native-engine/gemp/expanded-match-provenance.json`.

The 66-turn game exposed a native legality error at turn 35: an Imperial Blaster
could not fire when its owner's Reserve was empty. AR pp10/21 explicitly exempt
destiny draws from empty-pile initiation restrictions; p31 explains failed destiny.
Native blasters/rifles, lightsabers and Gaderffii Sticks now allow that initiation
when all other requirements are met. Payment and weapon-use limits still apply.
No completed draw means no total and no hit/weapon suppression; it is not a zero
that can gain bonuses. Eight new native regressions cover all three weapon
families, actual firing costs, misses, unchanged target forfeit and consumed use.
An older Gaderffii test asserting the incorrect restriction was corrected.

Five archived complete games now cover 12,527 commands and 1,270 checkpoints.
The replay also rejects corrupted attachment hosts and hit status. The new
source includes an adapter for choosing required Timer Mine ordering by
observing the selected GEMP action's source; the three successful new games did
not exercise that adapter. An earlier fresh run stopped at that previously
unmapped required decision and is not counted as complete evidence.

These are chosen legal paths, not exhaustive conformance or complete card
admission. Remaining attrition is not compared separately from initial attrition.
Optional card-text responses, automatic mine ordering in a complete replay,
special setup and the broader engine/product scope remain required. Full native
admission remains closed; existing studies, GEMP routes and saves are preserved.

## Complete matches with responses, mines and devices

The next two complete games add 9,263 commands and 982 checkpoints, including
actual Barrier and It Could Be Worse plays. The 71-turn game exposed a Timer
Mine sequencing error: the native engine removed multiple characters together.
It now records the chosen target set, lets the owner select the next casualty,
and finishes that character's loss and responses before proceeding. Each
character and its attached cards still leave together, with their own Lost Pile
ordering. Pending targets use saved zone-instance references; departed or
returned instances cannot become replacement casualties. See
`tests/native-engine/gemp/response-match-provenance.json` for exact evidence and
the native-only recovery/identity checks.

Four subsequent complete games add 14,246 commands and 1,585 checkpoints. They
exercise device attachment bonuses, four explicit required mine-order choices,
and 99 private inspections using Macroscan and Electrobinoculars. Snapshot v4
also compares unattached active Effects. Native owner views must reveal the
recorded inspection blueprints in order, while opponent views reveal none. The
optional Reserve-to-Force movement follows the actual Yes/No answer. The replay
now compares current modified battle-damage totals rather than the separate
initial-damage record. That was a comparison correction: the native remaining
obligation already matched GEMP. No runtime rule changed in this device batch.
Exact executed sources and fixture hashes are in
`tests/native-engine/gemp/device-match-provenance.json`.

The eleven-game corpus covers 36,036 commands and 3,837 checkpoints. Every game
uses the exact introductory lists and unmodified reference production sources.
Fresh client policies preserve pairs of mines and some Force/hand cards; these
are ordinary player decisions, not altered rules or mid-game fixture mutations.
Old Ben and Kintan driver branches were added but were never offered in these
four completed games, so no full-match conformance is claimed for them. Device
transfer, other recovery/response branches, complete legal-choice comparisons,
remaining attrition and the broader native engine/product requirements remain
unfinished. Full production admission stays closed. This validation-only batch
does not require a website deployment.

## Public values and computer policy 2

`public-values.ts` derives active character power, defending power, ability and
forfeit, plus site totals, from the shared rules selectors. Both seats receive
the same `rules.values` record. It contains only public active character/site
identities, without hand identities or hidden pile order. Character forfeiture
uses the actual payable value, including bonuses from characters at adjacent
sites who are not battle participants. The full-match replay checks projected
current power, ability and forfeit against GEMP at every recorded checkpoint.

`native-cpu-2` uses these current values and defensive bonuses instead of only
printed estimates. It prioritizes hit losses, avoids using damage reduction on
obligations covered by compulsory forfeits, chooses a useful legal reduction
amount, values Talz rescue and low-value mine casualties, and can choose offered
Old Ben, Kintan and Barrier actions. It still receives only its player projection,
selects only engine-offered choices and produces deterministic decisions across
JSON recovery. The service retains revision/CAS protection and a separate
computer receipt namespace; the policy identifier changes for new receipts.

This remains a bounded heuristic opponent, not an optimal strategy or additional
rules implementation. Broader card tactics, resource planning and production
full-match admission remain required. No new Rules Lab scenario is added.

### Optional durable PvP clocks

Private native matches can select `clockMinutes: 15 | 30 | 45 | 60` at creation;
null/omitted remains untimed. This is an explicit online match time control, not a
change to card rules or a claim to implement tournament round scoring. CPU matches
remain untimed until independent computer scheduling exists. Setup and waiting for
a guest are untimed. During gameplay, time belongs to the seat owning the current
legal prompt, including responses and required decisions; it is not necessarily
the turn player. Closing a browser, pausing the empty-opportunity UI, or inspecting
a card does not pause match time. There is no per-decision timeout or time extension.

The invitation fragment includes the chosen duration. Joining must acknowledge the
exact server-stored `clockMinutes`; missing/tampered terms cannot seat a player in
a timed game. Existing untimed invitation links and idempotency hashes remain
compatible. The duration cannot change after creation. The separate nullable
`native_matches.clock` column stores both balances, decision owner and server-time
anchor. Migration 0003 adds it without rewriting existing matches or receipts.

Every legal move consumes elapsed time and moves the clock to the new decision
owner in the same receipt/snapshot transaction. Reads project elapsed time without
writing or resetting the anchor. At zero, the next authorized read or command
commits a terminal `timeout` result through the timer CAS; a late move cannot act.
Concurrent readers and expired commands cannot produce two wins or partial clock
writes. Concession and ordinary wins freeze both balances. Persisted clocks are
validated against the current decision owner. Client-supplied balances/timestamps
are rejected. Backwards timestamps cannot refund committed time.

Both scoreboards display remaining time on desktop, tablet and phone. Local
countdown interpolation is display-only; only a saved server result declares a
winner. Refresh/retry and original invitation retry preserve the clock. Until an
autonomous scheduler exists, expiry is materialized on the next interaction, with
all subsequent actions checking it first. Full production rules admission remains
closed; this service and UI implementation does not certify any additional cards.

`match-clock.test.mjs` and the service suite verify duration validation, immutable
invitation terms, boundary expiry, duplicate commands/joins, transactional rollback,
corrupt state, untimed compatibility and concession. The isolated real D1/workerd
smoke test verifies simultaneous expiry against the additive migration. Portable
Playwright checks exercise timed invitations, setup, real service transitions,
refresh and timeout UI at 1440, 834 and 390 pixels. These are match-service tests,
not additional standalone Rules Lab studies or GEMP clock-conformance claims.

### Lars family and durable table-loss origins

Beru Lars (`1_2`) and Owen Lars (`1_22`) now have ground-character components.
Beru deploys at -1 at the Light Lars' Moisture Farm; Owen deploys there for free.
The farm's Luke discount now uses the existing explicit persona registry. Beru's
forfeit bonus and Owen's power bonus check the named character/device at the same
site, without adding twice when both alternatives are there. Excluded characters
cannot supply local battle modifiers; site devices need not be battle participants.
Forfeit increases still pass through the shared resets, caps and prevention query.

Their required loss triggers use a saved original table instance. `table.ts`
records the origin before the table → leaving → Lost sequence, including compound
attachment ordering. `loss-origin.ts` distinguishes a real active-table loss from
hand/Force loss, a buried dud, an inactive stacked character or forfeiture into
Used. A departure and later return to Lost cannot revive an old loss opportunity.
These records contain at most the latest origin per physical card and are not
included in either player's private projection.

Each initiated Lars trigger records its Lost instance once, survives source
movement during responses, and applies a global Luke-persona power modifier
through the end of the next owner turn. Beru and Owen combine to +6. Repeated
same-title effects do not accumulate. This global power query works in every card
state, including a Luke in Reserve, hand or Lost, and follows later Luke instances
and personas. It is not locked to the Luke present when a Lars character was lost.
See the official Advanced Rulebook pp27–28 (global-effects example), p104 (Beru),
p123 (Owen), and p130 (Light farm):
https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf.

Four executed tests against unchanged pinned GEMP yield 18 matching observations:
seven local attribute combinations, four actual deployment costs, five real
forfeiture paths with cross-turn/zone/persona power checks, and two site-device
queries during battle. All 6,820 production reference files match the pinned
archive. See `tests/native-engine/gemp/lars-provenance.json`; its hashes bind the
executed harness and observations. The native tests additionally cover saved
continuations, cancellation, repeated loss instances, compound ordering, excluded
characters and invalid state. These extra checks are not additional GEMP evidence.

There are 135 explicit definitions. Hydroponics Station (`1_37`) and Vaporator
(`1_41`) are metadata-only for the named-card queries; their deployment, activation
replacement/protection behavior is still required. Aboard/captured contexts,
compound character identities, wider prevention and generic modifier behavior
remain incomplete. The two starter-location audit entries now distinguish the
farm's deployment text from Detention Block's drain text. Full native admission
remains closed, all broader engine/product scope is retained, and no standalone
Rules Lab study was added.

### Farm devices and Force activation responses

Hydroponics Station (`1_37`) and Vaporator (`1_41`) now have component gameplay,
replacing their earlier metadata-only status. Both deploy for 1 Force to Tatooine
sites; Hydroponics additionally requires an exterior icon. They attach to their
chosen location, record the normal deployment event, and expose no transfer or
movement action. Pending deployment binds the source and site instances and
retains paid costs if canceled or invalidated.

`runtime.activateOneForce` is the shared actual-activation primitive. Normal
Force generation and R2-D2's response both emit a `force-activated` result for
each transferred card and increment a durable per-phase count. R2 activation
does not spend the ordinary generation allowance. Moving a card onto Force by
another effect is not activation. Empty result windows settle automatically;
required or optional responses suspend the continuation. Counts and event
references survive serialization without exposing hidden card identities.

Hydroponics can draw the first activated Force during its owner's Activate
phase, and the second when a Vaporator is on the table. Declining the first
leaves the second opportunity intact. Multiple Stations do not duplicate a draw:
the activated instance must still be the Force top, and each Station can respond
only once to that event. After initiation, GEMP's effect draws the current Force
top; source departure does not cancel it. Location devices use themselves and do
not share a character's one-different-device restriction.

Six observations from two executed GEMP JUnit tests verify both actual deploy
costs and three-card activation outcomes with a Station alone, a Vaporator,
a declined first draw, and two Stations. All 6,820 reference production files
remain byte-identical. `gemp/farm-provenance.json` fingerprints the executed
harness and results. Additional native checks cover R2 integration, interrupted
source/target instances, cancellation, stale saves, private projections, and
last-Life-Force victory. These extra cases are not fresh GEMP observations.

This does not finish Vaporator: Gravel Storm protection remains unimplemented.
Generic activation/draw restrictions and replacement, Farm deployment from
Reserve, broader locations and CPU policy for these optional device choices also
remain. The full native-engine scope and production admission gate are unchanged;
no standalone Rules Lab study was added.

### Gravel Storm and named-card immunity

Gravel Storm (`1_247`) is implemented as a ground Interrupt component. It targets
an opponent's character present at one of its six named Tatooine sites, during
a normal top-level opportunity or the battle weapons segment. Its destiny goes
through the shared cost, draw, response and cleanup machinery. A successful
strict greater-than comparison uses current ability (Droids remain zero); failed
or equal destiny does not lose the target. The victim and attached cards leave
together, with owner-controlled Lost ordering and normal before/after loss
responses, including Beru's required Luke modifier.

`immuneToCardTitle` separates named-card protection from attrition immunity.
Vaporator now supplies its Gravel Storm protection to characters at its site or
an adjacent site, regardless of their owner. Its active game text is required;
range uses the current site layout. A device need not participate in a battle to
protect a character there. This closes the earlier farm-device protection gap.

The executed GEMP timing cases are significant: initial protection prevents
selection, but adding protection or moving the selected character afterward does
not undo the initiated Storm. GEMP also retains its physical target across a
controlled hand departure/re-entry, both during initiation responses and after
destiny is drawn. This implementation follows that observed card-specific
behavior. The saved selection reference validates provenance; it does not impose
a different instance-retargeting policy. A character absent from table when loss
is carried out is not lost from its new pile.

Fifteen observations across two fresh GEMP JUnit tests cover target availability,
strict/failed draws, and movement/protection/re-entry interventions. All 6,820
production reference files are unchanged; see `gemp/gravel-provenance.json`.
Native-only checks additionally cover actual Sense cancellation, battle context,
attachment ordering, Beru's trigger, modified ability and corrupt saves. The
interventions are controlled component tests, not proof of exhaustive reachable
full matches. There are now 136 explicit definitions, with full admission still
closed. Aboard/capture/vehicles, other immunity providers, broader retargeting,
site catalog and CPU strategy remain in scope. No new Rules Lab study was added.

### Computer policy 3: farm resources and desert responses

`native-cpu-3` adds optional choices for Hydroponics Station, Vaporator, R2-D2's
Scomp Link responses and Gravel Storm. It uses only its seat's player projection
and engine-offered legal choices. Station deployment avoids redundant copies;
Vaporator placement estimates extra draws, Owen's local bonus and protection for
both sides across the public site layout. Hydroponics preserves estimated Force
for characters when the hand has options, while a nearly empty hand prioritizes
drawing. Both draw responses preserve the final Life Force and cap hand growth.
R2's free activation can still be taken at one Life Force. Gravel prefers targets
with low current public ability and retains the card if Reserve is empty or only
high-ability targets are offered. Hidden destiny values are never inspected.

These are conservative strategy estimates, not new rules or an optimal resource
planner. Printed deployment costs can differ from actual costs; canceled-text
providers and further cross-card tactics still need policy work. Rules selectors
remain authoritative for every offered action, target, cost and effect.

`computer-cards.test.mjs` resolves paid deployments, activation responses, both
R2 branches and a Gravel loss through the actual engine, including save/reload
and hidden-order invariance. Two extended, shuffled 40/60-card test-only games
finish by Life Force loss and each exercises farm deployment, Hydroponics and
Gravel; R2 response coverage comes from component boards. Service tests inject a
real Station window, roll back a storage failure, recreate the service and race
eight CPU requests: one response is committed and one card drawn. Existing
receipt namespaces isolate human commands from the new policy's identifiers.
The production admission gate stays closed; these tests do not certify complete
deck or card coverage. No new Rules Lab study was added.

### Beru Stew and ordered activation

Beru Stew (`1_72`) now plays in phase windows or the battle weapons segment.
The turn player chooses which player activates first; each mandatory group then
attempts two activations through `activateOneForce`. Each unit updates the shared
phase ledger and completes its responses before the next unit. Empty response
windows settle automatically. These activations do not spend the ordinary Force
generation allowance. Once both groups finish, Light can choose additional
activation based on the current Beru, Owen and Station cards on table. The choice
is capped by remaining Reserve; the chosen sequence survives serialization.

The unique Interrupt consumes its per-turn play allowance even when canceled.
Successful Sense cancels it before results. Once results begin, the Interrupt
itself is no longer open to cancellation; individual activation responses remain.
Hydroponics and Vaporator use the existing activation ledger. Drawing the last
Life Force through a Station ends the game immediately, including mid-sequence.

Official AR pp14–15,39,54,104,138 establish the ordering, activation, timing and
erratum. The pinned GEMP differs in two observed ways: it suppresses Stew if
either Reserve is empty, and shortcuts both-player ordering without a prompt.
Native follows the official turn-player choice and the explicit erratum that
activation is a result, not an initiation condition. Ten executed component
outcomes match GEMP when Light activates first, including a contributor leaving
before the extra amount is chosen; three eligibility discrepancies are retained
as evidence. See `gemp/stew-provenance.json`. All 6,820 reference production files
remain unchanged. Native-only tests cover the alternate order, actual Sense,
endgame, corruption and CPU choices; there is no new Rules Lab study.

`native-cpu-4` adds conservative Stew play, ordering and optional-amount choices
using only the seat projection. It preserves one Reserve card when choosing
extra activation and avoids building Force beyond its resource target.

There are 137 explicit definitions; full admission remains closed. Generic
activation prevention/replacement, doubling, other Beru/Owen identities and
aboard/inactive states remain required. GEMP also snapshots the base amounts from
both Reserve sizes when results start, while native attempts each mandatory unit
until Reserve empties; mid-sequence replenishment still needs reference coverage.
These component tests do not certify the whole card or a complete deck.

### Finalized battle destiny and Takeel

Battles retain finalized selected draws separately from their resolved totals.
Takeel requires exactly one successful draw for each player: canceled draws and
unchosen candidates do not count, replacement draws occupy the original slot,
and substitutions and successful zeroes do count. Its swap carries individual
draw modifiers while keeping resolved total adjustments with their owner. A
second Takeel keeps the switch in effect, matching GEMP, and still pays its cost.
Physical destiny cards remain with their owners.

`takeel.test.mjs` and the Gambler's Luck integration tests reconstruct saved state
at each command, including selection, cancellation, limited/exhausted draws,
modifier ownership and repeat play. Older saves use their existing single-draw
or planned-draw history when the finalized record is absent. The executed GEMP
component comparisons and source fingerprints are in `gemp/takeel-provenance.json`.
This does not certify other modifier-granting cards, dynamic total resets or
complete decks. Full native admission remains closed; no new Lab study was added.

### Retrieval forms and suspended selections

The shared retrieval mechanism supports choosing an amount from 1 through X,
random retrieval, and optional per-card retrieval into hand. The amount is chosen
before modifiers and Secret Plans; it is not limited by the number of matching
Lost cards. Random retrieval shuffles the remaining Lost Pile before each card,
then persists the selected card through responses. An allowed hand destination
is chosen after payment for each card; fixed hand retrieval needs no extra choice.
All forms retain public retrieval events and stop appropriately on cancellation.

Selected-card handling follows executed GEMP behavior: a departed card is
skipped without spending a retrieval unit, a returned physical card remains the
selection, and a newly inserted top card does not replace it. This is specific
to retrieval, not a universal targeting rule. Existing saves omit the new optional
fields and continue through their original paths. Decision and continuation
validation rejects unknown handlers, wrong actors, missing selections and
inconsistent amount/destination modes.

`retrieval-forms.test.mjs` exercises save reconstruction, nested retrieval,
Secret Plans, entropy rollback, privacy and invalid commands. Twelve executed
GEMP comparisons cover ten deterministic card/order outcomes and two random
quantity/response invariants; independent RNG orders are not compared. See
`gemp/retrieval-forms-provenance.json`. These are shared primitives, not admission
of additional granting cards or complete decks. Compound-card counting,
fractional quantities, wider prevention/replacement and granting-card integration
remain required. No new Rules Lab study was added.

### On The Edge card integration

On The Edge now targets a current ground Rebel with ability greater than two,
asks its player to choose 1–6 before using one Force, and opens normal Interrupt
responses. General destiny timing determines whether it succeeds (strictly
higher) or loses the Rebel (including equal, canceled and failed draws). Success
allows retrieval to be declined. Accepted retrieval uses the shared quantity,
Fenson reduction, Secret Plans payment and per-card response machinery. The
Interrupt remains in play until all its effects and loss responses finish.

Executed GEMP retains the originally selected physical Rebel through response
changes, including departure, return and ability reduction. Native follows this
card-specific behavior: it still draws and can retrieve, while a failed result
only loses the target if currently on table. Attached cards leave with it and
the owner orders Lost before character-loss responses, including Kintan Strider.
Number/retrieval choices and all continuations survive JSON reconstruction;
invalid commands, corrupted bindings and repeat payment are rejected.

Evidence is in `on-the-edge.test.mjs` and `gemp/edge-provenance.json`. GEMP plays
the actual card on controlled boards; response removals and destiny values are
fixture interventions. Native tests additionally cover actual Sense, canceled
destiny, attachments, Kintan and concession. Broader retrieval-contributor
restrictions, retargeting, aboard/captured/inactive targets and CPU strategy
remain required. This does not admit a complete card/deck or add a Lab study.

### Off The Edge and retrieval contributors

Off The Edge targets your active ground character at a Cloud City site and draws
through the normal destiny pipeline. A higher destiny retrieves the difference;
a lower one opens the ordinary, reducible Force-loss sequence; equality or a
failed/canceled draw loses the character with attachment ordering and loss
responses. Its unique-card turn limit, cancellation, endgame and saved choices
use the existing engine paths. The Chasm Walkway definition and setup metadata
identify a real Cloud City site for this integration; its Weather Vane text is
not implemented and its metadata does not admit the site to full native games.

R2-D2's 2-or-5 printed target value is chosen after the draw (even a failed draw),
independently of any prior or later destiny draw. A shared current-character
statistic query applies live additive/reset destiny modifiers; target labels and
value choices show the current number. This table statistic is distinct from
modifiers to a just-drawn destiny. Fractional differences now use the shared
whole-Force implementation documented below; their greater/less comparison
retains the original value.

The shared retrieval entry point now checks its source and explicit additional
contributors before emitting initiation. Rule-owned instance restrictions can
last for the turn or while their source remains on table. Later restrictions do
not undo a retrieval already initiated. Off The Edge supplies its target as a
contributor. On The Edge checks the target before offering its optional retrieval,
then the shared entry point checks the source if retrieval is accepted. Source
card cleanup continues even when retrieval cannot begin.

`off-the-edge.test.mjs` reconstructs state after every command and checks both
result paths and interactions. `gemp/off-edge-provenance.json` records actual
card plays, including R2, Secret Plans, Fenson, target value changes and retrieval
restrictions. Direct target/modifier interventions are controlled fixtures;
continuous granting-card selectors, retargeting, aboard/captured/inactive states,
remaining fractional battle/activation handling, Weather Vane and broader CPU strategy remain required. Full
production admission stays closed; no standalone Lab study was added.


### Fractional Force and indivisible card movements

`force-quantity.ts` applies nearest-whole rounding only at a whole-card boundary.
The authority is AR p30 (Rounding) and pp138–139 (Brainiac): destiny comparisons
and attrition retain their values, but a Force effect cannot move part of a card.
The explicit Obsession example retrieves and loses zero for a 0.14159 difference,
without changing the winner or preventing character loss. Applying this rule to
fractional use-Force payments and other retrieval forms is the general
indivisibility interpretation, rather than an additional card-specific ruling.

Ordinary/specific/random/hand retrieval accepts a finite fractional initial
quantity. Applicable modifiers are combined before rounding once, after
initiation responses and before first-card selection or Secret Plans. The frozen
quantity, retrieved-card count and remaining count stay integers thereafter.
Fractional modifiers and lowest-value resets are supported. Up-to choices remain
whole integers no greater than the declared maximum; ranges with no positive
integer remain guarded. Zero final retrieval produces no Secret Plans payment.

Non-battle Force loss preserves the raw base and modifiers in its ledger, rounds
the full modified obligation, then subtracts the cards already lost. Explicit
We're Doomed rounding takes precedence. Force payments convert each player's
cost independently before affordability and retain the existing opponent-first,
one-card-at-a-time response sequence. Saved continuations bind the rounded cost
to the parent's raw amount. Existing integer saves use the same representation.
Off The Edge now compares unrounded destinies, then retrieves/loses the rounded
Force amount. A sub-half difference does not become the equal-destiny branch.
Battle damage and attrition remain numeric obligations; fractional forfeit ledger
values are accepted without globally rounding those totals.

`gemp/fractional-force-provenance.json` records 30 executed outcomes from two
JUnit tests against unchanged pinned production sources: ordinary retrieval,
Force loss, UseForce, Secret Plans, and real Off The Edge with controlled target
modifiers. GEMP rounds all these positive fractional obligations up. Fourteen
whole-card outcomes agree; sixteen explicitly differ under the official nearest-
whole rule. Tests retain the reference observations separately and assert the
native rules outcomes, so disagreement is not presented as GEMP conformance.
Specific/random/hand forms, fractional modifier ordering, corrupt snapshots,
rounded-zero endgame, affordability and joint costs have additional native tests.

Mixed fractional battle-damage/forfeiture payment, fractional activation,
compound-card counting, wider prevention/replacement and granting-card coverage
remain required. This is shared engine work, with no new standalone Lab study.
Full native admission stays closed; the complete catalog, vehicles/pilots/
passengers/space, Objectives/setup, 40/60/custom/sealed, CPU/PvP, persistence,
clocks/capacity and responsive gameplay remain in scope.

### Activation batches and fractional battle payments

`runtime.activateForce` now queues a durable card-effect activation batch. It
rounds a finite requested amount once at the whole-card boundary, then moves one
current Reserve top at a time through the existing activation event/history
path. Responses complete between cards. Empty Reserve or a newly applicable
prohibition stops the remaining batch without claiming additional activations;
source departure alone does not undo an initiated result. Nested batches keep
independent counts. Text activation does not consume normal generation.

Normal generation is different: the full numeric value stays frozen in the turn
record and survives projection/recovery, but the legal activation count cannot
exceed its floor. This implements an "up to" bound without changing the numeric
statistic. A 1.5 generation value permits one ordinary activation, while a
mandatory "activate 1.5 Force" result activates two whole cards under the general
rounding rule. GEMP's production generation limit query matches the former;
its activation-effect constructor only accepts integers, so the latter is an
explicit native rulebook adjudication, not a fractional GEMP argument test.

`activation.preventActivation` registers side-specific, rule-owned restrictions
for the current turn or a source's original table instance. Every actual unit
rechecks them. Turn restrictions survive source departure; source restrictions
expire when that instance leaves; a later turn releases turn restrictions.
Normal activation and R2's optional activation branch are suppressed when
prohibited; a late prohibition prevents the already initiated R2 result.
R2's draw branch is unaffected. Granting-card selectors and insert-card reveal
semantics remain separate work.

Beru Stew now uses shared batches for both mandatory groups and its chosen bonus,
while preserving turn-player ordering, current bonus calculation, source cleanup,
per-unit Hydroponics responses and unique play limits. A prohibited player is
skipped without suppressing the other player's result or making Stew unplayable.
Old `stew:activate` saves with a partially completed group still resume correctly.
The regression fixture now observes actual activation events rather than tying
its trace to the former card-specific one-unit resolver.

Battle damage must not use the rounding policy of "lose X Force" effects.
AR pp56–57 defines pending battle damage as any positive remainder and permits a
one-Force loss action to satisfy one point. Thus 0.14 damage still requires a
payment, and a fractional forfeit reduces damage and attrition by its exact
value. The existing numeric ledger and battle actions now have executed coverage
for these cases, including mixed forfeiture/card losses and no premature pass.
Attrition remains unrounded and cannot be paid by losing Life Force.

`gemp/activation-battle-provenance.json` records 25 matching observations from
three JUnit tests: twelve real battles, eight activation sequences and five
normal-generation limit queries. Battle observations read the production float
values directly; the test framework's integer damage convenience accessor would
hide fractional remainders. All 6,820 production reference files remain unchanged.
Native tests additionally verify fractional mandatory amounts, nested batches,
legacy recovery, private projections, concession, corrupted snapshots and actual
Stew/R2 integration. Direct modifier/reorder interventions are fixture controls,
not certification of their granting cards.

This checkpoint adds no standalone study and does not open full-match admission.
Compound counting, activation replacement/prevention beyond prohibitions, insert
cards, generation modifier providers and the complete engine/product scope remain
required, including broader catalog, ships/vehicles/pilots/passengers, special
setup, deck formats, CPU/PvP, clocks/capacity and responsive match UX.

### Physical Reserve inserts

`reserve-inserts.ts` keeps inserts on table with an owner-preserving card-instance
reference and a private position among ordinary Reserve cards. The pile arrays
continue to contain only ordinary cards belonging to that player. This follows
AR pp167–168: inserts are not part of the opponent's Reserve Deck, cannot supply
Life Force, and cannot become a destiny, activation, or Force payment.

`state.insertCard` is a rule-owned physical primitive. It requires at least two
ordinary Reserve cards, validates and shuffles on a private copy before committing
movement, and preserves existing mutable frame references. All subsequent
Reserve shuffles include the inserts. The conditional uniform shuffle chooses an
ordinary first card and shuffles the rest, producing the same allowed distribution
as repeated complete shuffles while avoiding an endless deterministic test loop.
All four possible orders of two ordinary cards and one insert are tested.

Ordinary removal and top/bottom additions maintain insert positions; recirculation
keeps Used order. An exposed insert blocks ordinary Reserve removal until its
provider handles it. `revealInsert` marks just the first exposed insert, permits
public inspection, and preserves adjacent-insert order. Moving the inserted card
off table removes its registration and expires its table instance. These are
physical primitives, not automatic reveal scheduling or card-effect handlers.
Providers must yield at exposure; a multi-card loop cannot silently move past it.

Public projections conceal positions, relative insert order, unrevealed opponent
identities, Reserve counts, and the derived Life Force total. Counts are `null`
until counting is legal again; the match UI renders `?` with an explanation.
Own inserts and inserts in their owner's own Reserve are visible by identity,
without exposing position. CPU draw/low-Life-Force heuristics handle an unknown
Life Force total explicitly; broader insert activation planning remains required.
Legacy snapshots with no registry retain their existing numeric projections.

The receipt `gemp/reserve-inserts-provenance.json` records eight observations from
two executed JUnit tests with 6,820 unchanged production source files. Placement
uses real Tremor/Disturbance deployments; removal deliberately sets the revealed
flag before production `LoseInsertCardEffect`. It establishes physical placement,
shuffle and removal invariants, not native card-specific conformance. Native
fixtures deliberately grant physical insertion to controlled cards and do not
change those cards' actual game text or the production admission gate.

Next integration work includes card-specific deployment and once-per-game rules,
automatic topmost reveal scheduling, response/cancellation windows, activation
amount declarations, and peek replacement. Shuffling while a revealed insert is
pending, or with no ordinary cards remaining, is explicitly guarded until timing
is established. No new standalone Rules Lab scenario or full-match admission is
added. The entire engine/product scope remains required.

### Insert reveal timing and activation declarations

Tremor (`1_42`) and Disturbance (`1_208`) now have component implementations:
owned Deploy-phase insertion, the two-ordinary-card target requirement, global
per-title once-per-game use at initiation, uniqueness through the common play
registry, unconditional Alter immunity, actual insertion/shuffle/deployment
results, and the printed reveal/loss/activation-prohibition sequence. A target
that becomes too short during responses fails deployment without restoring the
spent allowance. Their metadata is explicit; production `supports` remains false.

The shared runtime's optional `interrupt` hook lets the rules package put a newly
exposed insert above suspended gameplay before the next continuation settles.
Adjacent inserts follow physical order. Simultaneous exposure in both Reserves
lets the turn player order the results. An insert exposed inside another result
can interrupt that result. Each revealed insert has a durable response window;
its original card-instance reference prevents departure/return from reviving a
stale result. Cancellation retires the insert and suppresses its restriction.
The two cards are lost first, then apply their turn-long restriction after loss
responses. A completed match remains frozen, including pending insert work.

When an opposing insert is present, ordinary activation requires a declared
amount. A serialized declaration holds its count and remainder, yields normal
phase-action opportunities between units, and prevents extending the declared
amount while an opposing insert remains. If all opposing inserts are revealed
and canceled during that activation, ordinary activation can continue up to the
frozen generation limit. Prohibitions and empty Reserve stop the remaining units.
The CPU selects declarations from its private projected legal choices; it does
not obtain hidden Reserve counts. The match UI displays declared/activated/
remaining values and lets both players inspect revealed inserts across refresh.

Variable card activation batches can similarly offer additional activation when
all opposing inserts disappear during the declared batch. Beru Stew passes its
text-derived maximum into that continuation. While any insert prevents counting
Reserve, its bonus prompt does not expose the true short Reserve size by capping
its choices to that size. Normal and card-text activation retain separate counts.

`gemp/insert-timing-provenance.json` records ten executed observations: actual
Tremor/Disturbance effects interrupt three-card activations at depths one/two;
controlled production cancellation lets them finish; and both title limits
persist after return to hand and a later turn. Both test harnesses are hashed;
6,820 production files remain unchanged. Native tests also exercise normal and
variable declarations, additional activation, adjacent/simultaneous ordering,
concession, corrupt snapshots, private Stew bounds and responsive service/browser
recovery. Controlled cancellation does not certify its granting cards, and these
observations are not a complete GEMP normal-generation declaration trace.

Remaining insert work includes cancellation-granting cards, destiny-drawing
responses while a revealed insert remains pending, peek replacement, broader
insert text, and conversion of multi-card movement providers to yield at exposure.
The physical guard still rejects ordinary Reserve removal past a pending insert;
these cross-card interactions must be adjudicated before admitting full decks.
The whole engine/product scope remains required; no standalone Lab study was added.

### Noble Sacrifice and out-of-play costs

Noble Sacrifice (`1_99`) now responds to actual opponent character deployments
and offers own table characters with equal current power. The selected forfeit
and retrieval-contributor eligibility are frozen during initiation. A serialized
out-of-play cost opens its own before/after responses and orders dependent card
losses before Sense can answer the Interrupt. Canceling the Interrupt never
returns the sacrificed character. A redirected cost fails the Interrupt under
AR Appendix B; a later departure of the opposing deployed character does not
undo a paid sacrifice. Retrieval remains optional and uses the shared modifier,
Secret Plans and ordered Lost-to-Used pipeline.

Both players can inspect out-of-play cards in the match UI. Existing persona
rules prevent replaying a unique character after its sacrifice. `native-cpu-5`
accepts optional retrieval and considers sacrificing a small exposed unit only
in a Life Force emergency, using public information.

Nine executed GEMP observations and their exact fixture limits are recorded in
`tests/native-engine/gemp/noble-sacrifice-provenance.json`. This is component
coverage: captured/aboard characters, escort releases, broader prevention and
replacement cards, and full card/deck certification remain incomplete. No new
Rules Lab study or production deck admission is introduced.

### Labria: public Reserve reveal and pile return

`labria.ts` implements Premiere Labria (`1_184`) during its owner's Control
phase: once per table instance per turn, reveal the top ordinary Reserve card to
both players; a vehicle or starship is lost, otherwise choose the top of Reserve,
Force or Used. A required opponent acknowledgment makes the public reveal
reviewable through network polling and refresh. This acknowledgment adds no
rules-action window. Placing a card on Force is not activation. Placement/loss
responses precede the reveal-completed response, matching the executed reference.
An initiated result survives source departure, while cancellation still consumes
that instance's use. The source returning to table creates a new instance.

`pile-reveal.ts` distinguishes a public reveal from a private peek. Revealed
cards remain in their original pile, and manipulation history invalidates the
reveal when a card moves (including replacement in the same pile), its pile is
shuffled, or a peek returns it. A stale reveal never moves or loses a replacement
card. Insert deployment propagates shuffle invalidation from its staged state.
Returning Labria's card to Reserve preserves the insert underneath; moving it to
Force/Used exposes that insert before the suspended result continues. Saved
source/reveal references, usage and acknowledgment ownership are validated.

Both `/matches` seats can inspect the revealed card. `native-cpu-6` conservatively
uses Labria only above four Life Force when short of usable Force, and routes the
revealed card to Force. It reads only the ordinary player projection. This is a
heuristic, not hidden-deck inference or a complete strategic opponent.

`tests/native-engine/gemp/labria-provenance.json` records nine actual GEMP
observations (one JUnit test), with all 6820 production source files unchanged.
These cover the three destinations, vehicle/starship loss, source departure,
short Reserve and adjacent inserts. Board, top-card, source-departure and insert
positions are controlled fixtures. Native tests separately cover manipulation,
forged snapshots, canceled usage, source return, CPU decisions and concession.
The real-service browser suite verifies both-seat recovery, acknowledgment,
inspection and Force placement at 1440, 834 and 390 pixels.

Sandcrawler (`1_309`) is explicitly defined only as a metadata/loss target; neither
it nor TIE Fighter gains vehicle/space gameplay admission. Captured/aboard Labria,
other public-reveal providers, broader prevention/replacement and the full engine
remain required work. Production full-match admission stays closed; no new
standalone Rules Lab scenario is introduced.

### Planet locations, Sunsdown and power destiny

The location model now distinguishes Tatooine's planet-system versions (`1_127`
and `1_289`) from ground sites. Systems supply their printed Force icons, deploy
at the exterior end of the related group, convert opposing versions, and may be
ordinary starting-location candidates in explicitly admitted component tests.
They do not create ground adjacency or accept character deployment. Conversion
moves location-attached cards to the active version; the UI displays the parsec,
icons and attached Effects together.

Sunsdown (`1_230`) deploys on an active planet through the normal Effect response
pipeline, including Alter. Its live text derives nighttime at related sites,
including sites deployed later, and supplies free spy deployment at nighttime
sites. Source departure or text cancellation removes these modifiers immediately;
no derived condition is saved as a permanent flag. Duplicate copies do not stack.
The existing Talz power and Macroscan peek rules now consume this actual producer.

During a related ground battle, the initiator counts and draws the mandatory
power destiny first; the opponent counts after that sequence finishes. These
use the shared cost, before-draw, reveal, cancellation/redraw, completion, Used
placement and total-response pipeline. Battle destiny follows. Separate saved
power-destiny records contribute only to total power, never attrition or Takeel's
battle-destiny exchange. Empty Reserve and canceled draws contribute no value.
Both players' public loss panels distinguish power destiny from battle destiny
through battle completion, including recovery from a saved draw window.

`tests/native-engine/gemp/sunsdown-provenance.json` records six executed GEMP
observations with all 6820 production files unchanged: actual deployment and
battle, duplicate Effects, source departure, free spy deployment, conversion,
and empty Reserve. Native comparisons check destiny ordering, power and attrition
against those recorded results. Additional native tests cover actual Alter,
new-site nighttime, saved-state rejection, cancellation/redraw and setup layout.
Playwright verifies attachment inspection, nighttime/system labels and recovery
with the real match service at desktop, tablet and phone widths.

This is component coverage, not full planet/space certification. Vessel and
Tatooine ship-control coverage is detailed in the following checkpoint; other
power-destiny granting/preventing cards and complete CPU card strategy remain
unfinished. The CPU uses printed system icons where relevant;
its ground-adjacency estimate stays site-only. Full production match admission
remains closed, and no standalone Rules Lab study has been added.

### Vessel occupancy and first space combat

Y-wing (`1_147`), TIE Scout (`1_305`) and both Sandcrawlers (`1_150`,
`1_309`) now have explicit printed pilot/driver/passenger capacities. Actual
Deploy actions pay Force, retain target-instance bindings through responses and
emit deployment events. Crew may deploy directly aboard, change capacity during
their Deploy/Move phases, and freely embark/disembark at sites during Move.
Capacity choices and previous roles survive serialization and are validated.
Permanent personnel do not consume additional capacity. Enclosed occupants
supply presence/ordinary ability, but neither personal battle power nor a target
for the currently implemented character weapons; only pilots/drivers supply
battle-destiny ability. Landed ships retain permanent-pilot presence while their
power and battle-destiny ability are zero. Drivers do not apply pilot bonuses.

Space battles use the existing response, destiny, attrition, damage and ending
pipeline. Carrier forfeiture credits only the carrier; its crew and attached
cards leave simultaneously and are ordered into Lost. Returning a carrier to
hand also loses occupants. Tatooine's ship-control modifier now adds ground
battle power from controlled orbit. The UI groups crew under their vessel with
role, operational/landed status, permanent ability and printed capacity. CPU
preferences deploy pilots/drivers and avoid unlimited embark/disembark loops;
route planning remains unfinished.

`tests/native-engine/gemp/vessels-provenance.json` records eight matching
observations from two executed GEMP tests, with all 6820 production files
unchanged: actual ship/vehicle/crew deployments and a space battle through
carrier forfeiture. Opposing ship/crew placement and destiny tops are controlled
reference fixtures. Native comparisons deploy both sides and also check recovery,
capacity rejection, stale targets, CPU choices and battle completion. Playwright
uses the real service to reassign crew, resolve responses, refresh and inspect
cards at 1440/834/390 widths.

This remains component coverage. Landspeed, hyperspace, takeoff/landing,
simultaneous pilot deployment, open transports, passengers' card-specific text,
additional ships/vehicles, capture, broad response/prevention providers and the
full native product scope remain required. Production admission stays closed.
No new standalone study has been added.

### Regular vessel travel

Sandcrawlers now traverse up to their printed landspeed through adjacent exterior
planet sites for one Force. Each intermediate arrival emits a movement response
with initial/completed flags; the saved route resumes after those responses and
stops if the driver or permission disappears. The one-regular-move limit belongs
to the carrier, not its occupants. Existing docking-bay party transit also accepts
driven vehicles with legal destination sites and transports their crew.

Y-wing and TIE Scout now use hyperspace between registered systems within printed
range, requiring their nav computer and pilot. Starfighter landing/takeoff uses
related exterior sites; docking bays are free, other sites cost one Force, and
TIE landing requires a docking bay. These actions share regular-move history,
payment and response handling. Pending routes bind the vessel and locations to
their original table instances. Yavin 4's two printed faces now supply system
metadata and the same controlled-orbit ground-power provider as Tatooine; orbital
support selects the related system when several planets coexist.

A public journey panel shows source, destination, current location and completed
legs. Real-service Playwright checks initiate a two-site journey, refresh during
the intermediate response, finish the route and preserve crew at 1440/834/390.
The CPU can take off and select safer or more valuable destinations without
cycling equally valuable routes; coordinated landing/crew delivery remains.

`tests/native-engine/gemp/vessel-travel-provenance.json` records ten executed
GEMP observations (two JUnit tests, 6820 unchanged production files). Native replay
matches costs, intermediate arrival flags, carried crew, movement usage and power
for hyperspace, free bay landing/takeoff, paid exterior landing/takeoff, one/two
landspeed steps, an unpiloted transport, and both starfighters' deployment
destinations (docking bays and systems, excluding ordinary exterior sites). The receipt documents controlled
fixtures and opposite printed Tatooine faces used for the same route endpoint.

This does not finish movement or the full engine. Sector/mobile-system movement,
shuttling, open transports, simultaneous pilot deployment, astromech-dependent
ships, general speed/cost/restriction modifiers, movement-react and cancellation
providers, capture and remaining card/product coverage stay in scope. Full-match
admission remains closed; no new Rules Lab study was added.

### Capital ships, shuttling and nested cargo

Corellian Corvette and Imperial-Class Star Destroyer now have printed pilot,
passenger and cargo capacities. They deploy to systems and use hyperspace, with
no site deployment or landing. Characters and vehicles shuttle between related
exterior planet sites and their owner's capital ships for one Force and their
regular move. A carried vehicle retains its crew and equipment, without spending
those occupants' regular movement. Unpiloted vehicles may shuttle or use docking
bay transit (correcting the previous transit pilot requirement).

TIE Scout can deploy into the Star Destroyer's TIE capacity, embark from its
system or launch there with a pilot. Embark/launch and character transfers between
the outer bridge and an inner vessel are unlimited and free. Inner crew consume
only inner capacity; moving them onto the bridge changes their system ability
contribution. Cargo is landed and has no operational power. A carried vehicle may
participate and forfeit, but its inner characters do not join the outer battle.
Carrier loss recursively loses cargo, crew and equipment with saved Lost ordering.
Pending actions bind original instances, roles and locations across responses.

The responsive table nests cargo and its crew for inspection. Playwright tests
execute shuttling through the real service, refresh pending responses and inspect
nested crew at 1440/834/390. The CPU launches carried fighters without immediately
embarking them again; coordinated cargo delivery strategy remains unfinished.

`tests/native-engine/gemp/shuttle-provenance.json` records nine actual-action
observations from one passing GEMP JUnit test, with 6820 production files unchanged.
Native replay matches costs, movement use, cargo/crew relationships, operational
power and ordinary system ability. **One explicit disagreement remains:** GEMP
counts Labria inside a carried Sandcrawler as a participant at the weapons segment;
native follows AR p90's passenger exception for characters inside cargo. The replay
asserts this divergence separately rather than describing it as parity.

Ship-to-ship docking transfers, shuttle vehicles, sectors, simultaneous pilots,
other cargo capacities and aboard-card text, broader movement modifiers/prevention,
capture and the rest of the full engine/product remain. Production full-match
admission is still closed. No new standalone Rules Lab study was added.

### Ship-to-ship docking

Two own registered starships at the same system can dock during Move for one
Force when at least one is piloted and one has docking capability (all capital
ships do by rule). Docking is unlimited and neither ship spends its regular move.
The paid session allows any number of direct crew and cargo transfers in either
direction, including none, then undocking. Crew may change pilot/passenger slots
to free capacity; choices recheck printed capacity after each operation. Inner
cargo crew stay with their carrier and cannot transfer directly to the other ship.

Transfers preserve nested attachments and expose their own response results,
without treating transferred cards as moving. Ship movement prohibitions prevent
initial docking; a carried character's movement prohibition does not prevent its
transfer. Pending sessions bind both ships and their system to original instances;
departure closes the session instead of following a returned replacement. Recovery
validates session identity and transfer counts. The table identifies both ship
instances and shows the completed transfer count until undocking. Playwright
executes multiple transfers with refresh at 1440/834/390 through the real service.

Six executed GEMP paths in `tests/native-engine/gemp/docking-provenance.json`
match native cost, crew role, cargo relationships, pilot power bonuses and regular
movement history: no transfer, crew, vehicle, fighter, multiple transfers, and a
crew round trip. One JUnit test passes against 6820 unchanged production files.
Native tests additionally cover capacity, stale references, ship loss, restricted
movement, an unpiloted partner, and CPU ending without a transfer loop.

Sector docking, special docking-site permissions, non-capital docking-capability
providers, generic cost/prevention modifiers and coordinated CPU cargo strategy
remain. The remaining full engine/product scope and admission gate are unchanged.

### Simultaneous ship and pilot deployment

Gold 1 and Black 3 supply unpiloted starfighter component coverage. During Deploy,
players can select a ship and a pilot from hand as one action, paying their
combined deployment costs. Both remain in the pending action across recovery;
they enter table together with the character occupying a pilot slot before any
arrival response. Deployments produce two history records and a shared arrival
opportunity. The match client identifies both cards and their destination.

Unpiloted starfighters can deploy empty to docking bays or compatible cargo, but
require a simultaneously deployed pilot to enter a system. Paired bay/cargo
arrivals remain landed and have zero power. Gold 1 has shared pilot/passenger
capacity; Black 3 has one pilot seat, no hyperdrive and TIE landing restrictions.
Normal deployment restrictions, uniqueness and available Force apply to both
cards. Source/destination instance checks reject invalid continuations; failed
paired deployment retains both play allowances and orders both cards into Lost.

Barrier can target a newly deployed starship as well as a character. Either
member of a simultaneous ship/pilot pair offers the same effect on both valid
targets. A barred ship also keeps its aboard crew out of battle, without assigning
the crew an independent movement prohibition. CPU policy 11 prefers an offered
operational paired deployment to a system over parking that pair in a bay/cargo.
It remains a heuristic using only the player's projection.

`pilot-deploy-provenance.json` records seven executed GEMP paths, one passing
JUnit test and byte comparison of all 6,820 production source files with the
pinned reference. Costs, landing/cargo relationships, pilot roles, power, paired
arrival records and Barrier restrictions agree. Native-only tests cover stale
bindings, failed action disposal, crew battle exclusion and CPU choice. Playwright
exercises a real service deployment, pending refresh and crew inspection at
1440/834/390 widths. Component fixtures explicitly bypass full-match admission.

Still required: deploying a paired card from another pile, reactive/special-text
pairings, wider matching-pilot bonuses and nonparticipating pilot contributions,
open vehicles, sectors, broader capacity/cost/prevention providers and all
remaining catalog, capture, Objectives/setup and product work. This checkpoint
does not open production full-match admission or create another standalone study.

### Pilot participation and matching ships

Dutch and DS-61-3 now provide their printed piloting power bonuses, matching
Gold 1/Black 3 maneuver bonus and fallback battle destiny. Fallback entitlement
uses the existing draw policy and never adds a second destiny merely because
ordinary ability already supplies one. Dutch also grants forfeit to other Gold
Squadron pilots at his location, including a character whose squadron comes from
piloting a Gold Squadron ship; this modifier does not require Dutch to pilot.

Pilot seats and pilot functions are distinct. Excluded crew keep their capacity
slots, but once battle begins they cannot operate a ship or supply piloting text.
The last active pilot's exclusion makes an otherwise unpiloted ship power and
maneuver zero. A permanent pilot still operates independently of an excluded
additional pilot. During pending battle initiation, before automatic exclusion,
the pilot's ordinary ship contributions remain; after battle ends they resume.
Landed pilots function as passengers and cannot supply matching-ship bonuses.
A permanent pilot icon persists when game text is canceled, even when its
text-provided ability becomes zero. Docking and takeoff use that distinction.

The vessel panel shows current power and maneuver, preserves permanent pilot
identity with zero ability, and identifies crew not participating in the battle.
These values are derived by the engine and survive service recovery. Native
checks cover actual fallback draws, pilot departure, capacity preservation,
reactivation, excluded Dutch, and an actually unpiloted docking partner.

`crew-provenance.json` records ten executed GEMP paths and an unchanged 6,820-file
production source comparison. Characters deploy, Barrier is played, and battles
begin through real reference actions. Starting ships/locations/Force are fixture
state. Two cancellation observations use a controlled production cancellation
modifier. Values are sampled both during initiation and at the weapons menu;
the earlier initiation snapshot must not be mistaken for settled exclusion.

Remaining work includes other matching-pilot abilities, generic vessel stat
modifiers, inactive/captured states beyond current battle exclusion, open
vehicles, sectors and wider transport. Full catalog/timing, capture, Objectives,
setup/deck formats, opponents/capacity and complete product delivery remain in
scope. Production full-match admission is still closed.

### Open vehicles, exposed crew and movement costs

Luke's X-34 (`1_149`), the SoroSuub V-35 (`1_151`) and Ubrikkian
9000 Z001 (`1_310`) now have explicit printed capacity records. Only the X-34
is open: the other two have GEMP's Enclosed characteristic. Open occupants
contribute personal power and battle-destiny ability, can fire character weapons,
and can be targeted by those weapons. An open vehicle inside another vessel's
cargo hold does not expose its crew at the outer location. The match screen
shows this distinction alongside the crew roles and current vehicle values.

Ordinary character landspeed movement requires disembarking first. Vehicle
travel carries attached crew and weapons without consuming the crew's regular
move. Loss of the driver at an intermediate site stops further landspeed
travel. The passengers can still provide presence; open passengers retain their
personal power. Unpiloted vehicles retain the official docking-transit exception.

The X-34 moves free with Luke aboard. The V-35 moves free with Luke, Premiere
Owen or Beru aboard. Their text applies to landspeed and docking-bay transit;
a mixed party pays the highest applicable cost, and a wholly free party can
start transit with zero Force. This movement text is suspended when unpiloted,
and canceled vehicle text removes the discount without changing crew identity.

The four existing Blaster/Blaster Rifle definitions can now target exposed
vehicles as their printed text permits. Defense uses current maneuver or printed
armor; unpiloted maneuver is zero and existing armor becomes two. Missing armor
is not invented. A destiny equal to defense misses. Forfeiting a vehicle loses
its attached crew, but their forfeit values do not also pay battle obligations.
Forfeiting a passenger leaves the vehicle and other occupants in place.

Evidence: `tests/native-engine/gemp/open-vehicles-provenance.json`, the Java
harness and its recorded results. Two JUnit tests execute fifteen observations
against pinned, unmodified GEMP production code: thirteen complete native action
replays agree, while the two controlled cancellation cases compare projected
costs from equivalent trusted canceled-text state only. They do not establish a
native cancellation-card provider. Native replay restores JSON at each command.
The reference uses actual vehicle/crew deployment, movement, battle, firing and
forfeiture with controlled locations, opposing units, attached weapons and
destiny cards. The 6,820 production reference files remain byte-identical to the
pinned source archive.

Native-only checks additionally cover Ubrikkian deployment/capacity, crew inside
cargo, loss of a driver en route, zero-Force party selection and stale movement
boundaries. Playwright uses the real native service to initiate a battle, fire
an open passenger's blaster, refresh while the shot is pending, and inspect
crew at 1440/834/390 widths.

**Remaining at the open-vehicle checkpoint (movement reactions are extended below):** moving/deploying vehicles as reacts, optional crew boarding
and disembarking around a react, cancellation and turn history; broader aboard
interactions with movement cards (including Run Luke and move-away effects);
general vessel stat modifiers, creature/combat/shuttle vehicles, sectors,
capture and the remaining catalog/timing/product scope. These cards are component
coverage only. Full native admission stays closed. No new standalone study was
created; this work extends the full engine and match UI.

### Vehicle movement reactions

`vehicle-react.ts` executes printed landspeed reactions for Luke's X-34, SoroSuub V-35 and Ubrikkian 9000. It answers the opponent's battle/drain initiation, pays movement cost before optional crew embarkation, then offers the regular movement's cancellation window. Intermediate sites carry all attachments; eligible crew may disembark only after final arrival. Crew choices, movement references and per-turn restrictions survive serialized recovery. Successful Sense preserves completed boarding and spent Force, leaves the vehicle at origin, and closes the remaining movement/crew sequence. Cards merely carried aboard do not spend their own regular move or react allowance.

`vehicle-react.test.mjs` covers costs, both players, multi-crew capacities, ordinary movement after the turn changes, battle entry, interrupted journeys, persistent drain cancellation and original-card identity. Seven complete recorded GEMP outcomes in `vehicle-react-results.json` match native command replays. `vehicle-react-provenance.json` records the pinned reference, exact harness/helper hashes, unchanged production sources and verification limits. The browser harness exercises boarding and disembarking across refresh on desktop, tablet and phone using the durable native match service.

This remains component coverage. Full production admission stays closed. Broader reaction grants, vessel deployment reactions, cargo movements around reactions, aboard movement Interrupts and the remaining full-engine scope still require implementation and verification; no new standalone study was added.

### Granted vessel and crew deployment reactions

`vessels.ts` now uses CZ-3/Comlink permissions for separate vessel deployment and character deployment aboard. Ordinary destination, capacity, identity, Force costs and play limits still apply. The grant and original reaction location are saved; removing the grant does not undo an initiated action, while a moved or returned target cannot carry a pending crew reaction to another location. An unpiloted vehicle supplies no presence; a later successful driver deployment can cancel the drain. Sense returns only the canceled deployment to hand, keeps its Force cost paid and preserves prior arrivals. The shared source query now excludes canceled text and inactive crew grants.

Seven complete GEMP result comparisons cover Light CZ-3 and Dark Comlink, canceling the vehicle or its driver, and source departure/return. `deploy-react-provenance.json` records the pinned engine and verification limits. Its harness declines a GEMP optional simultaneous-driver prompt at a site; it does not establish that selecting Yes succeeds. Native retains the AR p171 separate-deployment requirement when an unpiloted vessel may legally deploy there. Required simultaneous pilot reactions, cargo deployment reactions and wider permission grants remain unfinished. Production admission is still closed.

The native suite additionally checks battle entry, Barrier on arriving drivers, full seats, non-unique title locks, stale targets and recovery. Playwright deploys the vehicle, refreshes, then deploys its driver and refreshes again through the actual native service at 1440/834/390 widths. These are engine/match checks, not new Rules Lab studies.


### Required simultaneous pilot reactions

`pilot-deploy.ts` extends the existing paired deployment action to CZ-3/Comlink reactions at systems where an unpiloted starship requires a pilot. Both cards must be legal, have unused reaction eligibility and be jointly affordable. They pay together, remain bound to their original card/destination instances through refresh, and arrive together with the pilot already aboard. Arrival presence cancels the pending drain; Barrier on either valid simultaneous arrival affects both. Sense returns both to hand without refunding Force and applies the shared physical/non-unique-title reaction restrictions to both. Removing the permission source after initiation does not cancel the deployment. Optional pairing at docking bays is excluded when the ship can legally deploy unpiloted.

Red 1 now has explicit component metadata, identity, capacity and ordinary vessel behavior, taken from the pinned GEMP card implementation. Six executed GEMP records in `pilot-react-results.json` compare Red 1/Han Solo arrival, Sense cancellation, Barrier on either member and source departure/return; `pilot-react-provenance.json` records exact evidence and unchanged production sources. Additional native checks cover eligibility, insufficient combined Force, saved references, invalid destination recovery and optional-pair exclusion. Browser tests exercise the actual durable service and pending/shared-arrival refresh at phone, tablet and desktop widths.

This does not enable full production deck admission. Cargo reactions, required pilot reactions for vehicles/sectors, other permission providers, special card-text pairings, broader cost/prevention modifiers and the entire outstanding engine/product scope remain. No new standalone Rules Lab study was added.

### Cargo deployment reactions

`transport.ts` accepts CZ-3/Comlink deployment reactions into eligible cargo capacity at the pending battle/drain location. Normal affordability, printed deployment restrictions, carrier capacity and card-play/reaction history apply. Initiation retains original grant, cargo, carrier and location references. A grant leaving does not cancel the initiated action; a carrier moving or returning as a new table instance invalidates arrival. Sense returns the cargo to hand, retains paid Force and applies physical/non-unique-title reaction restrictions. Shared cancellation now reads both string and reference payloads without breaking ground movement reactions. Shared card-play history also recognizes reference-backed cargo deployments, closing a unique-card replay gap for ordinary and reacting cargo.

Seven executed GEMP records compare TIE Scout, Black 3 and Ubrikkian cargo deployment, canceled ship/vehicle reactions and grant departure/return. Carried vessels participate in the carrier's battle but have no normal power while landed; deployment into a hangar does not launch the craft. `cargo-react-provenance.json` records the unchanged reference sources and verification limits. Additional native checks cover Light CZ-3/Corvette cargo, capacity/Force limits, stale references, carrier changes and saved play allowances. Playwright exercises pending refresh, nested cargo inspection and the battle boundary at three device sizes.

This checkpoint adds no standalone study and keeps full production admission closed. Cargo reaction movement, more permission providers, vehicle/sector pilot pairs, aboard movement Interrupts, the previously recorded nested-crew participation discrepancy, and all outstanding full-engine/product scope remain required.

### Aboard movement Interrupts

`travel.ts` distinguishes ordinary landspeed movement from move-away permissions. Run Luke, Run! requires Luke on the ground, including when its nested movement resolves. Narrow Escape requires a qualifying Rebel present at the battle site: a passenger on an open vehicle can qualify, while enclosed crew and characters aboard landed starfighters cannot. Once another present Rebel permits play, eligible aboard characters can move away only if all targeted cards with ability have landspeed at initiation. AR p71, move-away Example 3 explicitly forbids play when a landed starship with a permanent pilot is among those targets. Having landspeed is distinct from being able to move: an immobile character or insufficient Force can still result in an unsuccessful movement attempt. Successful movement disembarks the character, carries attached equipment, pays one Force and uses that character's regular move. The carrier stays behind. Failed or canceled movement leaves the character aboard; paid costs remain spent. Landed starships do not gain landspeed movement from having ability.

Each initiated move-away binds the original character, host and source/destination location instances. Save/refresh retains those references; a returned or changed host cannot inherit an earlier movement action. Older pending snapshots without the new route fields remain readable. Action labels explicitly say “Disembark and move” for aboard choices.

Nine of ten recorded GEMP outcomes match ground/open/enclosed Run Luke eligibility, Narrow Escape presence, successful disembarking, equipment attachment, regular movement and insufficient Force. The original `escape-landed` observation permits play contrary to the explicit AR p71 example; the native engine now rejects it. The executed reference source and raw observations remain unchanged as discrepancy evidence. `aboard-travel-provenance.json` records execution against unchanged pinned production sources. Additional native tests cover cancellation, Barrier, prior movement, changed/returned hosts and targets, malformed/restored snapshots, and the official landspeed initiation condition. Controlled suppression/restoration fixtures distinguish current permanent ability from later movement resolution; they do not establish a legal starter-card blanking path. `narrow-escape-browser.mjs` verifies both the rejected play (atomic service rejection and refresh) and a permitted passenger escape (payment, carried weapon and pending/completed refresh) at 1440/834/390. Browser checks exercise actual service commands and refresh before and after movement at phone/tablet/desktop sizes. These are engine integration checks, not new Rules Lab studies or evidence of complete deck support. Full production admission remains closed; broader vehicle/space movement permissions, nested cargo behavior and the full engine/product scope remain unfinished.

### Character movement reactions

`character-react.ts` executes Shistavanen Wolfman's (`1_30`) printed adjacent-site movement permission as a staged reaction. It checks active game text, ordinary movement availability, previous reaction/battle participation, affordability and an opponent's just-initiated battle or drain. The one-Force cost is paid at initiation. An aboard Wolfman disembarks before the regular movement's response step, so successful Sense cancellation keeps that disembarking and spent Force while preventing the regular move. Successful movement carries attached equipment and consumes the regular move. At arrival the character may embark once into legal pilot/driver/passenger capacity at that site; the card's attributes determine the available roles. The character may also finish on the ground.

Original character, source/destination locations and selected carrier references persist through the separate response windows. Capacity and original host identity are rechecked when boarding resolves. A canceled source's game text prevents initiation; canceling it after initiation does not revoke the granted move. The existing ground reaction command IDs remain stable, legacy pending ground movement snapshots remain readable, and shared Sense cancellation retains the physical-card reaction lock. The native UI shows which of disembarking, reacting or arrival boarding is pending.

Nine complete GEMP comparisons cover ground/open/enclosed/landed departures, cancellation and failed Sense, optional boarding from ground or an original carrier, and battle entry. The source archive is unchanged; see `character-react-provenance.json`. Additional native tests cover Barrier/movement/reaction/text restrictions, stale character/carrier instances, capacity changes, saved state validation and persistent drain cancellation. Full engine and deck admission remains gated; this extends normal match behavior without adding a standalone Rules Lab study.

### Starship weapons

`starship-weapons.ts` adds ship-mounted Proton Torpedoes (`1_158`), Quad Laser Cannon (`1_159`), and Turbolaser Battery (`1_323`) to the continuous native battle engine. Explicit model/persona metadata controls legal hosts. Deployment and transfers pay the printed costs; transfers require ships present together. CZ-3/Comlink grants also offer eligible hand deployments as reactions, with the existing cancellation and play-history rules. These ordinary weapons require an operational, participating ship and cannot fire from landed or cargo ships. Targets must be present opposing participating starships.

Each paid firing attempt consumes that weapon's battle attempt. Starfighters normally use one different weapon per turn; capitals may use multiple weapons. Firing uses the existing physical-destiny scope, cost/draw/total response windows, about-to-hit/hit timing and battle loss system. Quad's +1 against starfighters and Turbolaser's −2/−5 apply to the total, not each individual draw. A hit does not reset ship forfeit. Losing a hit ship removes its crew and equipment through the ordinary ordered-loss process. Weapon and target references distinguish original table instances across leaving/returning responses. Invalidated targets cannot inherit the original hit; a paid firing still finishes its draws if the firing weapon leaves.

The native match UI shows both sides' shot records with draws, modifier, total, defense, outcome and required hit forfeiture. The serialized records survive refresh during and after firing. Phone, tablet and desktop use the same authoritative command service.

Verification: `starship-weapons.test.mjs` contains focused component checks and compares all 18 outcome records from `gemp/NativeEngineStarshipWeaponsOracleTests.java`. That harness executes actual deployments and firing in the pinned GEMP production engine, with controlled initial ships/Force/destiny. It checks both target classes at three destiny values for each weapon, costs, hits, unchanged forfeit, attempted-weapon availability and second-weapon availability. The provenance records hashes and an archive comparison of all 6,820 unchanged production source files. Native-only checks cover transfers, cancellation, stale table instances, unavailable hosts, physical draw limits, granted deployment reactions, ordered attached-card loss, invalid snapshots and JSON round trips. `client-browser.mjs` exercises two-destiny Turbolaser firing through the authenticated PvP service, reloading before draws and after the hit at 1440, 834 and 390 pixels.

Limits: no full card/deck admission is opened. Turbolaser Battery's **mobile-system** mount still requires mobile-system setup, location attachment and motion integration. Unregistered X/B-wing and Falcon variants, Star Destroyer variants, squadrons and cards treated as starfighters need their own complete behavior and evidence. The shared three-weapon squadron limit is only a foundation; no squadron conformance claim is made here. Further card text, timing, setup/Objectives, capture, reactions/cargo movement, custom/open40/60/sealed, CPU/PvP, clocks/capacity and responsive complete-match work all remain in the full engine scope. Existing studies and GEMP paths remain intact.

### Mobile systems and Death Star mounts

The mobile-system component now covers Dark Death Star (`2_143`): its starting-location text makes Light take the first turn, while later deployment preserves the active player. It begins at parsec zero. During Dark's Move phase its regular move costs one Force and changes parsec by at most its printed hyperspeed of one, including entering/leaving orbit without changing parsec. Separate moving and moved response windows preserve payment, regular-move use and the original system/destination references across refresh. Ships, crew and weapons remain at the physical Death Star as it moves. Current parsec and orbit appear on the match table and pending movement status.

Ship hyperspace routes use current mobile-system positions. A piloted fighter without a hyperdrive may transfer between Death Star and the planet it orbits for one Force; equal parsecs alone do not grant that route. Turbolaser Battery may deploy on the mobile location, remains attached during movement and fires at opposing participating ships there. Ordinary weapon transfers still require character/vehicle/starship hosts and cannot transfer to or from a location. This supersedes the previous checkpoint's mobile-mount limitation. Core Shaft's increased ability requirement applies to Death Star sites only, not the system.

`mobile-systems.test.mjs` adds 21 component checks, including exact comparisons of all nine records from four executed `NativeEngineMobileSystemsOracleTests` methods. The pinned production source remains unchanged across all 6,820 files; hashes, execution command and fixture limitations are recorded in `gemp/mobile-systems-provenance.json`. GEMP coverage includes starting player/parsec, five mobile moves, both directions of a no-hyperdrive transfer and location-mounted Turbolaser deployment/firing. The reference test framework normalizes opening hands, so native eight-card setup is tested separately. Other native checks cover stale state, canceled arrival, bounds, later deployment, range and Core Shaft control. The browser fixture exercises real service persistence, moving/moved refresh, current position, carried fleets and mounted-weapon inspection at phone/tablet/desktop widths.

Pinned GEMP defaults a mobile system to one different weapon used per turn, and its second-weapon outcome is verified. Native follows that observed behavior. The cited Advanced Rulebook explicitly lists character/vehicle/starfighter and capital weapon limits but does not explicitly state a mobile-system number; this is an engine-backed result, not a claim of an explicit printed mobile restriction.

Full-match admission remains closed. Light Death Star, Death Star II, nested mobile orbits, sectors, Attack Run/blown-away rules, Revolution itself, hyperspeed modifiers and the remaining catalog/timing/product scope still require integrated implementation and verification. The nested-orbit carrying foundation does not establish coverage for unregistered mobile cards. No standalone Rules Lab scenario was added.

### Astromech capacity, current ship values and navigation

Reserved astromech slots now participate in the shared passenger-capacity calculation. Only an astromech droid can occupy reserved capacity; remaining astromechs use ordinary passenger or shared pilot/passenger space. This preserves the existing passenger role, deployment/reaction, transfer, shuttle and docking interfaces rather than inventing a separate character role. Component metadata adds Red 3, Gold 5, Red 5 and R2-X2, without changing full-match admission.

R2-D2 adds its printed power/maneuver/hyperspeed bonuses to a starfighter, including the larger Red 5 bonus. R2-X2 contributes its printed bonus. Different titles combine; duplicate noncumulative R2-X2 copies contribute once. Canceled or battle-excluded droids do not supply game-text bonuses. Astromech identity supplies navigation independently of active game text, and current hyperspeed controls legal routes. Landed/unpiloted ships retain their current hyperspeed value but cannot use it; their power and maneuver stay zero. Once hyperspace movement begins, reducing hyperspeed during its moving response does not undo the initiated route. Physical card/location references and movement prohibitions still apply.

Premiere Luke's Red 5 maneuver bonus and Red 5's conditional attrition immunity are included. Artoo can respond to an opponent's destiny through a Scomp link on the ship it occupies, using the existing activation/draw pipeline. Current hyperspeed, navigation and reserved capacity appear in the ship panel. Closing printed-card inspection restores keyboard focus to the card without scrolling the table.

The trusted `suppressGameText` effect API adds serialized, table-instance-bound suppression for a turn or while its original source remains. Suppression survives refresh, stops on the appropriate boundary and cannot follow a target that leaves and returns. It composes with the existing Praji cancellation/restoration actions. This is a shared effect primitive, not an assertion that all cards creating suppression are implemented.

Verification: `navigation.test.mjs` compares all eleven recorded outcomes from `NativeEngineNavigationOracleTests`, including actual droid deployments and hyperspace moves, combined/duplicate bonuses, reserved slots, navigation-source and Scomp queries, matching Red 5 immunity, canceled text, and astromech departure during movement. The cancellation cases use a production GEMP turn modifier and the equivalent trusted native API. Initial ships, crew, Force and locations are controlled fixtures. All 6,820 production reference files remain unchanged; see `navigation-provenance.json`. Additional native checks exercise state corruption, instance replacement, suppression expiry, full capacity, excluded crew and actual aboard Scomp responses. Playwright uses the real native service and SQLite D1 for deployment and two-stage movement recovery at 1440, 834 and 390 pixels.

Limits: Red 5's Attack Run bonus remains outstanding; no full card or deck admission is opened. These fixtures verify astromech navigation independently of a printed nav icon, but do not implement or verify icon-cancellation cards. Broader ship modifiers, matching pilots, movement grants, mobile-system variants, sectors, capture, Objectives/setup and the complete CPU/PvP/custom/open40/60/sealed product scope remain required. No standalone Rules Lab study was added.

### Ship maneuvers and Tallon Roll

A Few Maneuvers (`1_70`) and Dark Maneuvers (`1_241`) use the shared physical-instance and noncumulative statistic history for turn-scoped maneuver, hyperspeed and power additions. Normal phase/weapon-segment plays and the special just-drawn response use the same effect. Only actual defense targets of the owning pending draw qualify; an unrelated destiny or a completed total does not reopen that response. Ship power, current defense and hyperspace routes consume those values. Sense cancellation, Used disposal, expiration, source recycling and original-target identity survive reload. Eleven executed GEMP comparisons accompany `maneuvers.test.mjs`; full admission stays closed.

Tallon Roll (`1_270`) now executes through ordinary native match commands. A piloted TIE/ln and a Rebel starfighter present at the same supported system are targeted, Dark draws first and Light second, and current ship values are compared. The defending ship may be unpiloted. A failed draw loses the comparison regardless of numeric total; two failures or equal successful totals lose neither ship. Losing a ship removes its crew and mounted equipment with normal chosen Lost ordering. Neither the ship nor its crew is forfeited for battle-loss credit. The comparison and both sides' values remain visible in the responsive match UI and survive refresh.

Corellian Slip (`2_47`) responds to the exact pending Tallon Roll initiation to add Light's maneuver and highest active pilot ability, including an applicable permanent pilot. Multiple copies do not repeat this addition. Its separate normal action reduces an opponent's starfighter maneuver by one for the turn, without requiring the target to be piloted. Both modes can be canceled through the ordinary Sense timing. Slip binds the original source play, so a later Roll does not inherit its modification.

The initiating Tallon Roll draw targets only the TIE's maneuver ordinarily, and both ships' maneuver after Slip. The defending draw targets neither for these just-drawn responses. GEMP execution also established that departing targets do not cancel remaining draws/effects: the original permanently-piloted Y-wing retains printed power for the calculation, and a failed initiating draw or higher defending total can still lose the remaining TIE. Native matches those recorded departure outcomes while binding any later loss to the original table instance.

`NativeEngineTallonRollOracleTests` records sixteen outcomes against the pinned, unmodified engine; `tallon-provenance.json` records exact source/result hashes and limits. Native tests additionally cover cancellation nesting, repeated Slip, pilot ability, reference replacement, malformed snapshots and crew/weapon loss ordering. Production `supports` remains false. This does not verify sector play, every ship/model, calculation-total modifiers, all loss protections, ship statistic resets, capture, Objectives/setup or the remaining full engine/product scope. No standalone Rules Lab study was added.

### Ion cannon damage and persistent ship resets

`starship-weapons.ts` now executes Ion Cannon (`1_318`) and SW-4 Ion Cannon (`2_81`) in the integrated battle flow. Explicit Star Destroyer and Y-/B-wing mounts, paid deployment/transfer/firing, current defense, strict greater-than comparisons, the printed Dark +2 calculation and the shared destiny/response pipeline determine the result. Ionization is separate from a hit: power, crew, and forfeit remain, and the ship is not added to the mandatory hit-forfeiture list. Only starship weapons directly mounted on the target are lost; carried character weapons remain aboard. The existing ordered table-loss transaction retains refresh recovery and original weapon-instance references.

`stat-modifiers.ts` adds target-instance duration for persistent resets. Ion damage survives turn changes and source-weapon departure; maneuver/armor/hyperspeed queries apply its reset after ordinary bonuses. Leaving play ends that instance's damage. The trusted `restoreIonDamage` effect removes ion-origin resets while preserving unrelated modifiers, preparing actual repair cards without admitting them prematurely. Unpiloted armor continues to use the pinned GEMP value of 2. Current armor and the ion-damage state appear alongside maneuver/hyperspeed in ship panels, and firing history identifies an ionized result separately from a hit. The shared hyperspace route and subsequent-weapon queries consume the reset values.

Evidence: `tests/native-engine/ion.test.mjs` and `gemp/ion-provenance.json`. Twelve complete executed GEMP outcomes cover both cannons, capital/starfighter targets, deployment/firing costs, failed comparisons, weapon removal, unchanged crew/power/forfeit, defense/hyperspeed and use limits. Additional native tests cover live maneuver responses, source/target/weapon departure, ordered loss recovery, repair primitives, turn persistence, a subsequent Turbolaser hit, hyperspace eligibility and malformed saves. Those additional branches are not claimed as separate GEMP comparisons. Repair card actions, artillery/Planet Defender Ion Cannon, permanent weapons, targets treated as starfighters, complete prevention/redirection and broader catalog interactions remain required. Production full-match admission remains closed; no new standalone study was added.

### R5 repair droids in continuous matches

R5-D4 (`2_15`) and R5-A2 (`2_101`) use the existing Character deployment and passenger/astromech capacity rules. Each title adds one power and maneuver to its directly occupied starship, including capital ships; repeated copies are noncumulative. They supply astromech navigation without adding hyperspeed. Inactive/canceled-text crew do not grant their text bonuses, and normal unpiloted/landed ship rules continue to apply.

`ion-repair.ts` implements their mandatory end-of-owner-Control repair through the phase snapshot and required-action machinery. The owner orders simultaneous repairs; they cannot pass a required repair. An initiated repair remains respondable and survives the droid's departure, while the original ship reference prevents a returned card inheriting an old repair. Repair removes the current ship's ion-origin armor/maneuver/hyperspeed resets and retains unrelated modifiers. Existing damaged ships show their available repair crew and timing in the table UI, and the required action and restoration survive service/browser refresh.

`tests/native-engine/gemp/repair-provenance.json` records sixteen complete executed GEMP comparisons with real droid deployments and automatic repairs. Initial ion damage and canceled-text state are controlled fixtures; actual cannon firing has separate ion conformance evidence. Native tests additionally exercise pending references, cancellation, multi-ship ordering, unrelated resets and saved recovery. This does not admit full decks or certify ship-related sites, opposing-player boarding, other repair cards, all ion types or wider catalog interactions. Full native engine and product coverage remains required, with production admission still closed.

### Matching fighter pilots and Wedge's Reserve search

Biggs Darklighter (`1_3`), Wedge Antilles (`2_23`) and DS-61-2 (`1_173`) use ordinary pilot deployment and occupancy. They add their printed power to any ship they actively pilot. Red 3, Red 2 (`2_70`) and Black 2 (`1_299`) respectively receive their named pilot's maneuver bonus and battle-destiny fallback; the fallback does not add a second draw when ordinary ability already permits one. Landed, departed, excluded or canceled-text pilots do not provide these text bonuses. Red 2 is immune to attrition less than three while Wedge pilots it, including when Wedge's text is canceled: this condition belongs to the ship and checks Wedge's identity. Canceling Red 2's text removes that immunity. Black 2 uses the existing TIE cargo and landing restrictions.

Wedge may pay one Force to find Corellian Slip (`2_47`) in Reserve during a legal normal action opportunity, including the battle weapons segment when he participates. The search need not originate aboard a ship. Its private selection, public selected-card reveal, take into hand and reshuffle use serialized continuations and exact card instances. Source departure after initiation does not undo the search. A successful search may be repeated for another Force; a verified failed search prevents repeating that function during the same turn. The owner can inspect Reserve membership without exposing its order; the opponent sees only a selected card or the failed-search verification. The responsive match UI presents these inspection states and restores pending choices on refresh.

`matching-pilot.test.mjs` compares all nineteen records from two executed `NativeEngineMatchingPilotOracleTests` methods: fifteen deployment/statistic/battle-destiny/immunity cases and four search outcomes. The original GEMP production source remains byte-identical across all 6,820 files; see `gemp/matching-pilot-provenance.json` for hashes, methods and precise limits. Additional native tests cover actual destiny draws, canceled searches, stale selection references, failure expiry and battle/opponent-turn availability. Browser verification exercises real native service persistence and seat privacy across phone, tablet and desktop. The recorded final search outcomes do not establish identical internal response-trigger ordering for every catalog interaction.

Full native admission remains closed. Other matching pilot/card text, navigation grants/cancellation, sector play, mobile variants, Attack Run, capture/Objectives/setup and all remaining full-engine/product scope remain required. No additional standalone Rules Lab study was added.

### Post-battle fighter loss and Red 6

Jek Porkins (`1_13`) now supplies his ordinary pilot power and named Red 6 maneuver/battle-destiny fallback through shared occupancy and battle queries. Red 6 (`2_72`) has its printed single pilot seat and navigation, with no invented astromech capacity. Its optional opponent action adds two to the exact pending destiny drawn by I've Got A Problem Here (`1_253`). A canceled or substituted draw cannot be increased. The response is consumed once per draw window; a redraw gets a fresh opportunity without retaining the canceled draw's bonus. Unpiloted Red 6 remains a legal target but its suspended text cannot offer that bonus.

The Lost Interrupt is offered after an actual system battle ends, for one Force, targeting an opposing starfighter there with defined maneuver. It does not require that starfighter to have participated, or to remain piloted. A canceled battle does not create the opportunity. The shared destiny pipeline permits A Few Maneuvers in response to its targeting draw; the final comparison uses current maneuver and requires strictly greater destiny. Failed or equal draws do not lose the ship. Source/target references, paid Force, destiny responses, comparison and ordered loss survive serialized match recovery. Target departure does not undo a destiny already initiated, but a returned table instance cannot inherit the old loss. Losing the ship also loses its crew and mounted cards without providing battle-loss credit. The result remains visible in the responsive match screen.

`fighter-trouble.test.mjs` contains exact comparisons of ten executed GEMP outcome records, including Jek's real deployment cost, ship values, battle-destiny eligibility, completed destiny values, Interrupt cost, optional bonus, defensive maneuver, unpiloted/canceled text, empty Reserve and departed targets. The reference fixture runs real battles and pays damage from Reserve; controlled board, Force and destiny setup are disclosed in `gemp/fighter-trouble-provenance.json`. Its 6,820 production files remain unchanged. Additional native checks exercise actual Sense cancellation, repeated Interrupts, canceled battle, replacement/canceled destiny, original references, ordered crew/weapon loss, malformed saves and browser/service refresh. These additional branches are not separate executed GEMP claims.

Sector locations, wider fighter variants, complete targeting/loss prevention and the remaining full engine/product scope remain required. Navigation grants/cancellation and sector integration are next connected work; full native admission stays closed. No standalone Rules Lab study was added.

### Heavy weapons and artillery

`heavy-weapons.ts` integrates AT-AT Cannon (`3_158`) and Golan Laser Battery (`3_75`) with ordinary battle and creature-attack opportunities. It uses paid firing, the shared destiny/total response pipeline, strict hit comparisons, physical source/target references and persistent firing history. Cannon target-type bonuses and the starfighter defense override are explicit. Adjacent weapons may fire into a battle without their users contributing power or forfeiture there. A creature assault permits remote fire; a creature-initiated hunt requires participating users. Hits remain until the appropriate battle forfeiture or attack damage segment.

`artillery.ts` resolves present, friendly power-droid/fusion-generator sources and active Light Main Power Generators text. Firing spends the chosen warrior's weapon allowance. Golan deploys to an exterior planet site for three Force, participates with no power, and can forfeit its printed value toward losses. A blown-away site's former exterior icon cannot authorize deployment. The match UI shows powering status, firing unit, target, destiny, modifier, total, defense and outcome. Pending draws, totals, hits and forfeiture recover through the native match service.

`heavy-provenance.json` records three executed GEMP test methods and nine exact observations covering six cannon target/range combinations, two artillery shots and power-source location queries. All 6,820 reference production files are unchanged. Native-only cases additionally cover creature attacks, forfeiture, cancellation, source/target departure, excluded users and malformed saved continuations. Power-droid and Portable Fusion Generator metadata supplies these powering fixtures; their other text and card actions are not certified. Other artillery, remotes, special movement, immunity/redirection, broader total-modifier interactions and general destruction remain required. Full card/deck admission remains closed and no standalone study was added.

### Continuous weapon totals during responses

`weapon-total.ts` supplies live printed total modifiers for AT-AT Cannon, Golan Laser Battery, Quad Laser Cannon and Turbolaser Battery. `destiny.ts` re-queries these contributions after total responses, preserving independent action adjustments and the underlying signed sum when the displayed total is clamped to zero. Losing or canceling the original weapon's text removes its contribution. Returning that same physical weapon restores it, matching executed GEMP behavior; another copy cannot supply the pending shot's modifier. Saved continuations bind the original weapon and target references, while live battle projections update without rewriting completed history.

Ion Cannon's printed +2 is firing-action arithmetic applied after the total response window, rather than a continuous total modifier. It therefore survives the source leaving or losing text. The pending destiny total and final hit comparison retain this distinction.

`weapon-total-provenance.json` records three executed GEMP methods and twenty exact comparisons across five weapons and unchanged, departed, canceled-text and returned-source cases. All 6,820 reference production files remain unchanged. Departure, return and text cancellation are controlled fixture interventions, not executed card actions. Native-only checks cover negative-total recovery, independent adjustments, malformed saved references, another copy, and pure live projections. Playwright exercises persisted total changes and final outcomes through the real native service and SQLiteD1 at phone, tablet and desktop sizes. This closes the preceding four-weapon total-window gap; general automatic modifiers, other weapon types, targeting changes and prevention/replacement still require coverage. Full native admission remains closed.

### Power droids and Portable Fusion Generator

EG-4 (`3_8`) and EG-6 (`1_175`) deploy through ordinary character rules for one Force. Their active text adds one power to each friendly non-power droid present, with repeated copies noncumulative. Drawn battle destiny is zero. When the drawing side has lower battle power, their required trigger adds the current power of participating cards present as a lasting battle bonus. It excludes battle destiny, power-only destiny and other total-power additions. The trigger precedes optional just-drawn responses; later cancellation of that destiny does not reverse the resolved bonus. Battle state records physical-card usage and the frozen addition, with serialized validation and an explicit UI explanation.

Both Portable Fusion Generator mirrors (`3_96`, `4_13`) deploy free on a friendly warrior and use ordinary device transfer. The selected firing warrior's generator adds one to each blaster-rifle or artillery destiny draw; powering artillery from another carrier does not grant that firing bonus. The optional, unrespondable enhancement targets one present droid, including an opposing droid. The bearer uses its one-device allowance for these actions; continuous draw bonuses do not spend that allowance. Turn off the enhancement before choosing another droid. It survives turn changes, suspends during text cancellation, and ends when the original source, carrier or target leaves its valid relationship. Departing and returning cannot restore an expired link. The match screen identifies the selected target and refresh restores both enhancement and pending mandatory destiny actions.

`gemp/power-support-provenance.json` records ten exact GEMP/native comparisons from four executed methods: both sides' ordinary/repeated/canceled droid power, actual enhancement on/off, enhanced rifle draws, and four battle-destiny power outcomes. All 6,820 reference production files remain unchanged. Additional native checks cover deployment, artillery firing-user identity, device-use restrictions, source/target departure, canceled destiny and malformed saves. Those branches are not separate executed GEMP claims. Repeated droid draws, draw selection/substitution, simultaneous triggers, broader device permissions, inactive/capture/undercover exceptions and strategic CPU choices remain required. Full deck admission stays closed and no standalone Rules Lab study was added.

### Starter readiness reconciliation and Assault presence

`data/native-engine/starter-readiness.json` binds the admission audit to the
exact 68-definition starter pair, retains explicit rules disputes, and separates
absent wider-catalog providers from unverified starter interactions. Forty new
native-only legal-command matches (seeds 101–120 at both 40 and 60 cards) ended
through Life Force exhaustion after 119,205 commands. Their compact receipts are
in `tests/native-engine/audit/starter-readiness-results.json`. These paths never
played Obsession and do not certify exhaustive timing or GEMP parity. The
one-sided failed-duel Force amount remains a real starter blocker; target-return
reachability still needs review. The nested Chances chain requires more physical
copies than the current pair contains, but remains required for custom decks.

The audit found a concrete vessel integration gap: Assault still counted only
characters. `assault.ts` now counts present physical characters, vehicles and
starships. A landed/unpiloted vessel contributes a draw even if it contributes
no power. Enclosed crew and nested cargo do not add draws; exposed occupants of
an open vehicle do. Power/count remain frozen at resolution entry under the
Counter Assault ruling (AR pp140–141), shared by Surprise Assault.

Eleven executed GEMP paths compare actual drain cancellation, destiny draws,
power, Force losses and Interrupt cleanup across both sides and these occupancy
cases. Native tests additionally cover response-time crew changes, subsequent
departure and serialization. The Playwright service/SQLiteD1 fixture plays both
Assault mirrors through the actual UI and reloads at pending destiny, result and
completed loss at phone/tablet/desktop sizes. Evidence and limitations are in
`tests/native-engine/gemp/assault-presence-provenance.json`. No new Rules Lab
study was added. Full engine scope is retained and production admission remains
closed.

### Complete-match recovery and damage-action priority

A twelfth complete introductory GEMP game now replays through 2,439 native
commands and 245 exact checkpoints, ending with Dark's Life Force victory on
turn 35. This path includes Kintan Strider retrieving the topmost character and
Old Ben reviving the opponent's same just-forfeited character, after its
attachments are lost. The revived character stays out of the current battle,
and its already credited forfeiture remains paid. This is a complete selected
path using the actual 60-card lists and a fresh reference shuffle; there are no
helper cards, arranged mid-game piles or state corrections. The source and
record hashes are in `gemp/recovery-match-provenance.json`.

The game exposed a timing error in a later battle: playing It Could Be Worse
advanced the native damage-action turn. It is a response to the pending loss,
not the player's forfeiture/loss action. The combined damage UI now retains
that player's action turn while payment, play and cancellation responses still
alternate normally. After the player actually forfeits or loses Force, the next
damage action belongs to the opponent. The saved parent window retains this
priority through refresh. This agrees with the pinned GEMP
`BattleDamageSegmentAction.ChooseCardToLoseOrForfeitEffect`, `Card1_090`, and the
AR damage-segment sequence (pp56–57).

The reference client validates actual selectable entries in Lost Pile dialogs;
nonselectable cards may precede the legal character. Replay checks the selected
temporary ID/blueprint, exact subsequent physical cards, and Old Ben's original
site. Its optional checkpoint observer receives copies and cannot change the
continuing replay. `recovery-match-fixture.mjs` resumes the verified turn-14
checkpoint for service/browser checks, with no board or pile arrangement.
Run `node tests/native-engine/recovery-match-browser.mjs` against the normal
local UI for the real service/SQLiteD1 phone, tablet and desktop refresh test.

This selected path does not establish every reachable action, remaining
attrition comparison or every intermediate timing window. Native regressions
add cancellation via It's Worse; that is not a second GEMP match observation.
The failed-Obsession Force amount, further response interactions, general card
coverage and all remaining full-engine/product requirements remain unfinished.
Full production deck admission stays closed. No standalone Rules Lab study was
added.

### Complete-match returns, redraws and destiny switching

Three further complete GEMP games cover Set For Stun, Han's Dice and Takeel
through 6,094 native commands and 646 exact checkpoints. The games finish on
turns 28, 26 and 19 with Light victories. They include Luke returning to hand,
failed Stun leaving five attachments intact, the same physical Dice card played
twice, and Dice followed by Takeel switching unequal battle destiny totals.
Targets come from the selected reference Action's actual primary target, with
explicit selection IDs checked when GEMP opens a dialog. No later board state
is used to guess a target. Each exact executed harness is archived beside its
record; hashes and limits are in
`tests/native-engine/gemp/battle-response-match-provenance.json`.

Version 5 checkpoints also compare remaining attrition and finalized destiny
totals, physical cards and individual values during the damage segment. A
zero-valued draw remains distinct from having no draw. Takeel swaps the totals;
the drawn cards retain their original owners. Tampering regressions cover these
fields, source action labels, target identities and absent observations.

`battle-response-match-fixture.mjs` extracts consecutive real checkpoints only
after the entire recorded game replays successfully. Run
`node tests/native-engine/battle-response-match-browser.mjs` against the local
UI to play the Interrupt buttons and refresh pending/resolved states through
the real native match service and SQLiteD1 at phone, tablet and desktop widths.
The intervening commands are the recorded legal sequence; no state corrections
are supplied after resuming the checkpoint.

These selected paths extend verification of existing native behavior; they do
not certify every timing window or starter interaction. Successful Stun with
attachments is not reached here. The older version 4 path lacks the new destiny
and remaining-attrition fields. Full production admission stays closed, and the
failed-Obsession question and broader full-engine scope remain outstanding.

### Complete-match battle movement responses

`ground-travel-responses` adds a complete 31-turn GEMP game ending in Dark's
Life Force victory: 1,775 reference decisions replay as 2,418 native commands
and 267 exact checkpoints. Luke runs into two battles on different turns.
Between them, Narrow Escape moves Luke and a Rebel Trooper separately, paying
one Force for each. The recorded moves preserve table identities and exact
Force/Used pile order. Existing native gameplay matches this path unchanged.

The client uses the normal starter lists and a reference shuffle. It chooses
Luke's deployment at Lars Moisture Farm when available and other deployments
at Docking Bay 94; these are offered player choices, without board corrections.
The selected Action supplies each Interrupt target. The chosen move-away card
and its engine-observed arrival supply each destination, checked against the
immediate next reference state. Altered origins, arrivals, payments and later
actions cannot silently replace that evidence. Exact source and record hashes
are in `tests/native-engine/gemp/travel-match-provenance.json`.

Run `NATIVE_MATCH_RESPONSES=travel node tests/native-engine/battle-response-match-browser.mjs`
against the local app to resume these actual full-game checkpoints through the
real match service and SQLiteD1. Both Interrupt plays and each Escape destination
use the UI buttons; the recorded intervening commands complete normally. Pending
and resolved refreshes retain the exact saved state at phone/tablet/desktop sizes.

This is additional complete-path evidence, not a resolution of the controlled
departure/return/late-arrival discrepancies. The subsequent starter timing audit below addresses reachability; the
failed-Obsession Force amount still requires evidence. No admission gate or broader
engine requirement was removed, and no standalone Rules Lab study was added.


## Starter movement response reachability

`data/native-engine/starter-travel-reachability.json` reviews the printed timing
capabilities of all 68 definitions in the exact intro pair. No card in that pair
can make an original target leave and return to the table before its pending move,
or deploy a later arrival into a pending Narrow Escape group. The earlier
controlled mutations remain useful robustness tests and broader-deck discrepancies;
they are now classified outside this exact pair, not silently resolved for all cards.

The executed GEMP inventory has every starter Interrupt in hand and funded CZ-3,
Comlink, Wolfman and accident prerequisites. Before playing the Interrupt, responses
are nonempty. During three completed movement chains (Run Luke on either side's turn), all twenty-six response decisions
are empty. Native matches their twenty-two movement/Interrupt stages and acting sides;
four empty GEMP payment decisions are safely elided by the existing native cost
handler. The reference production sources remain unchanged.

Arrival mines are a distinct exception: a completed move may trigger a loss while
Escape still has other characters to move. A combined native test resolves a real
mine draw/loss, Kintan retrieval to hand, and the next Escape move, with JSON
restoration checks throughout. Old Ben cannot respond to a mine casualty because
it is not a forfeiture. Neither side can use the older battle-initiation react
window while these nested actions resolve. The mine case is native integration
evidence, not an additional GEMP comparison.

Tests bind this analysis to exact deck lists, every card definition, and reviewed
source hashes; changed inputs require a new audit. Controlled inventories are not
exhaustive state exploration or full-deck certification. The failed-Obsession Force
amount, broader cards/rules, and the full native product scope remain outstanding.
No production admission was opened and no standalone study was added.

### Vehicle move-away and Snowspeeder

Narrow Escape now dispatches eligible Vehicle targets through the shared landspeed journey. The original ability group remains bound to physical instances; the owner chooses movement order and destination, pays once for each mover, and receives the existing intermediate-arrival windows. Moving the vehicle first carries its occupants and equipment; those characters no longer make separate escape moves. A character may instead disembark and move first, paying separately. Range, terrain, prior movement, Barrier, cancellation and pending route identity remain enforced.

Snowspeeder (`3_69`) has explicit component metadata, enclosed shared pilot/passenger capacity, permanent pilot ability and its Hoth-only movement react. Reaction boarding now offers pilot capacity when the actual vehicle permits it. This allows Han to board as pilot, enhance power, and arrive to contest a Force drain through the existing reaction machinery.

`vehicle-escape-provenance.json` retains eight executed GEMP observations against unchanged production sources. Five agree: ordinary near/long journeys, Hoth reaction/pilot boarding, rejected Tatooine reaction and no-Force Escape. Three Escape observations reveal a pinned GEMP filter discrepancy: `Filters.hasAbility` excludes permanent pilots despite a valid Snowspeeder move-away action. Native follows AR p71's explicit permanent-pilot target example and vehicle-first carrying rule. The raw discrepancy is preserved, not reported as conformance. Native checks add route/target replacement, cancellation, Barrier, movement order and JSON recovery. Portable browser checks use the actual match service and SQLite D1 at phone, tablet and desktop widths.

This adds engine behavior, not a standalone study or full deck certification. The exact starter travel reachability audit remains valid: these decks contain no Vehicle, and their character routing is unchanged. Failed-Obsession amount adjudication, wider card/setup/timing coverage and all full-game product requirements remain outstanding; production admission stays closed.

### Complete custom vehicle matches

Two fixed 60-card Hoth vehicle games now replay from ordinary setup through life-force victory against the unmodified pinned GEMP engine. The retained games cover 5,290 native commands and 584 exact checkpoints, including regular landspeed journeys, passenger deployment, battles, forfeitures and two Snowspeeder movement reactions. Comparisons include ordered piles, physical attachments, crew roles, vehicle power/ability/forfeit, battle losses and final results. The exact decks, executed harnesses and compressed reference receipts are bound by hashes in `tests/native-engine/gemp/vehicle-match-provenance.json`.

Nine focused tests replay both games and reject altered evidence or deck profiles. Nine portable browser checks exercise movement, passenger deployment and reaction recovery through the actual match service and SQLite D1 at desktop, tablet and phone widths, including refresh during pending actions.

These selected complete games do not deploy an additional pilot aboard or exercise vehicle Narrow Escape; those behaviors retain their separate component evidence and documented reference discrepancy. This checkpoint changes test coverage only. Production admission remains closed, and the outstanding full-engine scope is unchanged.

### Complete space games and world boundaries

Two fixed custom 60-card space games now replay against unchanged GEMP production sources from ordinary setup to life-force victory: 4,741 native commands and 492 exact checkpoints. The second game deploys additional pilots, carries passengers, moves occupied ships through hyperspace and resolves carrier forfeiture. Version 7 snapshots compare ship power/ability/forfeit and actual crew roles alongside ordered piles, attachments and battle losses/destinies. The replay also handles a pilot deployed as a passenger when the reference offers only that remaining capacity. Exact decks, executed harnesses and reference hashes are retained in `tests/native-engine/gemp/space-match-provenance.json`.

The full games exposed two runtime defects. Planetary site orientation is now validated independently from the outer site/sector/system sequence, as required by AR Appendix E: a system may sit at either end without fixing which end of the site row is interior. Site insertion, sector insertion and restored-state validation agree; existing adjacency, buffer, city and Hoth ordering restrictions remain enforced. Utility belts now distinguish being **on** Tatooine or Death Star from orbiting **at** that system. Tatooine Utility Belt has no bonus in orbit; Death Star Utility Belt retains its ordinary +1 away from the station. Sites and clouds still qualify, including characters aboard carriers there; related asteroids do not (AR p43, Prepositions).

Regression checks cover both site orientations with either system placement, cloud placement, illegal split rows, belt transitions and altered reference evidence. Portable Playwright cases resume verified whole-game checkpoints through the actual match service and SQLite D1 for pilot deployment, hyperspace, carrier loss and the previously rejected site placement, with pending-action refresh at phone, tablet and desktop sizes.

These are selected complete-game comparisons, not exhaustive deck certification. Production admission stays closed; failed-Obsession adjudication, earlier documented discrepancies and the wider full-engine/product scope remain required. No standalone Rules Lab study was added.

### Complete armed space matches

Two more fixed custom 60-card games replay from ordinary setup to life-force victory against the unchanged pinned GEMP engine: 4,616 native commands and 450 exact checkpoints. They exercise SW-4 Ion Cannon, Ion Cannon, Quad Laser Cannon, Proton Torpedoes and Turbolaser Battery, plus three just-drawn maneuver responses. Version 8 also compares current armor, maneuver and hyperspeed, and validates the actual observed maneuver targets. Exact lists, executed Java harnesses, compressed receipts and hashes are retained in `tests/native-engine/gemp/armed-space-match-provenance.json`.

The ion game includes two successful ionizations. These paths also include misses and failed weapon destiny draws, but neither a successful laser hit nor ion-driven weapon removal; those retain separate component coverage. Reference snapshots compare resulting table/pile state and ship statistics rather than weapon-total scalars directly. No runtime correction was needed for these selected paths. They strengthen whole-game integration evidence without certifying every reachable interaction; production admission remains closed and all outstanding full-engine/product requirements remain.

Nine focused tests bind the evidence and reject altered ship statistics, targets and decks. Twelve Playwright 1.62.1/Chromium 1234 checks resume maneuver chains, ionization, Turbolaser firing and failed torpedo draws through the actual match service and SQLite D1 at 1440/834/390. Pending-action and resolved refresh preserve exact state; ionized and failed-draw summaries are asserted in the UI.

### Private custom decks and native match selection

The native lobby now selects saved open-play 40- or 60-card decks for either side, a separate computer deck, and matching decks when joining a private invitation. The account-owned library can create, copy or edit drafts with searchable card names/text, multiplicity controls and live deck counts. It uses the existing D1 `decks` table under a separate `native-deck:` namespace, preserving retired prototype records. No schema migration or production card admission changes are required.

`/api/match-decks` uses the same trusted gateway identity, same-origin JSON and request-size checks as matches. Drafts may be incomplete or contain unverified cards; the server reports their readiness separately. Optimistic revision checks prevent lost updates, including simultaneous edits. Exact lost-response retries return the saved revision. The match service still validates a frozen card list before seating players; editing a saved deck cannot change a running match. An uncertain match creation is recovered with its original ID, cards and time control before a new table can start.

Six service tests cover privacy, legacy-record preservation, concurrency, retries, forged inputs, current admission and both deck sizes for CPU/PvP. Portable browser checks edit/save/reload at 1440/834/390, create both sizes in both modes, recover interrupted creation, join with a custom guest deck and verify that the production gate stays closed. These UI games use the existing test-only admission override; they do not certify those decks for production.

Sealed pools, the full printed catalog in native deck construction, and all outstanding rules/setup/capture/Objective, scheduling/capacity and full-match conformance requirements remain in scope. This is a connected product workflow, not a new Rules Lab study or permission to play unverified rules.

### Paired OTSD pools and bound deck construction

The native lobby can create a private OTSD table, invite the opposite side, reveal each player's allocation after both seats are occupied, and build/save a 40-card draft from that inventory. Two boxes supply 186 cards: each has 18 fixed premium cards, four Premiere boosters and one A New Hope booster. Off-side cards are exchanged before either pool is projected. The server persists both allocations once under the existing `pools` table's `native-sealed:` namespace; retries recover the original products and competing invitations can claim only one guest seat. No migration is needed.

Saved sealed drafts retain their pool binding and reject excess copies, other-side cards, another player's pool and a changed deck size. The collection includes all 504 printed cards from those three sets. This is pool opening and construction only: sealed match binding, sealed-specific starting-location setup, computer sealed construction and tournament scheduling remain unfinished. Sealed decks explicitly remain ineligible for match play; ordinary open-match admission is unchanged.

`tests/native-engine/gemp/sealed-products-provenance.json` binds the executed product oracle, raw observations and source data. Sixteen seeded booster comparisons replay GEMP's weighted rarity-sheet collation exactly when given its same filtered sheets. Pinned GEMP excludes eleven unimplemented printed cards; native physical products deliberately retain those cards, with gameplay admission handled separately. Thus whole native product outputs are not claimed to equal GEMP's filtered products. Fixed OTSD contents, full printed-card presence, privacy, allocation conservation, competing joins, inventory checks and recovery have separate tests. Portable Playwright checks exercise both players and persisted 40-card construction at 1440/834/390 through the actual HTTP handlers and SQLite D1 with trusted test identity.

### Pool-bound OTSD private matches

OTSD is now a distinct lobby format. Creating a private match freezes the pool ID with the submitted 40-card owner deck; joining checks the paired participant's assigned side and inventory, then uses the existing ordinary setup and persisted command service. Either paired participant can host. Foreign players, excess copies, different pools and incompatible sizes/modes fail before mutation. Copies edited in the deck library cannot change the match. Open games retain their existing array snapshot and creation hash; sealed snapshots use a versioned object in the same `owner_deck` column, with no migration.

This follows the [official Alternate Format Tournament Guide](https://res.starwarsccg.org/wp/wp-content/uploads/Alternate-Formats-Guide.pdf), pp4/7, for standard OTSD sealed. The pinned GEMP `downloadBattlegroundRule` is a separate format addition: `PlayStartingEffectsGameProcess` announces it and `GameState.iterateCardsWithCardPileActions` exposes it during Deploy. It is not an extra starting-location step and is not silently added to standard OTSD. Casual clocks remain explicitly agreed per-player controls, not tournament clocks.

Three service tests verify inventory/participant enforcement, immutable copies, retry recovery, private projections, ordinary setup through eight-card hands, and concession. Three Playwright 1.62.1/Chromium1234 workflows at1440/834/390 create from saved pool decks, recover an interrupted creation, join the paired invitation and advance ordinary setup via the actual HTTP/service/SQLite path. These use explicit test-only component admission and a fixed seed266 allocation; they verify integration, not every card in the product. Production admission remains closed. CPU sealed construction, card-specific Starting Interrupts, full product card behavior, tournament scheduling and the broader engine requirements remain outstanding. No new Rules Lab study was added.

### Computer sealed construction and complete match integration

A sealed table can now assign the opposite side to the computer before either product is revealed. The owner immediately receives only their side's allocation; the other pool has no public projection, invitation or player seat. Existing rooms without a mode retain their paired-player behavior. Reusing a creation ID cannot change mode, side or allocation, and neither a browser request nor a saved player deck can replace the computer's cards.

The server's versioned `sealed-balanced-1` policy chooses40 admitted cards from the computer's inventory. It favors varied locations, affordable characters/pilots and ships when systems are available, then fills from remaining physical copies. This is a deterministic construction heuristic, not rules execution or an optimal strategy claim. Insufficient verified cards produces a generic readiness error without revealing the pool. Match creation freezes both lists and the policy version; reads and retries never rebuild the computer deck. Automatic play uses the existing rules-driven computer service.

Eight focused tests cover128 generated allocations across both sides, deterministic construction/copy limits, privacy, rejected seat/mode/deck substitutions, current admission and restored setup. Three browser workflows at1440/834/390 exercise computer pool opening,40-card construction, lost opening and creation responses, automatic setup and refresh. Paired-player sealed and16 open40/60 CPU/PvP browser groups remain green.

`node tests/native-engine/sealed-computer-match.mjs` reproduces a complete generated-deck game from allocation seed266 and game entropy seed73:1,470 driving iterations,2,937 saved commands, Light life-force victory. It uses the real match service/SQLite D1 and explicitly test-only component admission. This is one complete native integration path, not GEMP conformance or exhaustive card certification. Production admission stays closed. All18 OTSD premium definitions and their component providers now exist (`otsd-ships`, `otsd-characters`, `otsd-locations`, `otsd-orders`, `alien-search` and `droid-service`); their presence does not establish exhaustive full-match conformance. Broader card/starting-card/capture/Objective coverage remains required. Standard OTSD retains ordinary setup without GEMP's separate bonus download rule; tournament controls remain unfinished.

### Disarmed and Dr. Evazan

Both Premiere Disarmed cards now deploy during either Control phase when each player has an armed character present at the same site. The attached Effect reduces power by one, prevents further weapon deployment/transfer and is immune to Alter. Its mandatory deployment response loses carried weapons with simultaneous Lost-pile ordering before emitting the disarmed event. Dr. Evazan may respond to another character present just hit or disarmed, including a friendly character. Physical references bind the patient and event; an initiated operation survives source departure but cannot affect a returned instance of the patient. His existing pilot bonus and ordinary deployment are also verified.

`tests/native-engine/gemp/disarm-provenance.json` binds four executed GEMP tests and fourteen observations from unchanged production sources. These are controlled component boards, including prepared weapon destiny and a source-departure intervention, not full-match conformance. Native tests additionally cover saved-state validation, duplicate response prevention, weapon carrying/transfer, Alter immunity and computer choices. The computer prefers operating on opponents and passes on friendly patients.

Run `node --test tests/native-engine/disarm.test.mjs` for focused checks and `node tests/native-engine/disarm-browser.mjs` for fifteen Playwright 1.62.1/Chromium 1234 flows through the real HTTP/service/SQLite D1 path at 1440/834/390. Browser cases cover deployment, multiple weapon losses, actual weapon hit, optional operation and decline with refresh at pending and resolved boundaries. No standalone Rules Lab study was added. Production native admission remains closed, and complete-match coverage plus the broader catalog and product requirements remain unfinished.

### Complete Disarmed and Evazan match

A fixed custom 60-card game now replays from ordinary shuffled setup to Light Life Force victory against unchanged pinned GEMP production sources: 2,056 reference decisions, 2,730 native commands and 258 exact checkpoints over 44 turns. Both Disarmed cards deploy; one loses three Blasters with chosen Lost-pile ordering. Evazan operates on that disarmed Rebel Trooper. Actual primary targets and immediate outcome snapshots are bound to their initiating actions, and the verifier rejects altered source, timing, attachments and losses. Initial shuffle permutations supply only lawful entropy; the replay never changes table or pile state to fit the reference.

`tests/native-engine/gemp/disarm-match-provenance.json` binds the exact decks, executed harness, compressed game and source hashes. Thirty-seven focused checks and nine Playwright flows cover both deployments and the operation through the real HTTP/service/SQLite D1 path at 1440/834/390, with pending-action and resolved refresh. Run `node tests/native-engine/disarm-match-browser.mjs` to reproduce those browser checks.

This game operates on a disarmed enemy only. Hit, friendly-patient, decline and source-departure branches retain their separate component evidence. One complete game does not certify every reachable interaction or the full catalog. Production admission remains closed and the full engine/product objective remains unfinished.

### Persistent Disarmed state and Bionic Hand

Disarmed status now belongs to the character's current table instance, independently of an attached Effect's continuous restrictions. It survives Effect removal or canceled text, and ends on rearming or table departure. Bionic Hand uses two Force to deploy on your Disarmed character; its required response rearms that character and cancels attached disarming cards with normal Lost ordering. An active Hand supplies noncumulative power +1 and +1 to the total character-weapon destiny, including two-draw lightsabers and creature attacks. Changes to the Hand during total responses update the total; canceling the weapon's own text does not remove this external modifier. A later Disarmed event loses the Hand through the ordinary loss responses. Host loss still cleans up the attachment.

The native table shows a Disarmed badge and the live weapon destiny arithmetic. Saved continuations retain the original firing user and validate the bonus context. Pre-Hand decks keep their existing destiny continuation format. The new component checks cover costs, legal deployment, mandatory order, all-failed draws, noncumulative bonuses, source changes, malformed saves and refresh through the actual service. `node tests/native-engine/bionic-hand-browser.mjs` exercises nine flows at 1440/834/390 with Playwright 1.62.1/Chromium 1234.

`tests/native-engine/gemp/bionic-hand-provenance.json` binds four executed GEMP tests, seventeen observations and 6,820 unchanged production files. Fifteen observations cover actual deployment/firing and explicit controlled interventions; two are transfer eligibility queries. The [Advanced Rulebook, Bionic Hand entry, p138](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf) confirms one total bonus for multiple weapon draws.

**Unresolved transfer discrepancy:** the pinned GEMP implementation offers transfer even with the Hand's removal-protection modifier, both with active and canceled game text. Native transfer stays guarded pending authoritative clarification of the printed “otherwise, may not be removed” restriction. The query result is recorded as a discrepancy, not advertised as conformance. These component fixtures do not establish complete-game or every-branch Bionic Hand coverage. Full production admission remains closed; no standalone Rules Lab study was added, and the complete engine/product scope remains outstanding.

### Complete Bionic Hand match

The ordinary shuffled60-card match in `tests/native-engine/gemp/bionic-match-provenance.json` records actual Hand deployment, its two-Force payment, required rearming and canceled Disarmed placement. It follows the rearmed character into weapon firing, a second disarming with mandatory Hand loss, and later rearming through Life Force victory. Version9 checkpoints include persistent Disarmed status. Weapon observations bind the actual selected target, original firing user, individual drawn cards and live total; replay supplies lawful initial shuffle entropy without correcting any board or pile state.

`node --test tests/native-engine/bionic-match.test.mjs` rejects corrupted target, payment, attachment, timing and total evidence. `node tests/native-engine/bionic-match-browser.mjs` resumes observed complete-match checkpoints through real HTTP handlers, native service and SQLite D1 at1440/834/390, with pending and resolved refresh. No standalone Rules Lab study is added.

**Separate multiple-Hand discrepancy:** the preserved `bionic-multiple-discrepancy.json.gz` game has Hands on two different characters. At decision641, the second character fires a Blaster with printed destiny0 and GEMP reports total0 despite its active attached Hand. Pinned `ModifiersLogic.getModifiers` globally removes same-title noncumulative `TOTAL_WEAPON_DESTINY` modifiers before `Destiny.getTotalWeaponDestiny` checks each modifier's firing-user filter. This is inconsistent with applying each Hand to its own character; the [Advanced Rulebook's Modifiers rule](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf) limits stacking on the same base value. Native retains the host-scoped bonus. This trace is recorded as a discrepancy, not a passing conformance game. The passing reference client legally keeps at most one Hand attached at a time. Multiple-Hand reference conformance and the prior transfer discrepancy remain unresolved; production admission stays closed and the full engine/product scope remains unfinished.

### Shared Starting Interrupt setup protocol

`starting-interrupts.ts` adds persisted private selection, optional decline, simultaneous reveal and first-player resolution order between starting-location placement and opening shuffle. A card provider owns its legal choices, printed results and result-state validation; it may retain a pending choice across refresh. Both results must complete before the server shuffles and draws eight additional cards. Public history preserves each revealed identity without exposing its subsequent hidden zone. No provider means the existing setup representation and command path remain unchanged.

This follows [Starting the game and Starting Interrupts in the Advanced Rulebook](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf). `starting-interrupt-provenance.json` binds eight ordinary GEMP setups using Prepared Defenses and Heading For The Medical Frigate in decks with no Effects. All play/decline combinations, both turn orders, simultaneous disclosure and final pile counts agree. Lost arrivals are independently observed, not inferred by sorting into the expected order. All6,820 production files remain unchanged.

The test-only provider abstracts those cards' unsuccessful search verification. It does **not** implement their full starting or USED functions, The actual printed provider is described below; full native admission remains closed. The protocol's nine browser flows exercise actual HTTP handlers/service/SQLite D1 with private choices and persisted refresh at1440/834/390. This is engine infrastructure, not a standalone Rules Lab study or a full-match admission claim.

### Prepared Defenses / Heading For The Medical Frigate — USED functions

`preparation-destiny.ts` implements the printed USED functions of Dark9_139 and
Light9_51 in ordinary battle responses. Each adds1 to its own individual physical
battle destiny, respects unique-card play limits, supports Sense cancellation,
and binds the exact pending draw across relocation, reload and nested responses.
A later Han’s Dice redraw discards the earlier bonus. Substituted/failed draws,
opposing destiny, weapon destiny and total-result windows grant no such action.
CPU policy20 chooses the legal bonus using only its player projection.

The unchanged pinned GEMP receipt `gemp/preparation-destiny-provenance.json`
records six actual outcomes: each side’s successful play, Sense cancellation and
response-time destiny relocation. Fixtures explicitly prepare board/Force/hand/
destiny; this is component evidence, not an ordinary complete-match receipt.
The STARTING provider now supports the two implemented eligible Effects below;
metadata remains `component-coverage-only` and production admission stays closed.
Full-match GEMP conformance exercising both functions and additional eligible
Effect providers remain required.

### Do, Or Do Not / There Is No Try

`try-effects.ts` implements ordinary deployment of Light4_21 and Dark4_134,
including free cost, uniqueness and unconditional Alter immunity. While active,
each changes Sense/Alter into Lost Interrupts and independently requires the
performing player to lose2 Force after a successful Sense/Alter destiny. Failed
draws and direct counters do not generate that penalty. The played subtype is
saved at initiation; a subsequent source arrival/departure does not rewrite it.
The ordinary loss pipeline supplies reduction, private payment choices, nested
responses and game completion. CPU policy21 considers its own visible Sense/Alter
hand before deploying an Effect that penalizes both players.

Thirty-two executed GEMP observations cover both sides, Sense/Alter success and
failure under either/both Effects, deployment immunity, and controlled source
arrival/departure/canceled text. All6,820 production source files match the pinned
archive. Native tests additionally verify direct counters, either mandatory order,
source departure after initiation, reduction, final Life Force and invalid saved
continuations. Six Playwright1.62.1/Chromium1234 flows use actual HTTP/service/SQLite
D1 at1440/834/390; both seats refresh between individual payments and between the
two mandatory losses without duplication. These are component fixtures, not a
full-match certification. Starting Interrupt integration is described below;
broader engine scope remains required and full native admission stays closed.

### Starting preparation searches and deployments

`preparation-starting.ts` registers both preparation Interrupts in ordinary
setup. Private Reserve inspection offers the implemented eligible Effect of
each side (4_21 or 4_134), enforces uniqueness, and gives the opponent inspection
only when verifying an unsuccessful search. Actual deployment and arrival
responses resolve before the Interrupt enters Lost and before the other player
resolves their preparation. Both finish before shuffle and eight-card opening
hands. Setup ignores activation, use and loss of Force as required by AR p36;
setup deployment/play history does not consume first-turn allowances.

The provider uses a persisted response stack with private projections, legal
computer choices (policy22), concession, duplicate-command protection and
refresh recovery. Sixteen unchanged GEMP executions compare exact 60-card deck
compositions, both first players, all play/decline combinations, successful and
empty searches, Lost arrival order, table Effects and final pile counts. The
reference chooses its own shuffle; opening-hand identities are not compared.
See `gemp/preparation-starting-provenance.json` for source and result hashes.

Nine Playwright flows cover actual HTTP/service/SQLite D1 at1440/834/390, with
both-seat refresh during private search, deployment and failed verification.
Four CPU-service flows verify durable setup and idempotent requests. Ordinary
40/60-card computer games complete from location choice through Life Force
victory using only legal commands and saved-state round trips. Those complete
native games are integration evidence, not GEMP full-match parity.

This initial receipt covers one unique eligible Effect title per side. The
following iteration extends it to two; the printed three-Effect capacity and
other eligible Effects still need card providers and conformance evidence. Synthetic arrival-response tests establish
shared setup semantics but do not certify unimplemented card interactions.
Full engine/card scope and all existing discrepancies remain outstanding;
production admission is closed. No new Rules Lab study is added.

### Resistance / Ultimatum and two-Effect starts

`resistance.ts` implements Dark6_147 and Light6_58 as free unique table Effects
with unconditional Alter immunity. Their owner's drain and insert Force loss is
capped at2 while that owner occupies at least three battlegrounds or the opponent
occupies none. Occupation uses presence, including contested locations; shielded
Hoth locations and destroyed/iconless locations do not count. Other location
families retain their existing admission boundary and need their own exceptions.

The loss ledger retains the uncapped base and paid credits, rechecking the cap
before each payment. The cap is independent of reducibility and is applied after
ordinary loss modifiers; it cannot limit generic Effect loss or battle damage.
Anger's actual delayed loss carries an explicit insert classification. Public
loss UI shows the remaining amount, original amount, paid credit and current cap.
CPU policy23 deploys the Effect through offered legal actions.

`starting-effects.ts` provides explicit real deployment adapters for these and
the two Sense/Alter Effects. Starting preparation supports two distinct Effects
in either order, uniqueness, and stopping after the first; opening shuffle waits
for both players' results. Three distinct Effects still require more providers.

`gemp/resistance-provenance.json` binds28 component outcomes and8 ordinary60-card
setup outcomes against unchanged GEMP. Component drains use a stable controlled
bonus; insert checks invoke GEMP's production insert-loss primitive. Source
arrival/departure/suppression are explicit fixture interventions. Native Anger
reveal-to-loss integration separately verifies actual card routing. Setup replay
follows the selected blueprint recorded in the trace rather than display order.

Six browser payment flows and nine setup flows exercise actual HTTP handlers,
service and SQLite D1 at1440/834/390, both-seat refresh and private inspection.
Ordinary40/60-card CPU games start with both Effects and finish by Life Force
victory; these native games are integration evidence, not full-match GEMP parity.
Full native admission stays closed. Battle Plan/Order, three-Effect conformance
and all other unfinished engine scope remain required; no new Rules Lab study.
