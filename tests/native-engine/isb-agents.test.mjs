import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mod,runtime,state,rules,pull,phase,step,ids,seek,clone,fixture,ready,refresh} from './isb-agents-fixture.mjs';
const board=mod('board'),agents=mod('isb-agents'),text=mod('game-text');
const oracleUrl=new URL('./gemp/isb-agents-results.json',import.meta.url);
const oracle=JSON.parse(fs.readFileSync(oracleUrl));
function compare(row){const expected=oracle.find(x=>x.name===row.name);assert.ok(expected,row.name);assert.deepEqual(row,expected);}
for(const mode of ['lone','tarkin','bast','dodonna','all','other-site','aboard'])test('Yularen '+mode+' matches the real at-same-site power condition',()=>{
 const f=fixture(),m=f.m,y=pull(m,'dark','1_166','table',f.site);
 if(['tarkin','all','aboard'].includes(mode))pull(m,'dark','1_179','table',f.site);
 if(['bast','all'].includes(mode))pull(m,'dark','1_165','table',f.site);
 if(['dodonna','all'].includes(mode))pull(m,'light','1_10','table',f.site);
 if(mode==='other-site')pull(m,'dark','1_179','table',f.hoth);
 if(mode==='aboard'){const v=pull(m,'dark','1_310','table',f.site);m.cards[y].attachedTo=v;m.cards[y].aboardRole='passenger';assert.equal(mod('occupancy').characterPresent(m,y),false);}
 assert.equal(board.power(m,y),['lone','other-site'].includes(mode)?1:2);compare({name:'yularen-'+mode,power:board.power(m,y)});refresh(m);
});
for(const mode of ['same-site','other-site','aboard'])test('Veers '+mode+' adds only the snowtrooper forfeit bonus',()=>{
 const f=fixture(),m=f.m,v=pull(m,'dark','104_6','table',mode==='other-site'?f.hoth:f.site),snow=pull(m,'dark','3_91','table',f.site),trooper=pull(m,'dark','1_194','table',f.site);
 if(mode==='aboard'){const transport=pull(m,'dark','1_310','table',f.site);m.cards[v].attachedTo=transport;m.cards[v].aboardRole='passenger';}
 assert.equal(board.forfeit(m,snow),mode==='other-site'?3:4);assert.equal(board.forfeit(m,trooper),2);compare({name:'veers-'+mode,snowForfeit:board.forfeit(m,snow),trooperForfeit:board.forfeit(m,trooper)});refresh(m);
});
for(const count of [0,2,3])test('Veers deployment with '+count+' opposing unique characters',()=>{
 const f=fixture(),v=pull(f.m,'dark','104_6','hand');for(const bp of ['1_10','1_19','1_11'].slice(0,count))pull(f.m,'light',bp,'table',f.site);
 let m=ready(f),offered=ids(m).some(id=>id.startsWith('deploy:'+v+':'));assert.equal(offered,count<3);const row={name:'veers-deploy-'+count,offered};
 if(offered){row.hothOffered=ids(m).includes('deploy:'+v+':'+f.hoth);row.tatooineOffered=ids(m).includes('deploy:'+v+':'+f.site);assert.equal(row.hothOffered,true);assert.equal(row.tatooineOffered,false);const before=m.players.dark.force.length;m=step(m,'deploy:'+v+':'+f.hoth);m=seek(m,x=>x.cards[v].zone==='table');row.cost=before-m.players.dark.force.length;assert.equal(row.cost,3);assert.equal(m.cards[v].location,f.hoth);refresh(m);}
 compare(row);
});
test('ISB ignores Veers own Hoth restriction while preserving the three-unique-character prohibition',()=>{
 const f=fixture({objective:true}),v=pull(f.m,'dark','104_6','hand');assert.equal(mod('characteristics').hasCharacteristic(f.m,v,'ISB_AGENT'),true);assert.equal(mod('characteristics').hasCharacteristic(f.m,v,'SPY'),true);
 assert.deepEqual(board.deploymentPayment(f.m,v,f.site),{dark:4});for(const bp of ['1_10','1_19','1_11'])pull(f.m,'light',bp,'table',f.site);assert.equal(agents.isbAgentDeploymentProhibited(f.m,v),true);assert.equal(board.deploymentPayment(f.m,v,f.site),null);assert.equal(board.deploymentPayment(f.m,v,f.hoth),null);refresh(f.m);
});
test('Veers cannot deploy in Hoth orbit, but ISB can bypass that own location restriction',()=>{
 for(const objective of [false,true]){const f=fixture({objective}),v=pull(f.m,'dark','104_6','hand'),orbit=pull(f.m,'dark','3_143');f.m.locations.push(orbit);assert.deepEqual(board.deploymentPayment(f.m,v,orbit,true),objective?{dark:4}:null);refresh(f.m);}
});
test('Veers prohibition ignores nonunique characters, friendly uniques, and opponents outside the table',()=>{
 const f=fixture(),m=f.m,v=pull(m,'dark','104_6','hand'),luke=pull(m,'light','1_19','table',f.site),han=pull(m,'light','1_11','table',f.site),dodonna=pull(m,'light','1_10','hand');pull(m,'dark','1_179','table',f.site);for(let i=0;i<5;i++)pull(m,'light','1_28','table',f.site);
 assert.equal(agents.isbAgentDeploymentProhibited(m,v),false);state.moveCard(m,dodonna,'table');m.cards[dodonna].location=f.site;assert.equal(agents.isbAgentDeploymentProhibited(m,v),true);state.moveCard(m,dodonna,'hand');assert.equal(agents.isbAgentDeploymentProhibited(m,v),false);refresh(m);
});
test('both source modifiers disappear with canceled text and return after their suppressor leaves',()=>{
 const f=fixture(),m=f.m,y=pull(m,'dark','1_166','table',f.site),tarkin=pull(m,'dark','1_179','table',f.site),v=pull(m,'dark','104_6','table',f.site),snow=pull(m,'dark','3_91','table',f.site),src=pull(m,'light','1_19','table',f.site);
 for(const target of [y,v])text.suppressGameText(m,src,target,'source');assert.equal(board.power(m,y),1);assert.equal(board.forfeit(m,snow),3);state.moveCard(m,src,'hand');assert.equal(board.power(m,y),2);assert.equal(board.forfeit(m,snow),4);refresh(m);
});
test('partners retain their identities when their own text is canceled, but excluded battle cards supply no modifier',()=>{
 const f=fixture(),m=f.m,y=pull(m,'dark','1_166','table',f.site),tarkin=pull(m,'dark','1_179','table',f.site),v=pull(m,'dark','104_6','table',f.site),snow=pull(m,'dark','3_91','table',f.site);
 text.suppressGameText(m,y,tarkin);assert.equal(board.power(m,y),2);assert.equal(board.power(m,y,false,id=>id!==tarkin),1);assert.equal(board.forfeit(m,snow,id=>id!==v),3);assert.equal(board.forfeit(m,snow,id=>id!==snow),3);refresh(m);
});
test('Veers supports any snowtrooper at the site regardless of owner and neither agent acquires a pilot icon',()=>{
 const f=fixture(),m=f.m,y=pull(m,'dark','1_166','table',f.site),v=pull(m,'dark','104_6','table',f.site),snow=pull(m,'dark','3_91','table',f.site);m.cards[snow].originalOwner='dark';m.cards[snow].owner='light';assert.equal(board.forfeit(m,snow),4);for(const id of [y,v])assert.equal(board.cardDefinition(m,id).icons.includes('Pilot'),false);refresh(m);
});

