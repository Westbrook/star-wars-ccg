import {definition,other,printed,sites} from './catalog';
import {setupSites} from './setup-rules';
import type {Frame,Match,Prompt,Side,Zone} from './types';

export const isLocationStudy=(s:string)=>['changing-front','docking-transit','control-room'].includes(s);
export const locationPool=(side:Side)=>side==='light'?['1_28','1_26','1_105','1_124','1_129','1_132']:['1_194','1_181','1_249','1_284','1_285','1_291','101_4'];
export const bayCosts:Record<string,Record<Side,number>>={'1_124':{dark:1,light:1},'1_285':{dark:0,light:2},'1_129':{dark:2,light:1},'1_291':{dark:1,light:2}};
const name=(m:Match,id:string)=>definition(m.cards[id].blueprint).name;
const system=(m:Match,id:string)=>setupSites[m.cards[id].blueprint]?.system;
export const locationAdjacent=(m:Match,a:string,b:string)=>system(m,a)===system(m,b)&&Math.abs(m.locations.indexOf(a)-m.locations.indexOf(b))===1;
export const locationGeneration=(m:Match,side:Side,blueprints=m.locations.map(id=>m.cards[id].blueprint))=>1+blueprints.reduce((n,b)=>n+sites[b][side],0);
const rank=(m:Match,id:string)=>bayCosts[m.cards[id].blueprint]?1:system(m,id)==='Death Star'?0:2;
export function placements(m:Match,id:string):{key:string;label:string}[]{
 const c=m.cards[id];if(!setupSites[c.blueprint]||!locationPool(c.owner).includes(c.blueprint))return [];
 const same=m.locations.find(at=>name(m,at)===name(m,id));
 if(same)return m.cards[same].owner===c.owner?[]:[{key:'over-'+same,label:'Convert '+name(m,same)+' · characters stay here'}];
 const group=m.locations.filter(at=>system(m,at)===system(m,id));
 if(!group.length)return [{key:'at-'+m.locations.length,label:'Start a separate '+system(m,id)+' group'}];
 const start=m.locations.indexOf(group[0]);
 return Array.from({length:group.length+1},(_,i)=>i).filter(i=>{
  const result=[...group];result.splice(i,0,id);const values=result.map(at=>rank(m,at));
  return values.every((v,k)=>!k||v>=values[k-1])||values.every((v,k)=>!k||v<=values[k-1]);
 }).map(i=>({key:'at-'+(start+i),label:i===0?'Place before '+name(m,group[0]):i===group.length?'Place after '+name(m,group.at(-1)!):'Place between '+name(m,group[i-1])+' and '+name(m,group[i])}));
}
export function transitEligible(m:Match,from:string){return Object.values(m.cards).filter(c=>c.zone==='table'&&c.owner===m.active&&c.location===from&&['1_28','1_194'].includes(c.blueprint)&&!m.turn!.moved.includes(c.id)&&!m.turn!.restrictions.some(r=>r.target===c.id)).map(c=>c.id);}
const roomControlled=(m:Match,id:string)=>Object.values(m.cards).some(c=>c.zone==='table'&&c.location===id&&c.owner==='dark'&&printed(c.blueprint,'ability')>0)&&!Object.values(m.cards).some(c=>c.zone==='table'&&c.location===id&&c.owner==='light'&&printed(c.blueprint,'ability')>0);
export function locationChoices(m:Match):Prompt['choices']{
 if(!isLocationStudy(m.scenario))return [];
 if(m.turn!.stage==='deploy')return [
  ...m.players[m.active].hand.filter(id=>placements(m,id).length).map(id=>({id:'site:'+id,card:id,label:'Deploy '+name(m,id)+' '+id.toUpperCase()+' · free',tone:'primary' as const,forceIcons:sites[m.cards[id].blueprint]})),
  ...(m.active==='dark'&&m.players.dark.reserve.length&&m.locationStudy!.failedSearchTurn!==m.turn!.number?m.locations.filter(id=>m.cards[id].blueprint==='101_4'&&roomControlled(m,id)).map(id=>({id:'search:'+id,label:'Search Reserve · deploy a docking bay',tone:'primary' as const})):[]),
 ];
 if(m.turn!.stage==='move')return m.locations.filter(id=>bayCosts[m.cards[id].blueprint]&&transitEligible(m,id).length&&m.players[m.active].force.length>=bayCosts[m.cards[id].blueprint][m.active]).flatMap(from=>m.locations.filter(to=>to!==from&&bayCosts[m.cards[to].blueprint]).map(to=>({id:'transit:'+from+':'+to,label:'Docking-bay transit · '+name(m,from)+' → '+name(m,to)+' · '+bayCosts[m.cards[from].blueprint][m.active]+' Force for the group',tone:'primary' as const})));
 return [];
}
const searchChoices=(m:Match)=>[...m.players.dark.reserve].sort().filter(id=>bayCosts[m.cards[id].blueprint]&&placements(m,id).length);
export function locationPrompt(m:Match,f:Frame):Prompt|null{
 const base={id:m.engine+':'+m.revision,side:m.active,automatic:false};
 if(f.kind==='location-place')return {...base,title:'Place '+name(m,f.card),detail:'Locations deploy without a Force cost. Only legal placements are offered. Converting replaces the active text and icons; every character stays at this location.',choices:placements(m,f.card).map(p=>({id:'place-site:'+p.key,label:p.label,tone:'primary' as const}))};
 if(f.kind==='bay-search'){
  if(f.stage==='verify')return {...base,side:'light',title:'Verify the unsuccessful search',detail:'No docking bay can legally deploy. Both players may inspect the Reserve cards without their order. After verification, Dark reshuffles and cannot use this search again this turn.',choices:[{id:'verify-search',label:'Verify and reshuffle',tone:'primary'}]};
  const legal=searchChoices(m);return {...base,side:'dark',title:'Choose a docking bay from Reserve',detail:'Choose a legal target, including a bay that converts the opponent’s version. The remaining Reserve Deck will be reshuffled. Its order is hidden.',choices:legal.length?legal.map(id=>({id:'search-card:'+id,card:id,label:'Deploy '+name(m,id)+' '+id.toUpperCase(),tone:'primary' as const,forceIcons:sites[m.cards[id].blueprint]})):[{id:'search-failed',label:'No legal docking bay · reveal for verification',tone:'primary'}]};
 }
 if(f.kind==='transit-select'){
  const cost=bayCosts[m.cards[f.from].blueprint][m.active];
  return {...base,title:'Choose your traveling party',detail:name(m,f.from)+' → '+name(m,f.to)+'. '+cost+' Force for the entire group. Guards, Barriered characters and characters that already moved cannot join.',choices:[...transitEligible(m,f.from).map(id=>({id:'toggle-transit:'+id,card:id,label:(f.selected.includes(id)?'Remove ':'Add ')+name(m,id)+' '+id.toUpperCase(),tone:f.selected.includes(id)?'primary' as const:undefined})),...(f.selected.length?[{id:'confirm-transit',label:'Move '+f.selected.length+' character'+(f.selected.length===1?'':'s')+' · '+cost+' Force total',tone:'primary' as const}]:[]),{id:'cancel-transit',label:'Cancel · keep everyone here'}]};
 }
 return null;
}
export function shuffleReserve(m:Match,random:()=>number){
 const a=m.players.dark.reserve;
 // Rejection sampling avoids modulo bias. Randomness is supplied only by the
 // server; the resulting order is saved in the same command transaction.
 for(let i=a.length-1;i>0;i--){const limit=0x100000000-0x100000000%(i+1);let n:number;do{n=random();if(!Number.isSafeInteger(n)||n<0||n>=0x100000000)throw Error('Invalid shuffle entropy.');}while(n>=limit);const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}
 m.locationStudy!.shuffles++;
}
type Operations={move:(m:Match,id:string,zone:Zone,location?:string)=>void;log:(m:Match,text:string)=>void;window:(m:Match,text:string,priority:Side)=>void};
export function applyLocationChoice(m:Match,f:Frame,choice:string,ops:Operations,random:()=>number):boolean{
 const {move,log,window}=ops;
 if(f.kind==='bay-search'){
  if(choice==='search-failed'){f.stage='verify';m.locationStudy!.failedSearchTurn=m.turn!.number;log(m,'Dark found no legal docking bay. Light may verify the Reserve Deck before reshuffling.');}
  else if(choice==='verify-search'){m.stack.pop();shuffleReserve(m,random);log(m,'Reserve verified and reshuffled. This search is unavailable for the rest of the turn.');window(m,'Reserve reshuffled responses','light');}
  else {m.stack.pop();m.stack.push({kind:'location-place',card:choice.slice(12),source:'reserve'});}
  return true;
 }
 if(f.kind==='location-place'){
  const key=choice.slice(11),id=f.card,from=f.source;
  move(m,id,'table');
  if(key.startsWith('over-')){
   const old=key.slice(5);m.cards[old].coveredBy=id;m.locations[m.locations.indexOf(old)]=id;
   for(const c of Object.values(m.cards)){if(c.location===old)c.location=id;if(c.coveredBy===old)c.coveredBy=id;}
   m.drained=m.drained.map(at=>at===old?id:at);m.turn!.battled=m.turn!.battled.map(at=>at===old?id:at);if(m.battle?.site===old)m.battle.site=id;
   log(m,name(m,id)+' converts the opposing version. Characters remain; only the new top card’s text and icons apply.');
  }else {m.locations.splice(Number(key.slice(3)),0,id);log(m,name(m,id)+' deploys to its chosen position.');}
  m.locationStudy!.deployed.push(id);m.stack.pop();
  if(from==='reserve'){shuffleReserve(m,random);log(m,'Dark’s remaining Reserve Deck is reshuffled and saved. Another successful search is allowed while Dark controls the room.');}
  window(m,'Location just deployed responses',other(m.active));return true;
 }
 if(f.kind==='transit-select'){
  if(choice==='cancel-transit'){m.stack.pop();const parent=m.stack.at(-1);if(parent?.kind==='turn')parent.priority=m.active;return true;}
  if(choice.startsWith('toggle-transit:')){const id=choice.slice(15);f.selected=f.selected.includes(id)?f.selected.filter(c=>c!==id):[...f.selected,id];return true;}
  const cost=bayCosts[m.cards[f.from].blueprint][m.active];for(let i=0;i<cost;i++)move(m,m.players[m.active].force[0],'used');
  for(const id of f.selected){move(m,id,'table',f.to);m.turn!.moved.push(id);}
  log(m,f.selected.length+' characters transit together to '+name(m,f.to)+' for '+cost+' Force total. Each has used its regular move.');m.stack.pop();window(m,'Docking-bay transit completed responses',other(m.active));return true;
 }
 return false;
}
export function assertLocations(m:Match){
 if(!isLocationStudy(m.scenario)){if(m.locationStudy||m.stack.some(f=>['location-place','bay-search','transit-select'].includes(f.kind)))throw Error('Unexpected location continuation.');return;}
 const s=m.locationStudy;if(!s||!m.cycle||!m.turn||!Array.isArray(s.generationSites)||s.generationSites.some(b=>!sites[b])||!Number.isInteger(s.shuffles)||s.shuffles<0||s.shuffles>60||s.failedSearchTurn!==null&&(!Number.isInteger(s.failedSearchTurn)||s.failedSearchTurn<1||s.failedSearchTurn>m.turn.number))throw Error('Invalid location study.');
 if(!m.locations.length||new Set(m.locations).size!==m.locations.length||new Set(m.locations.map(id=>name(m,id))).size!==m.locations.length)throw Error('Duplicate active location.');
 for(const id of m.locations){const c=m.cards[id];if(c?.zone!=='table'||c.coveredBy||!sites[c.blueprint]||!locationPool(c.owner).includes(c.blueprint))throw Error('Unsupported active location.');}
 for(const group of ['Death Star','Tatooine']){const ids=m.locations.filter(id=>system(m,id)===group),indices=ids.map(id=>m.locations.indexOf(id)),values=ids.map(id=>rank(m,id));if(indices.some((n,i)=>i>0&&n!==indices[i-1]+1)||!values.every((n,i)=>!i||n>=values[i-1])&&!values.every((n,i)=>!i||n<=values[i-1]))throw Error('Illegal location arrangement.');}
 for(const c of Object.values(m.cards)){
  if(c.zone!=='lost'&&!locationPool(c.owner).includes(c.blueprint))throw Error('Unsupported reachable location-study card.');
  if(c.coveredBy&&(c.zone!=='table'||!m.locations.includes(c.coveredBy)||name(m,c.id)!==name(m,c.coveredBy)||c.location))throw Error('Invalid converted location.');
  if(c.zone==='table'&&!c.coveredBy&&!m.locations.includes(c.id)&&(!['1_28','1_194','1_26','1_181'].includes(c.blueprint)||!c.location))throw Error('Unsupported location-study table card.');
 }
 if(!Array.isArray(s.deployed)||new Set(s.deployed).size!==s.deployed.length||s.deployed.some(id=>m.cards[id]?.zone!=='table'||!setupSites[m.cards[id].blueprint]))throw Error('Invalid deployed location history.');
 for(const f of m.stack){
  if(f.kind==='location-place'&&(m.turn.stage!=='deploy'||!['hand','reserve'].includes(f.source)||m.cards[f.card]?.owner!==m.active||m.cards[f.card]?.zone!==f.source||!placements(m,f.card).length||f.source==='reserve'&&(m.active!=='dark'||!bayCosts[m.cards[f.card].blueprint])))throw Error('Invalid pending location.');
  if(f.kind==='bay-search'&&(m.active!=='dark'||m.turn.stage!=='deploy'||!['choose','verify'].includes(f.stage)||!m.locations.includes(f.room)||m.cards[f.room].blueprint!=='101_4'||!roomControlled(m,f.room)||f.stage==='verify'&&searchChoices(m).length))throw Error('Invalid pending Reserve search.');
  if(f.kind==='transit-select'&&(m.turn.stage!=='move'||!m.locations.includes(f.from)||!m.locations.includes(f.to)||f.from===f.to||!bayCosts[m.cards[f.from].blueprint]||!bayCosts[m.cards[f.to].blueprint]||new Set(f.selected).size!==f.selected.length||f.selected.some(id=>!transitEligible(m,f.from).includes(id))||m.players[m.active].force.length<bayCosts[m.cards[f.from].blueprint][m.active]))throw Error('Invalid pending transit.');
 }
}
