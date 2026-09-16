import {definition,scenarios} from './catalog';
import type {ScenarioId} from './types';

export const studyTopics=[
 {id:'all',label:'All studies'},
 {id:'force',label:'Force'},
 {id:'battle',label:'Battle'},
 {id:'weapons',label:'Weapons'},
 {id:'interrupts',label:'Interrupts'},
 {id:'deployment',label:'Deploy & move'},
 {id:'setup',label:'Setup'},
] as const;
export type StudyTopic=typeof studyTopics[number]['id'];
export type StudyFilter={query:string;topic:StudyTopic};
const coverage:Record<ScenarioId,Exclude<StudyTopic,'all'>[]>={
 'reduce-drain':['force','interrupts'],'reduce-damage':['battle','force','interrupts'],'talz-rescue':['battle','weapons'],
 'guard-post':['deployment','battle','interrupts'],'rebel-post':['deployment','battle','interrupts'],'corridor-crossfire':['weapons','battle','deployment'],
 'luke-arrives':['deployment','battle','interrupts'],
 'luke-support':['battle'],
 'tusken-band':['deployment','battle','interrupts'],
 'second-contact':['setup','force','deployment','battle','interrupts','weapons'],
 activation:['force'],drain:['force'],battle:['battle'],recirculation:['force'],
 takeel:['battle','interrupts'],barrier:['deployment','interrupts','battle'],
 'imperial-barrier':['deployment','interrupts','battle'],weapons:['deployment','weapons','battle'],
 'rebel-weapons':['deployment','weapons','battle'],
 'next-turn':['force','battle','interrupts','deployment'],
 'opening-table':['setup','force'],
 'first-contact':['setup','force','deployment','battle','interrupts','weapons'],
};
// Featured cards only: Reserve filler is not a claim of playable card coverage.
const featuredCards:Record<ScenarioId,string[]>={
 'reduce-drain':['1_90','1_132'],'reduce-damage':['1_90','1_28','1_194'],'talz-rescue':['1_31','1_28','1_317','1_312','1_152'],
 'guard-post':['1_170','1_181','1_26','1_194','1_105'],'rebel-post':['1_26','1_181','1_28','1_249'],'corridor-crossfire':['1_284','1_152','1_153','1_317','1_312'],
 'luke-arrives':['101_2','1_28','1_129','1_132','1_249'],
 'luke-support':['101_2','1_28','1_26','1_170'],
 'tusken-band':['1_196','1_129','1_132','1_105'],
 'second-contact':['1_124','1_284','1_194','1_170','1_181','1_26','1_28','1_249','1_105','1_152','1_153','1_317','1_312'],
 activation:['1_124'],drain:['1_124','1_194','1_28'],battle:['1_124','1_194','1_28'],
 recirculation:[],takeel:['1_124','1_194','1_28','1_269'],
 barrier:['1_124','1_284','1_194','1_28','1_105'],
 'imperial-barrier':['1_124','1_284','1_194','1_28','1_249'],
 weapons:['1_124','1_194','1_28','1_152','1_153','1_317','1_312'],
 'rebel-weapons':['1_124','1_194','1_28','1_152','1_153','1_317','1_312'],
 'next-turn':['1_124','1_284','1_194','1_28','1_105','1_249'],
 'first-contact':['1_124','1_284','1_194','1_28','1_105','1_249','1_152','1_317','1_12','1_182'],
 'opening-table':['101_1','101_4','1_124','1_129','1_130','1_131','1_132','1_284','1_285','1_291','1_292','1_293','1_295'],
};
// Index the mechanics exercised by the fixture, including mirrored coverage
// that its short description may not repeat. Do not index unsupported card text.
const battleRules='battle initiation cost battle damage attrition forfeit forfeiture Force loss';
const turnRules='character deployment Force icons presence regular movement adjacent sites once per turn draw phase recirculation temporary restrictions expire end of turn';
const weaponRules='weapon deployment transfer firing target weapon destiny threshold return fire hit power ability warrior one different weapon mandatory hit forfeit attached cards simultaneous losses Lost Pile order';
const searchableRules:Record<ScenarioId,string>={
 'reduce-drain':'Force drain loss reduction It Could Be Worse X cost Used Life Force result step',
 'reduce-damage':battleRules+' It Could Be Worse reduction damage attrition separate cost X Used',
 'talz-rescue':weaponRules+' Talz restore hit replacement rescue two hits numeric forfeit',
 'guard-post':battleRules+' '+turnRules+' conditional power defending guard cannot move Death Star only deploy restriction',
 'rebel-post':battleRules+' '+turnRules+' conditional power defending attacking guard cannot move zero power presence',
 'corridor-crossfire':battleRules+' '+weaponRules+' location modifier bonus Dark only Detention Block Corridor printed destiny',
 'luke-arrives':turnRules+' Luke free deploy unique persona Tatooine Lars Moisture Farm discount cost',
 'luke-support':battleRules+' Luke warrior forfeit adjacent support loss order nonwarrior',
 'tusken-band':turnRules+' Tusken Raider power group noncumulative cumulative present excluded Barrier',
 'second-contact':battleRules+' '+turnRules+' '+weaponRules+' four turns second turn setup opening hand Force generation guards defending power cannot move Death Star Troopers Corridor bonus',
 activation:'Force generation personal Force optional activation activate action priority response',
 drain:'Force drain control presence Force loss Reserve Deck Force Pile Used Pile hand',
 battle:battleRules+' optional battle destiny draw ability',
 recirculation:'recirculation Used Pile Reserve Deck order unspent Force retained',
 takeel:battleRules+' optional battle destiny draw ability Interrupt response pay cost switch destiny',
 barrier:battleRules+' '+turnRules+' Rebel Barrier Used Interrupt response blocks battle and movement',
 'imperial-barrier':battleRules+' '+turnRules+' Imperial Barrier Used Interrupt response blocks battle and movement',
 weapons:battleRules+' '+weaponRules+' optional battle destiny draw',
 'rebel-weapons':battleRules+' '+weaponRules+' optional battle destiny draw',
 'next-turn':battleRules+' '+turnRules+' Force generation activation control Force drain start turn end turn handoff retained Force per-turn limits Rebel Barrier Imperial Barrier response',
 'first-contact':battleRules+' '+turnRules+' '+weaponRules+' starting setup eight-card hands first turn Barrier defensive fire carried weapons',
 'opening-table':'pregame setup starting location secret private simultaneous reveal conversion converted supporting location same title choose another physical copy shuffle cut opening eight card hand Dark first Force generation start turn',
};
export const studies=scenarios.map((scenario,index)=>({...scenario,number:String(index+1).padStart(2,'0'),topics:coverage[scenario.id],cards:featuredCards[scenario.id].map(id=>definition(id).name)}));
const normalize=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchingStudies({query,topic}:StudyFilter){
 const normalized=normalize(query),words=normalized.split(' ').filter(Boolean);
 const matches=studies.filter(study=>{
  if(topic!=='all'&&!study.topics.includes(topic))return false;
  const text=normalize([study.number,study.title,study.subtitle,study.description,study.phase,...study.rules,...study.cards,searchableRules[study.id]].join(' '));
  return words.every(word=>text.includes(word));
 });
 const rank=(title:string)=>{const text=normalize(title);return text===normalized?0:text.includes(normalized)?1:words.every(word=>text.includes(word))?2:3};
 return normalized?matches.sort((a,b)=>rank(a.title)-rank(b.title)):matches;
}
export function readStudyFilter(params:URLSearchParams):StudyFilter{
 const topic=params.get('topic');
 return {query:(params.get('q')||'').slice(0,200),topic:studyTopics.some(t=>t.id===topic)?topic as StudyTopic:'all'};
}
export function writeStudyFilter(params:URLSearchParams,filter:StudyFilter){
 if(filter.query.trim())params.set('q',filter.query);else params.delete('q');
 if(filter.topic==='all')params.delete('topic');else params.set('topic',filter.topic);
 return params;
}
export function proofLocation(id:string|undefined,report:boolean,filter:StudyFilter){
 const params=writeStudyFilter(new URLSearchParams(),filter);
 if(id)params.set('gameId',id);
 if(report)params.set('progress-report','');
 const query=params.toString();return '/proof'+(query?'?'+query:'');
}
