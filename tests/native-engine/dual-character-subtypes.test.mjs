import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from '../native-proof/load-engine.mjs';
import {runtime,state,rules,clone,pull,location,force,prompt,ids,step,seek,phase,priority} from './noble-fixture.mjs';
const mod=name=>load(new URL('../../lib/native-engine/'+name+'.ts',import.meta.url));
const board=mod('board'),traits=mod('characteristics'),persona=mod('persona'),text=mod('game-text'),ability=mod('ability');
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/native-proof/manifest.json',import.meta.url)));
// Actual card definitions and legal commands on controlled component boards.
// No metadata mutation or full-deck admission is used to make Chewie dual-type.
function fresh(extra={}){return runtime.createMatch('dual-character-subtypes',60,manifest.decks.map(d=>({side:d.side,cards:[...(d.side==='light'?['2_3']:[]),...(extra[d.side]??[]),...d.main].slice(0,60)})),rules);}
function ready(m,side='light',p='deploy'){force(m,'light',8);force(m,'dark',8);m=phase(m,p);m.turn.side=side;m.stack[0].priority=side;return m;}
const boundary=(m,event)=>seek(m,x=>x.stack.at(-1)?.event?.kind===event);

test('Original Chewbacca retains Alien and Rebel identity through text cancellation without becoming other subtypes',()=>{
 const m=fresh({light:['1_5']});const site=location(m,'light','1_129'),chewie=pull(m,'light','2_3','table',site),talz=pull(m,'light','1_31','table',site),rebel=pull(m,'light','1_28','table',site),droid=pull(m,'light','1_5','table',site),imperial=pull(m,'dark','1_194','table',site);
 assert.equal(board.cardDefinition(m,chewie).subType,'Alien/Rebel');
 for(const blank of [false,true]){if(blank)text.suppressGameText(m,site,chewie);for(const [id,expected] of [[chewie,['Alien','Rebel']],[talz,['Alien']],[rebel,['Rebel']],[droid,['Droid']],[imperial,['Imperial']],[site,[]]])for(const kind of ['Alien','Rebel','Droid','Imperial'])assert.equal(traits.hasCharacterSubtype(m,id,kind),expected.includes(kind),id+':'+kind);}
 assert.equal(traits.hasCharacterSubtype(m,chewie,'Reb'),false);assert.equal(traits.hasCharacterSubtype(m,'missing','Alien'),false);assert.equal(traits.hasCharacteristic(m,chewie,'SMUGGLER'),true);assert.equal(persona.hasPersona(m,chewie,'CHEWIE'),true);assert.equal(traits.reinforcementTarget(m,chewie,'light'),false,'Rebel identity does not grant trooper');
});

test('Scanning Crew can select Chewbacca as a Rebel, keeps the alien-only card private, and resumes the saved placement',()=>{
 let m=fresh({dark:['1_266']});location(m,'light','1_129');const chewie=pull(m,'light','2_3','hand'),talz=pull(m,'light','1_31','hand'),rebel=pull(m,'light','1_28','hand'),scan=pull(m,'dark','1_266','hand');m=ready(m,'dark');
 m=seek(step(m,'scan:play:'+scan),x=>x.stack.at(-1)?.handler==='scan:peek');m=step(m,'scan:continue');assert.ok(ids(m).includes('scan:select:'+chewie));assert.ok(ids(m).includes('scan:select:'+rebel));assert.ok(!ids(m).includes('scan:select:'+talz));
 m=step(clone(m),'scan:select:'+chewie);assert.equal(m.stack.at(-1).event.kind,'about-to-place-hand-card-used');assert.deepEqual(runtime.project(m,rules,'light').rules.scan.cards.map(c=>c.id),[chewie]);m=seek(clone(m),x=>x.cards[scan].zone==='used');assert.equal(m.cards[chewie].zone,'used');assert.equal(m.cards[talz].zone,'hand');assert.equal(m.cards[rebel].zone,'hand');
});

test('Chewbacca simultaneously supplies C-3PO Rebel pairing, receives Leia text and counts as an alien for Ardan',()=>{
 const m=fresh({light:['1_5','1_17'],dark:['4_103']});const site=location(m,'dark','1_284'),chewie=pull(m,'light','2_3','table',site),c3po=pull(m,'light','1_5','table',site),leia=pull(m,'light','1_17','table',site),ardan=pull(m,'dark','4_103','table',site);
 const protocol=mod('protocol-droid'),leiaText=mod('leia'),combat=mod('combat-modifiers');
 assert.equal(protocol.protocolPowerBonus(m,'light',site,id=>id!==leia),2);assert.equal(leiaText.leiaPowerBonus(m,chewie,()=>true),1);assert.equal(combat.attritionImmunityValues(m,ardan).lessThan,1);
 text.suppressGameText(m,site,chewie);assert.equal(protocol.protocolPowerBonus(m,'light',site,id=>id!==leia),2);assert.equal(leiaText.leiaPowerBonus(m,chewie,()=>true),1);assert.equal(combat.attritionImmunityValues(m,ardan).lessThan,1);
 state.moveCard(m,chewie,'hand');assert.equal(protocol.protocolPowerBonus(m,'light',site,id=>id!==leia),0);assert.equal(combat.attritionImmunityValues(m,ardan).lessThan,0);assert.equal(m.cards[c3po].zone,'table');
});

