import identities from '../../data/native-engine/identities.json';
import {isWarrior} from './board';
import {optionalActionWindow} from './action-timing';
import {cardDefinition} from './definitions';
import {isModel} from './characteristics';
import {canUseDevice,useDevice} from './equipment-state';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {groundPresent} from './participation';
import type {Action,Json,Match,Resolution,Side,Window} from './types';

type Link={source:CardReference;host:CardReference;target:CardReference};
const links=(m:Match)=>(m.data.fusionLinks??[]) as unknown as Link[];
export const fusionGenerator=(bp:string)=>['3_96','4_13'].includes(bp);
export const powerDroid=(bp:string)=>['3_8','1_175'].includes(bp);
const droid=(m:Match,id:string)=>!!m.cards[id]&&cardDefinition(m,id).subType==='Droid';
function present(m:Match,source:string,target:string):boolean{
 const s=m.cards[source],t=m.cards[target];
 return !!s&&!!t&&!!s.attachedTo&&groundPresent(m,s.attachedTo)&&groundPresent(m,target)&&s.location===t.location;
}
const alive=(m:Match,l:Link)=>sameCard(m,l.source)&&sameCard(m,l.host)&&sameCard(m,l.target)&&m.cards[l.source.id].attachedTo===l.host.id&&present(m,l.source.id,l.target.id);
/** A lost connection ends; returning to the location does not restart it. */
export function expireFusionLinks(m:Match):boolean{
 const before=links(m),after=before.filter(l=>alive(m,l));if(after.length===before.length)return false;
 m.data.fusionLinks=after as unknown as Json;return true;
}
export function supportPowerBonus(m:Match,id:string,active:(id:string)=>boolean=()=>true):number{
 if(!droid(m,id)||!groundPresent(m,id)||!active(id))return 0;
 const c=m.cards[id];
 const powered=!isModel(m,id,'POWER')&&Object.values(m.cards).some(s=>powerDroid(s.blueprint)&&s.owner===c.owner&&s.location===c.location&&active(s.id)&&groundPresent(m,s.id)&&gameTextActive(m,s.id));
 const fusion=links(m).some(l=>l.target.id===id&&alive(m,l)&&gameTextActive(m,l.source.id)&&active(l.host.id));
 return (powered?1:0)+(fusion?1:0);
}
export function fusionWeaponBonus(m:Match,weapon:string):number{
 const c=m.cards[weapon];if(!c||c.zone!=='table')return 0;
 const artillery=cardDefinition(m,weapon).subType==='Artillery';
 if(!artillery&&!(identities as Record<string,{keywords:string[]}>)[c.blueprint]?.keywords.includes('BLASTER_RIFLE'))return 0;
 const shots=(m.data.heavyShots??[]) as unknown as {weapon:CardReference;user:CardReference;stage:string}[];
 const user=artillery?shots.findLast(s=>s.weapon.id===weapon&&s.stage==='drawing'&&sameCard(m,s.user))?.user.id:c.attachedTo;
 if(!user)return 0;
 return Object.values(m.cards).some(s=>fusionGenerator(s.blueprint)&&s.attachedTo===user&&gameTextActive(m,s.id)&&groundPresent(m,user))?1:0;
}
export function fusionActions(m:Match,w:Window,side:Side):Action[]{
 if(!optionalActionWindow(w))return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&fusionGenerator(c.blueprint)&&gameTextActive(m,c.id)&&!!c.attachedTo&&groundPresent(m,c.attachedTo)&&isWarrior(m,c.attachedTo)&&canUseDevice(m,c.id)).flatMap(c=>{
  const link=links(m).find(l=>l.source.id===c.id&&alive(m,l));
  const targets=link?[link.target.id]:Object.values(m.cards).filter(t=>droid(m,t.id)&&present(m,c.id,t.id)).map(t=>t.id);
  return targets.map(id=>({id:'fusion:'+c.id+':'+(link?'off':id),handler:'fusion:'+ (link?'off':'on'),source:c.id,unrespondable:true as const,label:'Fusion Generator · '+(link?'stop enhancing ':'add 1 power to ')+cardDefinition(m,id).name,payload:{source:referenceCard(m,c.id),host:referenceCard(m,c.attachedTo!),target:referenceCard(m,id)} as unknown as Json}));
 });
}
export function fusionInitiate(m:Match,r:Resolution):void{useDevice(m,(r.action.payload as unknown as Link).source.id);}
export function fusionResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Link;if(r.cancelled)return;
 const remaining=links(m).filter(l=>l.source.id!==p.source.id&&alive(m,l));
 if(r.action.handler==='fusion:on'&&alive(m,p))remaining.push(p);
 m.data.fusionLinks=remaining as unknown as Json;
}
export function fusionView(m:Match){return {fusionEnhancements:links(m).filter(l=>alive(m,l)).map(l=>({source:l.source.id,target:l.target.id,active:gameTextActive(m,l.source.id)}))};}
export function assertFusion(m:Match):void{
 if(!Array.isArray(links(m)))throw Error('Invalid fusion enhancements.');
 const check=(p:Link)=>{if(!p)throw Error('Missing fusion enhancement.');for(const ref of [p.source,p.host,p.target]){assertCardReference(m,ref);if(ref.zone!=='table')throw Error('Invalid fusion reference zone.');}if(!fusionGenerator(m.cards[p.source.id].blueprint)||cardDefinition(m,p.host.id).type!=='Character'||!droid(m,p.target.id)||m.cards[p.host.id].owner!==m.cards[p.source.id].owner)throw Error('Invalid fusion binding.');};
 const seen=new Set<string>();for(const l of links(m)){check(l);if(seen.has(l.source.id))throw Error('Duplicate fusion target.');seen.add(l.source.id);}
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('fusion:')){const p=f.action.payload as unknown as Link;check(p);if(!['fusion:on','fusion:off'].includes(f.action.handler)||f.actor!==m.cards[p.source.id].owner||f.action.source!==p.source.id||!f.action.unrespondable)throw Error('Invalid fusion continuation.');}
}
