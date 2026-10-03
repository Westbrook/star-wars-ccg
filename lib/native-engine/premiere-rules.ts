import {astromechActions, astromechInitiate, astromechResolve, assertAstromech} from './astromech';
import {deployEffectActions, deployEffectInitiate, deployEffectResolve, assertDeployEffects} from './deploy-effects';
import {bactaActions, bactaInitiate, bactaResolve, assertBacta} from './bacta';
import {assertStatModifiers} from './stat-modifiers';
import {fxActions, fxInitiate, fxResolve, assertFX} from './fx-droids';
import {forfeitureResolve, assertForfeitures} from './forfeiture';
import {lightsaberActions, lightsaberInitiate, lightsaberResolve, assertLightsaber} from './lightsabers';
import {assertForfeitResets} from './forfeit';
import {trooperAssaultActions, trooperAssaultInitiate, trooperAssaultResolve, assertTrooperAssault} from './trooper-assault';
import {assertCombatModifiers} from './combat-modifiers';
import {assertDuelModifiers} from './duel-modifiers';
import {duelInterruptActions, duelInterruptInitiate, duelInterruptResolve, assertDuelInterrupts} from './duel-interrupts';
import {assertDeployments} from './deployment';
import {phaseEffectActions, phaseEffectAutomatic, phaseEffectInitiate, phaseEffectResolve, assertPhaseEffects} from './phase-effects';
import {abilityEffectActions, abilityEffectInitiate, abilityEffectResolve, assertAbilityEffects} from './ability-effects';
import {assertLocationAbility} from './location-ability';
import {battleEffectActions,battleEffectAutomatic,battleEffectInitiate,battleEffectResolve,assertBattleEffects} from './battle-effects';
import {assertAbility} from './ability';
import {forceEffectActions, forceEffectInitiate, forceEffectResolve, forceEffectChoices, forceEffectChoose, assertForceEffects} from './force-effects';
import {cancellationActions, cancellationInitiate, cancellationResolve, assertCancellation} from './cancellation';
import {actionPlayCard, canPlayCard, recordCardPlay, assertCardPlays} from './persona';
import {assertCharacteristics} from './characteristics';
import {secretPlansAutomatic, secretPlansResolve, secretPlansChoices, secretPlansChoose, assertSecretPlans} from './secret-plans';
import {gamblersLuckActions, gamblersLuckInitiate, gamblersLuckResolve, assertGamblersLuck} from './gamblers-luck';
import {selectionResolve, selectionChoices, selectionChoose, assertDestinySelection} from './destiny-selection';
import {substitutionActions, substitutionInitiate, substitutionResolve, assertSubstitution} from './substitution';
import {gaderffiiActions, gaderffiiInitiate, gaderffiiResolve, assertGaderffii} from './gaderffii';
import {assertWeaponUse} from './weapon-state';
import {stakesActions, stakesInitiate, stakesResolve, assertStakes} from './stakes';
import {doomedActions, doomedInitiate, doomedResolve, doomedView, assertDoomed} from './doomed';
import {worseActions, worseInitiate, worseResolve, assertWorse} from './worse';
import {cardDefinition, citySitesTogether, definition, generation, name, system} from './board';
import {premiereSetup} from './premiere-setup';
import {groundActions, groundAutomatic, groundChoose, groundDecisions, groundInitiate, groundResolve, assertGround, registerReact, resolveCancelledReact, syncForceLosses} from './ground';
import type {Rules} from './runtime';
import type {Json, Side} from './types';
import {assertBattle, battleActions, battleAutomatic, battleCanPass, battleChoose, battleChoices, battleInitiate, battleResolve, battleView, syncBattle} from './battle';
import {equipmentActions, equipmentAutomatic, equipmentInitiate, equipmentResolve, equipmentChoices, equipmentChoose, equipmentView, assertEquipment} from './equipment';
import {resolveDestiny, assertDestiny, destinyChoices, destinyChoose} from './destiny';
import {travelActions, travelInitiate, travelResolve, travelChoices, travelChoose, travelView, assertTravel} from './travel';
import {assertLeaving, tableChoices, tableChoose} from './table';
import {assertInterrupts, interruptActions, interruptInitiate, interruptResolve} from './interrupts';
import {assertRetrieval, retrievalChoices, retrievalChoose, retrievalResolve, retrievalView} from './retrieval';
import {assertCharacterTriggers, characterAutomatic, characterResolve, characterChoices, characterChoose} from './character-triggers';
import {assertRevival, revivalActions, revivalInitiate, revivalResolve} from './revival';
import {accidentActions, accidentInitiate, accidentResolve, accidentChoices, accidentChoose, assertAccident} from './accident';
import {assaultActions, assaultInitiate, assaultResolve, assertAssault} from './assault';
import {scavengeActions, scavengeInitiate, scavengeResolve, scavengeChoices, scavengeChoose, scavengeView, assertScavenge} from './scavenge';
import {scanActions, scanInitiate, scanResolve, scanChoices, scanChoose, scanView, assertScan} from './scan';
import {stunActions, stunInitiate, stunResolve, assertStun} from './stun';
import {medicActions, medicInitiate, medicResolve, assertMedics} from './medics';
import {assertDuel, duelActions, duelInitiate, duelResolve, duelView} from './duel';

