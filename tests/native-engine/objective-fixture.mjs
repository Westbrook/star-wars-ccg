import {mod,runtime,state,clone} from './prisoner-fixture.mjs';
export const objectiveRules={...mod('premiere-rules').premiereRules,supports:()=>true,starting:{...mod('premiere-setup').premiereSetup,ordinarySetup:()=>true}};
export const objectiveDecks=({missing=false}={})=>['light','dark'].map(side=>({side,cards:[...(side==='dark'?['7_299',...(!missing?['12_166']:[]),'8_114','106_11','1_166','104_6','3_144','1_291','3_143','2_129','1_179']:['1_130','3_63','1_19','1_11','1_17']),...Array(60).fill(side==='dark'?'1_194':'1_28')].slice(0,60)}));
export const objectivePrompt=m=>{const p=runtime.prompt(m,objectiveRules,'dark');return runtime.prompt(m,objectiveRules,p.side);};
export function objectiveStep(m,choice){return runtime.applyCommand(clone(m),objectiveRules,objectivePrompt(m).side,{revision:m.revision,choice},()=>42);}
export function objectiveStart(options={}){return runtime.createMatch('isb-objective',60,objectiveDecks(options),objectiveRules);}
export function finishObjectiveSetup(m){for(let n=0;n<35&&m.status==='setup';n++){const p=objectivePrompt(m);m=objectiveStep(m,p.choices[0].id);}if(m.status==='setup')throw Error('Setup did not finish.');return m;}
export function objectiveSeek(m,fn){for(let i=0;i<500;i++){if(fn(m))return m;const cs=objectivePrompt(m).choices;m=objectiveStep(m,cs.some(c=>c.id==='pass')?'pass':cs[0].id);}throw Error('Objective boundary not found.');}
export function objectiveFixture(){let m=finishObjectiveSetup(objectiveStart());const pick=bp=>Object.values(m.cards).find(c=>c.blueprint===bp).id,objective=pick('7_299'),coruscant=pick('12_166');return {m,objective,coruscant,pick};}
export function tableCard(m,id,location){state.moveCard(m,id,'table');if(location)m.cards[id].location=location;else if(mod('definitions').cardDefinition(m,id).type==='Location'&&!m.locations.includes(id))m.locations.push(id);return id;}
