import {cancelRetrieval, pendingRetrieval, type Retrieval} from './retrieval';
import {queueForcePayment, type RequiredAction} from './runtime';
import {type Action, type Decision, type Json, type Match, type Resolution, type Window} from './types';

type Payload = {card: string; retrieval: string; amount: number};
const action = (step: string, p: Payload): Action => ({id: 'plans:' + step + ':' + p.retrieval, label: 'Secret Plans · use Force or cancel retrieval', handler: 'plans:' + step, source: p.card, payload: p as unknown as Json});
const active = (m: Match, p: Payload) => {
  const f = pendingRetrieval(m, p.retrieval);
  return f && !f.cancelled && (f.action.payload as unknown as Retrieval).side === 'light';
};

/** Defensive Shield's table text only. Shield setup/play and other Secret Plans
 * versions must be implemented before they are admitted to native decks. */
export function secretPlansAutomatic(m: Match, w: Window): RequiredAction[] {
  const e = w.event as {kind?: string; side?: string; amount?: number; retrieval?: string} | undefined;
  if (w.timing !== 'response' || e?.kind !== 'about-to-retrieve' || e.side !== 'light') return [];
  const card = Object.values(m.cards).find(c => c.blueprint === '13_86' && c.owner === 'dark' && c.zone === 'table');
  if (!card) return [];
  const p: Payload = {card: card.id, retrieval: e.retrieval!, amount: e.amount!};
  return active(m, p) ? [{...action('check', p), actor: 'dark'}] : [];
}
export function secretPlansResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as unknown as Payload;
  if (r.cancelled || r.action.handler === 'plans:paid' || !active(m, p)) return;
  if (r.action.handler !== 'plans:check') throw Error('Unknown Secret Plans continuation.');
  // Amount is the full retrieval, never capped by Lost Pile size. A mandatory
  // trigger already initiated still resolves after its source leaves table.
  if (m.players.light.force.length < p.amount) cancelRetrieval(m, p.retrieval, p.card);
  else m.stack.push({kind: 'decision', side: 'light', handler: 'plans:choose', payload: p as unknown as Json});
}
export function secretPlansChoices(m: Match, d: Decision) {
  const p = d.payload as unknown as Payload;
  return [...(active(m, p) && m.players.light.force.length >= p.amount ? [{id: 'plans:pay', label: `Use ${p.amount} Force to retrieve`}]: []), {id: 'plans:cancel', label: 'Cancel this retrieval'}];
}
export function secretPlansChoose(m: Match, d: Decision, choice: string): void {
  const p = d.payload as unknown as Payload;
  if (choice === 'plans:cancel') {cancelRetrieval(m, p.retrieval, p.card); return;}
  if (choice !== 'plans:pay' || !active(m, p)) throw Error('Invalid Secret Plans choice.');
  const r: Resolution = {kind: 'resolution', actor: 'light', cancelled: false, awaitingResponses: true,
    action: {...action('paid', p), payment: {light: p.amount}}};
  m.stack.push(r); queueForcePayment(m, r, {light: p.amount});
}
export function assertSecretPlans(m: Match): void {
  const seen = new Set<string>();
  for (const [index, f] of m.stack.entries()) {
    const h = f.kind === 'resolution' ? f.action.handler : f.kind === 'decision' ? f.handler : '';
    if (!h.startsWith('plans:')) continue;
    const p = (f.kind === 'resolution' ? f.action.payload : (f as Decision).payload) as unknown as Payload;
    const target = p && pendingRetrieval(m, p.retrieval), retrieval = target?.action.payload as unknown as Retrieval | undefined;
    if (!p || m.cards[p.card]?.blueprint !== '13_86' || m.cards[p.card].owner !== 'dark' || !target || m.stack.indexOf(target) >= index || retrieval?.side !== 'light' || !retrieval.announced || seen.has(p.retrieval) ||
        !Number.isSafeInteger(p.amount) || p.amount <= 0 || p.amount !== retrieval.remaining ||
        (f.kind === 'resolution' ? f.actor : (f as Decision).side) !== (h === 'plans:check' ? 'dark' : 'light') ||
        !(f.kind === 'resolution' ? ['plans:check', 'plans:paid'] : ['plans:choose']).includes(h)) throw Error('Invalid Secret Plans continuation.');
    seen.add(p.retrieval);
    if (f.kind === 'resolution' && (f.action.source !== p.card || f.action.id !== action(h.slice(6), p).id)) throw Error('Invalid Secret Plans action identity.');
    if (h === 'plans:paid' && f.kind === 'resolution' && (f.action.payment?.light !== p.amount || (f.action.payment?.dark ?? 0) !== 0)) throw Error('Invalid Secret Plans payment.');
  }
}
