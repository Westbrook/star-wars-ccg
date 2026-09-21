import assert from 'node:assert/strict';
import {engine} from './load-engine.mjs';
export const {createScenario,prompt,project,applyCommand,assertMatch}=engine;
export const pick=(m,prefix)=>prompt(m)?.choices.find(c=>c.id.startsWith(prefix));
let observer;export const observe=f=>{observer=f};
export const step=(m,choice)=>{const p=prompt(m),next=applyCommand(JSON.parse(JSON.stringify(m)),p.side,{prompt:p.id,choice},()=>42);observer?.(m,choice,next);return next};
export const fallback=m=>pick(m,'pass')?.id||pick(m,'recirculate')?.id||pick(m,'forfeit:')?.id||pick(m,'skip-destiny')?.id||prompt(m).choices[0].id;
export function until(m,done,choose=fallback){for(let i=0;i<1000;i++){if(done(m))return m;assert.equal(m.complete,false,'Unexpected endpoint');m=step(m,choose(m))}throw Error('Continuation bound')}
export const phase=(m,stage,number=m.turn.number)=>until(m,x=>x.turn.number===number&&x.turn.stage===stage&&x.stack.at(-1)?.kind==='turn'&&prompt(x).side===x.active);
export const ready=m=>phase(m,m.turn.stage);
export const card=(m,b,zone='hand')=>Object.values(m.cards).find(c=>c.blueprint===b&&c.zone===zone&&!c.coveredBy);
export function place(m,b,from='hand',last=false){m=ready(m);m=step(m,from==='hand'?'site:'+card(m,b).id:'search:'+m.locations.find(id=>m.cards[id].blueprint==='101_4'));if(from==='reserve'){m=until(m,x=>x.stack.at(-1)?.kind==='bay-search');m=step(m,'search-card:'+card(m,b,'reserve').id);}return ready(step(m,last?prompt(m).choices.at(-1).id:prompt(m).choices[0].id));}
export function transit(m,from,to,count=2){m=ready(m);m=step(m,'transit:'+from+':'+to);for(const c of prompt(m).choices.filter(c=>c.id.startsWith('toggle')).slice(0,count))m=step(m,c.id);return ready(step(m,'confirm-transit'));}
export const paths=['convert','place-site','free-group','paid-group','search-convert','search-new','search-failed'];
export const scenarioFor=p=>p.startsWith('search')?'control-room':p.includes('group')?'docking-transit':'changing-front';
export function runPath(path){let m=createScenario(scenarioFor(path)),facts={};
 if(path==='convert'||path==='place-site'){
  m=phase(m,'deploy');const old=m.locations[0],units=Object.values(m.cards).filter(c=>c.location===old).map(c=>c.id);
  m=place(m,path==='convert'?'1_285':'1_291');facts={locations:m.locations.map(id=>m.cards[id].blueprint),covered:!!m.cards[old].coveredBy,units:units.map(id=>m.cards[id].location),generation:m.cycle.generation};
  m=phase(m,'deploy',2);m=place(m,'1_132');
 }
 if(path.includes('group')){m=phase(m,'move',path==='free-group'?1:2);const from=m.locations[path==='free-group'?0:2],to=m.locations[path==='free-group'?2:0],side=m.active,before=m.players[side].force.length;m=transit(m,from,to);facts={cost:before-m.players[side].force.length,moved:m.turn.moved.length,guardsStayed:Object.values(m.cards).filter(c=>['1_26','1_181'].includes(c.blueprint)&&c.owner===side&&c.zone==='table').every(c=>c.location===from)};}
 if(path.startsWith('search')){m=phase(m,'deploy');m=place(m,path==='search-new'?'1_291':'1_285','reserve');if(path==='search-failed'){m=place(m,'1_291','reserve');m=step(m,pick(m,'search:').id);m=until(m,x=>x.stack.at(-1)?.kind==='bay-search');m=step(m,'search-failed');m=step(m,'verify-search');m=ready(m);}facts={locations:m.locations.map(id=>m.cards[id].blueprint),shuffles:m.locationStudy.shuffles,failed:m.locationStudy.failedSearchTurn,searchAvailable:!!pick(m,'search:')};}
 m=until(m,x=>x.complete);return {m,facts};}
