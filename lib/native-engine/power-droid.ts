import {battle,members} from './battle';
import {name,presentPower,totalPower} from './board';
import {tradedPower} from './battle-effects';
import {destinyInWindow} from './destiny-response';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {powerDroid} from './power-support';
import type {RequiredAction} from './runtime';
import {other,sides,type Json,type Match,type Resolution,type Side,type Window} from './types';
type Payload={source:CardReference;window:number};
export type DroidBoost={source:CardReference;side:Side;amount:number};
function currentPower(m:Match,side:Side,pendingSide:Side):number{
 const b=battle(m)!,ids=members(m,side);
 // While a multi-draw plan is pending, b.destiny holds the current draw.
 const earlier=side===pendingSide?(b.destinyPlans?.[side]?.draws??[]).reduce((n,d)=>n+(d.value??0),0):0;
 return totalPower(m,side,b.site,side!==b.initiator,id=>ids.includes(id))+(b.destiny[side]??0)+earlier+(b.powerDestinies?.[side]?.total??0)+tradedPower(m,side);
}
export function powerDroidAutomatic(m:Match,w:Window):RequiredAction[]{
 const b=battle(m),e=w.event as {kind?:string;category?:string;card?:string;side?:Side}|undefined,d=destinyInWindow(m,w);
 if(!b||b.stage!=='power'||!d||d.value===null||d.substituted||!e?.card||!powerDroid(m.cards[e.card]?.blueprint)||m.cards[e.card].zone!=='destiny'||!['battle-destiny-drawn','destiny-drawn'].includes(e.kind??'')||e.kind==='destiny-drawn'&&e.category!=='battle'||b.powerDroidUses?.includes(e.card)||currentPower(m,d.side,d.side)>=currentPower(m,other(d.side),d.side))return [];
 return [{id:'power-droid:'+e.card+':'+w.serial,label:name(m,e.card)+' · double power present',handler:'power-droid:double',source:e.card,actor:d.side,payload:{source:referenceCard(m,e.card),window:w.serial} as unknown as Json}];
}
export function powerDroidInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload,b=battle(m);if(!b||b.powerDroidUses?.includes(p.source.id))throw Error('Power droid already triggered this battle.');
 (b.powerDroidUses??=[]).push(p.source.id);
}
export function powerDroidResolve(m:Match,r:Resolution):void{
 if(r.cancelled)return;
 const b=battle(m);if(!b||b.stage==='complete')return;
 const p=r.action.payload as unknown as Payload,ids=members(m,r.actor);
 // A lasting addition freezes the power of participating cards present, without
 // battle destiny, power-only destiny or other total-power modifiers (AR Ap. B).
 const amount=presentPower(m,r.actor,b.site,r.actor!==b.initiator,id=>ids.includes(id));
 (b.powerDroidBoosts??=[]).push({source:p.source,side:r.actor,amount});
}
export function assertPowerDroids(m:Match):void{
 const b=battle(m);if(!b)return;
 const uses=b.powerDroidUses??[],boosts=b.powerDroidBoosts??[];
 if(!Array.isArray(uses)||new Set(uses).size!==uses.length||uses.some(id=>!powerDroid(m.cards[id]?.blueprint))||!Array.isArray(boosts))throw Error('Invalid power droid battle history.');
 const seen=new Set<string>();
 for(const p of boosts){assertCardReference(m,p.source);if(p.source.zone!=='destiny'||!uses.includes(p.source.id)||!sides.includes(p.side)||m.cards[p.source.id].owner!==p.side||!Number.isFinite(p.amount)||p.amount<0||seen.has(p.source.id))throw Error('Invalid power droid boost.');seen.add(p.source.id);}
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('power-droid:')){
  const p=f.action.payload as unknown as Payload;if(!p)throw Error('Missing power droid trigger.');assertCardReference(m,p.source);
  const w=m.stack.find(x=>x.kind==='window'&&x.serial===p.window) as Window|undefined;
  if(f.action.handler!=='power-droid:double'||p.source.zone!=='destiny'||!uses.includes(p.source.id)||m.cards[p.source.id].owner!==f.actor||f.action.source!==p.source.id||!w||(w.event as {card?:string})?.card!==p.source.id||m.stack.indexOf(w)>=m.stack.indexOf(f))throw Error('Invalid power droid trigger binding.');
 }
}
