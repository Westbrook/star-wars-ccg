import {adjacent,moveWithAttachments,name,system} from './board';
import {cardDefinition} from './definitions';
import {creatureProfile} from './creature-profile';
import {deployValue} from './deploy-costs';
import {deployed} from './deployment';
import {gameTextActive} from './game-text';
import {record,usage} from './ground';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {characterPresent} from './occupancy';
import {barred} from './participation';
import {canPlayCard} from './persona';
import {openWindow} from './runtime';
import {moveCard} from './state';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';
export const groundCreature=(m:Match,id:string)=>creatureProfile(m,id)?.ground===true;
export function creatureHabitat(m:Match,id:string,site:string):boolean {
 if(!groundCreature(m,id)||!m.locations.includes(site))return false;
 const d=cardDefinition(m,site);return d.subType==='Site'&&(d.icons as string[]).includes('Planet')&&system(m,site)!=='Hoth';
}
/** Worrt/Bubo restrict landspeed only: transit, transport and relocation retain
 * their own rules. An aboard character who is not present is unaffected. */
export function creatureBlocksLandspeed(m:Match,id:string):boolean {
 const c=m.cards[id];if(!c||c.zone!=='table'||!c.location||!characterPresent(m,id))return false;
 return Object.values(m.cards).some(g=>g.zone==='table'&&g.owner!==c.owner&&g.location===c.location&&!g.attachedTo&&gameTextActive(m,g.id)&&
  (g.blueprint==='6_48'&&system(m,g.location!)==='Tatooine'||g.blueprint==='6_138'&&cardDefinition(m,g.location!).name.startsWith("Jabba's Palace:")));
}
type Payload={card:CardReference;site:CardReference;from?:CardReference};
const action=(step:string,p:Payload):Action=>({id:'ground-creature:'+step+':'+p.card.id+':'+p.site.id,handler:'ground-creature:'+step,source:p.card.id,label:step,payload:p as unknown as Json});
export function groundCreatureActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||side!==m.turn.side)return [];
 const out:Action[]=[];
 if(m.turn.phase==='deploy')for(const card of m.players[side].hand.filter(id=>groundCreature(m,id)&&canPlayCard(m,id)))for(const site of m.locations.filter(id=>creatureHabitat(m,card,id))){const cost=deployValue(m,card);out.push({...action('deploy',{card:referenceCard(m,card),site:referenceCard(m,site)}),label:'Deploy '+name(m,card)+' at '+name(m,site)+' · '+cost+' Force',payment:{[side]:cost}});}
 if(m.turn.phase==='move')for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&groundCreature(m,c.id)&&c.location&&!c.attachedTo&&!barred(m,c.id)&&!usage(m).moved.includes(c.id)))for(const site of m.locations.filter(id=>creatureHabitat(m,c.id,id)&&adjacent(m,c.location!,id)))out.push({...action('move',{card:referenceCard(m,c.id),site:referenceCard(m,site),from:referenceCard(m,c.location!)}),label:'Move '+name(m,c.id)+' to '+name(m,site),payment:{[side]:1}});
 return out;
}
export function groundCreatureInitiate(m:Match,r:Resolution):void{const p=r.action.payload as unknown as Payload;if(r.action.handler==='ground-creature:deploy')moveCard(m,p.card.id,'playing');}
export function groundCreatureResolve(m:Match,r:Resolution):void {
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='ground-creature:deploy'){
  if(r.cancelled||!sameCard(m,p.site)||!creatureHabitat(m,p.card.id,p.site.id)){moveCard(m,p.card.id,'lost');return;}
  moveCard(m,p.card.id,'table');m.cards[p.card.id].location=p.site.id;deployed(m,p.card.id);return;
 }
 if(r.action.handler!=='ground-creature:move')throw Error('Unknown ground creature action.');
 if(r.cancelled||!sameCard(m,p.card)||!sameCard(m,p.site)||!sameCard(m,p.from!)||m.cards[p.card.id].location!==p.from!.id||barred(m,p.card.id)||!creatureHabitat(m,p.card.id,p.site.id))return;
 moveWithAttachments(m,p.card.id,p.site.id);record(m).moved.push(p.card.id);
 openWindow(m,'response',other(r.actor),{kind:'moved',card:p.card.id,from:p.from!.id,site:p.site.id,method:'landspeed'});
}
export function assertGroundCreatures(m:Match):void{
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('ground-creature:')){
  const p=f.action.payload as unknown as Payload;if(!p)throw Error('Missing creature payload.');assertCardReference(m,p.card);assertCardReference(m,p.site);
  const step=f.action.handler.slice(16);
  if(!['deploy','move'].includes(step)||!groundCreature(m,p.card.id)||f.action.source!==p.card.id||m.cards[p.card.id].owner!==f.actor||f.action.id!==action(step,p).id||p.site.zone!=='table'||cardDefinition(m,p.site.id).subType!=='Site')throw Error('Invalid ground creature action.');
  if(step==='deploy'&&(p.card.zone!=='hand'||m.cards[p.card.id].zone!=='playing')||step==='move'&&(p.card.zone!=='table'||!p.from))throw Error('Invalid ground creature continuation.');
  if(p.from){assertCardReference(m,p.from);if(p.from.zone!=='table'||p.from.id===p.site.id||cardDefinition(m,p.from.id).subType!=='Site')throw Error('Invalid creature movement origin.');}
 }
}
