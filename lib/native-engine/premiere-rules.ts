import {cardDefinition, definition, generation, name, system} from './board';
import {premiereSetup} from './premiere-setup';
import {groundActions, groundAutomatic, groundChoose, groundDecisions, groundInitiate, groundResolve, assertGround} from './ground';
import type {Rules} from './runtime';
import type {Side} from './types';
import {assertBattle, battleActions, battleAutomatic, battleCanPass, battleChoose, battleChoices, battleInitiate, battleResolve, battleView, syncBattle} from './battle';
import {assertLeaving, tableChoices, tableChoose} from './table';

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
  automatic: (m, w) => [...groundAutomatic(m, w), ...battleAutomatic(m, w)],
  actions: (m, w, side) => [...groundActions(m, w, side), ...battleActions(m, w, side)],
  initiate: (m, r) => {if (r.action.handler.startsWith('battle:')) battleInitiate(m, r); else groundInitiate(m, r);},
  resolve: (m, r) => {if (r.action.handler.startsWith('battle:')) battleResolve(m, r); else groundResolve(m, r); syncBattle(m);},
  decisions: (m, d) => d.handler === 'table:lost-order' ? tableChoices(m, d) : d.handler === 'battle:destiny' ? battleChoices() : groundDecisions(m, d),
  choose: (m, d, c) => {if (d.handler === 'table:lost-order') tableChoose(m, d, c); else if (d.handler === 'battle:destiny') battleChoose(m, d, c); else groundChoose(m, d, c);},
  canPass: battleCanPass,
  view: battleView,
  validate: match => {
    assertGround(match);
    assertBattle(match);
    assertLeaving(match);
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
