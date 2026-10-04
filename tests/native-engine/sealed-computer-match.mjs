// Complete native integration; test-only card admission, not GEMP conformance.
import assert from 'node:assert/strict';
import {load} from '../native-proof/load-engine.mjs';
import {SqliteD1} from './sqlite-d1.mjs';
import {seeded} from './match-runner.mjs';
import {sealedMatchRules as rules} from './sealed-match-fixture.mjs';
const root=new URL('../../',import.meta.url).href;
const {nativeSealedService}=load(new URL(root+'lib/native-sealed.ts')),{nativeMatchService}=load(new URL(root+'lib/native-engine/service.ts')),{buildSealedComputerDeck}=load(new URL(root+'lib/sealed-computer-deck.ts')),{chooseComputerAction}=load(new URL(root+'lib/native-engine/computer.ts'));
const db=new SqliteD1(),pool=await nativeSealedService(db,{entropy:seeded(266)}).create('owner',{id:crypto.randomUUID(),side:'light',mode:'cpu'}),entropy=seeded(73),fresh=()=>nativeMatchService(db,{currentRules:rules.id,rules:()=>rules,entropy,now:()=>1800000000000});
const deployedPremium=new Set();
let v=await fresh().create('owner',{id:crypto.randomUUID(),side:'light',mode:'cpu',deckSize:40,poolId:pool.id,deck:buildSealedComputerDeck(pool.cards,'light',rules)}),loops=0;
for(;loops<6000&&v.game.status!=='finished';loops++){
 const choice=chooseComputerAction(v.game,'light');if(choice)v=await fresh().command(v.id,'owner',{commandId:crypto.randomUUID(),revision:v.revision,choice});
 v=await fresh().advanceComputer(v.id,'owner',{operation:'advance'});
 const saved=JSON.parse(db.sqlite.prepare('SELECT state FROM native_matches WHERE id=?').get(v.id).state);for(const c of Object.values(saved.cards))if(c.zone==='table'&&c.blueprint.startsWith('106_'))deployedPremium.add(c.blueprint);
 if(loops%500===0)console.log('Commands saved:',v.revision);
}
console.log(JSON.stringify({loops,revision:v.revision,status:v.game.status,result:v.game.result,deployedPremium:[...deployedPremium].sort()}));
assert.equal(v.game.status,'finished');assert.equal(v.game.result.reason,'life-force');assert.equal(v.poolId,pool.id);assert.equal(v.revision,1881);assert.equal(loops,933);assert.equal(v.game.result.winner,'light');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM native_commands WHERE match_id=?').get(v.id).n,v.revision);
assert.deepEqual([...deployedPremium].sort(),['106_11','106_12','106_13','106_14','106_16','106_3','106_6','106_7','106_8','106_9']);
db.close();
