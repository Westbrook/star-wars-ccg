import {piles, sides, type Card, type Deck, type Definition, type Match, type Pile, type Player, type Side, type Zone} from './types';
import {shuffled, type Entropy} from './random';

const emptyPlayer = (): Player => ({reserve: [], force: [], used: [], lost: [], hand: [], destiny: []});
export const isPile = (zone: Zone): zone is Pile => (piles as readonly string[]).includes(zone);

/** Deck size is an explicit format choice: 40 is the product's open-play variant. */
export function initialState(id: string, size: 40 | 60, decks: readonly Deck[], rules: string,
  definition: (blueprint: string) => Definition): Match {
  if (!id || !rules || ![40, 60].includes(size) || decks.length !== 2 || new Set(decks.map(d => d.side)).size !== 2)
    throw Error('Specify one deck for each side and a 40- or 60-card format.');
  const match: Match = {
    schema: 1, engine: 'native-engine-1', rules, id, revision: 0, deckSize: size, status: 'setup',
    cards: {}, players: {dark: emptyPlayer(), light: emptyPlayer()}, locations: [],
    turn: {number: 1, side: 'dark', phase: 'activate', generation: 0, activated: 0},
    stack: [], serial: 0, data: {}, result: null,
  };
  for (const deck of decks) {
    if (!sides.includes(deck.side) || deck.cards.length !== size) throw Error('Invalid deck size or side.');
    for (const [index, blueprint] of deck.cards.entries()) {
      if (definition(blueprint).side !== deck.side) throw Error('A deck contains a card from the opposing side.');
      const cardId = `${deck.side}-${index + 1}`;
      match.cards[cardId] = {id: cardId, blueprint, owner: deck.side, zone: 'reserve'};
      match.players[deck.side].reserve.push(cardId);
    }
  }
  assertState(match);
  return match;
}

export function lifeForce(match: Match, side: Side): number {
  const p = match.players[side];
  // Unresolved destiny cards still count as Life Force (AR, Drawing Destiny).
  return p.reserve.length + p.force.length + p.used.length + p.destiny.length;
}

/** Primitive only: a rules handler must resolve leave-table consequences first. */
export function moveCard(match: Match, id: string, zone: Zone, position: 'top' | 'bottom' = 'top'): void {
  const card = match.cards[id];
  if (!card || ![...piles, 'table', 'playing', 'leaving', 'out'].includes(zone)) throw Error('Invalid card movement.');
  if (card.zone === 'table' && (match.locations.includes(id) || Object.values(match.cards).some(c => c.attachedTo === id || c.location === id || c.coveredBy === id)))
    throw Error('Resolve dependent cards before moving their host.');
  if (isPile(card.zone)) {
    const pile = match.players[card.owner][card.zone], index = pile.indexOf(id);
    if (index < 0) throw Error('Card is missing from its pile.');
    pile.splice(index, 1);
  }
  card.zone = zone;
  delete card.location; delete card.attachedTo; delete card.coveredBy;
  if (isPile(zone)) {
    const pile = match.players[card.owner][zone];
    if (position === 'bottom') pile.push(id); else pile.unshift(id);
  }
}

export function moveTop(match: Match, side: Side, from: Pile, to: Pile): string {
  const id = match.players[side][from][0];
  if (!id) throw Error('The source pile is empty.');
  moveCard(match, id, to);
  return id;
}

export function useForce(match: Match, payment: Partial<Record<Side, number>>): void {
  // Validate both players before paying anything (e.g. Jawa deployment).
  if (Object.keys(payment).some(key => !(sides as readonly string[]).includes(key))) throw Error('Invalid payment side.');
  for (const side of sides) {
    const amount = payment[side] ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > match.players[side].force.length)
      throw Error('Insufficient Force or invalid payment.');
  }
  for (const side of sides) for (let n = 0; n < (payment[side] ?? 0); n++) moveTop(match, side, 'force', 'used');
}

export function recirculate(match: Match): void {
  for (const side of sides) {
    const player = match.players[side];
    // Used top-to-bottom goes under Reserve without reversing its order.
    for (const id of [...player.used]) moveCard(match, id, 'reserve', 'bottom');
  }
}

export function shufflePile(match: Match, side: Side, pile: Pile, entropy?: Entropy): void {
  match.players[side][pile] = shuffled(match.players[side][pile], entropy);
}

