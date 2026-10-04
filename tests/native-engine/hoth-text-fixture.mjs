import {fixture as hothFixture,location,pull,board} from './hoth-fixture.mjs';
export * from './hoth-fixture.mjs';
export {ids,prompt,clone} from './noble-fixture.mjs';
export function fixture(){
 const f=hothFixture({extra:{light:['3_6'],dark:['3_155']}}),m=f.m;
 const ice=location(m,'dark','3_148'),mountains=location(m,'dark','104_4'),lightPerimeter=location(m,'light','3_56');
 // Each printed version is tested on its own board, never stacked as a duplicate.
 m.locations=m.locations.filter(id=>id!==f.perimeter);m.cards[f.perimeter].coveredBy=lightPerimeter;
 m.locations.sort((a,b)=>{const ag=board.system(m,a),bg=board.system(m,b);return ag==='Hoth'&&bg==='Hoth'?board.locationRank(m,a)-board.locationRank(m,b):Number(ag==='Hoth')-Number(bg==='Hoth');});
 return {...f,ice,mountains,lightPerimeter};
}
