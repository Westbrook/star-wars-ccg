import {cardDefinition} from './definitions';
import {gameTextActive} from './game-text';
import {queueForceLoss} from './ground';
import {referenceCard,assertCardReference,sameCard,type CardReference} from './identity';
import {loseSiteCards,siteLossCards} from './table';
import {openWindow} from './runtime';
import {other,type Action,type Json,type Match,type Resolution,type Side} from './types';
type Destruction={site:CardReference;source:CardReference;stage:'relocate'|'cards'|'loss'|'flip'|'complete';lost:CardReference[];force:number};
export const blownAway=(m:Match,id:string)=>m.cards[id]?.blownAway===true;
const history=(m:Match)=>(m.data.siteDestruction??=[]) as unknown as Destruction[];
const action=(index:number,step:string):Action=>({id:'blow-site:'+index+':'+step,label:'Resolve site destruction',handler:'blow-site:'+step,payload:{index}});
const queue=(m:Match,index:number,step:string,side:Side)=>m.stack.push({kind:'resolution',actor:side,action:action(index,step),cancelled:false});
/** AR Appendix C: site casualties precede Force loss; the site stays face up
 * until that loss resolves, so its own destruction text remains available. */
export function blowAwaySite(m:Match,site:string,source:string,side:Side){
 if(!m.locations.includes(site)||cardDefinition(m,site).subType!=='Site'||blownAway(m,site))throw Error('Invalid site destruction target.');
 const records=history(m),index=records.length;records.push({site:referenceCard(m,site),source:referenceCard(m,source),stage:'relocate',lost:[],force:0});queue(m,index,'cards',side);openWindow(m,'response',other(side),{kind:'blown-away-relocate',site,source});
}
export function blownAwayResolve(m:Match,r:Resolution){
 const {index}=r.action.payload as {index:number},s=history(m)[index],step=r.action.handler;
 if(!sameCard(m,s.site)||blownAway(m,s.site.id)){s.stage='complete';return;}
 if(step==='blow-site:cards'){
  s.stage='cards';s.lost=siteLossCards(m,s.site.id,s.source.id).map(id=>referenceCard(m,id));queue(m,index,'discard',r.actor);
  if(s.lost.length)openWindow(m,'response',other(r.actor),{kind:'about-to-lose',site:s.site.id,source:s.source.id,cards:s.lost.map(c=>c.id),cardRefs:s.lost as unknown as Json,cause:'blown-away'});
 }else if(step==='blow-site:discard'){
  queue(m,index,'loss',r.actor);const cards=s.lost.filter(ref=>sameCard(m,ref)).map(ref=>ref.id);if(cards.length)loseSiteCards(m,cards);
 }else if(step==='blow-site:loss'){
  s.stage='loss';s.force=m.cards[s.site.id].blueprint==='3_61'&&gameTextActive(m,s.site.id)?8:0;queue(m,index,'flip',r.actor);if(s.force)queueForceLoss(m,{side:'light',remaining:s.force,source:'blown-away',site:s.site.id,reductionUsed:false});
 }else if(step==='blow-site:flip'){
  s.stage='complete';m.cards[s.site.id].blownAway=true;openWindow(m,'response',other(r.actor),{kind:'blown-away',site:s.site.id,source:s.source.id});
 }else throw Error('Unknown site destruction step.');
}
export function assertBlownAway(m:Match){
 const all=m.data.siteDestruction;if(all!==undefined&&!Array.isArray(all))throw Error('Invalid site destruction history.');
 for(const c of Object.values(m.cards))if(c.blownAway!==undefined&&(c.blownAway!==true||!m.locations.includes(c.id)||cardDefinition(m,c.id).subType!=='Site'))throw Error('Invalid blown-away site.');
 for(const s of (all??[]) as unknown as Destruction[]){assertCardReference(m,s.site);assertCardReference(m,s.source);if(s.site.zone!=='table'||cardDefinition(m,s.site.id).subType!=='Site'||!['relocate','cards','loss','flip','complete'].includes(s.stage)||!Array.isArray(s.lost)||new Set(s.lost.map(c=>c.id)).size!==s.lost.length||![0,8].includes(s.force))throw Error('Invalid site destruction record.');for(const ref of s.lost){assertCardReference(m,ref);if(!['table','stacked','buried'].includes(ref.zone)||cardDefinition(m,ref.id).type==='Location')throw Error('Invalid site casualty reference.');}if(['relocate','cards'].includes(s.stage)&&s.force!==0)throw Error('Premature site Force loss.');}
 for(const r of m.stack)if(r.kind==='resolution'&&r.action.handler.startsWith('blow-site:')){const {index}=r.action.payload as {index:number};if(!Number.isSafeInteger(index)||!Array.isArray(all)||!all[index]||!['cards','discard','loss','flip'].some(k=>r.action.handler==='blow-site:'+k))throw Error('Invalid site destruction continuation.');const s=all[index] as unknown as Destruction;const stages:Record<string,string[]>={'blow-site:cards':['relocate'],'blow-site:discard':['cards'],'blow-site:loss':['cards'],'blow-site:flip':['loss']};if(!stages[r.action.handler].includes(s.stage)||r.actor!==m.cards[s.source.id].owner)throw Error('Invalid site destruction stage.');}
}
export const destructionView=(m:Match)=>({blownSites:m.locations.filter(id=>blownAway(m,id))});
