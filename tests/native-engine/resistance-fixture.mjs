import {load} from '../native-proof/load-engine.mjs';
import {runtime,rules,state,pull,location,step,seek,priority,prompt} from './noble-fixture.mjs';
export {runtime,rules,state,pull,location,step,seek,priority,prompt};
export const {resistanceLimit,occupiedBattlegrounds,battleground}=load(new URL('../../lib/native-engine/resistance.ts',import.meta.url));
export const {queueForceLoss}=load(new URL('../../lib/native-engine/ground.ts',import.meta.url));
export const {lossLedger,lossTotal,lossRemaining,assertLedger}=load(new URL('../../lib/native-engine/loss.ts',import.meta.url));
export const ordinary=m=>m.stack.length===1&&m.stack[0].kind==='window'&&m.stack[0].timing==='phase';
export function fixture({side='light',count=3,opponent=true,zone='table'}={}){
 const cards={light:['6_58','6_58','1_129','1_130','1_131','1_132','4_21','1_71','102_1','4_16','3_61','3_63','3_56'],dark:['6_147','6_147','1_284','4_134','1_234','102_6','3_144']};
 let m=runtime.createMatch('resistance',60,['light','dark'].map(side=>({side,cards:[...cards[side],...Array(60).fill(side==='light'?'1_28':'1_194')].slice(0,60)})),rules);
 const sites=['1_129','1_130','1_131','1_132'].map(bp=>location(m,'light',bp));location(m,'dark','1_284');
 const card=pull(m,side,side==='light'?'6_58':'6_147',zone),troops=[];for(let n=0;n<count;n++)troops.push(pull(m,side,side==='light'?'1_28':'1_194','table',sites[n+1]));
 const enemy=opponent?pull(m,side==='light'?'dark':'light',side==='light'?'1_194':'1_28','table',sites[0]):null;
 m=runtime.startTurns(m,rules);m=seek(m,x=>ordinary(x)&&x.turn.phase==='control');return {m,side,card,sites,troops,enemy};
}
export function loss(f,{kind='drain',base=4,insert=false,irreducible=false}={}){const m=structuredClone(f.m);queueForceLoss(m,{side:f.side,remaining:base,source:kind==='drain'?'drain':f.card,site:kind==='drain'?f.sites[0]:null,reductionUsed:false,ledger:{...lossLedger(base,kind,irreducible),...(insert?{insert:true}:{})}});return m;}
export const payment=m=>seek(m,x=>x.stack.at(-1)?.handler==='ground:force-loss');
export const finish=m=>seek(m,x=>ordinary(x));
