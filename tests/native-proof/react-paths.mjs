import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
let observer;export const observe=fn=>observer=fn;
export const clone=m=>JSON.parse(JSON.stringify(m));
export const pick=(m,p)=>prompt(m)?.choices.find(c=>c.id.startsWith(p));
export function step(m,choice){const p=prompt(m),next=applyCommand(clone(m),p.side,{prompt:p.id,choice});assertMatch(next);observer?.(m,choice,next);return next;}
export const fallback=m=>pick(m,'battle')?.id||pick(m,'drain')?.id||pick(m,'draw-destiny')?.id||pick(m,'pass')?.id||pick(m,'forfeit:')?.id||pick(m,'lose:reserve')?.id||prompt(m).choices[0].id;
export function until(m,done,select=fallback){for(let i=0;i<250;i++){if(done(m))return m;assert.ok(!m.complete);m=step(m,select(m));}throw Error('Checkpoint not reached');}
export const finish=m=>until(m,x=>x.complete);
export const scenarioFor=p=>p.startsWith('drain')?'react-drain':p.startsWith('battle')?'react-battle':'react-deploy';
export const paths=['battle-pass','battle-one','battle-two','drain-pass','drain-first','drain-second',...['same','adjacent'].flatMap(s=>['pass','troopers','wolfman'].map(p=>'deploy-'+s+'-'+p))];
export function facts(m){const site=m.reactStudy.site,chars=Object.values(m.cards).filter(c=>c.zone==='table'&&c.location===site),face=id=>m.cards[id].blueprint;return {force:m.players.light.force.length,used:m.players.light.used.map(face),lost:m.players.light.lost.map(face),light:chars.filter(c=>c.owner==='light').map(c=>c.blueprint).sort(),dark:chars.filter(c=>c.owner==='dark').map(c=>c.blueprint).sort(),ability:project(m,'light').reactStudy.ability.light,cancelled:m.reactStudy.cancelled,power:m.battle?.power.light??0,damage:m.battle?.damage.light??0,attrition:m.battle?.attrition.light??0};}
export function runPath(path){
 let m=createScenario(scenarioFor(path));m=step(m,path.startsWith('deploy')?'battle:'+m.locations[path.includes('adjacent')?1:0]:path.startsWith('battle')?'battle':'drain');
 const ids=Object.values(m.cards).filter(c=>c.blueprint==='1_30'&&c.zone==='table').map(c=>c.id);
 const wanted=path==='battle-two'?ids:path==='battle-one'||path==='drain-first'?ids.slice(0,1):path==='drain-second'?ids.slice(1,2):path.endsWith('troopers')?m.players.light.hand.filter(id=>m.cards[id].blueprint==='1_28'):path.endsWith('wolfman')?[...m.players.light.hand.filter(id=>m.cards[id].blueprint==='1_30'),...m.players.light.hand.filter(id=>m.cards[id].blueprint==='1_28').slice(0,1)]:[];
 for(const id of wanted){m=until(m,x=>!!prompt(x)?.choices.find(c=>c.card===id&&c.reactPreview));m=step(m,prompt(m).choices.find(c=>c.card===id&&c.reactPreview).id);}
 m=path.startsWith('drain')?finish(m):until(m,x=>!!project(x,'light').losses);
 const result=facts(m);return {m:finish(m),facts:result};
}
