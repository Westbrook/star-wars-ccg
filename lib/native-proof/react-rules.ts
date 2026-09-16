import {definition,printed,sites} from './catalog';
import type {Match,Frame,Choice,Side} from './types';

export const isReactStudy=(s:string)=>['react-battle','react-drain','react-deploy','react-drain-deploy','react-barrier'].includes(s);
// CZ-3 has no ability. Only this explicit droid handler contributes zero;
// missing numeric values on other cards still fail closed.
export const reactAbility=(m:Match,id:string)=>isReactStudy(m.scenario)&&m.cards[id].blueprint==='1_6'?0:printed(m.cards[id].blueprint,'ability');
const adjacent=(m:Match,a:string,b:string)=>Math.abs(m.locations.indexOf(a)-m.locations.indexOf(b))===1;
export function siteAbility(m:Match,side:Side,site:string){return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.location===site&&definition(c.blueprint).type==='Character').reduce((n,c)=>n+reactAbility(m,c.id),0);}
export function participatingAbility(m:Match,side:Side,site:string){return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===side&&c.location===site&&definition(c.blueprint).type==='Character'&&!m.reactStudy?.barred?.includes(c.id)).reduce((n,c)=>n+reactAbility(m,c.id),0);}
export function reactChoices(m:Match,f:Extract<Frame,{kind:'react-window'}>):Choice[]{
 if(!isReactStudy(m.scenario)||f.priority!=='light'||m.active!=='dark'||m.reactStudy!.cancelled)return [];
 const force=m.players.light.force.length,used=m.reactStudy!.used;
 const moves=Object.values(m.cards).filter(c=>c.owner==='light'&&c.zone==='table'&&c.blueprint==='1_30'&&c.location&&adjacent(m,c.location,f.site)&&!used.includes(c.id)&&force>=1);
 const cz=Object.values(m.cards).some(c=>c.owner==='light'&&c.zone==='table'&&c.blueprint==='1_6'&&c.location&&(c.location===f.site||adjacent(m,c.location,f.site)));
 const deploy=cz&&(sites[m.cards[f.site].blueprint].light>0||siteAbility(m,'light',f.site)>0)?m.players.light.hand.filter(id=>['1_28','1_30'].includes(m.cards[id].blueprint)&&!used.includes(id)&&printed(m.cards[id].blueprint,'deploy')<=force):[];
 return [...moves.map(c=>({id:c.id,method:'move' as const,cost:1})),...deploy.map(id=>({id,method:'deploy' as const,cost:printed(m.cards[id].blueprint,'deploy')}))].map(({id,method,cost})=>({id:'react:'+method+':'+id,card:id,label:(method==='move'?'Move ':'Deploy ')+definition(m.cards[id].blueprint).name+' '+id.toUpperCase()+' · '+cost+' Force',tone:'primary',reactPreview:{cost,site:f.site,method,ability:participatingAbility(m,'light',f.site)+reactAbility(m,id)}}));
}
export function assertReact(m:Match){
 if(!isReactStudy(m.scenario)){if(m.reactStudy||m.stack.some(f=>f.kind==='react'||f.kind==='react-window'))throw Error('Unexpected react continuation.');return;}
 const r=m.reactStudy;if(!r||m.active!=='dark'||m.locations.length!==2||m.cards[m.locations[0]]?.blueprint!=='1_124'||m.cards[m.locations[1]]?.blueprint!=='1_284')throw Error('Invalid react study board.');
 if(new Set(r.used).size!==r.used.length||new Set(r.arrived).size!==r.arrived.length||r.arrived.some(id=>!r.used.includes(id))||r.used.some(id=>m.cards[id]?.owner!=='light'||!['1_28','1_30'].includes(m.cards[id].blueprint))||r.site!==null&&!m.locations.includes(r.site)||r.cancelled&&!['react-drain','react-drain-deploy'].includes(m.scenario))throw Error('Invalid react history.');
 for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(!['1_28','1_30','1_6','1_194'].includes(c.blueprint)||!c.location||c.attachedTo))throw Error('Unsupported react table.');
 for(const side of ['light','dark'] as const)if(m.players[side].hand.some(id=>side==='dark'?!(m.scenario==='react-barrier'&&m.cards[id].blueprint==='1_249'):!['1_28','1_30','1_12'].includes(m.cards[id].blueprint)))throw Error('Unsupported react hand.');
 if((m.scenario==='react-barrier')!==Array.isArray(r.barred))throw Error('Missing or unexpected react Barrier state.');
 if(r.barred&&(m.scenario!=='react-barrier'||new Set(r.barred).size!==r.barred.length||r.barred.some(id=>!r.arrived.includes(id))))throw Error('Invalid react Barrier history.');
 for(const f of m.stack){
  if(f.kind==='react-window'&&(!m.locations.includes(f.site)||f.site!==r.site||!['light','dark'].includes(f.priority)||![0,1].includes(f.passes)||!m.stack.some(p=>p.kind===f.event)))throw Error('Invalid react opportunity.');
  if(f.kind==='react'&&(!r.used.includes(f.card)||r.arrived.includes(f.card)||f.site!==r.site||!m.stack.some(p=>p.kind==='react-window')||f.cost!==(f.method==='move'?1:printed(m.cards[f.card].blueprint,'deploy'))||m.cards[f.card].zone!==(f.method==='move'?'table':'playing')))throw Error('Invalid pending react.');
 }
}
