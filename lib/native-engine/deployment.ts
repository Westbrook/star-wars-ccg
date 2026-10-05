import {ability} from './ability';
import {gameTextActive} from './game-text';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {openWindow} from './runtime';
import {other, sides, type Json, type Match, type Phase, type Side} from './types';

export type Deployment = {card: CardReference; side: Side; turn: number; phase: Phase;
  serial: number; ability: number; observers: CardReference[]; inactiveObservers?: CardReference[]};
const records = (m: Match) => (m.data.deployments ?? []) as unknown as Deployment[];
function deploymentObservers(m: Match) {
  const observers = Object.values(m.cards).filter(c => c.zone === 'table').sort((a,b) => a.id.localeCompare(b.id)).map(c => referenceCard(m, c.id));
  const inactiveObservers = observers.filter(ref => !gameTextActive(m, ref.id));
  return {observers, ...(inactiveObservers.length ? {inactiveObservers} : {})};
}
/** Record successful entry before any arrival response changes the card. Merely
 * moving a card to table (setup, revival, transfer) is not deployment. */
export function deployed(m: Match, card: string): void {
  if (m.cards[card]?.zone !== 'table') throw Error('Deployment requires a card on table.');
  const entry: Deployment = {card: referenceCard(m, card), side: m.cards[card].owner,
    turn: m.turn.number, phase: m.turn.phase, serial: m.serial + 1, ability: ability(m, card),
    ...deploymentObservers(m)};
  if (records(m).some(d => d.card.id === card && d.card.version === entry.card.version)) throw Error('Deployment already recorded.');
  m.data.deployments = [...records(m).filter(d => d.turn === m.turn.number), entry] as unknown as Json;
  openWindow(m, 'response', other(entry.side), {kind: 'deployed', card});
}
/** Both cards are on table before one shared arrival opportunity. History uses
 * separate monotonic IDs so existing deployment records remain unambiguous. */
export function deployedTogether(m:Match,ship:string,pilot:string):void {
 const ids=[ship,pilot];if(ship===pilot||ids.some(id=>m.cards[id]?.zone!=='table')||m.cards[pilot].attachedTo!==ship)throw Error('Invalid simultaneous deployment.');
 for(const id of ids){
  if(records(m).some(d=>d.card.id===id&&sameCard(m,d.card)))throw Error('Deployment already recorded.');
  const entry:Deployment={card:referenceCard(m,id),side:m.cards[id].owner,turn:m.turn.number,phase:m.turn.phase,serial:++m.serial,ability:ability(m,id),...deploymentObservers(m)};
  m.data.deployments=[...records(m).filter(d=>d.turn===m.turn.number),entry] as unknown as Json;
 }
 openWindow(m,'response',other(m.cards[ship].owner),{kind:'deployed',card:pilot,cards:ids,simultaneous:true});
}
export function deployedAbilityDuringPhase(m: Match, observer: string, side: Side, phase: Phase): boolean {
  return records(m).some(d => d.turn === m.turn.number && d.phase === phase && d.side === side && d.ability > 0 &&
    d.observers.some(ref => ref.id === observer && sameCard(m, ref)) && !d.inactiveObservers?.some(ref => ref.id === observer));
}
export function assertDeployments(m: Match): void {
  if (m.data.deployments !== undefined && !Array.isArray(m.data.deployments)) throw Error('Invalid deployment history.');
  const seen = new Set<string>(); let last = 0;
  for (const d of records(m)) {
    if (!d || !sides.includes(d.side) || !Number.isSafeInteger(d.turn) || d.turn < 1 || d.turn > m.turn.number ||
        !['activate','control','deploy','battle','move','draw'].includes(d.phase) || !Number.isFinite(d.ability) || d.ability < 0 ||
        !Number.isSafeInteger(d.serial) || d.serial <= last || d.serial > m.serial || !Array.isArray(d.observers)) throw Error('Invalid deployment history.');
    assertCardReference(m, d.card);
    const key = d.card.id + ':' + d.card.version;
    if (d.card.zone !== 'table' || m.cards[d.card.id].owner !== d.side || seen.has(key)) throw Error('Invalid deployment identity.');
    seen.add(key); last = d.serial;
    const observers = new Set<string>();
    for (const ref of d.observers) {
      assertCardReference(m, ref);
      if (ref.zone !== 'table' || observers.has(ref.id)) throw Error('Invalid deployment observer.');
      observers.add(ref.id);
    }
    if (!d.observers.some(ref => ref.id === d.card.id && ref.version === d.card.version)) throw Error('Missing deployment observer.');
    if (d.inactiveObservers !== undefined) {
      if (!Array.isArray(d.inactiveObservers)) throw Error('Invalid inactive deployment observers.');
      const inactive = new Set<string>();
      for (const ref of d.inactiveObservers) {
        assertCardReference(m, ref);
        if (inactive.has(ref.id) || !d.observers.some(o => o.id === ref.id && o.version === ref.version && o.zone === ref.zone)) throw Error('Invalid inactive deployment observer.');
        inactive.add(ref.id);
      }
    }
  }
}
