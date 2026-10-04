import {cardDefinition} from './definitions';
import {generator,generatorAllowed,fourthMarkers,outerHothMarker,hothMarker} from './hoth';
import {sitePlacements} from './board';
import {moveCard} from './state';
import {sides,type Match} from './types';
export const invalidHothStarting=(m:Match)=>sides.flatMap(side=>{const id=m.setup!.selected[side];return id&&!generatorAllowed(m,id,Object.values(m.setup!.selected).filter((x):x is string=>!!x))?[id]:[];});
function options(m:Match){
 const selected=Object.values(m.setup!.selected).filter((id):id is string=>!!id);
 const source=selected.find(id=>generator(m,id));if(!source||[...m.locations,...selected].some(id=>outerHothMarker(m,id)))return null;
 const side=m.cards[source].owner;
 return {side,choices:fourthMarkers(m,side).flatMap(card=>sitePlacements(m,card).map(p=>({id:'hoth-start:'+card+':'+p.id,label:'Deploy '+cardDefinition(m,card).name+' · '+p.label,card,placement:p})))};
}
export const hothStartingOptions=options;
export function deployHothStarting(m:Match,choice:string){
 const option=options(m)?.choices.find(c=>c.id===choice);if(!option||option.placement.replace)throw Error('Invalid required Hoth starting deployment.');
 moveCard(m,option.card,'table');m.locations.splice(option.placement.index!,0,option.card);m.setup!.additional=[...(m.setup!.additional??[]),option.card];
}
export function assertHothStarting(m:Match){
 const s=m.setup!;if(s.setAside?.some(id=>!generator(m,id)))throw Error('Invalid rejected starting generator.');
 if(s.additional?.length){if(s.additional.length!==1||hothMarker(m,s.additional[0])!==4||!Object.values(s.selected).some(id=>id&&generator(m,id)&&m.cards[id].owner===m.cards[s.additional![0]].owner))throw Error('Invalid starting North Ridge.');}
}

/** Place the chosen starting locations around the prerequisite already on table. */
export function hothStartingPlacements(m:Match,selected:string[]){
 if(!m.setup?.additional?.length)return null;
 let layouts=[structuredClone(m)];
 for(const id of selected.filter(id=>!m.setup!.additional!.includes(id))){layouts=layouts.flatMap(state=>sitePlacements(state,id).filter(p=>!p.replace).map(p=>{const next=structuredClone(state);moveCard(next,id,'table');next.locations.splice(p.index!,0,id);return next;}));}
 const unique=[...new Map(layouts.map(x=>[x.locations.join(','),x.locations])).values()];
 return {side:'light' as const,choices:unique.map((order,i)=>({id:'hoth-layout:'+i,label:'Place starting locations · '+order.map(id=>cardDefinition(m,id).name).join(' → '),order}))};
}
