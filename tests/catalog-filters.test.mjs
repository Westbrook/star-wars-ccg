import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {load} from './native-proof/load-engine.mjs';

const {numericStat,ruleError,matchingFaces,filterAndSortCards,sortStatLabel,catalogStats,defaultCatalogOptions}=load(new URL('../lib/catalog-filters.ts',import.meta.url));
const {searchCards}=load(new URL('../lib/catalog.ts',import.meta.url));
const options=patch=>({...defaultCatalogOptions,...patch});
const rule=(field,operator,value='',upper='')=>({id:field+operator,field,operator,value,upper});
const face=(stats={},extra={})=>({title:'Face',image:'',text:'',lore:'',icons:[],stats,...extra});
const card=(id,stats={},extra={})=>({...face(stats),id,name:id,sourceId:1,gempId:id,side:'light',type:'Character',subType:'Rebel',setId:'1',setIds:['1'],setName:'Premiere',era:'decipher',rarity:'R',personas:[],characteristics:[],uniqueness:'',back:null,...extra});
const ids=(cards,patch)=>filterAndSortCards(cards,options(patch)).map(c=>c.id);
const archive=JSON.parse(readFileSync(new URL('../public/catalog/cards.json',import.meta.url),'utf8'));

test('single printed constants include zero, fractions and pi without guessing expressions',()=>{
 for(const [raw,n] of [['0',0],[' 4 ',4],['-2',-2],['.5',.5],['½',.5],['4½',4.5],['-1½',-1.5],['1/4',.25],['π',Math.PI],['2π',2*Math.PI],['0π',0]])assert.equal(numericStat(raw),n,raw);
 for(const raw of [undefined,'','*','X','Y','(4)','IV','0 or 7','π or 2π','1+2','1/0','Infinity','1e3','9'.repeat(400),'9'.repeat(400)+'π','9'.repeat(400)+'½'])assert.equal(numericStat(raw),null,String(raw));
});
for(const [op,value,upper,expected] of [['eq','3','',['three']],['ne','3','',['five','zero']],['gt','3','',['five']],['gte','3','',['five','three']],['lt','3','',['zero']],['lte','3','',['three','zero']],['range','0','3',['three','zero']]])test('numeric comparison '+op+' excludes missing and variable stats',()=>{
 const cards=[card('zero',{deploy:'0'}),card('three',{deploy:'3'}),card('five',{deploy:'5'}),card('variable',{deploy:'X'}),card('missing')];
 assert.deepEqual(ids(cards,{rules:[rule('deploy',op,value,upper)]}),expected);
});
test('exact printed text, special, presence and absence are distinct',()=>{
 const cards=[card('zero',{destiny:'0'}),card('variable',{destiny:'X'}),card('alternate',{destiny:'0 or 7'}),card('missing'),card('blank',{destiny:''})];
 assert.deepEqual(ids(cards,{rules:[rule('destiny','printed',' x ')]}),['variable']);
 assert.deepEqual(ids(cards,{rules:[rule('destiny','special')]}),['alternate','variable']);
 assert.deepEqual(ids(cards,{rules:[rule('destiny','present')]}),['alternate','variable','zero']);
 assert.deepEqual(ids(cards,{rules:[rule('destiny','missing')]}),['blank','missing']);
});
test('combined conditions must match the same face, including the icon',()=>{
 const c=card('double',{power:'6',forfeit:'2'},{icons:['Pilot'],back:face({power:'2',forfeit:'6'},{icons:['Warrior']})});
 assert.deepEqual(ids([c],{rules:[rule('power','gt','5'),rule('forfeit','gt','5')]}),[]);
 assert.deepEqual(ids([c],{icon:'Warrior',rules:[rule('power','gt','5')]}),[]);
 const good=options({icon:'Warrior',rules:[rule('forfeit','gte','6')]});
 assert.deepEqual(matchingFaces(c,good).map(f=>f.side),['back']);
 assert.deepEqual(ids([c],{...good,face:'front'}),[]);
 assert.deepEqual(ids([c],{...good,face:'back'}),['double']);
 assert.deepEqual(ids([card('single')],{face:'back'}),[]);
});
test('incomplete conditions report errors and do not hide unrelated matches',()=>{
 for(const r of [rule('power','eq',''),rule('power','eq','X'),rule('power','range','3',''),rule('power','range','5','3'),rule('power','printed',' ')])assert.ok(ruleError(r));
 assert.equal(ruleError(rule('power','range','3','3')),'');
 assert.equal(ruleError(rule('power','special')),'');
 assert.deepEqual(ids([card('a',{power:'3'}),card('b',{power:'5'})],{rules:[rule('power','gte','4'),rule('destiny','eq','')]}),['b']);
});
test('sorting keeps numbers before special and missing stats in both directions',()=>{
 const cards=[card('missing'),card('special',{power:'*'}),card('ten',{power:'10'}),card('two',{power:'2'}),card('zero',{power:'0'})];
 assert.deepEqual(ids(cards,{sort:'stat:power'}),['zero','two','ten','special','missing']);
 assert.deepEqual(ids(cards,{sort:'stat:power',direction:'desc'}),['ten','two','zero','special','missing']);
 assert.deepEqual(cards.map(c=>c.id),['missing','special','ten','two','zero'],'never mutate source order');
});
test('two-face sort uses matching faces and makes the chosen value visible',()=>{
 const c=card('double',{power:'8'},{back:face({power:'2'})}),mid=card('middle',{power:'5'});
 assert.deepEqual(ids([c,mid],{sort:'stat:power'}),['double','middle']);
 assert.equal(sortStatLabel(c,options({sort:'stat:power'})),'Power: 2 · back');
 assert.equal(sortStatLabel(c,options({sort:'stat:power',direction:'desc'})),'Power: 8');
 assert.deepEqual(ids([c,mid],{sort:'stat:power',rules:[rule('power','gte','4')]}),['middle','double']);
 assert.equal(sortStatLabel(c,options({sort:'stat:power',face:'back'})),'Power: 2 · back');
});
test('metadata facets combine with existing side, era, type, set and text search',()=>{
 const chosen=card('Luke',{power:'6'},{personas:['Luke Skywalker'],characteristics:['leader'],icons:['Warrior'],uniqueness:'*'});
 const cards=[chosen,{...chosen,id:'dark',side:'dark'},card('other',{power:'6'})];
 const base=searchCards(cards,'Luke','light','Character','1','decipher');
 const filters={subType:'Rebel',rarity:'R',persona:'Luke Skywalker',characteristic:'leader',icon:'Warrior',uniqueness:'*',layout:'single',rules:[rule('power','eq','6')]};
 assert.deepEqual(ids(base,filters),['Luke']);
 for(const key of ['subType','rarity','persona','characteristic','icon','uniqueness'])assert.deepEqual(ids(base,{...filters,[key]:'no-match'}),[],key);
 assert.deepEqual(ids(base,{layout:'double'}),[]);
 assert.deepEqual(ids(cards,{uniqueness:'none'}),['other']);
});
test('textual sorting and deterministic ties',()=>{
 const cards=[card('b',{}, {name:'Same',rarity:'U'}),card('a',{}, {name:'Same',rarity:'C'}),card('z',{}, {name:'Zed',rarity:'R'})];
 assert.deepEqual(ids(cards,{sort:'name'}),['a','b','z']);
 assert.deepEqual(ids(cards,{sort:'name',direction:'desc'}),['z','a','b']);
 assert.deepEqual(ids(cards,{sort:'rarity'}),['a','z','b']);
});
test('all eleven indexed stats support real-archive numeric filtering and sorting',()=>{
 const stats=catalogStats(archive);assert.equal(stats.length,11);
 for(const field of stats){
  const numeric=filterAndSortCards(archive,options({rules:[rule(field,'gte','0')],sort:'stat:'+field}));
  assert.ok(numeric.length>0,field);
  const values=numeric.map(c=>Math.min(...[c,c.back].filter(Boolean).map(f=>numericStat(f.stats[field])).filter(n=>n!==null&&n>=0)));
  assert.ok(values.every((n,i)=>i===0||n>=values[i-1]),field+' sorted');
 }
 assert.equal(filterAndSortCards(archive,options({})).length,3824);
});
