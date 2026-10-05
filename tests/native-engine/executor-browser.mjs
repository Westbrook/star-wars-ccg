// Bounded Executor/Holotheatre scenarios using real UI → HTTP → service → SQLite.
// Fixture admission is scenario-only; this does not open full starter matches.
import assert from 'node:assert/strict';
import {fixture as vessels,pull as vesselPull,force} from './vessels-fixture.mjs';
import {mod,runtime,rules,state,pull,phase} from './prisoner-fixture.mjs';
import {browserHarness,widths} from './capture-gate-browser-helper.mjs';

const setupRules={...mod('premiere-rules').premiereRules,supports:()=>true};
const soloDecks=(dark,light)=>['dark','light'].map(side=>({side,cards:[...(side==='dark'?dark:light),...Array(60).fill(side==='dark'?'1_194':'1_28')].slice(0,60)}));
function deployFixture(){
 const f=vessels({dark:['4_167','4_161','4_161','1_284'],light:[]});
 f.hull=vesselPull(f.m,'dark','4_167','hand');f.holo=vesselPull(f.m,'dark','4_161','hand');f.duplicate=vesselPull(f.m,'dark','4_161','hand');force(f.m,'dark',12);return f;
}
function departureFixture(){
 let m=runtime.createMatch('executor-departure',60,soloDecks(['4_167','4_161','1_289'],Array(8).fill('1_147')),rules);
 const system=pull(m,'dark','1_289'),holo=pull(m,'dark','4_161');m.locations.push(system,holo);
 const hull=pull(m,'dark','4_167','table',system),resident=pull(m,'dark','1_194','table',holo);
 for(let i=0;i<8;i++)pull(m,'light','1_147','table',system);
 for(const side of ['dark','light'])for(let i=0;i<10;i++)state.moveCard(m,m.players[side].reserve.at(-1),'force');
 m=phase(runtime.startTurns(m,rules),'dark','battle');return {m,system,holo,hull,resident};
}
function setupFixture(){const m=runtime.createMatch('executor-setup',60,soloDecks(['4_161'],['1_129']),setupRules);return {m,holo:Object.values(m.cards).find(c=>c.blueprint==='4_161').id,light:Object.values(m.cards).find(c=>c.blueprint==='1_129').id};}
const modes=process.env.EXECUTOR_MODES?.split(',')??['deploy','departure','setup'];
for(const mode of modes){
 assert.ok(['deploy','departure','setup'].includes(mode));
 const h=await browserHarness('executor',{rules:mode==='setup'?setupRules:rules});
 try{for(const [width,height]of widths('EXECUTOR_WIDTHS')){
  const f=mode==='deploy'?deployFixture():mode==='departure'?departureFixture():setupFixture(),t=await h.seed(f.m,width,height);
  const siteLabel=host=>host?'Aboard Executor · Below decks':'Aboard Executor · Vessel not on table';
  async function labelBoth(host){for(const side of ['dark','light']){const page=t.clients[side].page;assert.equal(await page.getByText(siteLabel(host),{exact:true}).count(),1);}}
  async function capturePhone(suffix,selector){if(width===390){const page=await t.screenshot(mode+'-'+suffix+'-phone.png','dark',false);if(selector)await page.locator(selector).screenshot({path:h.output+'/'+mode+'-'+suffix+'-detail-phone.png'});}}
  try{
   await t.refresh();
   if(mode==='deploy'){
    await t.choose(t.ids().find(id=>id.startsWith('ship-site:deploy:'+f.holo+':EXECUTOR:')));await t.refresh();
    await t.advance(m=>m.cards[f.holo].zone==='table');await t.refresh();await labelBoth(false);
    await capturePhone('hostless','.native-site:has(h3:text-is("Executor: Holotheatre"))');
    await t.advance(()=>t.ids().includes('vessel:deploy:'+f.hull+':'+f.planet));
    assert.ok(!t.ids().some(id=>id.startsWith('ship-site:deploy:'+f.duplicate+':')),'Unique Holotheatre cannot deploy twice.');
    const before=t.read().players.dark.force.length;
    await t.choose('vessel:deploy:'+f.hull+':'+f.planet);await t.refresh();
    await t.advance(m=>m.cards[f.hull].zone==='table');await t.refresh();await labelBoth(true);
    assert.equal(before-t.read().players.dark.force.length,15);
    for(const side of ['dark','light']){
     const ship=t.clients[side].page.getByRole('region',{name:'Executor crew',exact:true});
     assert.equal(await ship.getByText('Unlimited pilots, passengers, vehicles and starfighters',{exact:true}).count(),1);
     assert.equal(await ship.getByText('Permanent pilot · ability 3',{exact:true}).count(),1);
     assert.match(await ship.getByLabel('Current vessel values').innerText(),/Power 12 · Armor 12 · Hyperspeed 2/);
    }
    await t.advance(()=>t.ids().includes('vessel:aboard:'+f.pilot+':'+f.hull+':pilot'));
    await t.choose('vessel:aboard:'+f.pilot+':'+f.hull+':pilot');await t.refresh();
    await t.advance(m=>m.cards[f.pilot].attachedTo===f.hull);
    await t.advance(()=>t.ids().includes('deploy:'+f.passenger+':'+f.holo));
    await t.choose('deploy:'+f.passenger+':'+f.holo);await t.refresh();
    await t.advance(m=>m.cards[f.passenger].zone==='table');await t.refresh();
    await capturePhone('capacity','.native-vessel[aria-label="Executor crew"]');
    await t.advance(m=>m.turn.phase==='move'&&m.turn.side==='dark'&&m.stack.length===1&&t.prompt().side==='dark');
    const movingForce=t.read().players.dark.force.length;
    await t.choose('transport:ship-site:'+f.pilot+':'+f.holo);await t.refresh();
    await t.advance(m=>m.cards[f.pilot].location===f.holo);await t.refresh();
    assert.equal(t.read().cards[f.pilot].attachedTo,undefined);
    await t.advance(()=>t.ids().includes('transport:ship-site:'+f.passenger+':'+f.hull+':passenger'));
    await t.choose('transport:ship-site:'+f.passenger+':'+f.hull+':passenger');await t.refresh();
    await t.advance(m=>m.cards[f.passenger].attachedTo===f.hull);await t.refresh();
    assert.equal(t.read().cards[f.passenger].aboardRole,'passenger');assert.equal(t.read().cards[f.passenger].location,f.planet);
    assert.equal(t.read().players.dark.force.length,movingForce,'Both related ship/site moves are free.');
    assert.ok([f.pilot,f.passenger].every(id=>mod('ground').usage(t.read()).moved.includes(id)));
    await capturePhone('transferred','.native-vessel[aria-label="Executor crew"]');
   }else if(mode==='departure'){
    await labelBoth(true);
    await t.choose('battle:'+f.system);await t.refresh();
    await t.advance(()=>t.ids().includes('forfeit:'+f.hull));await t.refresh();
    await t.choose('forfeit:'+f.hull);await t.refresh();
    await t.advance(m=>m.cards[f.hull].zone==='lost');await t.refresh();await labelBoth(false);
    assert.equal(t.read().cards[f.holo].zone,'table');assert.ok(t.read().locations.includes(f.holo));
    assert.equal(t.read().cards[f.resident].zone,'table');assert.equal(t.read().cards[f.resident].location,f.holo);
    await capturePhone('surviving-site','.native-site:has(h3:text-is("Executor: Holotheatre"))');
   }else{
    // Setup starts with simultaneous private choices; Light is the harness's first seat.
    assert.equal(t.prompt().side,'light');await t.choose('select:'+f.light);await t.refresh();
    assert.equal(t.prompt().side,'dark');await t.choose('select:'+f.holo);await t.refresh();
    assert.equal(t.read().setup.selected.dark,f.holo);assert.equal(t.read().setup.stage,'reveal');
    await t.choose('reveal');await t.refresh();
    await t.advance(m=>m.cards[f.holo].zone==='table');await t.refresh();await labelBoth(false);
    assert.equal(mod('ship-sites').relatedShip(t.read(),f.holo),undefined);
    await capturePhone('starting-site','.native-site:has(h3:text-is("Executor: Holotheatre"))');
   }
   console.log('Passed Executor '+mode+' at '+width+' with real UI/HTTP/service/SQLite and both-seat refresh.');
  }finally{await t.close();}
 }}finally{await h.close();}
}
