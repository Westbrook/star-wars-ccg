// Service integration only: explicit component admission, never production.
import {load} from '../native-proof/load-engine.mjs';
import {seeded,auditRules} from './match-runner.mjs';
const {definition}=load(new URL('../../lib/native-engine/definitions.ts',import.meta.url));
const {nativeSealedService}=load(new URL('../../lib/native-sealed.ts',import.meta.url));
export const sealedMatchRules={...auditRules,starting:{...auditRules.starting,ordinarySetup:()=>true},supports:bp=>{try{return !!definition(bp)}catch{return false}}};
export async function pairedPool(db,owner='owner',guest='guest',id=crypto.randomUUID()){
 const service=nativeSealedService(db,{entropy:seeded(266)}),waiting=await service.create(owner,{id,side:'light'});
 await service.join(id,guest,{inviteToken:waiting.inviteToken});
 const light=await service.read(id,owner),dark=await service.read(id,guest);
 const cards=p=>p.cards.filter(bp=>sealedMatchRules.supports(bp)).slice(0,40);
 return {id,light,dark,decks:{light:cards(light),dark:cards(dark)}};
}
