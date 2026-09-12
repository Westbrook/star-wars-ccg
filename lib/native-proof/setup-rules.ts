import {definition,other} from './catalog';
import recordedOrder from '../../data/native-proof/setup-shuffle.json';
import type {Command,Match,Projection,Prompt,PublicCard,Side} from './types';

const sides:Side[]=['dark','light'];
const title=(side:Side)=>side==='dark'?'Dark':'Light';
// Setup-only profiles. This does not implement these locations' later actions.
export const setupSites:Record<string,{system:string;icons:Record<Side,number>}>=Object.fromEntries([
 ['101_1','Death Star',1,1],['101_4','Death Star',1,0],['1_124','Death Star',1,1],['1_284','Death Star',1,0],['1_285','Death Star',1,1],
 ['1_129','Tatooine',1,1],['1_130','Tatooine',1,1],['1_131','Tatooine',1,1],['1_132','Tatooine',1,2],['1_291','Tatooine',1,1],['1_292','Tatooine',1,1],['1_293','Tatooine',1,1],['1_295','Tatooine',2,1],
].map(([id,system,dark,light])=>[id,{system,icons:{dark,light}}])) as Record<string,{system:string;icons:Record<Side,number>}>;
const addLog=(m:Match,text:string)=>m.log.push({n:(m.log.at(-1)?.n||0)+1,text});
const named=(m:Match,id:string)=>definition(m.cards[id].blueprint).name;
const pair=(m:Match)=>sides.map(side=>m.setup!.selected[side]!);
const sameTitle=(m:Match)=>named(m,pair(m)[0])===named(m,pair(m)[1]);
const sameSystem=(m:Match)=>setupSites[m.cards[pair(m)[0]].blueprint].system===setupSites[m.cards[pair(m)[1]].blueprint].system;
function candidates(m:Match,side:Side){
 const rejected=new Set(m.setup!.rejected.flat());
 // AR p38 Example 5 excludes the selected physical copies, not every copy of
 // that title. The pinned GEMP pregame implementation differs on this edge.
 return m.players[side].reserve.filter(id=>setupSites[m.cards[id].blueprint]&&!rejected.has(id)&&(m.scenario!=='first-contact'||m.cards[id].blueprint===(side==='light'?'1_124':'1_284')));
}
function phase(m:Match,stage:NonNullable<Match['setup']>['stage'],name:string){m.setup!.stage=stage;m.phase=name;}
export function initializeSetup(m:Match){
 m.setup={stage:'choose',round:1,selected:{dark:null,light:null},revealed:false,collisionPriority:null,covered:null,rejected:[],shuffleOrder:structuredClone(recordedOrder),startPasses:0,generation:null};
 addLog(m,'Choose starting locations privately from the authored 60-card decks. Both choices are revealed together.');
 if(m.scenario==='first-contact'){
  // A saved, authored outcome keeps every reachable hand and Force card within
  // verified behavior. It is not an arbitrary shuffle or a full-match gate.
  for(const side of sides){const pool=m.players[side].reserve;const trooper=side==='light'?'1_28':'1_194',jawa=side==='light'?'1_12':'1_182',barrier=side==='light'?'1_105':'1_249',blaster=side==='light'?'1_152':'1_317';const of=(b:string)=>pool.filter(id=>m.cards[id].blueprint===b);const hand=[...of(trooper).slice(0,4),...of(jawa),...of(barrier),of(blaster)[0]];const front=[...hand,...of(trooper).slice(4),...of(side==='light'?'1_153':'1_312')];m.setup.shuffleOrder[side]=[...front,...pool.filter(id=>!front.includes(id))];}
  addLog(m,'Fixed Death Star starting sites and recorded eight-card hands: four troopers, two Tatooine-only Jawas, a Barrier and a Blaster. Continue through both first turns; stop before Dark activates on turn 3.');
 }else addLog(m,'This study uses a recorded shuffle outcome, including any opponent cut, and stops before the first ordinary Activate action.');
}
export function setupPrompt(m:Match,seat?:Side):Prompt|null{
 if(m.complete)return null;const s=m.setup!;
 let side:Side='dark',heading='',detail='',choices:Prompt['choices']=[],automatic=false;
 if(s.stage==='choose'){
  side=seat&&!s.selected[seat]?seat:!s.selected.dark?'dark':'light';
  heading='Choose your starting location';detail=(m.scenario==='first-contact'?'This integration study fixes two Death Star sites to keep all later actions verified. ':'')+'Your choice stays private until both players commit. Duplicate copies are identified individually; rejected physical cards cannot be selected again.';
  choices=candidates(m,side).map(id=>({id:'select:'+id,card:id,label:named(m,id)+' · '+id.toUpperCase(),tone:'primary',forceIcons:{...setupSites[m.cards[id].blueprint].icons}}));
 }else if(s.stage==='reveal'){
  heading='Both locations are chosen';detail='Reveal the two committed choices together. Neither player can change a committed choice.';choices=[{id:'reveal',label:'Reveal both starting locations',tone:'primary'}];
 }else if(s.stage==='collision'){
  side=s.collisionPriority!;heading='The same starting location';detail='Both players selected '+named(m,s.selected[side]!)+'. '+title(side)+' may accept having their copy covered by the opponent’s. Only the top card’s text and icons will apply.';
  choices=[{id:'accept-conversion',label:'Accept conversion · opponent’s copy on top',tone:'primary'},{id:'decline-conversion',label:side==='dark'?'Decline · ask Light':'Decline · both choose again'}];
 }else if(s.stage==='place'){
  const orient=!s.covered&&sameSystem(m);side=orient?'light':'dark';heading='Place the starting locations';detail=s.covered?'Both cards stay on the table. The converted copy sits underneath and contributes no icons or game text.':orient?'These two sites are adjacent. Either orientation is legal at this two-site setup.':'The sites belong to different systems and form separate, nonadjacent groups.';
  choices=orient?[{id:'place:left',label:'Place Light’s site left of Dark’s',tone:'primary'},{id:'place:right',label:'Place Light’s site right of Dark’s'}]:[{id:'place',label:s.covered?'Place the converted location stack':'Place both starting locations',tone:'primary'}];
 }else if(s.stage==='shuffle'){
  heading='Prepare the Reserve Decks';detail='Return rejected starting choices, then use the recorded shuffle outcome. These decks have no Starting Interrupt. Restart repeats the same fixture order.';
  choices=[{id:'prepare',label:'Prepare both Reserve Decks',tone:'primary'}];
 }else if(s.stage==='draw'){
  heading='Draw the opening hands';detail='Both players draw eight cards simultaneously. Each hand is private to its owner in paired play.';choices=[{id:'draw-opening',label:'Draw eight cards for each player',tone:'primary'}];
 }else if(s.stage==='start'){
  side=s.startPasses===0?'dark':'light';heading='Dark start of turn actions';detail='Neither deck has an applicable start-of-turn action here. These timing opportunities finish before Force generation is counted.';choices=[{id:'pass',label:'Pass empty opportunity'}];automatic=true;
 }
 return {id:m.engine+':'+m.revision,side,title:heading,detail,choices,automatic};
}
export function applySetup(before:Match,side:Side,command:Command):Match{
 const p=setupPrompt(before,side);if(!p||p.side!==side)throw Error('This seat has no pending choice.');
 if(command.prompt!==p.id)throw Error('This choice is stale. Refresh the saved match.');
 if(!p.choices.some(c=>c.id===command.choice))throw Error('This choice is not legal in the current fixture.');
 const m=structuredClone(before),s=m.setup!,choice=command.choice;m.revision++;
 if(s.stage==='choose'){
  s.selected[side]=choice.slice(7);addLog(m,title(side)+' committed a starting location. Its identity remains private.');
  if(s.selected.dark&&s.selected.light)phase(m,'reveal','Reveal starting locations');
 }else if(s.stage==='reveal'){
  s.revealed=true;addLog(m,'Starting locations revealed together: Dark — '+named(m,s.selected.dark!)+'; Light — '+named(m,s.selected.light!)+'.');
  if(sameTitle(m)){s.collisionPriority='dark';phase(m,'collision','Starting-location clash');}else phase(m,'place','Place starting locations');
 }else if(s.stage==='collision'){
  if(choice==='accept-conversion'){
   s.covered=s.selected[side];s.collisionPriority=null;phase(m,'place','Place starting locations');addLog(m,title(side)+' accepts conversion. '+title(other(side))+'’s copy will be on top.');
  }else if(side==='dark'){s.collisionPriority='light';addLog(m,'Dark declines conversion. Light may now accept or choose again.');}
  else{
   s.rejected.push(pair(m));s.selected={dark:null,light:null};s.revealed=false;s.collisionPriority=null;s.round++;phase(m,'choose','Starting locations');
   addLog(m,'Both players decline. Set those physical copies aside and choose again. Other copies of the same title remain eligible.');
  }
 }else if(s.stage==='place'){
  for(const id of pair(m)){const c=m.cards[id];m.players[c.owner].reserve.splice(m.players[c.owner].reserve.indexOf(id),1);c.zone='table';}
  if(s.covered){const active=pair(m).find(id=>id!==s.covered)!;m.cards[s.covered].coveredBy=active;m.locations=[active];}
  else m.locations=choice==='place:left'?[s.selected.light!,s.selected.dark!]:[s.selected.dark!,s.selected.light!];
  phase(m,'shuffle','Prepare Reserve Decks');addLog(m,'Starting locations deployed without a Force cost. Each player has 59 cards remaining.');
 }else if(s.stage==='shuffle'){
  for(const side of sides)m.players[side].reserve=s.shuffleOrder[side].filter(id=>m.cards[id].zone==='reserve');
  phase(m,'draw','Opening hands');addLog(m,'Rejected choices returned. Both 59-card Reserve Decks use the recorded shuffle outcome. No Starting Interrupts are present.');
 }else if(s.stage==='draw'){
  // Both draws are one saved mutation. Their source order is a recorded
  // outcome, not a claim of random deck generation or a GEMP RNG algorithm.
  for(const side of sides){const p=m.players[side];p.hand=p.reserve.splice(0,8);for(const id of p.hand)m.cards[id].zone='hand';}
  phase(m,'start','Start of turn');addLog(m,'Both players draw eight cards simultaneously. Each has 51 cards in Reserve. Dark begins the first turn.');
 }else if(s.stage==='start'){
  s.startPasses++;
  if(s.startPasses===2){s.generation=Object.fromEntries(sides.map(side=>[side,1+m.locations.reduce((n,id)=>n+setupSites[m.cards[id].blueprint].icons[side],0)])) as Record<Side,number>;phase(m,'complete','Activate');m.complete=true;addLog(m,'Dark reaches Activate with generation '+s.generation.dark+'. Setup is complete; no Force has been activated.'+(m.scenario==='first-contact'?' The same saved cards now continue into the first turn.':' This study stops before ordinary phase actions.'));}
 }
 return m;
}
export function assertSetup(m:Match){
 const s=m.setup!;const validSide=(value:unknown)=>sides.includes(value as Side);
 if(m.active!=='dark'||m.turn||m.cycle||m.battle||m.winner||m.drained.length||m.stack.length||!['choose','reveal','collision','place','shuffle','draw','start','complete'].includes(s.stage))throw Error('Invalid setup continuation.');
 if(!Number.isInteger(s.round)||s.round!==s.rejected.length+1||s.round>4||!Number.isInteger(s.startPasses)||s.startPasses<0||s.startPasses>2)throw Error('Invalid setup round.');
 const rejected=s.rejected.flat();if(new Set(rejected).size!==rejected.length)throw Error('A rejected physical card was reused.');
 for(const group of s.rejected)if(group.length!==2||m.cards[group[0]]?.owner!=='dark'||m.cards[group[1]]?.owner!=='light'||!group.every(id=>!!setupSites[m.cards[id]?.blueprint])||named(m,group[0])!==named(m,group[1]))throw Error('Invalid rejected location pair.');
 for(const side of sides){
  const id=s.selected[side];if(m.scenario==='first-contact'&&id!==null&&m.cards[id]?.blueprint!==(side==='light'?'1_124':'1_284'))throw Error('Unsupported integrated starting location.');if(id!==null&&(m.cards[id]?.owner!==side||!setupSites[m.cards[id].blueprint]||rejected.includes(id)))throw Error('Invalid committed starting location.');
  const order=s.shuffleOrder[side];if(order.length!==60||new Set(order).size!==60||order.some(id=>m.cards[id]?.owner!==side))throw Error('Invalid recorded setup order.');
 }
 const both=!!s.selected.dark&&!!s.selected.light,revealed=!['choose','reveal'].includes(s.stage),placed=['shuffle','draw','start','complete'].includes(s.stage),drawn=['start','complete'].includes(s.stage);
 if((s.stage==='choose'?both:!both)||s.revealed!==revealed||m.complete!==(s.stage==='complete')||m.complete!==(s.startPasses===2)||(!drawn&&s.startPasses!==0))throw Error('Invalid setup stage.');
 const expectedPhase={choose:'Starting locations',reveal:'Reveal starting locations',collision:'Starting-location clash',place:'Place starting locations',shuffle:'Prepare Reserve Decks',draw:'Opening hands',start:'Start of turn',complete:'Activate'}[s.stage];if(m.phase!==expectedPhase)throw Error('Invalid setup phase.');
 if(s.stage==='collision'?!validSide(s.collisionPriority)||!sameTitle(m):s.collisionPriority!==null)throw Error('Invalid conversion priority.');
 if(s.covered!==null&&(!['place','shuffle','draw','start','complete'].includes(s.stage)||!pair(m).includes(s.covered)||!sameTitle(m)))throw Error('Invalid converted location.');
 if(both&&revealed&&s.stage!=='collision'&&sameTitle(m)&&!s.covered)throw Error('Matching starting sites need conversion.');
 const expectedLocations=placed?pair(m).filter(id=>id!==s.covered):[];
 if(new Set(m.locations).size!==expectedLocations.length||m.locations.length!==expectedLocations.length||m.locations.some(id=>!expectedLocations.includes(id)))throw Error('Invalid setup table.');
 for(const c of Object.values(m.cards)){
  if(c.location||c.attachedTo||c.hit||!['table','reserve','hand'].includes(c.zone))throw Error('Unsupported card action entered setup.');
  if((c.zone==='table')!==(placed&&pair(m).includes(c.id)))throw Error('Invalid starting-card disposition.');
  if(c.coveredBy!==undefined&&(c.id!==s.covered||!placed||c.coveredBy!==expectedLocations[0]))throw Error('Invalid supporting location.');
 }
 if(placed&&s.covered&&m.cards[s.covered].coveredBy!==expectedLocations[0])throw Error('Missing supporting location relation.');
 for(const side of sides){
  const p=m.players[side];if(p.force.length||p.used.length||p.lost.length||p.destiny.length||p.hand.length!==(drawn?8:0)||p.reserve.length!==(drawn?51:placed?59:60))throw Error('Invalid opening pile counts.');
  if(['draw','start','complete'].includes(s.stage)){
   const order=s.shuffleOrder[side].filter(id=>!pair(m).includes(id));const same=(a:string[],b:string[])=>a.join(',')===b.join(',');
   if(!same(p.reserve,order.slice(drawn?8:0))||drawn&&!same(p.hand,order.slice(0,8)))throw Error('Opening draw differs from the saved order.');
  }
 }
 if(s.stage==='complete'){for(const side of sides)if(s.generation?.[side]!==1+m.locations.reduce((n,id)=>n+setupSites[m.cards[id].blueprint].icons[side],0))throw Error('Invalid starting Force generation.');}
 else if(s.generation!==null)throw Error('Force generation counted before start actions finished.');
}
export function projectSetup(m:Match,seat:Side,includeStudy:boolean,card:(id:string)=>PublicCard):NonNullable<Projection['setup']>{
 const s=m.setup!,shown=(side:Side)=>s.revealed||side===seat;
 return {stage:s.stage,round:s.round,committed:{dark:!!s.selected.dark,light:!!s.selected.light},selected:{dark:shown('dark')&&s.selected.dark?card(s.selected.dark):null,light:shown('light')&&s.selected.light?card(s.selected.light):null},candidates:s.stage==='choose'&&!s.selected[seat]?candidates(m,seat).map(card):[],rejected:s.rejected.map(group=>group.map(card)),covered:s.covered?card(s.covered):null,generation:s.generation?{...s.generation}:null,groups:['Death Star','Tatooine'].map(name=>({name,cards:m.locations.filter(id=>setupSites[m.cards[id].blueprint].system===name).map(card)})).filter(group=>group.cards.length),...(includeStudy&&['start','complete'].includes(s.stage)?{openingHands:{dark:m.players.dark.hand.map(card),light:m.players.light.hand.map(card)}}:{})};
}