/** Composable production implementation in progress. No card is admitted to a
 * public full match until its complete reachable behavior is verified. Tests
 * explicitly override admission to exercise each implemented rule component. */
export const premiereRules: Rules = {
  id: 'premiere-native-1',
  starting: premiereSetup,
  definition: id => {const card = definition(id); return {name: card.name, side: card.side as Side};},
  supports: () => false,
  setupComplete: match => match.setup?.stage === 'complete',
  generation,
  automatic: (m, w) => [...phaseEffectAutomatic(m,w), ...battleEffectAutomatic(m,w), ...groundAutomatic(m, w), ...battleAutomatic(m, w), ...equipmentAutomatic(m, w), ...characterAutomatic(m, w), ...secretPlansAutomatic(m, w)],
  actions: (m, w, side) => [...astromechActions(m,w,side), ...deployEffectActions(m,w,side), ...bactaActions(m,w,side), ...fxActions(m,w,side), ...medicActions(m,w,side), ...lightsaberActions(m,w,side), ...trooperAssaultActions(m,w,side), ...duelInterruptActions(m,w,side), ...phaseEffectActions(m,w,side), ...abilityEffectActions(m,w,side), ...battleEffectActions(m,w,side), ...forceEffectActions(m, w, side), ...cancellationActions(m, w, side), ...groundActions(m, w, side), ...battleActions(m, w, side), ...equipmentActions(m, w, side), ...travelActions(m, w, side), ...interruptActions(m, w, side), ...duelActions(m, w, side), ...revivalActions(m, w, side), ...assaultActions(m, w, side), ...accidentActions(m, w, side), ...stunActions(m, w, side), ...scanActions(m, w, side), ...scavengeActions(m, w, side), ...worseActions(m, w, side), ...doomedActions(m, w, side), ...stakesActions(m, w, side), ...gaderffiiActions(m, w, side), ...substitutionActions(m, w, side), ...gamblersLuckActions(m, w, side)].filter(a => {const card = actionPlayCard(m, a); return !card || canPlayCard(m, card);}),
  initiate: (m, r) => {
    const played = actionPlayCard(m, r.action);
    if (played) {if (!canPlayCard(m, played)) throw Error('Card play limit reached.'); recordCardPlay(m, played);}
    if (r.action.handler.startsWith('character:') || r.action.handler.startsWith('plans:')) return;
    if (r.action.handler.startsWith('astromech:')) astromechInitiate(m,r);
    else if (r.action.handler.startsWith('deploy-effect:')) deployEffectInitiate(m,r);
    else if (r.action.handler.startsWith('bacta:')) bactaInitiate(m,r);
    else if (r.action.handler.startsWith('fx:')) fxInitiate(m,r);
    else if (r.action.handler.startsWith('medic:')) medicInitiate(m,r);
    else if (r.action.handler.startsWith('saber:')) lightsaberInitiate(m,r);
    else if (r.action.handler.startsWith('trooper-assault:')) trooperAssaultInitiate(m,r);
    else if (r.action.handler.startsWith('duel-interrupt:')) duelInterruptInitiate(m,r);
    else if (r.action.handler.startsWith('phase-effect:')) phaseEffectInitiate(m,r);
    else if (r.action.handler.startsWith('ability-effect:')) abilityEffectInitiate(m,r);
    else if (r.action.handler.startsWith('battle-effect:')) battleEffectInitiate(m,r);
    else if (r.action.handler.startsWith('force-effect:')) forceEffectInitiate(m, r);
    else if (r.action.handler.startsWith('cancel:')) cancellationInitiate(m, r);
    else if (r.action.handler.startsWith('gambler:')) gamblersLuckInitiate(m, r);
    else if (r.action.handler.startsWith('substitution:')) substitutionInitiate(m, r);
    else if (r.action.handler.startsWith('gaffi:')) gaderffiiInitiate(m, r);
    else if (r.action.handler.startsWith('stakes:')) stakesInitiate(m, r);
    else if (r.action.handler.startsWith('doomed:')) doomedInitiate(m, r);
    else if (r.action.handler.startsWith('worse:')) worseInitiate(m, r);
    else if (r.action.handler.startsWith('scavenge:')) scavengeInitiate(m, r);
    else if (r.action.handler.startsWith('scan:')) scanInitiate(m, r);
    else if (r.action.handler.startsWith('stun:')) stunInitiate(m, r);
    else if (r.action.handler.startsWith('accident:')) accidentInitiate(m, r);
    else if (r.action.handler.startsWith('assault:')) assaultInitiate(m, r);
    else if (r.action.handler.startsWith('revival:')) revivalInitiate(m, r);
    else if (r.action.handler.startsWith('duel:')) duelInitiate(m, r);
    else if (r.action.handler.startsWith('interrupt:')) interruptInitiate(m, r);
    else if (r.action.handler.startsWith('travel:')) travelInitiate(m, r);
    else if (r.action.handler.startsWith('equipment:')) equipmentInitiate(m, r);
    else if (r.action.handler.startsWith('battle:')) {
      const p = r.action.payload as {react?: boolean; card?: string};
      if (p.react) registerReact(m, p.card!);
      battleInitiate(m, r);
    } else groundInitiate(m, r);
  },
  resolve: (m, r, context) => {
    if (resolveCancelledReact(m, r)) { /* Shared cancellation owns react disposal and restrictions. */ }
    else if (r.action.handler.startsWith('astromech:')) astromechResolve(m,r);
    else if (r.action.handler.startsWith('deploy-effect:')) deployEffectResolve(m,r);
    else if (r.action.handler.startsWith('bacta:')) bactaResolve(m,r);
    else if (r.action.handler.startsWith('forfeiture:')) forfeitureResolve(m,r);
    else if (r.action.handler.startsWith('fx:')) fxResolve(m,r);
    else if (r.action.handler.startsWith('medic:')) medicResolve(m,r);
    else if (r.action.handler.startsWith('saber:')) lightsaberResolve(m,r);
    else if (r.action.handler.startsWith('trooper-assault:')) trooperAssaultResolve(m,r);
    else if (r.action.handler.startsWith('duel-interrupt:')) duelInterruptResolve(m,r);
    else if (r.action.handler.startsWith('phase-effect:')) phaseEffectResolve(m,r);
    else if (r.action.handler.startsWith('ability-effect:')) abilityEffectResolve(m,r);
    else if (r.action.handler.startsWith('battle-effect:')) battleEffectResolve(m,r);
    else if (r.action.handler.startsWith('force-effect:')) forceEffectResolve(m, r);
    else if (r.action.handler.startsWith('cancel:')) cancellationResolve(m, r);
    else if (r.action.handler.startsWith('plans:')) secretPlansResolve(m, r);
    else if (r.action.handler.startsWith('gambler:')) gamblersLuckResolve(m, r);
    else if (r.action.handler.startsWith('substitution:')) substitutionResolve(m, r);
    else if (r.action.handler.startsWith('gaffi:')) gaderffiiResolve(m, r);
    else if (r.action.handler.startsWith('stakes:')) stakesResolve(m, r);
    else if (r.action.handler.startsWith('doomed:')) doomedResolve(m, r);
    else if (r.action.handler.startsWith('worse:')) worseResolve(m, r);
    else if (r.action.handler.startsWith('scavenge:')) scavengeResolve(m, r);
    else if (r.action.handler.startsWith('scan:')) scanResolve(m, r);
    else if (r.action.handler.startsWith('stun:')) stunResolve(m, r);
    else if (r.action.handler.startsWith('accident:')) accidentResolve(m, r);
    else if (r.action.handler.startsWith('assault:')) assaultResolve(m, r);
    else if (r.action.handler.startsWith('revival:')) revivalResolve(m, r);
    else if (r.action.handler.startsWith('duel:')) duelResolve(m, r);
    else if (r.action.handler.startsWith('character:')) characterResolve(m, r);
    else if (r.action.handler.startsWith('interrupt:')) interruptResolve(m, r, context);
    else if (r.action.handler.startsWith('retrieval:')) retrievalResolve(m, r);
    else if (r.action.handler.startsWith('travel:')) travelResolve(m, r, context);
    else if (r.action.handler.startsWith('selection:')) selectionResolve(m, r);
    else if (r.action.handler.startsWith('destiny:')) resolveDestiny(m, r);
    else if (r.action.handler.startsWith('equipment:')) equipmentResolve(m, r);
    else if (r.action.handler.startsWith('battle:')) battleResolve(m, r);
    else groundResolve(m, r);
    syncBattle(m);
    syncForceLosses(m);
  },
  decisions: (m, d) => {
    if (d.handler === 'destiny:value') return destinyChoices(m,d);
    if (d.handler.startsWith('force-effect:')) return forceEffectChoices(m, d);
    if (d.handler.startsWith('plans:')) return secretPlansChoices(m, d);
    if (d.handler.startsWith('selection:')) return selectionChoices(m, d);
    if (d.handler.startsWith('scavenge:')) return scavengeChoices(m, d);
    if (d.handler.startsWith('scan:')) return scanChoices(m, d);
    if (d.handler.startsWith('accident:')) return accidentChoices(m, d);
    if (d.handler.startsWith('character:')) return characterChoices(m, d);
    if (d.handler.startsWith('retrieval:')) return retrievalChoices(m, d);
    if (d.handler.startsWith('travel:')) return travelChoices(m, d);
    if (d.handler.startsWith('equipment:')) return equipmentChoices(m, d);
    if (d.handler === 'table:lost-order') return tableChoices(m, d);
    if (d.handler === 'battle:destiny') return battleChoices(m, d);
    return groundDecisions(m, d);
  },
  choose: (m, d, c, context) => {
    if (d.handler === 'destiny:value') destinyChoose(m,d,c);
    else if (d.handler.startsWith('force-effect:')) forceEffectChoose(m, d, c);
    else if (d.handler.startsWith('plans:')) secretPlansChoose(m, d, c);
    else if (d.handler.startsWith('selection:')) selectionChoose(m, d, c);
    else if (d.handler.startsWith('scavenge:')) scavengeChoose(m, d, c);
    else if (d.handler.startsWith('scan:')) scanChoose(m, d, c);
    else if (d.handler.startsWith('accident:')) accidentChoose(m, d, c);
    else if (d.handler.startsWith('character:')) characterChoose(m, d, c);
    else if (d.handler.startsWith('retrieval:')) retrievalChoose(m, d, c);
    else if (d.handler.startsWith('travel:')) travelChoose(m, d, c, context);
    else if (d.handler.startsWith('equipment:')) equipmentChoose(m, d, c);
    else if (d.handler === 'table:lost-order') tableChoose(m, d, c);
    else if (d.handler === 'battle:destiny') battleChoose(m, d, c);
    else groundChoose(m, d, c);
    syncBattle(m);
    syncForceLosses(m);
  },
  canPass: battleCanPass,
  view: (m, seat, now) => ({...doomedView(m) as Record<string, Json>, ...scavengeView(m) as Record<string, Json>, ...scanView(m, seat) as Record<string, Json>, ...battleView(m) as Record<string, Json>, ...equipmentView(m, seat) as Record<string, Json>, ...travelView(m, seat) as Record<string, Json>, ...retrievalView(m) as Record<string, Json>, ...duelView(m) as Record<string, Json>}),
  validate: match => {
    assertAstromech(match);
    assertDeployments(match);
    assertPhaseEffects(match);
    assertAbility(match);
    assertLocationAbility(match);
    assertAbilityEffects(match);
    assertBattleEffects(match);
    assertForceEffects(match);
    assertSecretPlans(match);
    assertGround(match);
    assertEquipment(match);
    assertTravel(match);
    assertDestiny(match);
    assertDestinySelection(match);
    assertSubstitution(match);
    assertGamblersLuck(match);
    assertRetrieval(match);
    assertCharacteristics(match);
    assertCardPlays(match);
    assertCancellation(match);
    assertInterrupts(match);
    assertCharacterTriggers(match);
    assertDuel(match);
    assertDuelModifiers(match);
    assertCombatModifiers(match);
    assertStatModifiers(match); assertMedics(match); assertFX(match); assertBacta(match); assertDeployEffects(match); assertForfeitures(match);
    assertLightsaber(match); assertForfeitResets(match);
    assertTrooperAssault(match);
    assertDuelInterrupts(match);
    assertRevival(match);
    assertAssault(match);
    assertAccident(match);
    assertStun(match);
    assertScan(match);
    assertScavenge(match);
    assertWorse(match);
    assertDoomed(match);
    assertStakes(match);
    assertGaderffii(match);
    assertWeaponUse(match);
    assertBattle(match);
    assertLeaving(match);
    if (!citySitesTogether(match, match.locations)) throw Error('Mos Eisley sites must remain together.');
    if (new Set(match.locations.map(id => name(match, id))).size !== match.locations.length) throw Error('Duplicate active location identity.');
    const groups = new Set(match.locations.map(id => system(match, id)));
    for (const group of groups) {
      if (!group) throw Error('Location needs its rule metadata.');
      const indices = match.locations.map((id, i) => system(match, id) === group ? i : -1).filter(i => i >= 0);
      if (indices.some((i, n) => n > 0 && i !== indices[n - 1] + 1)) throw Error('A system must form one contiguous location group.');
      const ranks = indices.map(i => {
        const icons = cardDefinition(match, match.locations[i]).icons as string[];
        return icons.includes('Interior') && icons.includes('Exterior') ? 1 : icons.includes('Interior') ? 0 : 2;
      });
      if (!ranks.every((rank, n) => !n || rank >= ranks[n - 1]) && !ranks.every((rank, n) => !n || rank <= ranks[n - 1])) throw Error('Invalid interior/exterior site arrangement.');
    }
    for (const card of Object.values(match.cards)) {
      const def = cardDefinition(match, card.id);
      if (card.location && !match.locations.includes(card.location)) throw Error('Character or attachment refers to an inactive location.');
      if (card.zone === 'table' && def.type === 'Character' && !card.location) throw Error('A ground character needs its site.');
      if (card.coveredBy && (def.type !== 'Location' || !match.locations.includes(card.coveredBy) || name(match, card.id) !== name(match, card.coveredBy))) throw Error('Invalid supporting location.');
      if (card.zone === 'table' && def.type === 'Location' && !card.coveredBy && !match.locations.includes(card.id)) throw Error('Missing active location.');
      if (card.attachedTo && card.location !== match.cards[card.attachedTo].location) throw Error('Attachment separated from its host.');
    }
  },
};
