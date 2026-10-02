import {cardDefinition, citySitesTogether, definition, generation, name, system} from './board';
import {premiereSetup} from './premiere-setup';
import {groundActions, groundAutomatic, groundChoose, groundDecisions, groundInitiate, groundResolve, assertGround, registerReact} from './ground';
import type {Rules} from './runtime';
import type {Json, Side} from './types';
import {assertBattle, battleActions, battleAutomatic, battleCanPass, battleChoose, battleChoices, battleInitiate, battleResolve, battleView, syncBattle} from './battle';
import {equipmentActions, equipmentAutomatic, equipmentInitiate, equipmentResolve, equipmentChoices, equipmentChoose, equipmentView, assertEquipment} from './equipment';
import {resolveDestiny, assertDestiny} from './destiny';
import {travelActions, travelInitiate, travelResolve, travelChoices, travelChoose, travelView, assertTravel} from './travel';
import {assertLeaving, tableChoices, tableChoose} from './table';
import {assertInterrupts, interruptActions, interruptInitiate, interruptResolve} from './interrupts';
import {assertRetrieval, retrievalChoices, retrievalChoose, retrievalResolve, retrievalView} from './retrieval';
import {assertCharacterTriggers, characterAutomatic, characterResolve, characterChoices, characterChoose} from './character-triggers';
import {assertRevival, revivalActions, revivalInitiate, revivalResolve} from './revival';
import {accidentActions, accidentInitiate, accidentResolve, accidentChoices, accidentChoose, assertAccident} from './accident';
import {assaultActions, assaultInitiate, assaultResolve, assertAssault} from './assault';
import {stunActions, stunInitiate, stunResolve, assertStun} from './stun';
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
  automatic: (m, w) => [...groundAutomatic(m, w), ...battleAutomatic(m, w), ...equipmentAutomatic(m, w), ...characterAutomatic(m, w)],
  actions: (m, w, side) => [...groundActions(m, w, side), ...battleActions(m, w, side), ...equipmentActions(m, w, side), ...travelActions(m, w, side), ...interruptActions(m, w, side), ...duelActions(m, w, side), ...revivalActions(m, w, side), ...assaultActions(m, w, side), ...accidentActions(m, w, side), ...stunActions(m, w, side)],
  initiate: (m, r) => {
    if (r.action.handler.startsWith('character:')) return;
    if (r.action.handler.startsWith('stun:')) stunInitiate(m, r);
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
    if (r.action.handler.startsWith('stun:')) stunResolve(m, r);
    else if (r.action.handler.startsWith('accident:')) accidentResolve(m, r);
    else if (r.action.handler.startsWith('assault:')) assaultResolve(m, r);
    else if (r.action.handler.startsWith('revival:')) revivalResolve(m, r);
    else if (r.action.handler.startsWith('duel:')) duelResolve(m, r);
    else if (r.action.handler.startsWith('character:')) characterResolve(m, r);
    else if (r.action.handler.startsWith('interrupt:')) interruptResolve(m, r, context);
    else if (r.action.handler.startsWith('retrieval:')) retrievalResolve(m, r);
    else if (r.action.handler.startsWith('travel:')) travelResolve(m, r, context);
    else if (r.action.handler.startsWith('destiny:')) resolveDestiny(m, r);
    else if (r.action.handler.startsWith('equipment:')) equipmentResolve(m, r);
    else if (r.action.handler.startsWith('battle:')) battleResolve(m, r);
    else groundResolve(m, r);
    syncBattle(m);
  },
  decisions: (m, d) => {
    if (d.handler.startsWith('accident:')) return accidentChoices(m, d);
    if (d.handler.startsWith('character:')) return characterChoices(m, d);
    if (d.handler.startsWith('retrieval:')) return retrievalChoices(m, d);
    if (d.handler.startsWith('travel:')) return travelChoices(m, d);
    if (d.handler.startsWith('equipment:')) return equipmentChoices(m, d);
    if (d.handler === 'table:lost-order') return tableChoices(m, d);
    if (d.handler === 'battle:destiny') return battleChoices();
    return groundDecisions(m, d);
  },
  choose: (m, d, c, context) => {
    if (d.handler.startsWith('accident:')) accidentChoose(m, d, c);
    else if (d.handler.startsWith('character:')) characterChoose(m, d, c);
    else if (d.handler.startsWith('retrieval:')) retrievalChoose(m, d, c);
    else if (d.handler.startsWith('travel:')) travelChoose(m, d, c, context);
    else if (d.handler.startsWith('equipment:')) equipmentChoose(m, d, c);
    else if (d.handler === 'table:lost-order') tableChoose(m, d, c);
    else if (d.handler === 'battle:destiny') battleChoose(m, d, c);
    else groundChoose(m, d, c);
  },
  canPass: battleCanPass,
  view: (m, seat) => ({...battleView(m) as Record<string, Json>, ...equipmentView(m, seat) as Record<string, Json>, ...travelView(m, seat) as Record<string, Json>, ...retrievalView(m) as Record<string, Json>, ...duelView(m) as Record<string, Json>}),
  validate: match => {
    assertGround(match);
    assertEquipment(match);
    assertTravel(match);
    assertDestiny(match);
    assertRetrieval(match);
    assertInterrupts(match);
    assertCharacterTriggers(match);
    assertDuel(match);
    assertRevival(match);
    assertAssault(match);
    assertAccident(match);
    assertStun(match);
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
