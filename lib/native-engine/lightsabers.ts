import {characterPresent} from './occupancy';
import {defenseValue} from './defense';
import {deployed} from './deployment';
import {ability} from './ability';
import {hasPersona} from './persona';
import {resetWeaponForfeit} from './forfeit';
import {beginDestinySequence, assertDestinyScope} from './destiny-limits';
import {attachmentAttempt, assertAttachmentAttempt, validAttachmentAttempt, type AttachmentAttempt} from './attachment';
import {isWarrior, name} from './board';
import {battle, members} from './battle';
import {canDeployAsReact, pendingReactSite, reactionSources, registerReact} from './ground';
import {canUseWeapon, useWeapon} from './weapon-state';
import {completeDestinyTotal, drawDestiny, validDraw, type Draw} from './destiny';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other, sides, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';
export type LightsaberShot = {scope?: string; weapon: string; host: string; target: string; side: Side; draws: Draw[]; total: number | null; outcome: 'pending' | 'canceled' | 'invalid' | 'miss' | 'hit'; defense?: number};
type Payload = {attachment?: AttachmentAttempt; card: string; target?: string; site?: string; index?: number; draw?: Draw; draws?: Draw[]; total?: number | null; transfer?: boolean; react?: boolean; via?: string};
const action = (step: string, p: Payload): Action => ({id: 'saber:' + step + ':' + p.card + (p.target ? ':' + p.target : ''), label: step === 'equip' ? (p.transfer ? 'Transfer lightsaber' : 'Deploy lightsaber') : step === 'drain' ? 'Use lightsaber · add 1 to Force drain' : 'Swing lightsaber', handler: 'saber:' + step, source: p.card, payload: p as unknown as Json});
const queue = (m: Match, step: string, p: Payload, side: Side) => m.stack.push({kind: 'resolution', actor: side, action: action(step, p), cancelled: false});
export const lightsabers = ['1_155','1_157','1_324'];
const validHost = (m: Match, weapon: string, host: string) => m.cards[weapon].blueprint==='1_155'?isWarrior(m,host):hasPersona(m,host,m.cards[weapon].blueprint==='1_157'?'OBIWAN':'VADER');
const cost = (m: Match, weapon: string, host: string, deployment=false) => m.cards[weapon].blueprint==='1_155'?Math.max(0,(deployment?Math.ceil:Math.floor)(7-ability(m,host))):0;
const validTarget = (m: Match, target: string, side: Side) => characterPresent(m,target)&&members(m,other(side)).includes(target);
type Drain = {site: string; saberUsed?: string[]; saberBonus?: string[]};
const pendingDrain = (m: Match) => [...m.stack].reverse().find(r=>r.kind==='resolution' && r.action.handler==='ground:drain') as Resolution | undefined;
export function lightsaberDrainBonus(m: Match, p: Drain): number {return new Set((p.saberBonus??[]).map(id=>name(m,id))).size;}

