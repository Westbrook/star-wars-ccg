import {pendingReactSite,reactionSources,canDeployAsReact,registerReact,resolveCancelledReact,cancelDrainAfterReact} from './ground';
import {cardDefinition,name,deploymentPayment} from './board';
import {hasCharacteristic} from './characteristics';
import {vesselRule,roleAvailable} from './occupancy';
import {cargoDeploysAt} from './transport';
import {vesselDeploysAt} from './vessels';
import {deployValue} from './deploy-costs';
import {canPlayCard,canEnterTable,recordCardPlay} from './persona';
import {assertCardReference,referenceCard,sameCard,cardVersion,type CardReference} from './identity';
import {deployedTogether} from './deployment';
import {losePlayingCards} from './table';
import {moveCard} from './state';
import type {Match,Side,Window,Action,Resolution,Json} from './types';

type Pair={card:string;ship:CardReference;pilot:CardReference;target:CardReference;location:CardReference;cargo?:true;react?:true;grant?:CardReference};
const key=(p:Pair)=>'pair-deploy:'+p.card+':'+p.pilot.id+':'+p.target.id+(p.react?':react:via:'+p.grant!.id:'');
const fits=(m:Match,p:Pair)=>!!vesselRule(m,p.card)&&vesselRule(m,p.card)!.permanent===0&&cardDefinition(m,p.card).type==='Starship'&&roleAvailable(m,p.card,p.pilot.id,'pilot');
export function pilotDeployActions(m:Match,w:Window,side:Side):Action[]{
 const reactSite=pendingReactSite(m,w,side);
 if(!reactSite&&(w.timing!=='phase'||m.turn.phase!=='deploy'||m.turn.side!==side))return [];
 const grants=reactSite?reactionSources(m,reactSite,side):[null];
 const result:Action[]=[];
 for(const grant of grants)
 for(const card of m.players[side].hand.filter(id=>vesselRule(m,id)?.permanent===0&&cardDefinition(m,id).type==='Starship'&&canPlayCard(m,id)&&(!reactSite||canDeployAsReact(m,id))))
 for(const pilot of m.players[side].hand.filter(id=>cardDefinition(m,id).type==='Character'&&canPlayCard(m,id)&&roleAvailable(m,card,id,'pilot')&&(!reactSite||canDeployAsReact(m,id))))
 for(const target of (reactSite?[reactSite]:[...m.locations,...Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&cardDefinition(m,c.id).type==='Starship').map(c=>c.id)])){
  const cargo=cardDefinition(m,target).type==='Starship',site=cargo?m.cards[target].location!:target;
  if(reactSite&&vesselDeploysAt(m,card,site,false,true))continue;
  const spy=hasCharacteristic(m,pilot,'SPY');if(cargo?!cargoDeploysAt(m,card,target,spy):!vesselDeploysAt(m,card,site,true,spy))continue;
  const cost=deploymentPayment(m,pilot,site,true,spy);if(!cost)continue;cost[side]=(cost[side]??0)+deployValue(m,card);
  if(Object.entries(cost).some(([s,n])=>m.players[s as Side].force.length<n!))continue;
  const p:Pair={card,ship:referenceCard(m,card),pilot:referenceCard(m,pilot),target:referenceCard(m,target),location:referenceCard(m,site),...(cargo?{cargo:true as const}:{}),...(grant?{react:true as const,grant:referenceCard(m,grant)}:{})};
  result.push({id:key(p),handler:'pair:deploy',source:card,payload:p as unknown as Json,payment:cost,label:'Deploy '+name(m,card)+' with '+name(m,pilot)+' to '+name(m,target)+' · '+cost[side]+' Force'+(grant?' as a react using '+name(m,grant):'')});
 }return result;
}
export function pilotDeployInitiate(m:Match,r:Resolution){
 const p=r.action.payload as unknown as Pair;if(!canPlayCard(m,p.pilot.id))throw Error('Pilot cannot deploy.');if(p.react){registerReact(m,p.card);registerReact(m,p.pilot.id);}recordCardPlay(m,p.pilot.id);moveCard(m,p.card,'playing');moveCard(m,p.pilot.id,'playing');
}
export function pilotDeployResolve(m:Match,r:Resolution){
 if(resolveCancelledReact(m,r))return;
 const p=r.action.payload as unknown as Pair;
 if(r.cancelled||!sameCard(m,p.target)||!sameCard(m,p.location)||!canEnterTable(m,p.card)||!canEnterTable(m,p.pilot.id)||!fits(m,p)||!(p.cargo?m.cards[p.target.id].location===p.location.id&&cargoDeploysAt(m,p.card,p.target.id,hasCharacteristic(m,p.pilot.id,'SPY')):vesselDeploysAt(m,p.card,p.target.id,true,hasCharacteristic(m,p.pilot.id,'SPY')))){losePlayingCards(m,[p.card,p.pilot.id]);return;}
 moveCard(m,p.card,'table');moveCard(m,p.pilot.id,'table');m.cards[p.card].location=p.location.id;if(p.cargo)Object.assign(m.cards[p.card],{attachedTo:p.target.id,aboardRole:'starship'});Object.assign(m.cards[p.pilot.id],{location:p.location.id,attachedTo:p.card,aboardRole:'pilot'});if(p.react)cancelDrainAfterReact(m,r.actor,{react:true,card:p.card,site:p.location.id});deployedTogether(m,p.card,p.pilot.id);
}
export function pilotDeployView(m:Match){const frame=m.stack.find(f=>f.kind==='resolution'&&f.action.handler==='pair:deploy');if(!frame||frame.kind!=='resolution')return {deployingTogether:null};const p=frame.action.payload as unknown as Pair;return {deployingTogether:{ship:name(m,p.card),pilot:name(m,p.pilot.id),destination:name(m,p.target.id)}};}
export function assertPilotDeploy(m:Match){for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler==='pair:deploy'){
 const p=f.action.payload as unknown as Pair;if(!p||p.card!==p.ship?.id||f.action.source!==p.card||f.action.id!==key(p)||p.card===p.pilot?.id)throw Error('Invalid paired deployment.');
 if(p.react!==undefined){if(p.react!==true||p.cargo||!p.grant)throw Error('Invalid paired deployment react.');assertCardReference(m,p.grant);if(p.grant.zone!=='table'||m.cards[p.grant.id].owner!==f.actor||!['1_6','1_201'].includes(m.cards[p.grant.id].blueprint)||cardDefinition(m,p.location.id).subType!=='System')throw Error('Invalid paired react permission.');}else if(p.grant)throw Error('Unexpected paired react permission.');
 for(const ref of [p.ship,p.pilot,p.target,p.location])assertCardReference(m,ref);
 if(p.cargo!==undefined&&p.cargo!==true||p.ship.zone!=='hand'||p.pilot.zone!=='hand'||p.target.zone!=='table'||p.location.zone!=='table'||cardDefinition(m,p.location.id).type!=='Location'||(p.cargo?cardDefinition(m,p.target.id).type!=='Starship':p.target.id!==p.location.id)||!fits(m,p)||[p.ship,p.pilot].some(ref=>m.cards[ref.id].owner!==f.actor||m.cards[ref.id].zone!=='playing'||cardVersion(m,ref.id)!==ref.version+1))throw Error('Invalid paired deployment binding.');
}}
