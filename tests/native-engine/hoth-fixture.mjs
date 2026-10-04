import {fixture as groundFixture,pull,location,phase,priority,step,seek,load,rules,runtime} from './ground-creature-fixture.mjs';
export {pull,location,phase,priority,step,seek,load,rules,runtime};
export const hoth=load(new URL('../../lib/native-engine/hoth.ts',import.meta.url));
export const board=load(new URL('../../lib/native-engine/board.ts',import.meta.url));
export const state=load(new URL('../../lib/native-engine/state.ts',import.meta.url));
export function fixture({shield=true,outer=true,extra={}}={}){
 const f=groundFixture('dark',{dark:[...(extra.dark??[]),'3_143','1_302','1_179','1_293','1_284','3_144','3_149','3_148','104_4','3_147','3_93','3_150','1_305','1_173','1_309'],light:[...(extra.light??[]),'1_129','3_61','3_62','3_63','3_56','3_60','3_59','1_28','1_142']});
 const echo=location(f.m,'light','3_60'),bay=location(f.m,'dark','3_147'),trench=location(f.m,'light','3_63'),perimeter=location(f.m,'dark','3_144');
 const ridge=outer?location(f.m,'dark','3_149'):pull(f.m,'dark','3_149','hand');
 const gen=shield?location(f.m,'light','3_61'):pull(f.m,'light','3_61','hand');
 f.m.locations.sort((a,b)=>{const ah=hoth.hothSite(f.m,a),bh=hoth.hothSite(f.m,b);return ah&&bh?board.locationRank(f.m,a)-board.locationRank(f.m,b):Number(ah)-Number(bh);});
 return {...f,echo,bay,trench,perimeter,ridge,gen};
}
