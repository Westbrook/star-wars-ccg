import {definition,manifest,other,printed,scenarios,sites} from './catalog';
import type {Battle,Card,Command,Frame,Match,Pile,Player,Projection,Prompt,PublicCard,ScenarioId,Side,Zone} from './types';

// A deliberately closed conformance runner. It does not infer card abilities from
// printed text, accept arbitrary boards/decks, or claim full starter support.
const sides:Side[]=['light','dark'];
const piles:Pile[]=['reserve','force','used','lost','hand','destiny'];
const empty=():Player=>({reserve:[],force:[],used:[],lost:[],hand:[],destiny:[]});
const label=(s:Side)=>s==='light'?'Light':'Dark';
const top=(m:Match)=>m.stack[m.stack.length-1];
function log(m:Match,text:string){m.log.push({n:(m.log.at(-1)?.n||0)+1,text});if(m.log.length>120)m.log.shift();}
function name(m:Match,id:string){return definition(m.cards[id].blueprint).name;}
export function life(m:Match,s:Side){const p=m.players[s];return p.reserve.length+p.force.length+p.used.length+p.destiny.length;}
function move(m:Match,id:string,zone:Zone,location?:string){
 const c=m.cards[id];if(!c)throw Error('Missing physical card.');
 if(c.zone!=='table'&&c.zone!=='playing'){const a=m.players[c.owner][c.zone];const n=a.indexOf(id);if(n<0)throw Error('Corrupt card zone.');a.splice(n,1);}
 c.zone=zone;delete c.location;if(location)c.location=location;
 if(zone!=='table'&&zone!=='playing')m.players[c.owner][zone].unshift(id);
}
function pull(m:Match,s:Side,blueprint:string,zone:Zone,location?:string){
 const id=m.players[s].reserve.find(id=>m.cards[id].blueprint===blueprint);if(!id)throw Error('Fixture is outside the authored card list.');move(m,id,zone,location);return id;
}
function putTop(m:Match,s:Side,blueprint:string){const a=m.players[s].reserve;const n=a.findIndex(id=>m.cards[id].blueprint===blueprint);if(n<0)throw Error('Fixture card unavailable.');a.unshift(...a.splice(n,1));}
function window(m:Match,text:string,priority:Side,event?:'battle-destiny-complete'){m.stack.push({kind:'window',label:text,priority,passes:0,...(event?{event}:{})});}
function finish(m:Match,text:string){m.stack=[];m.complete=true;log(m,text);}

export function createScenario(scenario:ScenarioId):Match{
 if(!scenarios.some(s=>s.id===scenario))throw Error('Unknown conformance scenario.');
 const m:Match={schema:1,engine:scenario==='takeel'?'native-proof-2':'native-proof-1',scenario,revision:0,active:'dark',phase:scenarios.find(s=>s.id===scenario)!.phase,cards:{},players:{light:empty(),dark:empty()},locations:[],stack:[],battle:null,drained:[],log:[],complete:false,winner:null};
 for(const deck of manifest.decks){const s=deck.side as Side;for(const [i,b]of deck.main.entries()){const id=s[0]+String(i+1).padStart(3,'0');m.cards[id]={id,blueprint:b,owner:s,zone:'reserve'};m.players[s].reserve.push(id);}}
 const site=pull(m,'light','1_124','table');m.locations.push(site);
 if(scenario==='activation'){
  // Legal checkpoint after start-of-turn generation: personal1 + ownsiteicon1.
  // Hands are empty, so neither player has an omitted top-level/response action.
  m.stack=[{kind:'activation',used:0,generation:2,priority:'dark',passes:0}];
  log(m,'Fixture: Dark Activate phase, generation 2 (personal 1 + site icon 1).');
 }else if(scenario==='drain'){
  pull(m,'dark','1_194','table',site);
  pull(m,'light','1_28','hand');pull(m,'light','1_28','force');pull(m,'light','1_28','used');
  m.stack=[{kind:'drain',stage:'start',site,remaining:0}];
  log(m,'Fixture: Dark controls Docking Bay 327; its Light icon permits a Force drain of 1.');
 }else if(scenario==='battle'||scenario==='takeel'){
  const participants={light:[] as string[],dark:[] as string[]};
  for(const s of sides){for(let n=0;n<4;n++)participants[s].push(pull(m,s,s==='light'?'1_28':'1_194','table',site));pull(m,s,s==='light'?'1_28':'1_194','force');}
  if(scenario==='takeel'){pull(m,'dark','1_194','force');pull(m,'dark','1_269','hand');}
  // Known oracle fixtures, not shuffled opening hands or a new-match setup.
  putTop(m,'light','1_12');putTop(m,'dark','1_194');
  m.battle={site,initiator:'dark',participants,destiny:{light:null,dark:null},drawn:{light:false,dark:false},power:{light:4,dark:4},attrition:{light:0,dark:0},damage:{light:0,dark:0},next:'dark'};
  m.stack=[{kind:'battle',stage:'start',side:'dark'}];
  log(m,'Fixture: four Rebel Troopers face four Stormtroopers. Both sides have ability 4.');
  if(scenario==='takeel')log(m,'Response study: Dark begins with 2 Force, including the battle initiation cost.');
 }else{
  for(const s of sides){const b=s==='light'?'1_28':'1_194';pull(m,s,b,'force');pull(m,s,b,'used');pull(m,s,s==='light'?'1_12':'1_182','used');}
  m.stack=[{kind:'recirculation',next:'dark'}];
  log(m,'Fixture: end of Dark turn, before either player recirculates.');
 }
 assertMatch(m);return m;
}

