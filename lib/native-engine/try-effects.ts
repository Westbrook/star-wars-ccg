import {deployed} from './deployment';
import {name} from './board';
import {gameTextActive} from './game-text';
import {queueForceLoss} from './ground';
import {assertCardReference,referenceCard,type CardReference} from './identity';
import {canEnterTable} from './persona';
import {type RequiredAction} from './runtime';
import {moveCard} from './state';
import {sides,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

export const tryEffectBlueprints=['4_21','4_134'];
const active=(m:Match)=>Object.values(m.cards).filter(c=>tryEffectBlueprints.includes(c.blueprint)&&gameTextActive(m,c.id));
/** Only Sense and Alter are changed; the subtype chosen at initiation persists
 * through their result even if the modifying Effect subsequently leaves. */
export const senseAlterDisposition=(m:Match):'used'|'lost'=>active(m).length?'lost':'used';
type Payload={card:string;source?:CardReference;side?:Side;window?:number;interrupt?:string};
const action=(step:string,p:Payload,label:string):Action=>({id:'try-effect:'+step+':'+p.card+(p.source?':'+p.source.version+':'+p.window:''),handler:'try-effect:'+step,source:p.card,label,payload:p as unknown as Json});
export function tryEffectActions(m:Match,w:Window,side:Side):Action[]{
 if(w.timing!=='phase'||m.turn.side!==side||m.turn.phase!=='deploy')return [];
 return m.players[side].hand.filter(id=>tryEffectBlueprints.includes(m.cards[id].blueprint)).map(card=>action('deploy',{card},'Deploy '+name(m,card)));
}
export function tryEffectAutomatic(m:Match,w:Window):RequiredAction[]{
 const e=w.event as {kind?:string;side?:Side;source?:string}|undefined;
 if(w.timing!=='response'||e?.kind!=='sense-alter-destiny-successful'||!sides.includes(e.side!)||!e.source)return [];
 return active(m).map(c=>({...action('loss',{card:c.id,source:referenceCard(m,c.id),side:e.side,window:w.serial,interrupt:e.source},name(m,c.id)+' · '+(e.side==='light'?'Light':'Dark')+' loses 2 Force'),actor:c.owner}));
}
export function tryEffectInitiate(m:Match,r:Resolution){if(r.action.handler==='try-effect:deploy')moveCard(m,(r.action.payload as Payload).card,'playing');}
export function tryEffectResolve(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='try-effect:deploy'){
  if(r.cancelled||!canEnterTable(m,p.card))moveCard(m,p.card,'lost');
  else {moveCard(m,p.card,'table');deployed(m,p.card);}
 }else if(r.action.handler==='try-effect:loss'){
  // Successfully initiated mandatory results survive departure of their source.
  if(!r.cancelled)queueForceLoss(m,{side:p.side!,remaining:2,source:p.card,site:null,reductionUsed:false});
 }else throw Error('Unknown Sense/Alter consequence.');
}
export function assertTryEffects(m:Match){
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('try-effect:')){
  const p=r.action.payload as unknown as Payload,step=r.action.handler.slice('try-effect:'.length);
  if(!p||!['deploy','loss'].includes(step)||!tryEffectBlueprints.includes(m.cards[p.card]?.blueprint)||m.cards[p.card].owner!==r.actor||r.action.source!==p.card||r.action.id!==action(step,p,'').id||r.action.payment||r.action.unrespondable)throw Error('Invalid Sense/Alter Effect action.');
  if(step==='deploy'){if(m.cards[p.card].zone!=='playing'||p.source||p.side||p.window!==undefined||p.interrupt)throw Error('Invalid Sense/Alter Effect deployment.');}
  else {
   assertCardReference(m,p.source!,p.card);const index=m.stack.findIndex(f=>f.kind==='window'&&f.serial===p.window),w=m.stack[index],e=w?.kind==='window'?w.event as {kind?:string;side?:Side;source?:string}:undefined;
   if(p.source!.zone!=='table'||!sides.includes(p.side!)||index<0||index>=m.stack.indexOf(r)||w?.kind!=='window'||w.timing!=='response'||e?.kind!=='sense-alter-destiny-successful'||e.side!==p.side||e.source!==p.interrupt||!['1_109','1_267','1_71','1_234'].includes(m.cards[p.interrupt!]?.blueprint))throw Error('Invalid Sense/Alter success binding.');
  }
 }
}
