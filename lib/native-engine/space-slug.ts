import {optionalActionWindow} from './action-timing';
import {cardDefinition} from './definitions';
import {deployed} from './deployment';
import {deployValue} from './deploy-costs';
import {gameTextActive} from './game-text';
import {assertCardReference,referenceCard,sameCard,type CardReference} from './identity';
import {canPlayCard} from './persona';
import {openWindow} from './runtime';
import {caveSector,isCave,sectorFamily} from './sectors';
import {moveCard} from './state';
import {other,type Action,type Json,type Match,type Resolution,type Side,type Window} from './types';

type Slug={card:CardReference;closed:boolean;used?:number};
type Payload={card:string;site?:CardReference;source?:CardReference;closed?:boolean};
const states=(m:Match)=>(m.data.spaceSlugs??[]) as unknown as Slug[];
export const isSpaceSlug=(m:Match,id:string)=>['4_6','4_112'].includes(m.cards[id]?.blueprint);
export const slugAt=(m:Match,site:string)=>Object.values(m.cards).find(c=>c.zone==='table'&&!c.attachedTo&&c.location===site&&isSpaceSlug(m,c.id))?.id;
export const slugState=(m:Match,id:string)=>states(m).find(s=>s.card.id===id&&sameCard(m,s.card));
export const bellySlug=(m:Match,cave:string)=>isCave(m,cave)?slugAt(m,caveSector(m,cave)??''):undefined;
export const caveMouthOpen=(m:Match,cave:string)=>!slugState(m,bellySlug(m,cave)??'')?.closed;
/** Cave Rules, not the slug's text: losing the slug also loses the contents. */
export function bellyLossCards(m:Match,hosts:string[]):string[]{
 const locations=m.locations.filter(cave=>{const slug=bellySlug(m,cave);return !!slug&&hosts.includes(slug);});
 return Object.values(m.cards).filter(c=>c.zone==='table'&&c.location&&locations.includes(c.location)).map(c=>c.id);
}
const action=(step:string,p:Payload):Action=>({id:'slug:'+step+':'+p.card+(p.site?':'+p.site.id:''),handler:'slug:'+step,source:p.card,label:step,payload:p as unknown as Json});
export function slugActions(m:Match,w:Window,side:Side):Action[]{
 if(!optionalActionWindow(w))return [];
 const out:Action[]=[];
 if(m.turn.side===side&&m.turn.phase==='deploy')for(const card of m.players[side].hand.filter(id=>isSpaceSlug(m,id)&&canPlayCard(m,id)))for(const site of m.locations.filter(id=>sectorFamily(m,id)==='big-one'&&!slugAt(m,id))){const cost=deployValue(m,card);out.push({...action('deploy',{card,site:referenceCard(m,site)}),label:'Deploy Space Slug at Big One · '+cost+' Force',payment:{[side]:cost}});}
 for(const s of states(m).filter(s=>sameCard(m,s.card)&&m.cards[s.card.id].owner===side&&s.used!==m.turn.number&&gameTextActive(m,s.card.id)))out.push({...action('mouth',{card:s.card.id,source:s.card,closed:!s.closed}),label:(s.closed?'Open':'Close')+' Space Slug’s mouth'});
 return out;
}
export function slugInitiate(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='slug:deploy')moveCard(m,p.card,'playing');
 if(r.action.handler==='slug:mouth'){const s=slugState(m,p.card);if(!s)throw Error('Missing Space Slug state.');s.used=m.turn.number;}
}
export function slugResolve(m:Match,r:Resolution):void{
 const p=r.action.payload as unknown as Payload;
 if(r.action.handler==='slug:deploy'){
  if(r.cancelled||!sameCard(m,p.site!)||slugAt(m,p.site!.id)){moveCard(m,p.card,'lost');return;}
  moveCard(m,p.card,'table');m.cards[p.card].location=p.site!.id;
  m.data.spaceSlugs=[...states(m).filter(s=>s.card.id!==p.card),{card:referenceCard(m,p.card),closed:false}] as unknown as Json;deployed(m,p.card);return;
 }
 if(r.action.handler!=='slug:mouth')throw Error('Unknown Space Slug action.');
 const s=slugState(m,p.card);if(r.cancelled||!s||!sameCard(m,p.source!))return;s.closed=p.closed!;
 openWindow(m,'response',other(r.actor),{kind:s.closed?'slug-mouth-closed':'slug-mouth-opened',card:p.card});
}
export function slugView(m:Match){return {spaceSlugs:Object.fromEntries(states(m).filter(s=>sameCard(m,s.card)).map(s=>[s.card.id,{closed:s.closed,used:s.used===m.turn.number}])),bellies:Object.fromEntries(m.locations.filter(id=>bellySlug(m,id)).map(id=>[id,{slug:bellySlug(m,id)!,closed:!caveMouthOpen(m,id)}]))};}
export function assertSpaceSlugs(m:Match):void{
 const ss=states(m);if(!Array.isArray(ss)||new Set(ss.map(s=>s.card?.id)).size!==ss.length)throw Error('Invalid Space Slug state.');
 for(const s of ss){assertCardReference(m,s.card);if(!isSpaceSlug(m,s.card.id)||s.card.zone!=='table'||typeof s.closed!=='boolean'||s.used!==undefined&&(!Number.isSafeInteger(s.used)||s.used<1||s.used>m.turn.number))throw Error('Invalid Space Slug mouth.');}
 for(const c of Object.values(m.cards).filter(c=>c.zone==='table'&&isSpaceSlug(m,c.id))){if(!c.location||sectorFamily(m,c.location)!=='big-one'||c.attachedTo||!slugState(m,c.id)||Object.values(m.cards).filter(x=>x.zone==='table'&&x.location===c.location&&isSpaceSlug(m,x.id)).length!==1)throw Error('Space Slug requires its unique Big One habitat.');}
 for(const f of m.stack)if(f.kind==='resolution'&&f.action.handler.startsWith('slug:')){
  const p=f.action.payload as unknown as Payload;if(!p||!isSpaceSlug(m,p.card)||f.action.source!==p.card||m.cards[p.card].owner!==f.actor||!['slug:deploy','slug:mouth'].includes(f.action.handler)||f.action.id!==action(f.action.handler.slice(5),p).id)throw Error('Invalid Space Slug action.');
  if(p.site){assertCardReference(m,p.site);if(p.site.zone!=='table'||sectorFamily(m,p.site.id)!=='big-one')throw Error('Invalid slug deployment habitat.');}
  if(f.action.handler==='slug:deploy'&&(!p.site||m.cards[p.card].zone!=='playing')||f.action.handler==='slug:mouth'&&(!p.source||typeof p.closed!=='boolean'))throw Error('Invalid slug continuation.');
  if(p.source){assertCardReference(m,p.source);if(p.source.id!==p.card||p.source.zone!=='table')throw Error('Invalid slug source.');}
 }
}