function members(m:Match,s:Side){return m.battle!.participants[s].filter(id=>m.cards[id].zone==='table'&&m.cards[id].location===m.battle!.site);}
function ability(m:Match,s:Side){return members(m,s).reduce((n,id)=>n+printed(m.cards[id].blueprint,'ability'),0);}
function mayLose(m:Match,s:Side){return piles.some(z=>m.players[s][z].length>0);}
function lossChoices(m:Match,s:Side,prefix='lose'){
 const p=m.players[s];return [
  ...(['reserve','force','used','destiny'] as const).filter(z=>p[z].length).map(z=>({id:prefix+':'+z,label:'Lose 1 from '+(z==='reserve'?'Reserve Deck':z==='destiny'?'unresolved destiny':z[0].toUpperCase()+z.slice(1)+' Pile')})),
  ...p.hand.map(id=>({id:prefix+':hand:'+id,label:'Lose '+name(m,id)+' from hand',card:id})),
 ];
}
function pending(m:Match,s:Side){const b=m.battle!;return b.damage[s]>0||(b.attrition[s]>0&&members(m,s).length>0);}
function checkLife(m:Match){for(const s of [m.active,other(m.active)])if(life(m,s)===0){m.winner=other(s);finish(m,label(s)+' has no Life Force. '+label(other(s))+' wins.');return true;}return false;}
function settle(m:Match){
 for(let steps=0;steps<40&&!m.complete;steps++){
  if(checkLife(m))return;
  const f=top(m);if(!f){finish(m,'Conformance checkpoint complete.');return;}
  if(f.kind==='finish'){finish(m,f.message);return;}
  if(f.kind==='interrupt'){
   const b=m.battle!;
   // The paid Interrupt remains off table until both card-play responses pass.
   // No cancellation, cost modifier or other Interrupt exists in this fixture.
   [b.destiny.light,b.destiny.dark]=[b.destiny.dark,b.destiny.light];b.destinySwitched=true;
   move(m,f.card,'lost');m.stack.pop();
   log(m,'Takeel switches the destiny numbers: Light '+b.destiny.light+' · Dark '+b.destiny.dark+'. The drawn cards stay in their owners’ Used piles; Takeel goes to Lost.');
   // Empty Force-use and pile-placement responses settle internally in this
   // closed fixture. The parent response window resumes at the opponent.
   continue;
  }
  if(f.kind==='destiny'){
   m.stack.pop();move(m,f.card,'used');log(m,label(f.side)+' places the resolved destiny card on top of Used.');continue;
  }
  if(f.kind==='drain'){
   if(f.stage==='loss'&&f.remaining===0){f.stage='end';window(m,'Force drain completed responses',other(m.active));continue;}
   if(f.stage==='end'){finish(m,'Force drain checkpoint complete. The drain attempt remains recorded.');return;}
  }
  if(f.kind==='battle'){
   const b=m.battle!;
   if(f.stage==='weapons'){f.stage='destiny';f.side=b.initiator;window(m,'Weapons segment — no weapons or playable actions in this fixture',b.initiator);continue;}
   if(f.stage==='destiny'&&b.drawn[f.side]){
    if(f.side===b.initiator){f.side=other(f.side);continue;}
    f.stage='totals';window(m,'Power segment actions',b.initiator);window(m,'Both players finished battle destiny responses',other(b.initiator),m.scenario==='takeel'?'battle-destiny-complete':undefined);continue;
   }
   if(f.stage==='totals'){
    for(const s of sides){b.power[s]=members(m,s).reduce((n,id)=>n+printed(m.cards[id].blueprint,'power'),0)+(b.destiny[s]??0);b.attrition[s]=b.destiny[other(s)]??0;}
    for(const s of sides)b.damage[s]=Math.max(0,b.power[other(s)]-b.power[s]);
    log(m,'Total power: Light '+b.power.light+' · Dark '+b.power.dark+'. Attrition: Light '+b.attrition.light+' · Dark '+b.attrition.dark+'.');
    f.stage='damage';b.next=b.initiator;window(m,'Battle result responses',other(b.initiator));continue;
   }
   if(f.stage==='damage'){
    for(const s of sides)if(!members(m,s).length)b.attrition[s]=0;
    if(!pending(m,'light')&&!pending(m,'dark')){f.stage='end';window(m,'Battle just ended responses',other(b.initiator));window(m,'End of battle actions',other(b.initiator));continue;}
    if(!pending(m,b.next))b.next=other(b.next);
   }
   if(f.stage==='end'){finish(m,'Battle checkpoint complete. All damage and attrition are satisfied.');return;}
  }
  return;
 }
 if(!m.complete)throw Error('Conformance resolution exceeded its step budget.');
}

