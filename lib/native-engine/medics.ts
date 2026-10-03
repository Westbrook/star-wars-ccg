import {cardDefinition} from './definitions';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {premiereSites} from './premiere-setup';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';

const delevar = '8_5';
const sources = (m: Match) => Object.values(m.cards).filter(c => c.zone === 'table' && c.blueprint === delevar && c.location && !c.attachedTo);
/** Current ground-location context. A removed medic no longer protects the
 * board, but an already initiated recovery action survives its source. */
export function medicProtectsForfeit(m: Match, target: string): boolean {
  const c = m.cards[target];
  if (!c || c.zone !== 'table' || !c.location || cardDefinition(m,target).type !== 'Character') return false;
  return sources(m).some(s => s.owner === c.owner && (s.location === c.location ||
    m.cards[s.location!]?.blueprint === '3_60' && premiereSites[m.cards[c.location!]?.blueprint]?.system === 'Hoth'));
}
type Usage = {source: CardReference; turn: number};
const uses = (m: Match) => (m.data.medicUses ?? []) as unknown as Usage[];
const used = (m: Match, id: string) => uses(m).some(u => u.turn === m.turn.number && u.source.id === id && sameCard(m,u.source));
// Explicit represented FX identity; additional FX droids need their own
// metadata and behavior before full-deck admission.
const withFX = (m: Match, source: string) => Object.values(m.cards).some(c => c.zone === 'table' && c.owner === m.cards[source].owner &&
  c.blueprint === '3_9' && !c.attachedTo && c.location === m.cards[source].location);
type Payload = {source: CardReference; target: CardReference; site: string};
const action = (step: string, p: Payload): Action => ({id: 'medic:' + step + ':' + p.source.id + ':' + p.target.id,
  label: 'Corporal Delevar · place forfeited character in Used', handler: 'medic:' + step, source: p.source.id, payload: p as unknown as Json});
export function medicActions(m: Match, w: Window, side: Side): Action[] {
  const e = w.event as {kind?: string; card?: string; cardRef?: CardReference; site?: string} | undefined;
  if (w.timing !== 'response' || e?.kind !== 'forfeited' || !e.cardRef || !sameCard(m,e.cardRef) || e.cardRef.zone !== 'lost' ||
      !e.card || e.cardRef.id !== e.card || m.cards[e.card].owner !== side || cardDefinition(m,e.card).type !== 'Character' || !e.site) return [];
  return sources(m).filter(c => c.owner === side && c.location === e.site && !used(m,c.id) && withFX(m,c.id)).map(c => {
    const a = action('recover',{source:referenceCard(m,c.id),target:e.cardRef!,site:e.site!});
    a.label = 'Corporal Delevar · place ' + cardDefinition(m,e.card!).name + ' in Used'; return a;
  });
}
export function medicInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  if (r.action.handler !== 'medic:recover' || used(m,p.source.id)) throw Error('Medic recovery already used.');
  m.data.medicUses = [...uses(m).filter(u => u.turn === m.turn.number),{source:p.source,turn:m.turn.number}] as unknown as Json;
}
export function medicResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  if (r.cancelled || !sameCard(m,p.target)) return;
  if (r.action.handler === 'medic:recover') {
    m.stack.push({kind:'resolution',actor:r.actor,cancelled:false,action:action('place',p)});
    openWindow(m,'response',other(r.actor),{kind:'about-to-remove-just-lost',card:p.target.id,source:p.source.id});
  } else if (r.action.handler === 'medic:place') {
    moveCard(m,p.target.id,'used');
    // This is placement, not retrieval. Secret Plans and retrieval modifiers
    // do not apply; forfeiture has already paid battle damage and attrition.
    openWindow(m,'response',other(r.actor),{kind:'card-to-used',card:p.target.id,source:p.source.id});
  } else throw Error('Unknown medic continuation.');
}
export function assertMedics(m: Match): void {
  if (m.data.medicUses !== undefined && !Array.isArray(m.data.medicUses)) throw Error('Invalid medic usage.');
  const seen = new Set<string>();
  for (const u of uses(m)) {
    if (!u || !Number.isSafeInteger(u.turn) || u.turn < 1 || u.turn > m.turn.number) throw Error('Invalid medic turn.');
    assertCardReference(m,u.source);
    const key = u.turn + ':' + u.source.id + ':' + u.source.version;
    if (m.cards[u.source.id].blueprint !== delevar || u.source.zone !== 'table' || seen.has(key)) throw Error('Invalid medic usage source.');
    seen.add(key);
  }
  for (const f of m.stack) if (f.kind === 'resolution' && f.action.handler.startsWith('medic:')) {
    const p = f.action.payload as unknown as Payload;
    if (!p || !['medic:recover','medic:place'].includes(f.action.handler)) throw Error('Invalid medic continuation.');
    assertCardReference(m,p.source); assertCardReference(m,p.target);
    if (m.cards[p.source.id].blueprint !== delevar || p.source.zone !== 'table' || p.target.zone !== 'lost' ||
        m.cards[p.source.id].owner !== f.actor || m.cards[p.target.id].owner !== f.actor || cardDefinition(m,p.target.id).type !== 'Character' ||
        !m.locations.includes(p.site) || f.action.source !== p.source.id || !uses(m).some(u => u.source.id === p.source.id && u.source.version === p.source.version && u.turn === m.turn.number)) throw Error('Invalid medic recovery target.');
  }
  for (const f of m.stack) if (f.kind === 'window') {
    const e = f.event as {kind?: string; card?: string; cardRef?: CardReference} | undefined;
    if (e?.kind === 'forfeited' && e.cardRef) {
      assertCardReference(m,e.cardRef,e.card);
      if (e.cardRef.zone !== 'lost') throw Error('Invalid forfeited card reference.');
    }
  }
}
