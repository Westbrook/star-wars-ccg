import {isReactStudy,reactAbility,siteAbility,participatingAbility,reactChoices,assertReact} from './react-rules';
import {isLossStudy,lossAmount,lossResponses} from './loss-rules';
import {isDesertStudy,desertCharacters,characterForfeit,groupPowerBonus,tuskensAt} from './desert-rules';
import {isOpeningStudy,openingEndpoint,secondContactSafe} from './opening-rules';
import {characterCanDeploy,characterCanMove,characterDeployCost,characterPower,characterView,isGarrisonStudy,supportedCharacter,usesCharacterRules} from './character-rules';
import {definition,manifest,other,printed,scenarios,sites} from './catalog';
import {armoryChoices,firingChoices,hitMembers,isWeaponStudy,weaponRules,weaponBonus} from './weapon-rules';
import {applySetup,assertSetup,initializeSetup,projectSetup,setupPrompt,setupSites} from './setup-rules';
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
 if(c.zone!=='table'&&c.zone!=='playing'&&c.zone!=='leaving'){const a=m.players[c.owner][c.zone];const n=a.indexOf(id);if(n<0)throw Error('Corrupt card zone.');a.splice(n,1);}
 c.zone=zone;delete c.location;delete c.attachedTo;if(zone!=='table')delete c.hit;if(location)c.location=location;
 if(zone!=='table'&&zone!=='playing'&&zone!=='leaving')m.players[c.owner][zone].unshift(id);
}
function pull(m:Match,s:Side,blueprint:string,zone:Zone,location?:string){
 const id=m.players[s].reserve.find(id=>m.cards[id].blueprint===blueprint);if(!id)throw Error('Fixture is outside the authored card list.');move(m,id,zone,location);return id;
}
function putTop(m:Match,s:Side,blueprint:string){const a=m.players[s].reserve;const n=a.findIndex(id=>m.cards[id].blueprint===blueprint);if(n<0)throw Error('Fixture card unavailable.');a.unshift(...a.splice(n,1));}
function window(m:Match,text:string,priority:Side,event?:'battle-destiny-complete'|'character-deployed',target?:string){m.stack.push({kind:'window',label:text,priority,passes:0,...(event?{event}:{}),...(target?{target}:{})});}
function finish(m:Match,text:string){m.stack=[];m.complete=true;log(m,text);}
const isTurnStudy=(scenario:ScenarioId)=>isDesertStudy(scenario)||isGarrisonStudy(scenario)||scenario==='barrier'||scenario==='imperial-barrier'||scenario==='next-turn'||isOpeningStudy(scenario);
const engineFor=(scenario:ScenarioId)=>scenario==='react-drain-deploy'?'native-proof-14':['react-drain-deploy','react-barrier','last-force'].includes(scenario)?'native-proof-13':isReactStudy(scenario)?'native-proof-12':isLossStudy(scenario)?'native-proof-11':isDesertStudy(scenario)?'native-proof-10':scenario==='second-contact'?'native-proof-9':isGarrisonStudy(scenario)||scenario==='corridor-crossfire'?'native-proof-8':scenario==='first-contact'?'native-proof-7':scenario==='opening-table'?'native-proof-6':scenario==='next-turn'?'native-proof-5':isWeaponStudy(scenario)?'native-proof-4':isTurnStudy(scenario)?'native-proof-3':scenario==='takeel'?'native-proof-2':'native-proof-1';
const trooper=(side:Side)=>side==='light'?'1_28':'1_194';
const barrier=(side:Side)=>side==='light'?'1_105':'1_249';

