import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {groundCreature,creatureHabitat} from './ground-creatures';
import {canMove,record,barred,usage} from './ground';
import {moveWithAttachments,name} from './board';
import {capital,operational} from './occupancy';
import {vehicleDestination} from './vessel-travel';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {openWindow} from './runtime';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';
type Move={card:CardReference;source:CardReference;from:CardReference;to:CardReference};
const key=(p:Move)=>'hoth-move:'+p.card.id+':'+p.to.id;
function eligible(m:Match,id:string,to:string){
 const c=m.cards[id];if(!c||c.zone!=='table'||c.attachedTo||!c.location||!canMove(m,id))return false;
 const d=cardDefinition(m,id);
 if(d.type==='Character')return true;
 if(d.type==='Creature')return groundCreature(m,id)&&creatureHabitat(m,id,to);
 if(d.type==='Vehicle')return operational(m,id)&&vehicleDestination(m,id,to);
 return d.type==='Starship'&&!capital(m,id)&&operational(m,id);
}
export function hothMoveActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||side!=='dark'||m.turn.phase!=='move')return [];
 const source=m.locations.find(id=>m.cards[id].blueprint==='3_148'&&gameTextActive(m,id)),mountain=m.locations.find(id=>m.cards[id].blueprint==='104_4');if(!source||!mountain)return [];
 return Object.values(m.cards).filter(c=>c.owner===side&&[source,mountain].includes(c.location!)).flatMap(c=>{
  const to=c.location===source?mountain:source;if(!eligible(m,c.id,to))return [];
  const p:Move={card:referenceCard(m,c.id),source:referenceCard(m,source),from:referenceCard(m,c.location!),to:referenceCard(m,to)};
  return [{id:key(p),handler:'hoth-move:begin',source,payload:p as unknown as Json,payment:{[side]:0},label:'Move '+name(m,c.id)+' to '+name(m,to)+' · free using Ice Plains'}];
 });
}
/** The printed action's permission is latched at initiation. Cancellation of
 * its source text later does not undo it; moved cards still finish unless barred. */
export function hothMoveResolve(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Move,c=m.cards[p.card.id];
 if(r.cancelled||!sameCard(m,p.card)||!sameCard(m,p.from)||!sameCard(m,p.to))return;
 if(r.action.handler==='hoth-move:begin'){
  record(m).moved.push(c.id);
  m.stack.push({...r,action:{...r.action,handler:'hoth-move:finish'}});
  openWindow(m,'response',other(r.actor),{kind:'moving-using-location-text',card:c.id,from:p.from.id,site:p.to.id,source:p.source.id});return;
 }
 if(r.action.handler!=='hoth-move:finish')throw Error('Unknown Hoth movement.');
 if(barred(m,c.id))return;
 delete c.attachedTo;delete c.aboardRole;
 moveWithAttachments(m,c.id,p.to.id);
 openWindow(m,'response',other(r.actor),{kind:'moved',card:c.id,from:p.from.id,site:p.to.id,method:'location-text',source:p.source.id});
}
export function assertHothMovement(m:Match){for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('hoth-move:')){
 const p=f.action.payload as unknown as Move;for(const ref of [p?.card,p?.source,p?.from,p?.to])assertCardReference(m,ref);
 if(!['hoth-move:begin','hoth-move:finish'].includes(f.action.handler)||f.actor!=='dark'||m.cards[p.card.id].owner!==f.actor||[p.card,p.source,p.from,p.to].some(ref=>ref.zone!=='table')||m.cards[p.source.id].blueprint!=='3_148'||p.from.id===p.to.id||![p.from.id,p.to.id].includes(p.source.id)||![p.from,p.to].some(ref=>m.cards[ref.id].blueprint==='104_4')||f.action.source!==p.source.id||f.action.id!==key(p)||f.action.handler==='hoth-move:finish'&&!usage(m).moved.includes(p.card.id))throw Error('Invalid Hoth location-text movement.');
}}
