import type {Battle} from './battle';
import {name} from './board';
import {cancelPendingDestiny, destinyInWindow, destinyResponseHandlers} from './destiny-response';
import {gameTextActive} from './game-text';
import {assertCardReference, referenceCard, sameCard, type CardReference} from './identity';
import {battleMembers, groundPresent} from './participation';
import {hasPersona} from './persona';
import {other, type Action, type Json, type Match, type Resolution, type Side, type Window} from './types';
type Payload={source:CardReference;window:number;pendingIndex:number;pendingId:string;mode:'cancel'|'redraw'};
const battle=(m:Match)=>m.data.battle as Battle|undefined;
const used=(m:Match,id:string)=>(battle(m)?.characterDestinyUses??[]).some(ref=>ref.id===id&&sameCard(m,ref));
const target=(m:Match,p:Payload)=>{const r=m.stack[p.pendingIndex];return r?.kind==='resolution' && r.action.id===p.pendingId?r:undefined;};
export function characterDestinyActions(m:Match,w:Window,side:Side):Action[]{
  const b=battle(m),d=destinyInWindow(m,w);if(!b||b.stage==='complete'||!d||d.value===null||d.substituted)return [];
  const participants=[...battleMembers(m,'dark'),...battleMembers(m,'light')];
  return battleMembers(m,side).filter(id=>groundPresent(m,id)&&gameTextActive(m,id)&&!used(m,id)).flatMap(id=>{
    const bp=m.cards[id].blueprint,mode=bp==='1_11'&&d.side===side?'redraw':bp==='1_179'&&d.side!==side&&participants.some(c=>hasPersona(m,c,'VADER'))?'cancel':null;
    if(!mode)return [];
    return [{id:'character-destiny:'+id+':'+mode,label:name(m,id)+' · '+(mode==='redraw'?'use 1 Force to cancel and redraw':'cancel opponent’s destiny'),source:id,handler:'character-destiny:respond',
      ...(mode==='redraw'?{payment:{[side]:1}}:{}),payload:{source:referenceCard(m,id),window:w.serial,pendingIndex:m.stack.indexOf(d.resolution),pendingId:d.resolution.action.id,mode} as unknown as Json}];
  });
}
export function characterDestinyInitiate(m:Match,r:Resolution):void{
  const p=r.action.payload as unknown as Payload,b=battle(m);if(!b||used(m,p.source.id))throw Error('Character destiny action already used.');
  (b.characterDestinyUses??=[]).push(p.source);
}
export function characterDestinyResolve(m:Match,r:Resolution):void{
  const p=r.action.payload as unknown as Payload,d=target(m,p);if(!r.cancelled&&d)cancelPendingDestiny(m,d,p.mode==='redraw');
}
export function assertCharacterDestiny(m:Match):void{
  const refs=battle(m)?.characterDestinyUses??[],seen=new Set<string>();
  if(!Array.isArray(refs))throw Error('Invalid character destiny usage.');
  for(const ref of refs){assertCardReference(m,ref);const k=ref.id+':'+ref.version;if(ref.zone!=='table'||!['1_11','1_179'].includes(m.cards[ref.id].blueprint)||seen.has(k))throw Error('Invalid character destiny source.');seen.add(k);}
  for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('character-destiny:')){
    const p=f.action.payload as unknown as Payload;if(!p||f.action.handler!=='character-destiny:respond'||!['cancel','redraw'].includes(p.mode))throw Error('Invalid character destiny continuation.');
    assertCardReference(m,p.source);const d=target(m,p),w=m.stack.find(q=>q.kind==='window'&&q.serial===p.window) as Window|undefined;
    if(!d||!w||m.stack.indexOf(w)!==p.pendingIndex+1||!Number.isSafeInteger(p.pendingIndex)||p.pendingIndex<0||p.pendingIndex>=m.stack.indexOf(f)||d.action.handler!==destinyResponseHandlers[(w.event as {kind:string})?.kind]||
      m.cards[p.source.id].blueprint!==(p.mode==='redraw'?'1_11':'1_179')||m.cards[p.source.id].owner!==f.actor||p.source.zone!=='table'||f.action.source!==p.source.id||d.actor!==(p.mode==='redraw'?f.actor:other(f.actor))||!refs.some(v=>v.id===p.source.id&&v.version===p.source.version))throw Error('Invalid character destiny binding.');
  }
}