export function lightsaberActions(m: Match, w: Window, side: Side): Action[] {
  const actions: Action[] = [], b = battle(m), parent = m.stack.at(-2), reactSite = pendingReactSite(m, w, side);
  for (const card of Object.values(m.cards).filter(c => lightsabers.includes(c.blueprint) && c.owner === side)) {
    if (w.timing === 'phase' && m.turn.side === side && m.turn.phase === 'deploy' && ['hand','table'].includes(card.zone)) {
      const transfer = card.zone === 'table';
      for (const target of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location && validHost(m,card.id,c.id))) {
        if (transfer && (!card.attachedTo || target.id === card.attachedTo || target.location !== card.location)) continue;
        actions.push({...action('equip', {card: card.id, target: target.id, site: target.location, transfer}), payment: {[side]: cost(m,card.id,target.id,true)}});
      }
    }
    if (reactSite && card.zone === 'hand' && canDeployAsReact(m, card.id)) {
      const sources = reactionSources(m, reactSite, side);
      const options = [...(sources.some(id => m.cards[id].blueprint === '1_6') ? [undefined] : []), ...sources.filter(id => m.cards[id].blueprint === '1_201')];
      for (const via of options) for (const target of Object.values(m.cards).filter(c => c.owner === side && c.zone === 'table' && c.location === reactSite && validHost(m,card.id,c.id))) {
        const a = action('equip', {card: card.id, target: target.id, site: reactSite, transfer: false, react: true, ...(via ? {via} : {})});
        a.id += ':react' + (via ? ':via:' + via : ''); a.label += ' as a react on ' + name(m, target.id); a.payment = {[side]: cost(m,card.id,target.id,true)}; actions.push(a);
      }
    }
    if(w.timing==='response' && parent?.kind==='resolution' && parent.action.handler==='ground:drain' && !parent.awaitingResponses && !parent.cancelled && parent.actor===side && w.event===undefined && card.zone==='table' && card.attachedTo && validHost(m,card.id,card.attachedTo) && canUseWeapon(m,card.id)) {
      const d=parent.action.payload as Drain;
      if(card.location===d.site && !m.cards[card.attachedTo].attachedTo && !d.saberUsed?.includes(card.id))actions.push(action('drain',{card:card.id,site:d.site}));
    }
    if (w.timing !== 'response' || (w.event as {kind?: string})?.kind !== 'battle-weapons' || b?.stage !== 'weapons' || card.zone !== 'table' || !card.attachedTo || !validHost(m,card.id,card.attachedTo) || !members(m, side).includes(card.attachedTo)||!characterPresent(m,card.attachedTo) || b.fired.includes(card.id) || !canUseWeapon(m, card.id)) continue;
    for (const target of members(m, other(side)).filter(id => validTarget(m, id, side))) {
      const a = action('fire', {card: card.id, target, site: b.site}); a.label += ' at ' + name(m, target); a.payment={[side]:cost(m,card.id,card.attachedTo)}; actions.push(a);
    }
  }
  return actions;
}
export function lightsaberInitiate(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload;
  if (r.action.handler === 'saber:equip') {if (p.react) registerReact(m, p.card); if (!p.transfer) moveCard(m, p.card, 'playing'); p.attachment = attachmentAttempt(m, p.card, p.target!); return;}
  if(r.action.handler==='saber:drain'){const d=pendingDrain(m)!.action.payload as Drain;(d.saberUsed??=[]).push(p.card);return;}
  const b = battle(m)!, host = m.cards[p.card].attachedTo!;
  useWeapon(m, p.card); b.fired.push(p.card); b.users[host] = p.card;
  const shots = b.saberShots ??= [];
  p.index = shots.length; shots.push({weapon: p.card, host, target: p.target!, side: r.actor, draws: [], total: null, outcome: 'pending'});
}
export function lightsaberResolve(m: Match, r: Resolution): void {
  const p = r.action.payload as Payload, h = r.action.handler, side = r.actor;
  if (h === 'saber:equip') {
    const card = m.cards[p.card], target = m.cards[p.target!];
    if (r.cancelled || !validAttachmentAttempt(m, p.attachment!) || card.zone !== (p.transfer ? 'table' : 'playing') || target.zone !== 'table' || target.owner !== side || !validHost(m,card.id,target.id) || !target.location || p.react && target.location !== p.site || p.transfer && (card.zone !== 'table' || card.location !== target.location)) {if (card.zone === 'playing') moveCard(m, card.id, 'lost'); return;}
    if (card.zone === 'playing') moveCard(m, card.id, 'table'); card.attachedTo = target.id; card.location = target.location;
    if (p.transfer) openWindow(m, 'response', other(side), {kind: 'weapon-transferred', card: card.id}); else deployed(m, card.id); return;
  }
  if(h==='saber:drain'){
    const parent=pendingDrain(m);if(r.cancelled || !parent || parent.cancelled)return;
    const d=parent.action.payload as Drain;(d.saberBonus??=[]).push(p.card);
    if(canUseWeapon(m,p.card))useWeapon(m,p.card);
    openWindow(m,'response',other(side),{kind:'force-drain-enhanced',weapon:p.card,site:p.site!});return;
  }
  const b = battle(m)!, shot = b.saberShots![p.index!];
  if (r.cancelled) {shot.outcome = 'canceled'; return;}
  if (h === 'saber:fire') {
    // The weapon, bearer and target were legal at initiation. Changes
    // during responses don't undo that action (AR p15): finish both draws,
    // then determine whether the target can receive the result.
    shot.scope = beginDestinySequence(m, side, shot.weapon, 'weapon');
    queue(m, 'draw', p, side);
  } else if (h === 'saber:draw') {
    if (p.draw) {shot.draws.push(p.draw); delete p.draw;}
    if (shot.draws.length < 2) drawDestiny(m, side, shot.weapon, 'weapon', action('draw', p), false, {weapon: shot.weapon}, undefined, false, shot.scope);
    else completeDestinyTotal(m, side, shot.weapon, 'weapon', shot.draws, action('result', p));
  } else if (h === 'saber:result') {
    shot.total = p.total!; shot.outcome = 'miss'; shot.defense=defenseValue(m,shot.target);
    queue(m,'finish',p,side);
    if(shot.total!==null && shot.total>shot.defense && validTarget(m,shot.target,side)){
      queue(m,'hit',p,side);openWindow(m,'response',other(side),{kind:'about-to-hit',target:shot.target,weapon:shot.weapon});
    }
  } else if(h==='saber:hit'){
    if(validTarget(m,shot.target,side)){
      shot.outcome='hit';if(!b.hits.includes(shot.target))b.hits.push(shot.target);
      if(m.cards[shot.weapon].blueprint!=='1_155')resetWeaponForfeit(m,shot.weapon,shot.target);
      openWindow(m,'response',other(side),{kind:'hit',target:shot.target,weapon:shot.weapon});
    }else shot.outcome='invalid';
  } else if (h === 'saber:finish') openWindow(m, 'response', other(side), {kind: 'weapon-fired', weapon: shot.weapon, target: shot.target, hit: shot.outcome==='hit'});
  else throw Error('Unknown lightsaber action.');
}
export function assertLightsaber(m: Match): void {
  const b = battle(m);
  for(const r of m.stack)if(r.kind==='resolution' && r.action.handler==='ground:drain'){
    const d=r.action.payload as Drain;
    for(const list of [d.saberUsed,d.saberBonus])if(list!==undefined && (!Array.isArray(list) || new Set(list).size!==list.length || list.some(id=>!lightsabers.includes(m.cards[id]?.blueprint) || m.cards[id].owner!==r.actor)))throw Error('Invalid lightsaber drain grants.');
    if(d.saberBonus?.some(id=>!d.saberUsed?.includes(id)))throw Error('Invalid lightsaber drain grants.');
  }
  for (const shot of b?.saberShots ?? []) {
    assertDestinyScope(m, shot.scope, shot.side, shot.weapon, 'weapon');
    if (!lightsabers.includes(m.cards[shot.weapon]?.blueprint) || m.cards[shot.weapon].owner !== shot.side || !sides.includes(shot.side) || !m.cards[shot.host] || !m.cards[shot.target] || !Array.isArray(shot.draws) || shot.draws.length > 2 || shot.draws.some(d => !validDraw(m, d, shot.side)) || shot.total !== null && (!Number.isFinite(shot.total) || shot.total < 0) || !['pending','canceled','invalid','miss','hit'].includes(shot.outcome) || shot.defense!==undefined && (!Number.isFinite(shot.defense) || shot.defense<0)) throw Error('Invalid lightsaber record.');
    if (['miss','hit'].includes(shot.outcome) && shot.draws.length !== 2 || shot.outcome === 'hit' && (shot.total === null || shot.defense===undefined || shot.total<=shot.defense)) throw Error('Invalid lightsaber result.');
  }
  for (const r of m.stack) if (r.kind === 'resolution' && r.action.handler.startsWith('saber:')) {
    const p = r.action.payload as Payload, h = r.action.handler;
    if (!p || !lightsabers.includes(m.cards[p.card]?.blueprint) || m.cards[p.card].owner !== r.actor || r.action.source !== p.card || !['saber:equip','saber:fire','saber:draw','saber:result','saber:hit','saber:finish','saber:drain'].includes(h)) throw Error('Invalid lightsaber continuation.');
    if (h === 'saber:equip') {assertAttachmentAttempt(m, p.attachment!, p.card, p.target!); if (!m.cards[p.target!] || typeof p.transfer !== 'boolean' || p.react !== undefined && (p.react !== true || p.transfer || !p.site || !m.locations.includes(p.site) || p.via !== undefined && m.cards[p.via]?.blueprint !== '1_201')) throw Error('Invalid lightsaber deployment.');}
    else if(h==='saber:drain'){if(!p.site || !m.locations.includes(p.site) || !pendingDrain(m))throw Error('Invalid lightsaber drain.');}
    else {const shot = b?.saberShots?.[p.index!]; if (!Number.isSafeInteger(p.index) || !shot || shot.weapon !== p.card || shot.target !== p.target || b?.site !== p.site) throw Error('Invalid lightsaber firing.');}
  }
}