function responseChoices(m:Match,f:Extract<Frame,{kind:'window'}>):Prompt['choices']{
 if(m.scenario!=='takeel'||f.event!=='battle-destiny-complete'||f.priority!=='dark')return [];
 const b=m.battle!;const card=m.players.dark.hand.find(id=>m.cards[id].blueprint==='1_269');
 if(!card||m.players.dark.force.length<1||!b.drawn.light||!b.drawn.dark||b.destiny.light===null||b.destiny.dark===null)return [];
 return [{id:'play:'+card,label:'Play Takeel · use 1 Force',card,tone:'primary',destinyPreview:{light:b.destiny.dark,dark:b.destiny.light}}];
}

export function prompt(m:Match):Prompt|null{
 if(m.complete)return null;const f=top(m);if(!f)return null;
 const base={id:m.engine+':'+m.revision,side:m.active,title:'',detail:'',choices:[] as Prompt['choices'],automatic:false};
 if(f.kind==='window'){
  const actions=responseChoices(m,f);
  return {...base,side:f.priority,title:actions.length?'Battle destiny response':f.label,detail:f.event?'Both players have finished their battle destiny choices. Responses happen before the totals are applied.':'Neither player has a legal response in this exact fixture. The empty opportunity is preserved in the saved continuation.',choices:[...actions,{id:'pass',label:actions.length?'Pass · keep the destiny numbers':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='activation'){
  const max=Math.min(f.generation-f.used,m.players[m.active].reserve.length);const can=f.priority===m.active&&max>0;
  return {...base,side:f.priority,title:label(f.priority)+' action opportunity',detail:f.used+' of '+f.generation+' generated Force activated. Each activation moves one top Reserve card to the top of Force.',choices:[...(can?[{id:'activate',label:'Activate 1 Force',tone:'primary' as const}]:[]),{id:'pass',label:can?'Pass activation opportunity':'Pass empty opportunity'}],automatic:!can};
 }
 if(f.kind==='drain'){
  if(f.stage==='start')return {...base,title:'Initiate a Force drain',detail:'Dark has presence and Light has none here. Drain amount uses the opponent’s Force icons.',choices:[{id:'drain',label:'Force drain at Docking Bay 327',tone:'primary'},{id:'stop',label:'Leave this checkpoint'}]};
  return {...base,side:other(m.active),title:'Choose Force to lose',detail:f.remaining+' Force remaining. A card from hand or the top of Reserve, Force or Used can satisfy this loss.',choices:lossChoices(m,other(m.active))};
 }
 if(f.kind==='battle'){
  const b=m.battle!;
  if(f.stage==='start')return {...base,title:'Initiate battle',detail:'Use 1 Force. Both sides have presence and four participating troopers.',choices:[{id:'battle',label:'Use 1 Force · begin battle',tone:'primary'},{id:'stop',label:'Leave this checkpoint'}]};
  if(f.stage==='destiny'){
   const can=ability(m,f.side)>=4&&m.players[f.side].reserve.length>0;
   return {...base,side:f.side,title:'Battle destiny',detail:'Participating ability '+ability(m,f.side)+'. Four ability permits one base battle destiny; drawing it is optional.',choices:[...(can?[{id:'draw-destiny',label:'Draw battle destiny',tone:'primary' as const}]:[]),{id:'skip-destiny',label:'Draw no battle destiny'}]};
  }
  if(f.stage==='damage'){
   const s=b.next;return {...base,side:s,title:'Satisfy battle losses',detail:'Attrition '+b.attrition[s]+' · battle damage '+b.damage[s]+'. A forfeit reduces both totals. Losing Force pays only battle damage.',choices:[
    ...members(m,s).map(id=>{const value=printed(m.cards[id].blueprint,'forfeit');return {id:'forfeit:'+id,label:'Forfeit '+name(m,id)+' · '+value,card:id,lossPreview:{kind:'forfeit' as const,value,attrition:Math.max(0,b.attrition[s]-value),damage:Math.max(0,b.damage[s]-value)}}}),
    ...(b.damage[s]>0&&mayLose(m,s)?lossChoices(m,s).map(c=>({...c,lossPreview:{kind:'force' as const,value:1,attrition:b.attrition[s],damage:Math.max(0,b.damage[s]-1)}})):[]),
   ]};
  }
 }
 if(f.kind==='recirculation')return {...base,side:f.next,title:label(f.next)+' recirculates',detail:'Place the entire Used pile beneath Reserve without reversing its order. Cards in Force stay there.',choices:[{id:'recirculate',label:'Resolve recirculation',tone:'primary'}]};
 throw Error('Unresolved internal continuation.');
}

export function applyCommand(before:Match,side:Side,command:Command):Match{
 assertMatch(before);const p=prompt(before);if(!p||p.side!==side)throw Error('This seat has no pending choice.');
 if(command.prompt!==p.id)throw Error('This choice is stale. Refresh the saved match.');
 if(!p.choices.some(c=>c.id===command.choice))throw Error('This choice is not legal in the current fixture.');
 const m=structuredClone(before);const f=top(m);const choice=command.choice;m.revision++;
 if(choice==='stop'){finish(m,'Checkpoint left without initiating the action.');return m;}
 if(f.kind==='window'){
  if(choice.startsWith('play:')){
   const card=choice.slice(5);const b=m.battle!;
   // Initiation is atomic: the legal-choice check above verified card, timing
   // and Force. Save cost and pending card together before permitting responses.
   move(m,m.players[side].force[0],'used');move(m,card,'playing');
   b.destinyBeforeSwitch={light:b.destiny.light!,dark:b.destiny.dark!};
   f.passes=0;f.priority=other(side);
   m.stack.push({kind:'interrupt',card,side,effect:'switch-battle-destiny'});
   log(m,'Dark uses 1 Force to play Takeel. Its result waits for responses.');
   window(m,'Responses to Takeel',other(side));
  }else{
   if(f.event)log(m,label(side)+' passes the battle destiny response opportunity.');
   f.passes++;if(f.passes===2)m.stack.pop();else f.priority=other(f.priority);
  }
 }else if(f.kind==='activation'){
  if(choice==='activate'){
   const id=m.players[m.active].reserve[0];move(m,id,'force');f.used++;f.passes=0;f.priority=other(m.active);log(m,label(m.active)+' activates 1 Force.');window(m,'Force activation responses',other(m.active));
  }else{f.passes++;if(f.passes===2)finish(m,'Activation checkpoint complete: '+f.used+' Force activated.');else f.priority=other(f.priority);}
 }else if(f.kind==='drain'){
  if(choice==='drain'){
   if(m.drained.includes(f.site))throw Error('This location already attempted a drain.');
   m.drained.push(f.site);f.remaining=sites[m.cards[f.site].blueprint][other(m.active)];f.stage='loss';log(m,label(m.active)+' initiates a Force drain of '+f.remaining+'.');window(m,'Force drain initiated responses',other(m.active));
  }else{lose(m,side,choice);f.remaining--;window(m,'Force loss responses',other(side));}
 }else if(f.kind==='battle'){
  const b=m.battle!;
  if(choice==='battle'){
   const id=m.players[side].force[0];if(!id)throw Error('Battle requires 1 Force.');move(m,id,'used');f.stage='weapons';log(m,label(side)+' uses 1 Force to initiate battle.');window(m,'Battle initiated responses',other(side));
  }else if(choice==='draw-destiny'||choice==='skip-destiny'){
   b.drawn[side]=true;
   if(choice==='draw-destiny'){
    const id=m.players[side].reserve[0];const value=printed(m.cards[id].blueprint,'destiny');move(m,id,'destiny');b.destiny[side]=value;log(m,label(side)+' draws '+name(m,id)+' for battle destiny '+value+'.');
    m.stack.push({kind:'destiny',side,card:id,value});window(m,'Battle destiny just drawn responses',other(side));
   }else log(m,label(side)+' chooses not to draw battle destiny.');
  }else if(choice.startsWith('forfeit:')){
   const id=choice.slice(8);const value=printed(m.cards[id].blueprint,'forfeit');move(m,id,'lost');b.attrition[side]=Math.max(0,b.attrition[side]-value);b.damage[side]=Math.max(0,b.damage[side]-value);b.next=other(side);log(m,label(side)+' forfeits '+name(m,id)+' for '+value+', satisfying attrition and battle damage together.');window(m,'Card forfeited responses',other(side));
  }else{lose(m,side,choice);b.damage[side]--;b.next=other(side);window(m,'Battle damage loss responses',other(side));}
 }else if(f.kind==='recirculation'){
  const p=m.players[side];for(const id of p.used)m.cards[id].zone='reserve';p.reserve.push(...p.used);const count=p.used.length;p.used=[];log(m,label(side)+' recirculates '+count+' cards beneath Reserve.');
  if(side===m.active)f.next=other(side);else finish(m,'Recirculation checkpoint complete. Both Used piles are empty; Force piles are unchanged.');
 }
 settle(m);assertMatch(m);return m;
}

function lose(m:Match,s:Side,choice:string){
 const [,z,id]=choice.split(':');const zone=z as Pile;
 const card=zone==='hand'?id:m.players[s][zone]?.[0];if(!card||!m.players[s][zone]?.includes(card))throw Error('The selected Force-loss source is no longer available.');
 move(m,card,'lost');log(m,label(s)+' loses '+name(m,card)+' from '+zone+'.');
}

export function assertMatch(m:Match){
 if(m.schema!==1||m.engine!==(m.scenario==='takeel'?'native-proof-2':'native-proof-1')||!scenarios.some(s=>s.id===m.scenario))throw Error('Unsupported saved engine version.');
 if(!Number.isSafeInteger(m.revision)||m.revision<0||m.stack.length>24)throw Error('Invalid saved continuation.');
 const seen=new Set<string>();for(const s of sides){for(const z of piles)for(const id of m.players[s][z]){if(seen.has(id)||m.cards[id]?.owner!==s||m.cards[id]?.zone!==z)throw Error('Card conservation failed.');seen.add(id);}}
 for(const f of m.stack)if(f.kind==='interrupt'){
  if(m.engine!=='native-proof-2'||f.effect!=='switch-battle-destiny'||f.side!=='dark'||m.cards[f.card]?.blueprint!=='1_269'||m.cards[f.card]?.owner!==f.side||m.cards[f.card]?.zone!=='playing'||seen.has(f.card))throw Error('Invalid pending Interrupt.');
  seen.add(f.card);
 }
 for(const c of Object.values(m.cards)){definition(c.blueprint);if(c.zone==='table'){if(seen.has(c.id))throw Error('Duplicate table card.');seen.add(c.id);}if(c.location&&!m.locations.includes(c.location))throw Error('Invalid saved location.');}
 if(seen.size!==120||Object.keys(m.cards).length!==120)throw Error('The authored 120-card pool was not preserved.');
 for(const d of manifest.decks){const actual=Object.values(m.cards).filter(c=>c.owner===d.side).map(c=>c.blueprint).sort();if(actual.join(',')!==[...d.main].sort().join(','))throw Error('Saved card pool differs from source.');}
 if(JSON.stringify(m).length>160000)throw Error('Saved fixture exceeded its memory budget.');
}

function publicCard(m:Match,id:string):PublicCard{const c=m.cards[id],d=definition(c.blueprint);return {id,blueprint:c.blueprint,name:d.name,image:d.image,side:c.owner,type:d.type,text:d.text,stats:d.stats as Record<string,string>,...(c.location?{location:c.location}:{})};}
// This baseline is the immutable native-proof-1 fixture, including for older
// saves. Changing its initial card order requires a new supported engine version.
// Current piles always come from the actual saved match, never the expected result.
function recirculationStudy(m:Match):import('./types').RecirculationStudy{
 const initial=createScenario('recirculation');
 const same=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);
 const copy=(p:Player)=>({reserve:[...p.reserve],used:[...p.used],force:[...p.force]});
 const frame=m.stack.find(f=>f.kind==='recirculation');
 return {
  cards:Object.fromEntries(Object.values(m.cards).filter(c=>c.zone!=='table').map(c=>{const d=definition(c.blueprint);return [c.id,{id:c.id,name:d.name,image:d.image}]})),
  players:Object.fromEntries(sides.map(s=>{
   const before=copy(initial.players[s]),current=copy(m.players[s]);
   const resolved=m.complete||!!frame&&frame.next!==m.active&&s===m.active;
   return [s,{before,current,resolved,orderPreserved:resolved?current.used.length===0&&same(current.reserve,[...before.reserve,...before.used]):null,reserveUnchanged:same(current.reserve.slice(0,before.reserve.length),before.reserve),forceUnchanged:same(current.force,before.force)}];
  })) as import('./types').RecirculationStudy['players'],
 };
}
export function project(m:Match,seat:Side,includeStudy=false):Projection{
 assertMatch(m);const p=prompt(m);const players={} as Projection['players'];
 for(const s of sides){const source=m.players[s];players[s]={counts:Object.fromEntries(piles.map(z=>[z,source[z].length])) as Projection['players'][Side]['counts'],life:life(m,s),hand:s===seat?source.hand.map(id=>publicCard(m,id)):[],lost:source.lost.slice(0,1).map(id=>publicCard(m,id)),destiny:source.destiny.map(id=>publicCard(m,id))};}
 const b=m.battle;const frame=m.stack.find(f=>f.kind==='battle');
 // Active saves expose totals only after calculation, including nested response
 // windows. In this closed fixture a completed battle with both destiny choices
 // recorded has resolved losses; leaving before initiation has neither choice.
 // This also reads existing native-proof-1 saves without changing stored rules.
 const ready=!!b&&(frame?.stage==='damage'||frame?.stage==='end'||m.complete&&b.drawn.light&&b.drawn.dark);
 const losses=ready?Object.fromEntries(sides.map(s=>[s,{attrition:b!.attrition[s],damage:b!.damage[s],initialAttrition:b!.destiny[other(s)]??0,initialDamage:Math.max(0,b!.power[other(s)]-b!.power[s])}])) as Record<Side,import('./types').LossBalance>:null;
 return {scenario:m.scenario,engine:m.engine,revision:m.revision,active:m.active,phase:m.phase,seat,complete:m.complete,winner:m.winner,players,locations:m.locations.map(id=>publicCard(m,id)),table:Object.values(m.cards).filter(c=>c.zone==='table'&&!m.locations.includes(c.id)).map(c=>publicCard(m,c.id)),prompt:p&&p.side===seat?p:p?{...p,choices:[]}:null,log:m.log,battle:b?structuredClone(b):null,losses,...(m.scenario==='takeel'?{playing:Object.values(m.cards).filter(c=>c.zone==='playing').map(c=>publicCard(m,c.id))}:{}),...(includeStudy&&m.scenario==='recirculation'?{recirculationStudy:recirculationStudy(m)}:{})};
}