export function assertState(match: Match): void {
  assertSerializable(match);
  if (match.schema !== 1 || match.engine !== 'native-engine-1' || !match.rules || !match.id ||
      !Number.isSafeInteger(match.revision) || match.revision < 0 || ![40, 60].includes(match.deckSize)) throw Error('Invalid engine state.');
  if (!['setup', 'playing', 'finished'].includes(match.status) || (match.status === 'finished') !== !!match.result) throw Error('Invalid match status.');
  if (match.result && (!sides.includes(match.result.winner) || !sides.includes(match.result.loser) || match.result.winner === match.result.loser || !['concession', 'life-force'].includes(match.result.reason))) throw Error('Invalid match result.');
  const seen = new Set<string>();
  for (const side of sides) {
    for (const pile of piles) {
      if (!Array.isArray(match.players[side][pile])) throw Error('Invalid pile.');
      for (const id of match.players[side][pile]) {
        const card = match.cards[id];
        if (seen.has(id) || !card || card.owner !== side || card.zone !== pile) throw Error('Card conservation or ownership violation.');
        seen.add(id);
      }
    }
    if (Object.values(match.cards).filter(c => c.owner === side).length !== match.deckSize) throw Error('Physical deck size changed.');
  }
  for (const [id, card] of Object.entries(match.cards)) {
    if (id !== card.id || !card.blueprint || !sides.includes(card.owner) || ![...piles, 'table', 'playing', 'leaving', 'out'].includes(card.zone)) throw Error('Invalid physical card.');
    if (isPile(card.zone) !== seen.has(id)) throw Error('Card missing from pile or listed outside its zone.');
    for (const key of ['location', 'attachedTo', 'coveredBy'] as const) {
      const target = card[key];
      if (target && (card.zone !== 'table' || target === id || match.cards[target]?.zone !== 'table')) throw Error('Invalid table relation.');
    }
    const visiting = new Set<string>([id]);
    let current: Card | undefined = card;
    while (current?.attachedTo || current?.coveredBy) {
      const parent: string = current.attachedTo || current.coveredBy!;
      if (visiting.has(parent)) throw Error('Cyclic table relation.');
      visiting.add(parent); current = match.cards[parent];
    }
  }
  if (new Set(match.locations).size !== match.locations.length || match.locations.some(id => match.cards[id]?.zone !== 'table' || match.cards[id].coveredBy)) throw Error('Invalid active locations.');
  if (!Number.isSafeInteger(match.turn.number) || match.turn.number < 1 || !sides.includes(match.turn.side) || !['activate', 'control', 'deploy', 'battle', 'move', 'draw'].includes(match.turn.phase) ||
      !Number.isSafeInteger(match.turn.generation) || match.turn.generation < 0 || !Number.isSafeInteger(match.turn.activated) || match.turn.activated < 0 || match.turn.activated > match.turn.generation) throw Error('Invalid turn.');
  if (!Number.isSafeInteger(match.serial) || match.serial < 0 || !Array.isArray(match.stack)) throw Error('Invalid action stack.');
  const serials = new Set<number>();
  for (const frame of match.stack) {
    if (frame.kind === 'window') {
      if (!Number.isSafeInteger(frame.serial) || frame.serial < 1 || frame.serial > match.serial || serials.has(frame.serial) ||
          !['start', 'phase', 'end', 'response'].includes(frame.timing) || !sides.includes(frame.priority) || ![0, 1].includes(frame.passes) ||
          !Array.isArray(frame.completed) || new Set(frame.completed).size !== frame.completed.length) throw Error('Invalid timing window.');
      serials.add(frame.serial);
    } else if (frame.kind === 'resolution') {
      if (!sides.includes(frame.actor) || typeof frame.cancelled !== 'boolean' || frame.awaitingResponses !== undefined && typeof frame.awaitingResponses !== 'boolean' || !frame.action?.id || !frame.action.handler) throw Error('Invalid pending action.');
    } else if (frame.kind === 'decision') {
      if (!sides.includes(frame.side) || !frame.handler) throw Error('Invalid pending decision.');
    } else throw Error('Unknown continuation.');
  }
}

function assertSerializable(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || ancestors.has(value) ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) throw Error('State must contain only serializable JSON data.');
  ancestors.add(value);
  for (const child of Object.values(value)) assertSerializable(child, ancestors);
  ancestors.delete(value);
}

/** No seed, hidden pile order, opponent hand identities, or handler payloads leave the server. */
export function publicState(match: Match, seat: Side) {
  if (!sides.includes(seat)) throw Error('Invalid seat.');
  const shown = (ids: string[]) => ids.map(id => ({...match.cards[id]}));
  return {
    id: match.id, revision: match.revision, status: match.status, turn: {...match.turn}, result: match.result && {...match.result},
    players: Object.fromEntries(sides.map(side => [side, {
      counts: Object.fromEntries(piles.map(pile => [pile, match.players[side][pile].length])),
      lifeForce: lifeForce(match, side), hand: side === seat ? shown(match.players[side].hand) : [],
      lost: shown(match.players[side].lost), destiny: shown(match.players[side].destiny),
    }])),
    table: shown(Object.values(match.cards).filter(c => c.zone === 'table' || c.zone === 'playing' || c.zone === 'leaving').map(c => c.id)),
    locations: [...match.locations],
  };
}
