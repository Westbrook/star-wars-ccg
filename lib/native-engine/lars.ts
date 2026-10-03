import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {hasPersona} from './persona';
import {groundPresent} from './participation';
import {assertCardReference, sameCard, type CardReference} from './identity';
import {lostFromActiveTable} from './loss-origin';
import type {RequiredAction} from './runtime';
import {other, type Json, type Match, type Resolution, type Window} from './types';

type Effect = {source: CardReference; turn: number; applied: boolean};
type Payload = Pick<Effect,'source'|'turn'>;
const effects = (m: Match) => (m.data.larsEffects ?? []) as unknown as Effect[];
const isLars = (m: Match,id:string) => ['1_2','1_22'].includes(m.cards[id]?.blueprint);
const matching = (a: Payload,b: Payload) => a.source.id === b.source.id && a.source.version === b.source.version && a.turn === b.turn;
const at = (m: Match,id:string) => m.cards[id].location ?? (m.locations.includes(m.cards[id].attachedTo ?? '') ? m.cards[id].attachedTo : undefined);
function partner(m: Match,id:string,names:string[],active:(id:string)=>boolean): boolean {
  const site = at(m,id);
  return !!site && Object.values(m.cards).some(c => c.id !== id && c.zone === 'table' && !c.coveredBy && at(m,c.id) === site &&
    names.includes(cardDefinition(m,c.id).name) && (cardDefinition(m,c.id).type !== 'Character' || active(c.id) && groundPresent(m,c.id)));
}
export const larsForfeitBonus = (m: Match,id:string,active:(id:string)=>boolean) => m.cards[id].blueprint === '1_2' && gameTextActive(m,id) && groundPresent(m,id) &&
  partner(m,id,['Owen Lars','Hydroponics Station'],active) ? 2 : 0;
export function larsPowerBonus(m: Match,id:string,active:(id:string)=>boolean): number {
  const own = m.cards[id].blueprint === '1_22' && gameTextActive(m,id) && groundPresent(m,id) && partner(m,id,['Beru Lars','Vaporator'],active) ? 2 : 0;
  if (cardDefinition(m,id).type !== 'Character' || !hasPersona(m,id,'LUKE')) return own;
  // A global persona modifier: Luke need not be in play when it resolves, and
  // later Luke instances and Luke cards in other zones also benefit (AR pp27-28). Different titles combine; copies don't.
  const titles = new Set(effects(m).filter(e => e.applied && m.turn.number <= e.turn + 1).map(e => cardDefinition(m,e.source.id).name));
  return own + titles.size * 3;
}
export function larsAutomatic(m: Match,w:Window): RequiredAction[] {
  const event = w.event as {kind?:string; cardRefs?:CardReference[]} | undefined;
  if (w.timing !== 'response' || !['forfeited','character-lost','cards-lost'].includes(event?.kind ?? '')) return [];
  return (event?.cardRefs ?? []).filter(ref => isLars(m,ref.id) && sameCard(m,ref)).flatMap(source => {
    const origin = lostFromActiveTable(m,source.id), owner = m.cards[source.id].owner, p = {source,turn:m.turn.number};
    if (!origin || origin.turn !== m.turn.number || origin.side !== other(owner) || effects(m).some(e=>matching(e,p))) return [];
    return [{id:'lars:loss:'+source.id+':'+source.version,label:cardDefinition(m,source.id).name+' · Luke is power +3 through your next turn',
      handler:'lars:loss',source:source.id,actor:owner,payload:p as unknown as Json}];
  });
}
export function larsInitiate(m: Match,r:Resolution): void {
  const p = r.action.payload as unknown as Payload;
  if (!sameCard(m,p.source) || !lostFromActiveTable(m,p.source.id) || effects(m).some(e=>matching(e,p))) throw Error('Lars loss was already handled or has departed.');
  m.data.larsEffects = [...effects(m).filter(e=>e.turn+1>=m.turn.number),{...p,applied:false}] as unknown as Json;
}
export function larsResolve(m: Match,r:Resolution): void {
  const p = r.action.payload as unknown as Payload, entry = effects(m).find(e=>matching(e,p));
  if (!entry) throw Error('Missing Lars loss initiation.');
  // Resolving an initiated trigger does not require its source still in Lost.
  if (!r.cancelled) entry.applied = true;
}
function assertPayload(m: Match,p:Payload): void {
  if (!p || !Number.isSafeInteger(p.turn) || p.turn < 1 || p.turn > m.turn.number) throw Error('Invalid Lars duration.');
  assertCardReference(m,p.source);
  if (p.source.zone !== 'lost' || !isLars(m,p.source.id)) throw Error('Invalid Lars loss source.');
}
export function assertLars(m: Match): void {
  if (m.data.larsEffects !== undefined && !Array.isArray(m.data.larsEffects)) throw Error('Invalid Lars effects.');
  const seen = new Set<string>();
  for (const e of effects(m)) {
    assertPayload(m,e); const key = e.source.id+':'+e.source.version;
    if (typeof e.applied !== 'boolean' || seen.has(key)) throw Error('Invalid repeated Lars loss.'); seen.add(key);
  }
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('lars:')) {
    const p = f.action.payload as unknown as Payload; assertPayload(m,p);
    if (f.action.handler !== 'lars:loss' || f.action.source !== p.source.id || f.actor !== m.cards[p.source.id].owner || !effects(m).some(e=>matching(e,p))) throw Error('Invalid pending Lars trigger.');
  }
}