test('three unique opponents aboard an enclosed vehicle still prohibit Veers deployment',()=>{
 const f=fixture(),m=f.m,v=pull(m,'dark','104_6','hand'),transport=pull(m,'light','1_151','table',f.site);for(const bp of ['1_10','1_19','1_11']){const id=pull(m,'light',bp,'table',f.site);m.cards[id].attachedTo=transport;m.cards[id].aboardRole='passenger';assert.equal(mod('occupancy').characterPresent(m,id),false);}
 assert.equal(agents.isbAgentDeploymentProhibited(m,v),true);assert.equal(board.deploymentPayment(m,v,f.hoth),null);refresh(m);
});
test('Veers deployment restriction does not invalidate his table state or movement away from Hoth',()=>{
 const f=fixture(),m=f.m,v=pull(m,'dark','104_6','table',f.hoth);board.moveWithAttachments(m,v,f.site);assert.equal(m.cards[v].location,f.site);assert.equal(mod('ground').canMove(m,v),true);refresh(m);
});
test('both modifiers follow the selected Besieged party at a virtual site',async()=>{
 const captured=await import('./captured-ships-fixture.mjs'),decks=captured.shipDecks();decks[1].cards.splice(5,0,'1_166','104_6','1_179','3_91','2_117');decks[1].cards.length=60;
 const f=captured.fixture(1,{decks,capture:false});let m=f.m;const y=pull(m,'dark','1_166','table',f.site),tarkin=pull(m,'dark','1_179','table',f.site),v=pull(m,'dark','104_6','table',f.site),snow=pull(m,'dark','3_91','table',f.site),effect=pull(m,'dark','2_117','hand');
 for(const id of [y,tarkin,v,snow]){m.cards[id].attachedTo=f.host;m.cards[id].aboardRole='passenger';}
 mod('captured-ships').captureStarship(m,f.ship,f.host);m=phase(m,'dark','deploy');m=seek(step(m,'besieged:deploy:'+effect+':'+f.ship),x=>x.cards[effect].zone==='table');m=phase(m,'dark','battle');m=step(m,'besieged:select:'+effect+':'+f.ship);for(const id of [y,tarkin,v,snow])m=step(m,'besieged:add:'+id);m=step(m,'besieged:begin');m=seek(m,x=>x.stack.at(-1)?.event?.kind==='battle-weapons');assert.equal(board.power(m,y),2);assert.equal(board.forfeit(m,snow),4);
 mod('ground').record(m).barriers[tarkin]=m.turn.number;mod('ground').record(m).barriers[v]=m.turn.number;assert.equal(board.power(m,y),1);assert.equal(board.forfeit(m,snow),3);refresh(m);
});