test('Arleil Schous discounts actual Chewbacca deployment as an alien while an ordinary Rebel keeps its own cost',()=>{
 let m=fresh({light:['106_1']});const site=location(m,'light','1_129'),leader=pull(m,'light','106_1','table',site),chewie=pull(m,'light','2_3','hand'),rebel=pull(m,'light','1_28','hand');m=ready(m);
 assert.equal(mod('otsd-characters').otsdAlienDiscount(m,chewie,site),-1);assert.equal(mod('otsd-characters').otsdAlienDiscount(m,rebel,site),0);
 const payment=board.deploymentPayment(m,chewie,site),before=m.players.light.force.length;assert.equal(payment.light,Number(board.cardDefinition(m,chewie).stats.deploy)-1);
 m=boundary(step(m,'deploy:'+chewie+':'+site),'deployed');assert.equal(m.players.light.force.length,before-payment.light);assert.equal(m.cards[chewie].zone,'table');assert.equal(m.cards[leader].zone,'table');
});

test('Tatooine Utility Belt deploys on dual-type Chewbacca and follows the normal saved attachment pipeline',()=>{
 let m=fresh({light:['1_40']});const site=location(m,'light','1_129'),chewie=pull(m,'light','2_3','table',site),device=pull(m,'light','1_40','hand');m=ready(m);
 assert.ok(ids(m).includes('attach:'+device+':'+chewie));m=step(m,'attach:'+device+':'+chewie);m=seek(clone(m),x=>x.cards[device].zone==='table');assert.equal(m.cards[device].attachedTo,chewie);
});

test('Alien classification does not bypass Chewbacca uniqueness for alien search or Corulag',()=>{
 const m=fresh({light:['106_2','106_7']});const site=location(m,'light','1_129'),corulag=location(m,'light','106_2'),chewie=Object.values(m.cards).find(c=>c.blueprint==='2_3').id,talz=Object.values(m.cards).find(c=>c.blueprint==='1_31').id;
 const cs=mod('alien-search').alienSearchChoices(m,{handler:'alien-search:choose',side:'light'}).map(c=>c.id);assert.ok(cs.includes('alien-search:take:'+talz));assert.ok(!cs.includes('alien-search:take:'+chewie));
 pull(m,'light','106_7','table',corulag);const pilot=pull(m,'light','1_28','table',site);assert.equal(mod('otsd-locations').corulagStatBonus(m,chewie),0);assert.equal(mod('otsd-locations').corulagStatBonus(m,pilot),1);assert.equal(m.cards[site].zone,'table');
});

test('On The Edge recognizes Chewbacca as a Rebel but still requires ability greater than two',()=>{
 let m=fresh({light:['1_101']});const site=location(m,'light','1_129'),chewie=pull(m,'light','2_3','table',site),card=pull(m,'light','1_101','hand');m=ready(m);
 assert.equal(board.cardDefinition(m,chewie).stats.ability,'2');assert.ok(!ids(m).includes('edge:play:'+card+':'+chewie));ability.addAbilityModifier(m,site,chewie,'add',1);assert.ok(ids(m).includes('edge:play:'+card+':'+chewie));
 m=step(m,'edge:play:'+card+':'+chewie);assert.equal(m.stack.at(-1).handler,'edge:number');m=step(clone(m),'edge:number:1');assert.equal(m.cards[card].zone,'playing');assert.equal(m.players.light.force.length,7);rules.validate(clone(m));
});

test('A Rebel ability modifier lets Chewbacca satisfy free trooper deployment and Docking Control Room drain without changing his alien identity',()=>{
 const m=fresh();const site=location(m,'dark','101_4'),chewie=pull(m,'light','2_3','table',site),troop=pull(m,'light','1_28','hand');
 const drain=board.drainAmount(m,'light',site);assert.equal(board.deploymentPayment(m,troop,site).light,Number(board.cardDefinition(m,troop).stats.deploy));ability.addAbilityModifier(m,site,chewie,'add',1);
 assert.equal(board.deploymentPayment(m,troop,site).light,0);assert.equal(board.drainAmount(m,'light',site),drain+2);assert.equal(traits.hasCharacterSubtype(m,chewie,'Alien'),true);
});

test('Narrow Escape can name dual-type Chewbacca only when his current ability exceeds two',()=>{
 let m=fresh();const site=location(m,'light','1_129'),near=location(m,'light','1_132'),chewie=pull(m,'light','2_3','table',site),card=pull(m,'light','1_98','hand');pull(m,'dark','1_194','table',site);m=ready(m,'dark','battle');m=priority(step(m,'battle:'+site),'light');
 assert.ok(!ids(m).some(id=>id.startsWith('escape:'+card)));ability.addAbilityModifier(m,site,chewie,'add',1);assert.ok(ids(m).includes('escape:'+card));m=step(m,'escape:'+card);m=seek(m,x=>x.stack.at(-1)?.handler==='travel:escape');assert.ok(ids(m).includes('away:'+chewie+':'+near));m=step(clone(m),'away:'+chewie+':'+near);m=seek(m,x=>x.cards[card].zone==='used');assert.equal(m.cards[chewie].location,near);
});
