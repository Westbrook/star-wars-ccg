import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ready,destiny,fire,done,load,state,seek,rules,clone} from './heavy-fixture.mjs';
import {fixture as shipFixture,initiated,boundary} from './starship-weapons-fixture.mjs';
const textRules=load(new URL('../../lib/native-engine/game-text.ts',import.meta.url));
const totals=load(new URL('../../lib/native-engine/destiny.ts',import.meta.url));
const atTotal=m=>seek(m,x=>x.stack.at(-1)?.event?.kind==='destiny-total');
function change(m,weapon,mode,site){
 const host=m.cards[weapon].attachedTo,location=m.cards[weapon].location;
 if(mode==='leave'||mode==='return'){state.moveCard(m,weapon,'hand');if(mode==='return'){state.moveCard(m,weapon,'table');m.cards[weapon].attachedTo=host;m.cards[weapon].location=location;}}
 if(mode==='cancel')textRules.suppressGameText(m,site,weapon);
}
for(const artillery of [false,true])for(const mode of ['stay','leave','cancel','return'])test((artillery?'Golan':'cannon')+' total observes '+mode+' during total responses after reload',()=>{
 const f=destiny(ready(fixture({artillery})));let m=atTotal(fire(f));assert.equal(m.stack.at(-1).event.total,artillery?7:6);change(m,f.gun,mode,f.site);rules.validate(clone(m));m=done(clone(m));assert.equal(m.data.heavyShots.at(-1).total,['stay','return'].includes(mode)?(artillery?7:6):5);assert.equal(m.data.heavyShots.at(-1).modifier,['stay','return'].includes(mode)?(artillery?2:1):0);
});
for(const bp of ['1_159','1_323'])for(const mode of ['stay','leave','cancel','return'])test(bp+' continuous total follows '+mode+' in the final window',()=>{
 const f=shipFixture(bp);let m=atTotal(initiated(f,bp==='1_159'?[3]:[3,3]));change(m,f.weapon,mode,f.site);m=boundary(clone(m),'weapon-fired');const shot=m.data.battle.starshipShots.at(-1);assert.equal(shot.total,bp==='1_159'?(['stay','return'].includes(mode)?4:3):(['stay','return'].includes(mode)?1:6));assert.equal(shot.modifier,['stay','return'].includes(mode)?(bp==='1_159'?1:-5):0);
});
test('removing a negative total modifier restores the full sum after an apparent zero',()=>{
 const f=shipFixture('1_323');let m=atTotal(initiated(f,[1,1]));assert.equal(m.stack.at(-1).event.total,0);assert.equal(m.stack.at(-2).action.payload.total,-3);change(m,f.weapon,'leave',f.site);m=boundary(clone(m),'weapon-fired');assert.equal(m.data.battle.starshipShots.at(-1).total,2);
});
test('an independent total adjustment survives continuous source removal',()=>{
 const f=destiny(ready(fixture()));let m=atTotal(fire(f));m.stack.at(-2).action.payload.total+=3;change(m,f.gun,'leave',f.site);m=done(clone(m));assert.equal(m.data.heavyShots.at(-1).total,8);
});
test('restoring the original source text restores its continuous total contribution',()=>{
 const f=destiny(ready(fixture()));let m=atTotal(fire(f));textRules.suppressGameText(m,f.site,f.gun);assert.equal(totals.currentDestinyTotal(m,m.stack.at(-2).action.payload),5);m.data.gameTextSuppressions=[];assert.equal(totals.currentDestinyTotal(m,m.stack.at(-2).action.payload),6);m=done(clone(m));assert.equal(m.data.heavyShots.at(-1).total,6);
});
for(const mutation of ['weapon','target','weapon-version','target-version','category','initial'])test('saved continuous total rejects malformed '+mutation,()=>{
 const f=destiny(ready(fixture()));const m=atTotal(fire(f)),p=m.stack.at(-2).action.payload;
 if(mutation==='weapon')p.continuous.context.weapon.id=f.site;
 if(mutation==='target')p.continuous.context.target.id=f.site;
 if(mutation==='weapon-version')p.continuous.context.weapon.version++;
 if(mutation==='target-version')p.continuous.context.target.version++;
 if(mutation==='category')p.category='battle';
 if(mutation==='initial')p.continuous.initial=100;
 assert.throws(()=>rules.validate(m));
});
const fs=await import('node:fs');
const oracle=JSON.parse(fs.readFileSync(new URL('./gemp/weapon-total-results.json',import.meta.url)));
test('executed weapon-total evidence retains its source and result fingerprints',async()=>{
 const {createHash}=await import('node:crypto');
 const receipt=JSON.parse(fs.readFileSync(new URL('./gemp/weapon-total-provenance.json',import.meta.url)));
 assert.equal(oracle.length,receipt.observations);assert.equal(receipt.exactAgreements,20);
 for(const [name,hash] of Object.entries(receipt.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./gemp/'+name,import.meta.url))).digest('hex'),hash);
});
for(const row of oracle)test('executed GEMP continuous total '+row.weapon+' '+row.mode,()=>{
 if(['cannon','golan'].includes(row.weapon)){
  const f=destiny(ready(fixture({artillery:row.weapon==='golan'})));let m=atTotal(fire(f));const before=m.stack.at(-1).event.total;change(m,f.gun,row.mode,f.site);m=done(clone(m));assert.deepEqual({weapon:row.weapon,mode:row.mode,before,after:m.data.heavyShots.at(-1).total,hit:m.data.heavyShots.at(-1).outcome==='hit'},row);
 }else if(row.weapon==='1_318'){
  const f=ion.fixture();let m=atTotal(ion.start(f,[3]));const before=m.stack.at(-1).event.total;change(m,f.weapon,row.mode,f.site);const after=totals.currentDestinyTotal(m,m.stack.at(-2).action.payload);m=boundary(clone(m),'weapon-fired');const shot=m.data.battle.starshipShots.at(-1);assert.deepEqual({weapon:row.weapon,mode:row.mode,before,after,hit:shot.outcome==='hit',ionized:shot.outcome==='ionized'},row);assert.equal(shot.total,after+2);
 }else{
  const f=shipFixture(row.weapon);let m=atTotal(initiated(f,row.weapon==='1_159'?[3]:[3,3]));const before=m.stack.at(-1).event.total;change(m,f.weapon,row.mode,f.site);m=boundary(clone(m),'weapon-fired');assert.deepEqual({weapon:row.weapon,mode:row.mode,before,after:m.data.battle.starshipShots.at(-1).total,hit:m.data.battle.starshipShots.at(-1).outcome==='hit'},row);
 }
});
test('another copy on the host does not contribute to the original pending shot',()=>{
 const f=shipFixture('1_159');let m=atTotal(initiated(f,[3]));change(m,f.weapon,'leave',f.site);const second=Object.values(m.cards).find(c=>c.id!==f.weapon&&c.blueprint==='1_159');state.moveCard(m,second.id,'table');m.cards[second.id].attachedTo=f.host;m.cards[second.id].location=f.site;m=boundary(clone(m),'weapon-fired');assert.equal(m.data.battle.starshipShots.at(-1).total,3);
});
test('live heavy and starship projections show the current total without changing saved history',()=>{
 const f=destiny(ready(fixture()));const m=atTotal(fire(f)),before=clone(m);assert.equal(rules.view(m,'dark').heavyShots.at(-1).total,6);change(m,f.gun,'cancel',f.site);const after=clone(m);assert.equal(rules.view(m,'dark').heavyShots.at(-1).total,5);assert.equal(rules.view(m,'dark').heavyShots.at(-1).modifier,0);assert.deepEqual(m,after);assert.equal(m.data.heavyShots.at(-1).total,before.data.heavyShots.at(-1).total);
 const g=shipFixture('1_323'),n=atTotal(initiated(g,[1,1]));assert.equal(rules.view(n,'dark').battle.starshipShots.at(-1).total,0);change(n,g.weapon,'leave',g.site);assert.equal(rules.view(n,'dark').battle.starshipShots.at(-1).total,2);
});
const ion=await import('./ion-fixture.mjs');
test('the Ion Cannon firing-action addition persists when its source leaves during total responses',()=>{
 const f=ion.fixture(),m=atTotal(ion.start(f,[3]));assert.equal(m.stack.at(-1).event.total,3);change(m,f.weapon,'leave',f.site);const n=boundary(clone(m),'weapon-fired');assert.equal(n.data.battle.starshipShots.at(-1).total,5);assert.equal(n.data.battle.starshipShots.at(-1).modifier,2);
});