export function createScenario(scenario:ScenarioId):Match{
 if(!scenarios.some(s=>s.id===scenario))throw Error('Unknown conformance scenario.');
 const m:Match={schema:1,engine:engineFor(scenario),scenario,revision:0,active:scenario==='luke-arrives'||scenario==='luke-support'||scenario==='rebel-post'||scenario==='imperial-barrier'||scenario==='rebel-weapons'?'light':'dark',phase:scenarios.find(s=>s.id===scenario)!.phase,cards:{},players:{light:empty(),dark:empty()},locations:[],stack:[],battle:null,drained:[],log:[],complete:false,winner:null};
 for(const deck of manifest.decks){const s=deck.side as Side;for(const [i,b]of deck.main.entries()){const id=s[0]+String(i+1).padStart(3,'0');m.cards[id]={id,blueprint:b,owner:s,zone:'reserve'};m.players[s].reserve.push(id);}}
 if(scenario==='opening-table'||isOpeningStudy(scenario)){initializeSetup(m);assertMatch(m);return m;}
 const site=scenario==='reduce-drain'?pull(m,'light','1_132','table'):isDesertStudy(scenario)?pull(m,'light','1_129','table'):scenario==='corridor-crossfire'?pull(m,'dark','1_284','table'):pull(m,'light','1_124','table');m.locations.push(site);
 if(isReactStudy(scenario)){
  const corridor=pull(m,'dark','1_284','table');m.locations.push(corridor);m.reactStudy={used:[],arrived:[],cancelled:false,site:null};
  const deploy=['react-deploy','react-drain-deploy','react-barrier'].includes(scenario),drain=['react-drain','react-drain-deploy'].includes(scenario);
  if(scenario==='react-barrier')m.reactStudy.barred=[];
  for(const at of deploy&&scenario!=='react-barrier'?m.locations:[site]){
   for(let i=0;i<(deploy&&scenario!=='react-barrier'?3:4);i++)pull(m,'dark','1_194','table',at);
   for(let i=0;i<(drain?0:scenario==='react-barrier'?3:deploy?2:3);i++)pull(m,'light','1_28','table',at);
  }
  if(deploy){pull(m,'light','1_6','table',site);for(let i=0;i<2;i++)pull(m,'light','1_28','hand');pull(m,'light','1_30','hand');pull(m,'light','1_12','hand');}
  else for(let i=0;i<2;i++)pull(m,'light','1_30','table',corridor);
  if(scenario==='react-barrier'){pull(m,'dark','1_249','hand');move(m,m.players.dark.reserve.at(-1)!,'force');}
  for(let i=0;i<(deploy?4:2);i++)move(m,m.players.light.reserve.at(-1)!,'force');move(m,m.players.dark.reserve.at(-1)!,'force');
  putTop(m,'light','1_12');putTop(m,'dark','1_181');
  if(scenario==='react-drain-deploy'){m.reactStudy!.drains=[];m.stack=[{kind:'drain-control',priority:'dark',passes:0}];}
  else if(drain)m.stack=[{kind:'drain',stage:'start',site,remaining:0}];
  else {m.battle=reactBattle(m,site);m.stack=[{kind:'battle',stage:'start',side:'dark'}];}
  log(m,scenario==='react-drain-deploy'?'CZ-3 alone provides no presence. Light can deploy to the Bay through its icon, but cannot deploy to the Corridor with neither its icon nor presence. Dark may legally attempt a zero drain there.':scenario==='react-barrier'?'Reinforcements deploy before Dark may respond with Imperial Barrier. Barrier preserves their ordinary presence but excludes them from battle for this turn.':drain?'Two Wolfmen wait in the Corridor. Bringing one to the Bay cancels the drain before Force loss; the other cannot react to a canceled drain.':deploy?'CZ-3 enables separate deployment reacts at its site or the adjacent Corridor. Choose either battle. Rebels cost 1, Wolfman costs 3; Jawa cannot deploy on Death Star.':'Three Rebels have ability 3. Each arriving Wolfman adds 1 ability and 2 power, before battle destiny is checked.');
 }else if(scenario==='last-force'){
  pull(m,'dark','1_194','table',site);pull(m,'light','1_28','hand');putTop(m,'light','1_28');for(const id of [...m.players.light.reserve].slice(1))move(m,id,'lost');m.stack=[{kind:'drain',stage:'start',site,remaining:0}];log(m,'Light has one Reserve card and one card in hand. The drain can be paid from either, but only Reserve is Life Force. Losing the final Life Force ends the game.');
 }else if(isLossStudy(scenario)){
  m.lossStudy={reduced:0,rescued:[]};
  if(scenario==='reduce-drain'){
   pull(m,'dark','1_194','table',site);for(let i=0;i<3;i++)pull(m,'light','1_28','force');pull(m,'light','1_28','hand');pull(m,'light','1_28','used');
   for(let i=0;i<2;i++)pull(m,'light','1_90','hand');m.stack=[{kind:'drain',stage:'start',site,remaining:0}];
   log(m,'Dark controls the Lars Farm. Its two Light icons cause a drain of 2. Light may use saved Force to reduce that loss when it resolves.');
  }else{
   const participants={light:[] as string[],dark:[] as string[]};
   for(const side of sides)for(let i=0;i<(side==='dark'&&scenario==='reduce-damage'?7:side==='light'&&scenario==='talz-rescue'?3:4);i++)participants[side].push(pull(m,side,trooper(side),'table',site));
   if(scenario==='talz-rescue')participants.light.push(pull(m,'light','1_31','table',site));
   for(let i=0;i<(scenario==='talz-rescue'?4:1);i++)move(m,m.players.dark.reserve.at(-1)!,'force');
   for(let i=0;i<(scenario==='reduce-damage'?4:1);i++)move(m,m.players.light.reserve.at(-1)!,'force');
   if(scenario==='reduce-damage'){for(let i=0;i<2;i++)pull(m,'light','1_90','hand');putTop(m,'light','1_28');putTop(m,'dark','1_181');}
   else{
    for(const [i,b] of ['1_317','1_312'].entries()){const id=pull(m,'dark',b,'table',site);m.cards[id].attachedTo=participants.dark[i];}
    const gun=pull(m,'light','1_152','table',site);m.cards[gun].attachedTo=participants.light[0];
    putTop(m,'dark','1_194');putTop(m,'dark','1_181');putTop(m,'dark','1_182');putTop(m,'light','1_12');putTop(m,'light','1_28');
   }
   m.battle={site,initiator:'dark',participants,destiny:{light:null,dark:null},drawn:{light:false,dark:false},power:{light:4,dark:participants.dark.length},attrition:{light:0,dark:0},damage:{light:0,dark:0},next:'dark',...(scenario==='talz-rescue'?{fired:[],weaponUsers:{},shots:[]}:{})};
   m.stack=[{kind:'battle',stage:'start',side:'dark'}];
   log(m,scenario==='reduce-damage'?'Seven Stormtroopers face four Rebels. It Could Be Worse can reduce battle damage, but cannot remove attrition or a weapon hit.':'Three Rebel Troopers and a Talz face four Stormtroopers. Fire at a Trooper and the Talz to compare saving two hits with one forfeit.');
  }
 }else if(isDesertStudy(scenario)){
  m.locations.push(pull(m,'light','1_132','table'));
  if(scenario==='luke-arrives'){
   for(let i=0;i<3;i++)pull(m,'light','101_2','hand');for(let i=0;i<2;i++)pull(m,'light','1_28','hand');for(let i=0;i<5;i++)pull(m,'light','1_28','force');
   for(let i=0;i<4;i++)pull(m,'dark','1_194','table',site);pull(m,'dark','1_194','force');pull(m,'dark','1_249','hand');
  }else if(scenario==='luke-support'){
   pull(m,'light','101_2','table',site);for(let i=0;i<2;i++)pull(m,'light','1_28','table',site);pull(m,'light','1_26','table',site);pull(m,'light','1_28','force');
   for(let i=0;i<7;i++)pull(m,'dark','1_194','table',site);for(let i=0;i<2;i++)pull(m,'dark','1_170','table',site);
  }else{
   pull(m,'dark','1_196','table',site);for(let i=0;i<4;i++)pull(m,'dark','1_196','hand');for(let i=0;i<7;i++)pull(m,'dark','1_194','force');for(let i=0;i<2;i++)pull(m,'dark','1_170','force');
   for(let i=0;i<2;i++){pull(m,'light','1_26','table',site);pull(m,'light','1_28','table',site);}pull(m,'light','1_28','force');pull(m,'light','1_105','hand');
  }
  putTop(m,'light',scenario==='luke-support'?'101_2':'1_12');putTop(m,'dark','1_181');
  m.turn={number:1,deployer:m.active,stage:scenario==='luke-support'?'battle':'deploy',restrictions:[],expired:[],moved:[],battled:[]};m.stack=[{kind:'turn',priority:m.active,passes:0}];
  log(m,'Fixed character study on Docking Bay 94 and Lars’ Moisture Farm. Card order is recorded; this study ends after one turn.');
  log(m,scenario==='tusken-band'?'Raiders deploy for 2 only on Tatooine. Pair power and the single four-Raider total bonus depend on active cards present.':scenario==='luke-arrives'?'Luke costs 4 at the Bay or 3 at the Farm. Troopers deploy free at Luke’s site, even when no Force remains. Only one Luke may be on table.':'Luke boosts your nearby warriors’ forfeit, including his own. The guard is not a warrior. Forfeit choices update whenever Luke leaves.');
 }else if(isGarrisonStudy(scenario)){
  m.locations.push(pull(m,'dark','1_284','table'));
  const guard=(side:Side)=>side==='light'?'1_26':'1_181';
  pull(m,m.active,guard(m.active),'hand');pull(m,m.active,trooper(m.active),'hand');
  if(m.active==='dark')pull(m,'dark','1_170','hand');
  for(let i=0;i<6;i++)pull(m,m.active,trooper(m.active),'force');
  const opponent=other(m.active);pull(m,opponent,guard(opponent),'table',site);
  pull(m,opponent,trooper(opponent),'force');pull(m,opponent,barrier(opponent),'hand');
  m.turn={number:1,deployer:m.active,stage:'deploy',restrictions:[],expired:[],moved:[],battled:[]};
  m.stack=[{kind:'turn',priority:m.active,passes:0}];
  log(m,'Fixed garrison study: '+label(m.active)+' has 6 Force. The opposing guard defends Docking Bay 327; its owner has a Barrier and 1 Force.');
  log(m,'Guards have power 0, gain 4 when defending a battle, and cannot move. Death Star Troopers deploy for 2 only on Death Star. The study ends after this turn.');
 }else if(scenario==='next-turn'){
  const corridor=pull(m,'dark','1_284','table');m.locations.push(corridor);
  for(const side of sides){
   pull(m,side,trooper(side),'table',side==='dark'?site:corridor);
   pull(m,side,trooper(side),'hand');pull(m,side,barrier(side),'hand');pull(m,side,trooper(side),'force');
   // Four remaining troopers, then two Death-Star-ineligible Jawas. Across
   // these two turns every card reachable through activation/draw is supported.
   const reserve=m.players[side].reserve,jawa=side==='light'?'1_12':'1_182';
   m.players[side].reserve=[...reserve.filter(id=>m.cards[id].blueprint===trooper(side)),...reserve.filter(id=>m.cards[id].blueprint===jawa),...reserve.filter(id=>![trooper(side),jawa].includes(m.cards[id].blueprint))];
  }
  m.turn={number:1,deployer:'dark',stage:'start',restrictions:[],expired:[],moved:[],battled:[]};
  m.cycle={generation:0,activated:0,recirculated:{light:0,dark:0},history:[]};
  log(m,'Fixed two-turn study: Dark holds Docking Bay 327; Light holds the Detention Block Corridor. Each has one trooper and a Barrier in hand, and 1 Force.');
  log(m,'Only ordinary troopers and Barriers can enter play. The study stops at global turn 3 — Dark’s next turn — before any further activation.');
  beginTurn(m);
 }else if(isWeaponStudy(scenario)){
  const participants={light:[] as string[],dark:[] as string[]};
  for(const s of sides){
   for(let n=0;n<4;n++)participants[s].push(pull(m,s,trooper(s),'table',site));
   for(const [i,b] of (s==='light'?['1_152','1_153']:['1_317','1_312']).entries()){
    const id=pull(m,s,b,s===m.active?'hand':'table',s===m.active?undefined:site);if(s!==m.active)m.cards[id].attachedTo=participants[s][i];
   }
   // Fixed, private Reserve order: weapon decisions consume these exact cards;
   // battle destiny later uses whatever is actually left on top.
   for(const b of [s==='light'?'1_129':'1_291',s==='light'?'1_12':'1_182',trooper(s)])putTop(m,s,b);
   for(let n=0;n<(s===m.active?8:4);n++)move(m,m.players[s].reserve[3],'force');
  }
  m.battle={site,initiator:m.active,participants,destiny:{light:null,dark:null},drawn:{light:false,dark:false},power:{light:4,dark:4},attrition:{light:0,dark:0},damage:{light:0,dark:0},next:m.active,fired:[],weaponUsers:{},shots:[]};
  m.stack=[{kind:'armory',priority:m.active,passes:0}];
  log(m,'Fixture: four troopers on each side. '+label(m.active)+' has 8 Force and two weapons in hand; the opponent has 4 Force and two armed troopers. The study ends after battle.');
 }else if(isTurnStudy(scenario)){
  m.locations.push(pull(m,'dark','1_284','table'));
  for(let n=0;n<2;n++)pull(m,m.active,trooper(m.active),'hand');
  for(let n=0;n<5;n++)pull(m,m.active,trooper(m.active),'force');
  const opponent=other(m.active);pull(m,opponent,trooper(opponent),'table',site);pull(m,opponent,trooper(opponent),'force');pull(m,opponent,barrier(opponent),'hand');
  m.turn={number:1,deployer:m.active,stage:'deploy',restrictions:[],expired:[],moved:[],battled:[]};
  m.stack=[{kind:'turn',priority:m.active,passes:0}];
  log(m,'Fixture: '+label(m.active)+' Deploy phase. Two adjacent Death Star sites, two troopers in hand and 5 Force. The study ends after this turn.');
 }else if(scenario==='activation'){
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

function reactBattle(m:Match,site:string):Battle{
 const participants={light:atSite(m,'light',site),dark:atSite(m,'dark',site)};
 const power={light:participants.light.reduce((n,id)=>n+characterPower(m,id,'dark'),0),dark:participants.dark.reduce((n,id)=>n+characterPower(m,id,'dark'),0)};
 return {site,initiator:'dark',participants,destiny:{light:null,dark:null},drawn:{light:false,dark:false},power,attrition:{light:0,dark:0},damage:{light:0,dark:0},next:'dark'};
}
function atSite(m:Match,side:Side,site:string){return Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===site&&c.owner===side&&definition(c.blueprint).type==='Character').map(c=>c.id);}
function barred(m:Match,id:string){return !!m.turn?.restrictions.some(r=>r.target===id&&r.expiresTurn>=m.turn!.number);}
function deploySite(m:Match,side:Side,site:string){return (sites[m.cards[site].blueprint]?.[side]||0)>0||atSite(m,side,site).some(id=>printed(m.cards[id].blueprint,'ability')>0);}
function beginTurn(m:Match){
 m.phase='Start of turn';m.turn!.stage='start';m.cycle!.generation=0;m.cycle!.activated=0;m.cycle!.recirculated={light:0,dark:0};
 m.stack.push({kind:'turn-start'});log(m,'Turn '+m.turn!.number+' begins: '+label(m.active)+'. Start-of-turn actions precede Force generation.');
 // No mandatory start/end effects or optional timed cards exist in this
 // fixture. Preserve optional timing windows; do not admit ordinary actions.
 window(m,label(m.active)+' start of turn actions',m.active);
}
function forceGeneration(m:Match,side:Side){return 1+m.locations.reduce((sum,id)=>sum+sites[m.cards[id].blueprint][side],0);}
function drainAmount(m:Match,site:string){const blueprint=m.cards[site].blueprint;return sites[blueprint][other(m.active)]+(m.active==='light'&&blueprint==='1_284'?1:0);}
function controls(m:Match,side:Side,site:string){return atSite(m,side,site).some(id=>printed(m.cards[id].blueprint,'ability')>0)&&!atSite(m,other(side),site).some(id=>printed(m.cards[id].blueprint,'ability')>0);}
function turnChoices(m:Match,f:Extract<Frame,{kind:'turn'}>):Prompt['choices']{
 if(f.priority!==m.active)return [];
 const t=m.turn!,p=m.players[m.active];
 if(t.stage==='control')return m.locations.filter(site=>controls(m,m.active,site)&&!m.drained.includes(site)).map(site=>({id:'drain:'+site,label:'Force drain at '+name(m,site)+' · '+drainAmount(m,site)+' Force',tone:'primary' as const}));
 if(t.stage==='deploy')return [...(isOpeningStudy(m.scenario)?armoryChoices(m,f.priority):[]),...p.hand.flatMap(id=>supportedCharacter(m,m.active,m.cards[id].blueprint)?m.locations.filter(site=>deploySite(m,m.active,site)&&characterCanDeploy(m,m.cards[id].blueprint,site)&&p.force.length>=characterDeployCost(m.cards[id].blueprint,m,site)).map(site=>({id:'deploy:'+id+':'+site,card:id,label:'Deploy '+name(m,id)+' '+id.toUpperCase()+' · '+name(m,site)+' · '+characterDeployCost(m.cards[id].blueprint,m,site)+' Force',tone:'primary' as const})):[])];
 if(t.stage==='battle')return p.force.length>=1?m.locations.filter(site=>!t.battled.includes(site)&&[m.active,other(m.active)].every(s=>atSite(m,s,site).some(id=>!barred(m,id)&&printed(m.cards[id].blueprint,'ability')>0))).map(site=>({id:'battle:'+site,label:'Battle at '+name(m,site)+' · 1 Force',tone:'primary' as const})):[];
 if(t.stage==='move')return p.force.length>=1?m.locations.flatMap(from=>atSite(m,m.active,from).filter(id=>!barred(m,id)&&characterCanMove(m,id)&&!t.moved.includes(id)).flatMap(id=>m.locations.filter(to=>Math.abs(m.locations.indexOf(to)-m.locations.indexOf(from))===1).map(to=>({id:'move:'+id+':'+to,card:id,label:'Move '+name(m,id)+' '+id.toUpperCase()+' → '+name(m,to)+' · 1 Force',tone:'primary' as const})))):[];
 if(t.stage==='draw')return p.force.length?[{id:'draw',label:'Draw 1 card from Force',tone:'primary'}]:[];
 return [];
}
function nextTurnStage(m:Match,f:Extract<Frame,{kind:'turn'}>){
 const t=m.turn!;const stages:readonly import('./types').TurnStage[]=m.cycle?['control','deploy','battle','move','draw','end']:['deploy','battle','move','draw','end'];
 t.stage=stages[stages.indexOf(t.stage as typeof stages[number])+1];f.priority=m.active;f.passes=0;
 m.phase=t.stage==='end'?'End of turn':t.stage[0].toUpperCase()+t.stage.slice(1);
 log(m,m.phase+' begins.');
 if(t.stage==='battle'&&t.restrictions.length)log(m,'Barriered characters still provide ordinary presence, but cannot participate in battle. Another eligible character is needed to initiate.');
 if(t.stage==='move'&&t.restrictions.length)log(m,'Barriered characters cannot move this turn. Other troopers may each make one regular move for 1 Force.');
 if(t.stage==='end'){m.stack.pop();m.stack.push({kind:'recirculation',next:m.active});}
}

function members(m:Match,s:Side){return m.battle!.participants[s].filter(id=>m.cards[id].zone==='table'&&m.cards[id].location===m.battle!.site&&!m.reactStudy?.barred?.includes(id));}
function ability(m:Match,s:Side){return members(m,s).reduce((n,id)=>n+reactAbility(m,id),0);}
function mayLose(m:Match,s:Side){return piles.some(z=>m.players[s][z].length>0);}
function lossChoices(m:Match,s:Side,prefix='lose'){
 const p=m.players[s];return [
  ...(['reserve','force','used','destiny'] as const).filter(z=>p[z].length).map(z=>({id:prefix+':'+z,label:'Lose 1 from '+(z==='reserve'?'Reserve Deck':z==='destiny'?'unresolved destiny':z[0].toUpperCase()+z.slice(1)+' Pile')})),
  ...p.hand.map(id=>({id:prefix+':hand:'+id,label:'Lose '+name(m,id)+' from hand',card:id})),
 ];
}
function pending(m:Match,s:Side){const b=m.battle!;return b.damage[s]>0||(b.attrition[s]>0&&members(m,s).length>0)||hitMembers(m,s).length>0;}
function checkLife(m:Match){for(const s of [m.active,other(m.active)])if(life(m,s)===0){m.winner=other(s);finish(m,label(s)+' has no Life Force. '+label(other(s))+' wins.');return true;}return false;}
function settle(m:Match){
 for(let steps=0;steps<40&&!m.complete;steps++){
  if(checkLife(m))return;
  const f=top(m);if(!f){finish(m,'Conformance checkpoint complete.');return;}
  if(f.kind==='react-window'&&m.reactStudy!.cancelled){m.stack.pop();continue;}
  if(f.kind==='react'){
   move(m,f.card,'table',f.site);m.reactStudy!.arrived.push(f.card);m.stack.pop();
   if(m.battle){m.battle.participants.light.push(f.card);m.battle.power.light+=characterPower(m,f.card,'dark');}
   const drain=m.stack.find(x=>x.kind==='drain');
   if(drain&&siteAbility(m,'light',f.site)>0){drain.remaining=0;m.reactStudy!.cancelled=true;log(m,'Light has brought presence. The Force drain is canceled before loss; no more reacts to this drain are legal.');}
   log(m,name(m,f.card)+' '+f.card.toUpperCase()+' arrives at '+name(m,f.site)+'.');window(m,f.method==='move'?'React movement completed responses':'React character just deployed responses','dark',m.scenario==='react-barrier'&&f.method==='deploy'?'character-deployed':undefined,m.scenario==='react-barrier'?f.card:undefined);continue;
  }
  if(f.kind==='finish'){finish(m,f.message);return;}
  if(f.kind==='turn-start'){
   m.stack.pop();m.turn!.stage='activate';m.phase='Activate';const generation=forceGeneration(m,m.active);m.cycle!.generation=generation;
   log(m,label(m.active)+' counts Force generation '+generation+' (personal Force and own location icons).');
   if(m.turn!.number===openingEndpoint(m)){finish(m,(m.scenario==='second-contact'?'Four':'Two')+' turns complete. Dark’s next Activate phase is ready: the same board and piles remain, and turn limits have reset.');return;}
   m.stack.push({kind:'activation',used:0,generation,priority:m.active,passes:0});continue;
  }
  if(f.kind==='turn-end'){
   const t=m.turn!,cycle=m.cycle!;
   if(f.stage==='automatic'){
    t.expired.push(...t.restrictions);const count=t.restrictions.length;t.restrictions=[];f.stage='handoff';
    log(m,'Both players have recirculated. '+count+' Barrier restriction'+(count===1?'':'s')+' expire. '+label(m.active)+' remains active during end-of-turn actions.');
    window(m,label(m.active)+' end of turn actions',m.active);continue;
   }
   cycle.history.push({number:t.number,side:m.active,generation:cycle.generation,activated:cycle.activated,carriedForce:{light:m.players.light.force.length,dark:m.players.dark.force.length},recirculated:{...cycle.recirculated},expired:t.expired.filter(r=>r.expiresTurn===t.number).length});
   m.stack.pop();log(m,label(m.active)+' finishes end-of-turn actions. Turn limits now reset for both players.');
   t.number++;m.active=other(m.active);t.deployer=m.active;t.moved=[];t.battled=[];m.drained=[];m.battle=null;beginTurn(m);continue;
  }
  if(f.kind==='restore-hit'){
   delete m.cards[f.target].hit;m.lossStudy!.rescued.push(f.target);m.stack.pop();log(m,name(m,f.target)+' is restored to normal. Its attached weapon stays in play.');continue;
  }
  if(f.kind==='lost-order'){
   if(f.remaining.length>1)return;
   if(f.remaining.length)move(m,f.remaining[0],'lost');m.stack.pop();window(m,'Card forfeited responses',other(f.side));continue;
  }
  if(f.kind==='shot'){
   const shot=m.battle!.shots![f.index];
   if(f.stage==='draw'){
    const card=m.players[shot.side].reserve[0];shot.card=card;shot.destiny=printed(m.cards[card].blueprint,'destiny');shot.status='drawn';move(m,card,'destiny');f.stage='resolve';
    log(m,label(shot.side)+' draws '+name(m,card)+' for weapon destiny '+shot.destiny+'.');window(m,'Weapon destiny just drawn responses',other(shot.side));continue;
   }
   shot.hit=shot.destiny!+shot.bonus>shot.defense;shot.status='resolved';move(m,shot.card!,'used');if(shot.hit)m.cards[shot.target].hit=true;
   log(m,name(m,shot.weapon)+': '+shot.destiny+(shot.bonus?' + '+shot.bonus:'')+' '+(shot.hit?'>':'≤')+' defense '+shot.defense+'. '+name(m,shot.target)+' '+(shot.hit?'is hit; it still participates and must later be forfeited.':'is not hit.'));
   m.stack.pop();window(m,'Weapon just fired responses',other(shot.side));continue;
  }
  if(f.kind==='interrupt'){
   if(f.effect==='reduce-loss'){
    const amount=lossAmount(m,f.source,f.side),reduction=m.lossStudy!.reduction?0:Math.min(amount,f.amount);
    m.lossStudy!.reduction??={card:f.card,amount:f.amount,source:f.source};
    if(f.source==='battle')m.battle!.damage[f.side]-=reduction;else (m.stack.find(x=>x.kind==='drain') as Extract<Frame,{kind:'drain'}>).remaining-=reduction;
    m.lossStudy!.reduced+=reduction;move(m,f.card,'used');m.stack.pop();log(m,'It Could Be Worse reduces '+(f.source==='battle'?'battle damage':'Force loss')+' by '+reduction+'. '+f.amount+' Force was used; attrition is unchanged. The Interrupt goes to Used.'+(reduction===0?' Another copy already modifies this loss; the reductions are not cumulative.':''));continue;
   }
   if(f.effect==='barrier'){
    if(m.scenario==='react-barrier'){m.reactStudy!.barred!.push(f.target);m.battle!.power.light=members(m,'light').reduce((n,id)=>n+characterPower(m,id,'dark'),0);}
    else m.turn!.restrictions.push({target:f.target,source:f.card,expiresTurn:f.expiresTurn});
    move(m,f.card,'used');m.stack.pop();log(m,name(m,f.card)+' resolves to Used. '+name(m,f.target)+' cannot move or participate in battle for the rest of this turn; it remains at its site.');continue;
   }
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
   if(f.stage==='loss'&&f.remaining===0){f.stage='end';window(m,m.reactStudy?.cancelled?'Force drain canceled responses':'Force drain completed responses',other(m.active));continue;}
   if(isLossStudy(m.scenario)&&f.stage==='loss'&&!f.lossReady){f.lossReady=true;if(lossResponses(m,'drain',other(m.active)).length){m.stack.push({kind:'loss-window',source:'drain',side:other(m.active),priority:other(m.active),passes:0});continue;}}
   if(f.stage==='end'){if(m.reactStudy?.drains){m.reactStudy.drains.push({site:f.site,amount:sites[m.cards[f.site].blueprint].light,cancelled:m.reactStudy.cancelled});m.stack.pop();continue;}if(m.cycle){m.stack.pop();continue;}finish(m,'Force drain checkpoint complete. The drain attempt remains recorded.');return;}
  }
  if(f.kind==='battle'){
   const b=m.battle!;
   if(f.stage==='weapons'){f.stage='destiny';f.side=b.initiator;if(isWeaponStudy(m.scenario))m.stack.push({kind:'weapons',priority:b.initiator,passes:0});else window(m,'Weapons segment — no weapons or playable actions in this fixture',b.initiator);continue;}
   if((m.turn||isReactStudy(m.scenario))&&f.stage==='destiny'&&!b.drawn[f.side]&&ability(m,f.side)<4){b.drawn[f.side]=true;log(m,label(f.side)+' has participating ability '+ability(m,f.side)+' and cannot draw a base battle destiny.');continue;}
   if(f.stage==='destiny'&&b.drawn[f.side]){
    if(f.side===b.initiator){f.side=other(f.side);continue;}
    f.stage='totals';window(m,'Power segment actions',b.initiator);window(m,'Both players finished battle destiny responses',other(b.initiator),m.scenario==='takeel'?'battle-destiny-complete':undefined);continue;
   }
   if(f.stage==='totals'){
    for(const s of sides){b.power[s]=members(m,s).reduce((n,id)=>n+characterPower(m,id,b.initiator),0)+groupPowerBonus(m,s,b.site)+(b.destiny[s]??0);b.attrition[s]=b.destiny[other(s)]??0;}
    for(const s of sides)b.damage[s]=Math.max(0,b.power[other(s)]-b.power[s]);
    log(m,'Total power: Light '+b.power.light+' · Dark '+b.power.dark+'. Attrition: Light '+b.attrition.light+' · Dark '+b.attrition.dark+'.');
    f.stage='damage';b.next=b.initiator;window(m,'Battle result responses',other(b.initiator));continue;
   }
   if(f.stage==='damage'){
    for(const s of sides)if(!members(m,s).length)b.attrition[s]=0;
    if(!pending(m,'light')&&!pending(m,'dark')){f.stage='end';window(m,'Battle just ended responses',other(b.initiator));window(m,'End of battle actions',other(b.initiator));continue;}
    if(!pending(m,b.next))b.next=other(b.next);
    if(isLossStudy(m.scenario)&&f.lossReady!==b.next){f.lossReady=b.next;if(lossResponses(m,'battle',b.next).length){m.stack.push({kind:'loss-window',source:'battle',side:b.next,priority:b.next,passes:0});continue;}}
   }
   if(f.stage==='end'){
    if(m.turn){b.resolved=true;m.stack.pop();log(m,'Battle ends. All damage and attrition are satisfied.');continue;}
    finish(m,'Battle checkpoint complete. All damage and attrition are satisfied.');return;
   }
  }
  return;
 }
 if(!m.complete)throw Error('Conformance resolution exceeded its step budget.');
}

function responseChoices(m:Match,f:Extract<Frame,{kind:'window'}>):Prompt['choices']{
 if((m.turn||m.scenario==='react-barrier')&&f.event==='character-deployed'&&f.target){
  const c=m.cards[f.target],side=f.priority;const card=m.players[side].hand.find(id=>m.cards[id].blueprint===barrier(side));
  if(!card||m.players[side].force.length<1||c?.zone!=='table'||c.owner===side||!(m.scenario==='react-barrier'?['1_28','1_30'].includes(c.blueprint):supportedCharacter(m,c.owner,c.blueprint)))return [];
  return [{id:'play:'+card,label:'Play '+name(m,card)+' · use 1 Force',card,tone:'primary',barrierTarget:c.id}];
 }
 if(m.scenario!=='takeel'||f.event!=='battle-destiny-complete'||f.priority!=='dark')return [];
 const b=m.battle!;const card=m.players.dark.hand.find(id=>m.cards[id].blueprint==='1_269');
 if(!card||m.players.dark.force.length<1||!b.drawn.light||!b.drawn.dark||b.destiny.light===null||b.destiny.dark===null)return [];
 return [{id:'play:'+card,label:'Play Takeel · use 1 Force',card,tone:'primary',destinyPreview:{light:b.destiny.dark,dark:b.destiny.light}}];
}

export function prompt(m:Match):Prompt|null{
 if(m.setup)return setupPrompt(m);
 if(m.complete)return null;const f=top(m);if(!f)return null;
 const base={id:m.engine+':'+m.revision,side:m.active,title:'',detail:'',choices:[] as Prompt['choices'],automatic:false};
 if(f.kind==='react-window'){
  const actions=reactChoices(m,f);
  return {...base,side:f.priority,title:actions.length?'Answer with reinforcements':'React response opportunity',detail:f.event==='drain'?'Bring presence to cancel this drain before any Force is lost. Once canceled, no further reacts are possible.':'Each card reacts separately, paying its normal cost. Arriving characters participate before battle destiny is checked.',choices:[...actions,{id:'pass',label:actions.length?'Pass react opportunity':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='loss-window'){
  const actions=f.priority===f.side?lossResponses(m,f.source,f.side):[];
  return {...base,side:f.priority,title:actions.length?'Before you take losses':'Loss response opportunity',detail:f.source==='battle'?'You may reduce battle damage or use a legal hit replacement before choosing the next loss. Attrition is a separate obligation.':'The drain has resolved. You may reduce the resulting Force loss before choosing the next card to lose.',choices:[...actions,{id:'pass',label:actions.length?'Continue to losses':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='armory'||f.kind==='weapons'){
  const actions=f.kind==='armory'?armoryChoices(m,f.priority):firingChoices(m,f.priority);
  return {...base,side:f.priority,title:f.kind==='armory'?'Arm your troopers':'Weapons opportunity',detail:f.kind==='armory'?'Deploy or transfer to your warriors for the printed Force cost. Several weapons may be carried, but each trooper may use only one different weapon this turn.':'Fire at an opposing participant or pass. A hit trooper can still return fire. Two consecutive passes end this segment.',choices:[...actions,{id:'pass',label:actions.length?f.kind==='armory'?'Pass deployment opportunity':'Pass weapons opportunity':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='lost-order')return {...base,side:f.side,title:'Choose the order in Lost',detail:'These cards left the table together. Choose the next card to place on top of Lost. The last card placed will be on top; attached weapons add no forfeit value.',choices:f.remaining.map(id=>({id:'place-lost:'+id,card:id,label:'Place '+name(m,id)+' '+id.toUpperCase()+' on top',tone:'primary'}))};
 if(f.kind==='window'){
  const actions=responseChoices(m,f);
  const deployment=f.event==='character-deployed';
  return {...base,side:f.priority,title:actions.length?deployment?'Deployment response':'Battle destiny response':f.label,detail:deployment?'The character has deployed. This opportunity can respond only to that newly deployed character.':f.event?'Both players have finished their battle destiny choices. Responses happen before the totals are applied.':m.cycle?'Neither player has a legal action at this timing point in the fixed study. The turn and saved continuation stay in order.':'Neither player has a legal response in this exact fixture. The empty opportunity is preserved in the saved continuation.',choices:[...actions,{id:'pass',label:actions.length?deployment?'Pass this response':'Pass · keep the destiny numbers':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='turn'){
  const actions=turnChoices(m,f),stage=m.turn!.stage;
  const detail=stage==='control'?'Drain at a site you control, once per site this turn. Light adds 1 to its drain at the Detention Block Corridor. A zero drain is legal.':stage==='deploy'?'Troopers cost 1 Force here. Deploy where you have your Force icon or presence. Each deployment gives the opponent a response.'+(isOpeningStudy(m.scenario)?' Blasters deploy or transfer to your warriors for 1 Force. Jawas deploy only on Tatooine, so they cannot deploy at these sites.':''):stage==='battle'?'Initiate for 1 Force where both sides have eligible presence. Barriered characters cannot participate.':stage==='move'?'An unbarriered trooper may move to the adjacent site for 1 Force, once this turn. Movement does not require your Force icon.':'Draw cards from the top of your Force Pile into hand, one at a time. Drawing is optional.';
  return {...base,side:f.priority,title:label(f.priority)+' '+stage+' opportunity',detail:m.scenario==='second-contact'&&stage==='deploy'?'Deploy characters and weapons for their printed costs. Guards cannot carry weapons. Luke, Jawas and Tusken Raiders cannot deploy at these Death Star sites.':isGarrisonStudy(m.scenario)&&stage==='deploy'?'Deploy a character for its printed cost. Guards cost 2; Death Star Troopers cost 2 and deploy only on Death Star. The opponent may respond with a Barrier.':usesCharacterRules(m.scenario)&&stage==='move'?'Guards cannot move, even when no Barrier applies. Other unbarriered characters may make one regular move to the adjacent site for 1 Force.':detail,choices:[...actions,{id:'pass',label:actions.length?'Pass '+stage+' opportunity':'Pass empty opportunity'}],automatic:actions.length===0};
 }
 if(f.kind==='drain-control'){
  const choices=f.priority===m.active?m.locations.filter(site=>!m.drained.includes(site)&&siteAbility(m,'dark',site)>0&&siteAbility(m,'light',site)===0).map(site=>({id:'drain:'+site,label:'Drain at '+name(m,site)+' · '+sites[m.cards[site].blueprint].light+' Force',tone:'primary' as const})):[];
  return {...base,side:f.priority,title:f.priority==='dark'?'Choose where Dark drains':'Light Control opportunity',detail:'Resolve each drain separately, in either order. Each site may be attempted once this Control phase, even if its drain is canceled. You may finish without draining at every site.',choices:[...choices,{id:'pass',label:choices.length?'Finish Control':'Pass empty opportunity'}],automatic:choices.length===0};
 }
 if(f.kind==='activation'){
  const max=Math.min(f.generation-f.used,m.players[m.active].reserve.length);const can=f.priority===m.active&&max>0;
  return {...base,side:f.priority,title:label(f.priority)+' action opportunity',detail:f.used+' of '+f.generation+' generated Force activated. Each activation moves one top Reserve card to the top of Force.',choices:[...(can?[{id:'activate',label:'Activate 1 Force',tone:'primary' as const}]:[]),{id:'pass',label:can?'Pass activation opportunity':'Pass empty opportunity'}],automatic:!can};
 }
 if(f.kind==='drain'){
  if(f.stage==='start'&&m.scenario==='react-drain-deploy')return {...base,title:'Choose where Dark drains',detail:'CZ-3 has no ability and provides no presence. Light can react by deploying at the Bay through its icon. The Corridor has neither a Light icon nor Light presence; its drain is zero.',choices:m.locations.map(site=>({id:'drain:'+site,label:'Drain at '+name(m,site)+' · '+sites[m.cards[site].blueprint].light+' Force',tone:'primary'}))};
  if(f.stage==='start')return {...base,title:'Initiate a Force drain',detail:'Dark has presence and Light has none here. Drain amount uses the opponent’s Force icons.',choices:[{id:'drain',label:isLossStudy(m.scenario)?'Force drain at '+name(m,f.site):'Force drain at Docking Bay 327',tone:'primary'},{id:'stop',label:'Leave this checkpoint'}]};
  return {...base,side:other(m.active),title:'Choose Force to lose',detail:f.remaining+' Force remaining. A card from hand or the top of Reserve, Force or Used can satisfy this loss.',choices:lossChoices(m,other(m.active))};
 }
 if(f.kind==='battle'){
  const b=m.battle!;
  if(f.stage==='start'&&m.scenario==='react-deploy')return {...base,title:'Choose where Dark battles',detail:'CZ-3 can call reinforcements to its own site or the adjacent site. Use 1 Force to initiate one battle; this study ends after its losses.',choices:m.locations.map(site=>({id:'battle:'+site,label:'Battle at '+name(m,site)+' · 1 Force',tone:'primary'}))};
  if(f.stage==='start')return {...base,title:'Initiate battle' ,detail:isLossStudy(m.scenario)||isReactStudy(m.scenario)?'Use 1 Force. Both sides have presence; the characters and their printed values are shown on the table.':'Use 1 Force. Both sides have presence and four participating troopers.',choices:[...(!isWeaponStudy(m.scenario)||m.players[m.active].force.length?[{id:'battle',label:'Use 1 Force · begin battle',tone:'primary' as const}]:[]),{id:'stop',label:'Leave this checkpoint'}]};
  if(f.stage==='destiny'){
   const can=ability(m,f.side)>=4&&m.players[f.side].reserve.length>0;
   return {...base,side:f.side,title:'Battle destiny',detail:'Participating ability '+ability(m,f.side)+'. Four ability permits one base battle destiny; drawing it is optional.',choices:[...(can?[{id:'draw-destiny',label:'Draw battle destiny',tone:'primary' as const}]:[]),{id:'skip-destiny',label:'Draw no battle destiny'}]};
  }
  if(f.stage==='damage'){
   const s=b.next;return {...base,side:s,title:'Satisfy battle losses',detail:'Attrition '+b.attrition[s]+' · battle damage '+b.damage[s]+'. A forfeit reduces both totals. Losing Force pays only battle damage.'+(hitMembers(m,s).length?' Hit troopers must also be forfeited, even after both totals reach zero.':''),choices:[
    ...members(m,s).filter(id=>!isWeaponStudy(m.scenario)||b.attrition[s]>0||b.damage[s]>0||m.cards[id].hit).map(id=>{const value=characterForfeit(m,id);return {id:'forfeit:'+id,label:'Forfeit '+name(m,id)+(m.cards[id].hit?' (hit)':'')+' · '+value,card:id,lossPreview:{kind:'forfeit' as const,value,attrition:Math.max(0,b.attrition[s]-value),damage:Math.max(0,b.damage[s]-value)}}}),
    ...(b.damage[s]>0&&mayLose(m,s)?lossChoices(m,s).map(c=>({...c,lossPreview:{kind:'force' as const,value:1,attrition:b.attrition[s],damage:Math.max(0,b.damage[s]-1)}})):[]),
   ]};
  }
 }
 if(f.kind==='recirculation')return {...base,side:f.next,title:label(f.next)+' recirculates',detail:'Place the entire Used pile beneath Reserve without reversing its order. Cards in Force stay there.',choices:[{id:'recirculate',label:'Resolve recirculation',tone:'primary'}]};
 throw Error('Unresolved internal continuation.');
}

export function applyCommand(before:Match,side:Side,command:Command):Match{
 if(before.setup){assertMatch(before);const after=applySetup(before,side,command);
  if(isOpeningStudy(after.scenario)&&after.complete){const generation=after.setup!.generation!.dark;delete after.setup;after.complete=false;after.turn={number:1,deployer:'dark',stage:'activate',restrictions:[],expired:[],moved:[],battled:[]};after.cycle={generation,activated:0,recirculated:{light:0,dark:0},history:[]};after.stack=[{kind:'activation',used:0,generation,priority:'dark',passes:0}];}
  assertMatch(after);return after;}
 assertMatch(before);const p=prompt(before);if(!p||p.side!==side)throw Error('This seat has no pending choice.');
 if(command.prompt!==p.id)throw Error('This choice is stale. Refresh the saved match.');
 if(!p.choices.some(c=>c.id===command.choice))throw Error('This choice is not legal in the current fixture.');
 const m=structuredClone(before);const f=top(m);const choice=command.choice;m.revision++;
 if(choice==='stop'){finish(m,'Checkpoint left without initiating the action.');return m;}
 if(f.kind==='drain-control'){
  if(choice==='pass'){f.passes++;if(f.passes===2)finish(m,'Control checkpoint complete. Both players passed; each attempted site and its result remain recorded.');else f.priority=other(side);}
  else{
   const site=choice.slice('drain:'.length),amount=sites[m.cards[site].blueprint].light;
   f.passes=0;f.priority=other(side);m.drained.push(site);m.reactStudy!.site=site;m.reactStudy!.cancelled=false;
   m.stack.push({kind:'drain',stage:'loss',site,remaining:amount},{kind:'react-window',site,event:'drain',priority:'light',passes:0});
   log(m,'Dark initiates a Force drain of '+amount+' at '+name(m,site)+'.');
  }
 }else if(f.kind==='react-window'){
  if(choice==='pass'){f.passes++;if(f.passes===2)m.stack.pop();else f.priority=other(side);}
  else {const [,method,id]=choice.split(':');const cost=method==='move'?1:printed(m.cards[id].blueprint,'deploy');
   for(let i=0;i<cost;i++)move(m,m.players.light.force[0],'used');if(method==='deploy')move(m,id,'playing');m.reactStudy!.used.push(id);f.passes=0;f.priority='dark';
   m.stack.push({kind:'react',card:id,site:f.site,method:method as 'move'|'deploy',cost});log(m,'Light uses '+cost+' Force to '+method+' '+name(m,id)+' as a react. Its arrival waits for responses.');window(m,'Responses to the paid react','dark');
  }
 }else if(f.kind==='loss-window'){
  if(choice==='pass'){f.passes++;if(f.passes===2)m.stack.pop();else f.priority=other(side);}
  else if(choice.startsWith('reduce:')){
   const [,card,raw]=choice.split(':');const amount=Number(raw);for(let n=0;n<amount;n++)move(m,m.players[side].force[0],'used');move(m,card,'playing');f.passes=0;f.priority=other(side);
   m.stack.push({kind:'interrupt',card,side,effect:'reduce-loss',source:f.source,amount});log(m,'Light uses '+amount+' Force to play It Could Be Worse. The loss changes only after responses resolve.');window(m,'Responses to It Could Be Worse',other(side));
  }else{
   const [,id,target]=choice.split(':');const b=m.battle!,value=characterForfeit(m,id);
   b.attrition[side]=Math.max(0,b.attrition[side]-value);b.damage[side]=Math.max(0,b.damage[side]-value);b.next=other(side);
   m.stack.pop();const parent=top(m);if(parent.kind==='battle')delete parent.lossReady;
   move(m,id,'lost');m.stack.push({kind:'restore-hit',source:id,target});log(m,'Talz forfeits for '+value+' to restore '+name(m,target)+' '+target.toUpperCase()+'. Its forfeit pays damage and attrition.');window(m,'Card forfeited responses',other(side));
  }
 }else if(f.kind==='window'){
  if(choice.startsWith('play:')){
   const card=choice.slice(5);
   // Initiation is atomic: the legal-choice check above verified card, timing
   // and Force. Save cost and pending card together before permitting responses.
   move(m,m.players[side].force[0],'used');move(m,card,'playing');
   f.passes=0;f.priority=other(side);
   if(f.event==='character-deployed'){
    m.stack.push({kind:'interrupt',card,side,effect:'barrier',target:f.target!,expiresTurn:m.turn?.number||1});
    log(m,label(side)+' uses 1 Force to play '+name(m,card)+' targeting '+name(m,f.target!)+'. Its restriction waits for responses.');
    window(m,'Responses to '+name(m,card),other(side));
   }else{
    const b=m.battle!;b.destinyBeforeSwitch={light:b.destiny.light!,dark:b.destiny.dark!};
    m.stack.push({kind:'interrupt',card,side,effect:'switch-battle-destiny'});
    log(m,'Dark uses 1 Force to play Takeel. Its result waits for responses.');
    window(m,'Responses to Takeel',other(side));
   }
  }else{
   if(f.event)log(m,label(side)+' passes the '+(f.event==='character-deployed'?'deployment':'battle destiny')+' response opportunity.');
   f.passes++;if(f.passes===2)m.stack.pop();else f.priority=other(f.priority);
  }
 }else if(f.kind==='armory'){
  if(choice==='pass'){
   f.passes++;if(f.passes===2){m.stack.pop();m.stack.push({kind:'battle',stage:'start',side:m.active});m.phase='Battle';log(m,'Deployment ends. Battle phase begins.');}else f.priority=other(side);
  }else{
   const [action,id,user]=choice.split(':');const cost=weaponRules[m.cards[id].blueprint].deploy;
   for(let n=0;n<cost;n++)move(m,m.players[side].force[0],'used');
   move(m,id,'table',m.cards[user].location);m.cards[id].attachedTo=user;f.passes=0;f.priority=other(side);
   log(m,label(side)+' uses '+cost+' Force to '+(action==='equip'?'deploy ':'transfer ')+name(m,id)+' onto '+name(m,user)+' '+user.toUpperCase()+'.');window(m,'Weapon '+(action==='equip'?'deployed':'transferred')+' responses',other(side));
  }
 }else if(f.kind==='weapons'){
  if(choice==='pass'){f.passes++;if(f.passes===2)m.stack.pop();else f.priority=other(side);}
  else{
   const [,id,target]=choice.split(':');const rule=weaponRules[m.cards[id].blueprint],user=m.cards[id].attachedTo!,b=m.battle!;
   for(let n=0;n<rule.fire;n++)move(m,m.players[side].force[0],'used');
   b.fired!.push(id);b.weaponUsers![user]=id;
   const index=b.shots!.push({weapon:id,user,target,side,cost:rule.fire,bonus:weaponBonus(m,id),defense:printed(m.cards[target].blueprint,'ability'),status:'pending'})-1;
   f.passes=0;f.priority=other(side);m.stack.push({kind:'shot',index,stage:'draw'});
   log(m,label(side)+' uses '+rule.fire+' Force to fire '+name(m,id)+' at '+name(m,target)+' '+target.toUpperCase()+'.');window(m,'Weapon firing responses',other(side));
  }
 }else if(f.kind==='lost-order'){
  const id=choice.slice('place-lost:'.length);f.remaining.splice(f.remaining.indexOf(id),1);f.placed.unshift(id);move(m,id,'lost');
 }else if(f.kind==='turn'){
  if(choice==='pass'){f.passes++;if(f.passes===2)nextTurnStage(m,f);else f.priority=other(side);}
  else{
   f.passes=0;f.priority=other(side);const [action,id,target]=choice.split(':');
   if(action==='drain'){
    m.drained.push(id);const amount=drainAmount(m,id);m.stack.push({kind:'drain',stage:'loss',site:id,remaining:amount});
    log(m,label(side)+' initiates a Force drain of '+amount+' at '+name(m,id)+'.');window(m,'Force drain initiated responses',other(side));
   }else if(action==='draw'){const card=m.players[side].force[0];move(m,card,'hand');log(m,label(side)+' draws 1 card from Force into hand.');window(m,'Force card drawn responses',other(side));}
   else if(action==='equip'||action==='transfer'){
    const cost=weaponRules[m.cards[id].blueprint].deploy;for(let n=0;n<cost;n++)move(m,m.players[side].force[0],'used');move(m,id,'table',m.cards[target].location);m.cards[id].attachedTo=target;log(m,label(side)+' uses '+cost+' Force to '+(action==='equip'?'deploy ':'transfer ')+name(m,id)+' onto '+name(m,target)+'.');window(m,'Weapon '+(action==='equip'?'deployed':'transferred')+' responses',other(side));
   }else{
    const cost=action==='deploy'?characterDeployCost(m.cards[id].blueprint,m,target):1;
    for(let n=0;n<cost;n++)move(m,m.players[side].force[0],'used');
    if(action==='deploy'){
     // No card can respond to the Force cost in this fixture. GEMP places the
     // ordinary character before its just-deployed response (not in VOID).
     move(m,id,'table',target);log(m,label(side)+' uses '+cost+' Force to deploy '+name(m,id)+' at '+name(m,target)+'.');
     window(m,'Character just deployed',other(side),'character-deployed',id);
    }else if(action==='move'){
     move(m,id,'table',target);if(isOpeningStudy(m.scenario))for(const c of Object.values(m.cards))if(c.zone==='table'&&c.attachedTo===id)c.location=target;m.turn!.moved.push(id);log(m,label(side)+' uses 1 Force to move '+name(m,id)+' to '+name(m,target)+'.');window(m,'Movement completed responses',other(side));
    }else if(action==='battle'){
     const participants=Object.fromEntries(sides.map(s=>[s,atSite(m,s,id).filter(c=>!barred(m,c))])) as Record<Side,string[]>;
     const power=Object.fromEntries(sides.map(s=>[s,participants[s].reduce((n,c)=>n+characterPower(m,c,side),0)])) as Record<Side,number>;
     m.battle={site:id,initiator:side,participants,destiny:{light:null,dark:null},drawn:{light:false,dark:false},power,attrition:{light:0,dark:0},damage:{light:0,dark:0},next:side,...(isOpeningStudy(m.scenario)?{fired:[],weaponUsers:{},shots:[]}:{})};
     if(isDesertStudy(m.scenario))for(const s of sides)m.battle.power[s]=participants[s].reduce((n,c)=>n+characterPower(m,c,side),0)+groupPowerBonus(m,s,id);
     m.turn!.battled.push(id);m.stack.push({kind:'battle',stage:'weapons',side});
     log(m,label(side)+' uses 1 Force to battle at '+name(m,id)+'. Barriered characters are excluded.');window(m,'Battle initiated responses',other(side));
    }
   }
  }
 }else if(f.kind==='activation'){
  if(choice==='activate'){
   const id=m.players[m.active].reserve[0];move(m,id,'force');f.used++;if(m.cycle)m.cycle.activated=f.used;f.passes=0;f.priority=other(m.active);log(m,label(m.active)+' activates 1 Force.');window(m,'Force activation responses',other(m.active));
  }else{f.passes++;if(f.passes===2){
   if(m.cycle){m.stack.pop();m.turn!.stage='control';m.phase='Control';m.stack.push({kind:'turn',priority:m.active,passes:0});log(m,'Control begins. '+label(m.active)+' activated '+f.used+' of '+f.generation+' generated Force.');}
   else finish(m,'Activation checkpoint complete: '+f.used+' Force activated.');
  }else f.priority=other(f.priority);}
 }else if(f.kind==='drain'){
  if(choice==='drain'||choice.startsWith('drain:')){
   if(m.scenario==='react-drain-deploy')f.site=choice.split(':')[1];
   if(m.drained.includes(f.site))throw Error('This location already attempted a drain.');
   m.drained.push(f.site);f.remaining=sites[m.cards[f.site].blueprint][other(m.active)];f.stage='loss';log(m,label(m.active)+' initiates a Force drain of '+f.remaining+'.');if(isReactStudy(m.scenario)){m.reactStudy!.site=f.site;m.stack.push({kind:'react-window',site:f.site,event:'drain',priority:'light',passes:0});}else window(m,'Force drain initiated responses',other(m.active));
  }else{lose(m,side,choice);f.remaining--;if(isLossStudy(m.scenario))delete f.lossReady;window(m,'Force loss responses',other(side));}
 }else if(f.kind==='battle'){
  const b=m.battle!;
  if(choice==='battle'||choice.startsWith('battle:')){
   if(isReactStudy(m.scenario)){const site=choice.split(':')[1]||b.site;m.battle=reactBattle(m,site);m.reactStudy!.site=site;}
   const id=m.players[side].force[0];if(!id)throw Error('Battle requires 1 Force.');move(m,id,'used');f.stage='weapons';log(m,label(side)+' uses 1 Force to initiate battle.');if(isReactStudy(m.scenario))m.stack.push({kind:'react-window',site:m.battle!.site,event:'battle',priority:'light',passes:0});else window(m,'Battle initiated responses',other(side));
  }else if(choice==='draw-destiny'||choice==='skip-destiny'){
   b.drawn[side]=true;
   if(choice==='draw-destiny'){
    const id=m.players[side].reserve[0];const value=printed(m.cards[id].blueprint,'destiny');move(m,id,'destiny');b.destiny[side]=value;log(m,label(side)+' draws '+name(m,id)+' for battle destiny '+value+'.');
    m.stack.push({kind:'destiny',side,card:id,value});window(m,'Battle destiny just drawn responses',other(side));
   }else log(m,label(side)+' chooses not to draw battle destiny.');
  }else if(choice.startsWith('forfeit:')){
   if(isLossStudy(m.scenario))delete f.lossReady;
   const id=choice.slice(8);const value=characterForfeit(m,id);
   const attachments=Object.values(m.cards).filter(c=>c.zone==='table'&&c.attachedTo===id).map(c=>c.id);
   b.attrition[side]=Math.max(0,b.attrition[side]-value);b.damage[side]=Math.max(0,b.damage[side]-value);b.next=other(side);log(m,label(side)+' forfeits '+name(m,id)+' for '+value+', satisfying attrition and battle damage together.');
   if(attachments.length){const remaining=[id,...attachments];for(const card of remaining)move(m,card,'leaving');m.stack.push({kind:'lost-order',side,remaining,placed:[]});log(m,'The trooper and its attached weapons leave together. Their owner chooses their order in Lost.');}
   else{move(m,id,'lost');window(m,'Card forfeited responses',other(side));}
  }else{lose(m,side,choice);if(isLossStudy(m.scenario))delete f.lossReady;b.damage[side]--;b.next=other(side);window(m,'Battle damage loss responses',other(side));}
 }else if(f.kind==='recirculation'){
  const p=m.players[side];for(const id of p.used)m.cards[id].zone='reserve';p.reserve.push(...p.used);const count=p.used.length;p.used=[];log(m,label(side)+' recirculates '+count+' cards beneath Reserve.');
  if(m.cycle)m.cycle.recirculated[side]=count;
  if(side===m.active)f.next=other(side);
  else if(m.cycle){m.stack.pop();m.stack.push({kind:'turn-end',stage:'automatic'});}
  else if(m.turn){
   m.turn.expired=m.turn.restrictions;m.turn.restrictions=[];m.turn.number++;m.turn.stage='complete';m.active=other(m.active);m.phase='Start of turn';
   finish(m,'Both players recirculated. The turn ends and Barrier restrictions expire. '+label(m.active)+'’s turn is next; the study stops here.');
  }else finish(m,'Recirculation checkpoint complete. Both Used piles are empty; Force piles are unchanged.');
 }
 settle(m);assertMatch(m);return m;
}

function lose(m:Match,s:Side,choice:string){
 const [,z,id]=choice.split(':');const zone=z as Pile;
 const card=zone==='hand'?id:m.players[s][zone]?.[0];if(!card||!m.players[s][zone]?.includes(card))throw Error('The selected Force-loss source is no longer available.');
 move(m,card,'lost');log(m,label(s)+' loses '+name(m,card)+' from '+zone+'.');
}

export function assertMatch(m:Match){
 assertReact(m);
 if(m.scenario==='last-force'){
  if(m.locations.length!==1||m.cards[m.locations[0]]?.blueprint!=='1_124'||m.battle||m.players.light.force.length||m.players.light.used.length||m.players.light.destiny.length||m.players.light.reserve.length>1||m.players.light.hand.length>1||[...m.players.light.reserve,...m.players.light.hand].some(id=>m.cards[id].blueprint!=='1_28'))throw Error('Unsupported final Life Force fixture.');
  if(Object.values(m.cards).some(c=>c.zone==='table'&&!m.locations.includes(c.id)&&(c.owner!=='dark'||c.blueprint!=='1_194'||c.location!==m.locations[0])))throw Error('Unsupported final Life Force table.');
  if(m.winner!==null&&(m.winner!=='dark'||!m.complete||life(m,'light')!==0))throw Error('Invalid final Life Force winner.');
 }

 if(m.schema!==1||(m.engine!==engineFor(m.scenario)&&!(m.scenario==='react-drain-deploy'&&m.engine==='native-proof-13'))||!scenarios.some(s=>s.id===m.scenario))throw Error('Unsupported saved engine version.');
 if((isTurnStudy(m.scenario)&&!m.setup)!==!!m.turn)throw Error('Missing or unexpected turn study.');
 if((m.scenario==='next-turn'||isOpeningStudy(m.scenario)&&!m.setup)!==!!m.cycle)throw Error('Missing or unexpected turn cycle.');
 if((m.scenario==='opening-table'||isOpeningStudy(m.scenario)&&!m.turn)!==!!m.setup)throw Error('Missing or unexpected setup study.');
 if(m.setup)assertSetup(m);
 else if(Object.values(m.cards).some(c=>c.coveredBy!==undefined))throw Error('Unexpected covered starting location.');
 if(!Number.isSafeInteger(m.revision)||m.revision<0||m.stack.length>24)throw Error('Invalid saved continuation.');
 const seen=new Set<string>();for(const s of sides){for(const z of piles)for(const id of m.players[s][z]){if(seen.has(id)||m.cards[id]?.owner!==s||m.cards[id]?.zone!==z)throw Error('Card conservation failed.');seen.add(id);}}
 for(const f of m.stack)if(f.kind==='react'&&f.method==='deploy'){if(seen.has(f.card))throw Error('Duplicate pending react.');seen.add(f.card);}
 for(const f of m.stack)if(f.kind==='interrupt'){
  const c=m.cards[f.card];
  if(!c||c.owner!==f.side||c.zone!=='playing'||seen.has(f.card))throw Error('Invalid pending card.');
  if(f.effect==='switch-battle-destiny'){
   if(m.engine!=='native-proof-2'||f.side!=='dark'||c.blueprint!=='1_269')throw Error('Invalid pending Interrupt.');
  }else if(f.effect==='reduce-loss'){
   if(!['reduce-drain','reduce-damage'].includes(m.scenario)||f.side!=='light'||c.blueprint!=='1_90'||!Number.isInteger(f.amount)||f.amount<1||f.amount>60||!m.stack.some(x=>x.kind==='loss-window'&&x.source===f.source&&x.side===f.side))throw Error('Invalid pending reduction.');
  }else if(m.scenario==='react-barrier'){if(c.blueprint!=='1_249'||f.side!=='dark'||m.cards[f.target]?.owner!=='light'||!m.reactStudy!.arrived.includes(f.target)||f.expiresTurn!==1)throw Error('Invalid react Barrier.');}
  else if(!m.turn||c.blueprint!==barrier(f.side)||f.side===m.turn.deployer||m.cards[f.target]?.owner!==m.turn.deployer||m.cards[f.target]?.zone!=='table'||f.expiresTurn!==m.turn.number)throw Error('Invalid pending Barrier.');
  seen.add(c.id);
 }
 if(isLossStudy(m.scenario)){
  if(m.lossStudy?.reduction&&(!['reduce-drain','reduce-damage'].includes(m.scenario)||m.cards[m.lossStudy.reduction.card]?.blueprint!=='1_90'||!Number.isInteger(m.lossStudy.reduction.amount)||m.lossStudy.reduction.amount<1||m.lossStudy.reduction.amount>60||m.lossStudy.reduction.source!==(m.scenario==='reduce-drain'?'drain':'battle')))throw Error('Invalid loss modifier.');
  if(!m.lossStudy||!Number.isInteger(m.lossStudy.reduced)||m.lossStudy.reduced<0||!Array.isArray(m.lossStudy.rescued))throw Error('Invalid loss study.');
  if(m.locations.length!==1||m.cards[m.locations[0]]?.blueprint!==(m.scenario==='reduce-drain'?'1_132':'1_124'))throw Error('Unsupported loss study board.');
  for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(![trooper(c.owner),...(m.scenario==='talz-rescue'?(c.owner==='light'?['1_31','1_152']:['1_317','1_312']):[])].includes(c.blueprint)||c.location!==m.locations[0]))throw Error('Unsupported loss study table.');
  for(const side of sides)if(m.players[side].hand.some(id=>![trooper(side),...(side==='light'&&m.scenario!=='talz-rescue'?['1_90']:[])].includes(m.cards[id].blueprint)))throw Error('Unsupported loss study hand.');
  for(const f of m.stack){
   if(f.kind==='loss-window'&&(!['drain','battle'].includes(f.source)||!sides.includes(f.side)||!sides.includes(f.priority)||!Number.isInteger(f.passes)||f.passes<0||f.passes>1||!m.stack.some(p=>p.kind===f.source)))throw Error('Invalid loss window.');
   if(f.kind==='restore-hit'&&(m.scenario!=='talz-rescue'||m.cards[f.source]?.blueprint!=='1_31'||m.cards[f.source]?.zone!=='lost'||m.cards[f.target]?.zone!=='table'||m.cards[f.target]?.owner!=='light'||!m.cards[f.target]?.hit))throw Error('Invalid pending rescue.');
  }
 }else if(m.lossStudy||m.stack.some(f=>f.kind==='loss-window'||f.kind==='restore-hit'))throw Error('Unexpected loss study continuation.');
 if(m.scenario==='corridor-crossfire'){
  if(m.locations.length!==1||m.cards[m.locations[0]]?.blueprint!=='1_284'||m.cards[m.locations[0]]?.owner!=='dark'||m.battle?.site!==m.locations[0])throw Error('Unsupported Corridor board.');
  for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(![trooper(c.owner),...(c.owner==='dark'?['1_317','1_312']:['1_152','1_153'])].includes(c.blueprint)||c.location!==m.locations[0]))throw Error('Unsupported Corridor table card.');
  for(const shot of m.battle.shots||[]){const rule=weaponRules[m.cards[shot.weapon]?.blueprint];if(!rule||shot.bonus!==rule.bonus+(shot.side==='dark'?1:0)||shot.cost!==rule.fire)throw Error('Invalid saved Corridor modifier.');}
 }
 if(isDesertStudy(m.scenario)){
  if(m.locations.length!==2||m.cards[m.locations[0]]?.blueprint!=='1_129'||m.cards[m.locations[1]]?.blueprint!=='1_132')throw Error('Unsupported Tatooine character board.');
  for(const side of sides){for(const id of [...m.players[side].hand,...m.players[side].force])if(![...desertCharacters(side),barrier(side)].includes(m.cards[id].blueprint))throw Error('Unsupported character study hand or Force.');}
  for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(!supportedCharacter(m,c.owner,c.blueprint)||!c.location))throw Error('Unsupported character study table.');
  if(Object.values(m.cards).filter(c=>c.zone==='table'&&c.blueprint==='101_2').length>1)throw Error('Duplicate Luke persona.');
 }
 if(isGarrisonStudy(m.scenario)){
  if(m.locations.length!==2||m.cards[m.locations[0]]?.blueprint!=='1_124'||m.cards[m.locations[1]]?.blueprint!=='1_284')throw Error('Unsupported garrison board.');
  for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(!supportedCharacter(m,c.owner,c.blueprint)||!c.location))throw Error('Unsupported garrison character.');
  for(const side of sides){
   if(m.players[side].force.some(id=>m.cards[id].blueprint!==trooper(side))||m.players[side].hand.some(id=>!supportedCharacter(m,side,m.cards[id].blueprint)&&m.cards[id].blueprint!==barrier(side)))throw Error('Unsupported garrison hand or Force.');
  }
 }
 if(isOpeningStudy(m.scenario)&&!m.setup){
  if(m.locations.length!==2||m.locations.filter(id=>m.cards[id].blueprint==='1_124'&&m.cards[id].owner==='light').length!==1||m.locations.filter(id=>m.cards[id].blueprint==='1_284'&&m.cards[id].owner==='dark').length!==1)throw Error('Unsupported integrated board.');
  for(const c of Object.values(m.cards))if(c.zone==='table'&&!m.locations.includes(c.id)&&(!(m.scenario==='second-contact'?(supportedCharacter(m,c.owner,c.blueprint)||!!weaponRules[c.blueprint]):[trooper(c.owner),c.owner==='light'?'1_152':'1_317'].includes(c.blueprint))||!c.location||(!supportedCharacter(m,c.owner,c.blueprint)&&!c.attachedTo)))throw Error('Unsupported integrated table card.');
 }
 if(m.turn){
  const t=m.turn;
  if(m.cycle){
   const cycle=m.cycle,expected=t.number%2?'dark':'light';
   if(!Number.isInteger(t.number)||t.number<1||t.number>openingEndpoint(m)||t.deployer!==expected||m.active!==expected||!['start','activate','control','deploy','battle','move','draw','end'].includes(t.stage))throw Error('Invalid continuous turn.');
   if(cycle.history.length!==t.number-1||cycle.generation!==(t.stage==='start'?0:forceGeneration(m,m.active))||!Number.isInteger(cycle.activated)||cycle.activated<0||cycle.activated>cycle.generation)throw Error('Invalid saved Force generation.');
   if(m.complete&&!m.winner&&(t.number!==openingEndpoint(m)||t.stage!=='activate'))throw Error('Premature continuous turn completion.');
   const count=(n:number)=>Number.isInteger(n)&&n>=0&&n<=60;
   if(!sides.every(side=>count(cycle.recirculated[side])))throw Error('Invalid recirculation count.');
   for(const [i,record] of cycle.history.entries())if(record.number!==i+1||record.side!==(i%2?'light':'dark')||record.generation!==(i%2?2:3)||!count(record.activated)||record.activated>record.generation||!count(record.expired)||!sides.every(side=>count(record.carriedForce[side])&&count(record.recirculated[side])))throw Error('Invalid completed turn record.');
   for(const r of [...t.restrictions,...t.expired]){const owner=m.cards[r.target]?.owner;if(!owner||!supportedCharacter(m,owner,m.cards[r.target].blueprint)||m.cards[r.source]?.blueprint!==barrier(other(owner))||!Number.isInteger(r.expiresTurn)||r.expiresTurn<1||r.expiresTurn>t.number||r.expiresTurn>=openingEndpoint(m))throw Error('Invalid continuous Barrier restriction.');}
   if(t.restrictions.some(r=>r.expiresTurn!==t.number||m.cards[r.target].owner!==m.active)||new Set(t.battled).size!==t.battled.length||new Set(m.drained).size!==m.drained.length||m.drained.some(id=>!m.locations.includes(id)))throw Error('Invalid continuous turn limits.');
   for(const side of sides){
    const safe=m.scenario==='second-contact'?secondContactSafe(side):[trooper(side),side==='light'?'1_12':'1_182'];
    if(m.players[side].force.some(id=>!safe.includes(m.cards[id].blueprint))||m.players[side].hand.some(id=>![...safe,barrier(side),...(isOpeningStudy(m.scenario)?[side==='light'?'1_152':'1_317']:[])].includes(m.cards[id].blueprint)))throw Error('Unsupported card reached the continuous study hand or Force.');
   }
  }else{
   if(t.deployer!==(m.scenario==='barrier'||m.scenario==='guard-post'||m.scenario==='tusken-band'?'dark':'light')||!['deploy','battle','move','draw','end','complete'].includes(t.stage)||t.number!==(m.complete?2:1))throw Error('Invalid study turn.');
   for(const r of [...t.restrictions,...t.expired])if(m.cards[r.target]?.owner!==t.deployer||!supportedCharacter(m,t.deployer,m.cards[r.target]?.blueprint)||m.cards[r.source]?.blueprint!==barrier(other(t.deployer))||r.expiresTurn!==1)throw Error('Invalid saved Barrier restriction.');
  }
  if(t.moved.some(id=>m.cards[id]?.owner!==t.deployer||!characterCanMove(m,id))||new Set(t.moved).size!==t.moved.length||t.battled.some(id=>!m.locations.includes(id)))throw Error('Invalid turn action history.');
 }
 for(const f of m.stack)if(f.kind==='lost-order')for(const id of f.remaining){if(seen.has(id)||m.cards[id]?.zone!=='leaving'||m.cards[id]?.owner!==f.side)throw Error('Invalid pending loss.');seen.add(id);}
 if(isWeaponStudy(m.scenario)&&(!isOpeningStudy(m.scenario)||m.battle)){
  const b=m.battle!;if(m.scenario==='second-contact'&&b)for(const shot of b.shots||[]){const rule=weaponRules[m.cards[shot.weapon]?.blueprint];if(!rule||shot.cost!==rule.fire||shot.bonus!==rule.bonus+(shot.side==='dark'&&m.cards[b.site]?.blueprint==='1_284'?1:0))throw Error('Invalid four-turn saved weapon modifier.');}
  if(!b||!Array.isArray(b.fired)||!b.weaponUsers||!Array.isArray(b.shots)||new Set(b.fired).size!==b.fired.length)throw Error('Invalid weapon battle.');
  for(const id of b.fired)if(!weaponRules[m.cards[id]?.blueprint])throw Error('Unsupported fired weapon.');
  for(const shot of b.shots){if(!weaponRules[m.cards[shot.weapon]?.blueprint]||m.cards[shot.user]?.owner!==shot.side||m.cards[shot.target]?.owner===shot.side)throw Error('Invalid saved shot.');if(shot.card&&!m.cards[shot.card])throw Error('Missing weapon destiny.');}
  for(const f of m.stack)if(f.kind==='shot'&&!b.shots[f.index])throw Error('Missing pending shot.');
 }
 for(const c of Object.values(m.cards)){definition(c.blueprint);if(c.zone==='table'){if(seen.has(c.id))throw Error('Duplicate table card.');seen.add(c.id);}if(c.location&&!m.locations.includes(c.location))throw Error('Invalid saved location.');if(c.attachedTo){const host=m.cards[c.attachedTo];if(!isWeaponStudy(m.scenario)||!weaponRules[c.blueprint]||c.zone!=='table'||host?.zone!=='table'||host.owner!==c.owner||host.location!==c.location||!definition(host.blueprint).icons.some(icon=>icon==='Warrior'))throw Error('Invalid attachment.');}}
 if(seen.size!==120||Object.keys(m.cards).length!==120)throw Error('The authored 120-card pool was not preserved.');
 for(const d of manifest.decks){const actual=Object.values(m.cards).filter(c=>c.owner===d.side).map(c=>c.blueprint).sort();if(actual.join(',')!==[...d.main].sort().join(','))throw Error('Saved card pool differs from source.');}
 if(JSON.stringify(m).length>160000)throw Error('Saved fixture exceeded its memory budget.');
}

function publicCard(m:Match,id:string):PublicCard{const c=m.cards[id],d=definition(c.blueprint);const rulesView=c.zone==='table'&&d.type==='Character'?characterView(m,id):undefined;return {id,blueprint:c.blueprint,name:d.name,image:d.image,side:c.owner,type:d.type,text:d.text,stats:d.stats as Record<string,string>,...(rulesView?{rulesView}:{}),...(setupSites[c.blueprint]?{forceIcons:{...setupSites[c.blueprint].icons}}:{}),...(c.location?{location:c.location}:{}),...(c.attachedTo?{attachedTo:c.attachedTo}:{}),...(c.hit?{hit:true}:{})};}
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
 assertMatch(m);const p=m.setup?setupPrompt(m,seat):prompt(m);const players={} as Projection['players'];
 for(const s of sides){const source=m.players[s];players[s]={counts:Object.fromEntries(piles.map(z=>[z,source[z].length])) as Projection['players'][Side]['counts'],life:life(m,s),hand:s===seat?source.hand.map(id=>publicCard(m,id)):[],lost:source.lost.slice(0,1).map(id=>publicCard(m,id)),destiny:source.destiny.map(id=>publicCard(m,id))};}
 const b=m.battle;const frame=m.stack.find(f=>f.kind==='battle');
 // Active saves expose totals only after calculation, including nested response
 // windows. In this closed fixture a completed battle with both destiny choices
 // recorded has resolved losses; leaving before initiation has neither choice.
 // This also reads existing native-proof-1 saves without changing stored rules.
 const ready=!!b&&(frame?.stage==='damage'||frame?.stage==='end'||b.resolved||m.complete&&b.drawn.light&&b.drawn.dark);
 const losses=ready?Object.fromEntries(sides.map(s=>[s,{attrition:b!.attrition[s],damage:b!.damage[s],initialAttrition:b!.destiny[other(s)]??0,initialDamage:Math.max(0,b!.power[other(s)]-b!.power[s])}])) as Record<Side,import('./types').LossBalance>:null;
 const order=m.stack.find(f=>f.kind==='lost-order');
 return {...(isReactStudy(m.scenario)?{reactStudy:{...structuredClone(m.reactStudy!),pending:(()=>{const f=m.stack.find(f=>f.kind==='react');return f?{card:f.card,cost:f.cost,method:f.method}:null})(),ability:{light:participatingAbility(m,'light',m.reactStudy!.site||m.locations[0]),dark:participatingAbility(m,'dark',m.reactStudy!.site||m.locations[0])}}}:{}),...(isLossStudy(m.scenario)?{lossStudy:{kind:m.scenario==='reduce-drain'?'drain' as const:m.scenario==='talz-rescue'?'rescue' as const:'battle' as const,remaining:m.scenario==='reduce-drain'?((m.stack.find(f=>f.kind==='drain') as Extract<Frame,{kind:'drain'}>|undefined)?.remaining||0):m.battle!.damage.light,reduced:m.lossStudy!.reduced,rescued:[...m.lossStudy!.rescued]}}:{}),...(isDesertStudy(m.scenario)?{characterStudy:{groups:m.locations.map(site=>({site,raiders:tuskensAt(m,site),bonus:groupPowerBonus(m,'dark',site)}))}}:{}),scenario:m.scenario,engine:m.engine,revision:m.revision,active:m.active,phase:m.phase,seat,complete:m.complete,winner:m.winner,players,locations:m.locations.map(id=>publicCard(m,id)),table:Object.values(m.cards).filter(c=>c.zone==='table'&&!m.locations.includes(c.id)&&!c.coveredBy).map(c=>publicCard(m,c.id)),prompt:p&&p.side===seat?p:p?{...p,choices:[]}:null,log:m.log,battle:b?structuredClone(b):null,losses,...(m.setup?{setup:projectSetup(m,seat,includeStudy,id=>publicCard(m,id))}:{}),...(m.cycle?{cycle:structuredClone(m.cycle)}:{}),...(m.scenario==='takeel'||m.turn||isLossStudy(m.scenario)||isReactStudy(m.scenario)?{playing:Object.values(m.cards).filter(c=>c.zone==='playing').map(c=>publicCard(m,c.id))}:{}),...(isWeaponStudy(m.scenario)&&(!isOpeningStudy(m.scenario)||!!m.battle)?{weaponStudy:{stage:m.complete?'complete' as const:m.phase==='Deploy'?'deploy' as const:'battle' as const,hits:{light:hitMembers(m,'light'),dark:hitMembers(m,'dark')},lostOrder:order?{side:order.side,remaining:order.remaining.map(id=>publicCard(m,id)),placed:order.placed.map(id=>publicCard(m,id))}:null}}:{}),...(m.turn?{turn:{...structuredClone(m.turn),deploymentSites:m.locations.map(site=>({site,allowed:deploySite(m,m.turn!.deployer,site),reason:deploySite(m,m.turn!.deployer,site)?'Your Force icon or presence allows deployment.':'No '+label(m.turn!.deployer)+' Force icon or presence here.'}))}}:{}),...(includeStudy&&m.scenario==='recirculation'?{recirculationStudy:recirculationStudy(m)}:{})};
}
