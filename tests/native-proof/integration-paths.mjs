import assert from 'node:assert/strict';import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
let observer;export const observe=fn=>observer=fn;
export const pick=(m,p)=>prompt(m)?.choices.find(c=>c.id.startsWith(p));
export function step(m,choice){const p=prompt(m),next=applyCommand(JSON.parse(JSON.stringify(m)),p.side,{prompt:p.id,choice});assertMatch(next);observer?.(m,choice,next);return next;}
export const fallback=m=>pick(m,'battle')?.id||pick(m,'drain')?.id||pick(m,'draw-destiny')?.id||pick(m,'pass')?.id||pick(m,'forfeit:')?.id||pick(m,'lose:reserve')?.id||prompt(m).choices[0].id;
export function until(m,done,select=fallback){for(let i=0;i<250;i++){if(done(m))return m;assert.ok(!m.complete,'Premature completion');m=step(m,select(m));}throw Error('Checkpoint not reached');}
export const finish=m=>until(m,x=>x.complete);
export const paths=['signal-bay-pass','signal-bay-trooper','signal-bay-wolfman','signal-corridor','barrier-no-react','barrier-pass','barrier-first','barrier-second','barrier-reinforce','barrier-wolfman','last-hand','last-reserve'];
export const scenarioFor=p=>p.startsWith('signal')?'react-drain-deploy':p.startsWith('barrier')?'react-barrier':'last-force';
export function facts(m){const face=id=>m.cards[id].blueprint,b=m.battle,site=m.reactStudy?.site||m.locations[0],chars=Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===site),excluded=m.reactStudy?.barred||[];return {force:{light:m.players.light.force.length,dark:m.players.dark.force.length},used:{light:m.players.light.used.map(face),dark:m.players.dark.used.map(face)},lost:{light:m.players.light.lost.map(face),dark:m.players.dark.lost.map(face)},light:chars.filter(c=>c.owner==='light').map(c=>c.blueprint).sort(),excluded:excluded.map(face).sort(),ability:chars.filter(c=>c.owner==='light'&&!excluded.includes(c.id)).reduce((n,c)=>n+Number(c.blueprint==='1_6'?0:c.blueprint==='1_30'||c.blueprint==='1_28'?1:0),0),power:b?.power.light??0,damage:b?.damage.light??0,attrition:b?.attrition.light??0,life:engine.life(m,'light'),hand:m.players.light.hand.length,winner:m.winner};}
export function runPath(path){let m=createScenario(scenarioFor(path));
 m=step(m,path.startsWith('signal')?'drain:'+m.locations[path==='signal-corridor'?1:0]:path.startsWith('barrier')?'battle':'drain');
 if(path.startsWith('last')){m=until(m,x=>!!pick(x,'lose:'));m=step(m,path==='last-hand'?pick(m,'lose:hand:').id:'lose:reserve');m=finish(m);return {m,facts:facts(m)};}
 const troops=m.players.light.hand.filter(id=>m.cards[id].blueprint==='1_28'),wolf=m.players.light.hand.find(id=>m.cards[id].blueprint==='1_30');
 const wanted=path==='signal-bay-trooper'||['barrier-pass','barrier-first'].includes(path)?troops.slice(0,1):path==='signal-bay-wolfman'||path==='barrier-wolfman'?[wolf]:['barrier-second','barrier-reinforce'].includes(path)?troops:[];
 for(const [i,id] of wanted.entries()){m=until(m,x=>!!prompt(x)?.choices.find(c=>c.card===id&&c.reactPreview));m=step(m,'react:deploy:'+id);
  if(path.startsWith('barrier')&&m.players.dark.hand.some(id=>m.cards[id].blueprint==='1_249')){m=until(m,x=>!!pick(x,'play:'));const play=path==='barrier-first'||path==='barrier-wolfman'||path==='barrier-second'&&i===1||path==='barrier-reinforce'&&i===0;m=step(m,play?pick(m,'play:').id:'pass');if(play)m=until(m,x=>!x.stack.some(f=>f.kind==='interrupt'));}
 }
 m=path.startsWith('signal')?finish(m):until(m,x=>!!project(x,'light').losses);const result=facts(m);return {m:finish(m),facts:result};}
