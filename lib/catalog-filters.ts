import type {CatalogCard,PrintedFace} from './catalog';

export const statLabels:Record<string,string>={deploy:'Deploy',power:'Power',destiny:'Destiny',forfeit:'Forfeit',ability:'Ability',armor:'Armor',maneuver:'Maneuver',hyperspeed:'Hyperspeed',landspeed:'Landspeed',parsec:'Parsec',ferocity:'Ferocity'};
export const operators=[{value:'eq',label:'Equals ='},{value:'ne',label:'Not equal ≠'},{value:'gt',label:'Greater than >'},{value:'gte',label:'At least ≥'},{value:'lt',label:'Less than <'},{value:'lte',label:'At most ≤'},{value:'range',label:'Between (inclusive)'},{value:'printed',label:'Printed value is'},{value:'special',label:'Variable / special'},{value:'present',label:'Has this stat'},{value:'missing',label:'No printed stat'}] as const;
export type StatRule={id:string;field:string;operator:typeof operators[number]['value'];value:string;upper:string};
export type CatalogOptions={face:'either'|'front'|'back';subType:string;rarity:string;persona:string;characteristic:string;icon:string;uniqueness:string;layout:string;rules:StatRule[];sort:string;direction:'asc'|'desc'};
export const defaultCatalogOptions:CatalogOptions={face:'either',subType:'all',rarity:'all',persona:'all',characteristic:'all',icon:'all',uniqueness:'all',layout:'all',rules:[],sort:'name',direction:'asc'};
const compare=new Intl.Collator('en',{numeric:true,sensitivity:'base'}).compare;
export const statLabel=(key:string)=>statLabels[key]||key.charAt(0).toUpperCase()+key.slice(1);
export function catalogStats(cards:CatalogCard[]){const keys=new Set(cards.flatMap(c=>[...Object.keys(c.stats),...Object.keys(c.back?.stats||{})]));return [...new Set([...Object.keys(statLabels),...keys])].filter(k=>keys.has(k));}
// Single printed constants only. Expressions, alternatives and variables keep
// their original text, rather than silently turning into zero or a guessed stat.
export function numericStat(raw:unknown):number|null{
 if(typeof raw!=='string')return null;const s=raw.trim();if(!s)return null;
 if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)){const n=Number(s);return Number.isFinite(n)?n:null;}
 const fractions:Record<string,number>={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
 const mixed=s.match(/^([+-]?)(\d*)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/);if(mixed){const n=(mixed[1]==='-'?-1:1)*(Number(mixed[2]||0)+fractions[mixed[3]]);return Number.isFinite(n)?n:null;}
 const ratio=s.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);if(ratio&&Number(ratio[2])!==0){const n=Number(ratio[1])/Number(ratio[2]);return Number.isFinite(n)?n:null;}
 const pi=s.match(/^([+-]?)(\d*(?:\.\d+)?)\s*(?:π|pi)$/i);if(pi){const n=(pi[1]==='-'?-1:1)*Number(pi[2]||1)*Math.PI;return Number.isFinite(n)?n:null;}
 return null;
}
export function ruleError(rule:StatRule){
 if(['special','present','missing'].includes(rule.operator))return '';
 if(rule.operator==='printed')return rule.value.trim()?'':'Enter the printed value.';
 const n=numericStat(rule.value);if(n===null)return 'Enter a number, fraction or π.';
 if(rule.operator==='range'){const upper=numericStat(rule.upper);if(upper===null)return 'Enter the upper value.';if(upper<n)return 'Upper value must be at least the lower value.';}
 return '';
}
function matchesStat(face:PrintedFace,r:StatRule){
 const raw=face.stats[r.field],has=raw!==undefined&&raw.trim()!=='';
 if(r.operator==='missing')return !has;if(r.operator==='present')return has;
 if(r.operator==='printed')return has&&raw.trim().toLowerCase()===r.value.trim().toLowerCase();
 const n=numericStat(raw);if(r.operator==='special')return has&&n===null;if(n===null)return false;
 const v=numericStat(r.value)!;switch(r.operator){case 'eq':return n===v;case 'ne':return n!==v;case 'gt':return n>v;case 'gte':return n>=v;case 'lt':return n<v;case 'lte':return n<=v;case 'range':return n>=v&&n<=numericStat(r.upper)!;default:return false;}
}
export function matchingFaces(c:CatalogCard,o:CatalogOptions){
 const faces:{side:'front'|'back';face:PrintedFace}[]=[...(o.face!=='back'?[{side:'front' as const,face:c}]:[]),...(o.face!=='front'&&c.back?[{side:'back' as const,face:c.back}]:[])];
 const rules=o.rules.filter(r=>!ruleError(r));
 return faces.filter(({face})=>(o.icon==='all'||face.icons.includes(o.icon))&&rules.every(r=>matchesStat(face,r)));
}
function sortStat(c:CatalogCard,o:CatalogOptions){
 const field=o.sort.slice(5),values=matchingFaces(c,o).map(({face,side})=>({raw:face.stats[field],side,n:numericStat(face.stats[field])}));
 const numeric=values.filter(v=>v.n!==null).sort((a,b)=>o.direction==='asc'?a.n!-b.n!:b.n!-a.n!);if(numeric.length)return {...numeric[0],rank:0};
 const special=values.filter(v=>v.raw?.trim()).sort((a,b)=>compare(a.raw!,b.raw!)*(o.direction==='asc'?1:-1));if(special.length)return {...special[0],rank:1};
 return {raw:undefined,side:'front' as const,n:null,rank:2};
}
export function sortStatLabel(c:CatalogCard,o:CatalogOptions){if(!o.sort.startsWith('stat:'))return '';const v=sortStat(c,o);return statLabel(o.sort.slice(5))+': '+(v.raw||'not printed')+(v.side==='back'?' · back':'');}
export function filterAndSortCards(cards:CatalogCard[],o:CatalogOptions){
 const matched=cards.filter(c=>(o.subType==='all'||c.subType===o.subType)&&(o.rarity==='all'||c.rarity===o.rarity)&&(o.persona==='all'||c.personas.includes(o.persona))&&(o.characteristic==='all'||c.characteristics.includes(o.characteristic))&&(o.uniqueness==='all'||(o.uniqueness==='none'?!c.uniqueness:c.uniqueness===o.uniqueness))&&(o.layout==='all'||(o.layout==='double'?!!c.back:!c.back))&&matchingFaces(c,o).length);
 const multiplier=o.direction==='asc'?1:-1;
 const decorated=matched.map(card=>({card,stat:o.sort.startsWith('stat:')?sortStat(card,o):null}));
 decorated.sort((a,b)=>{
  let order=0;if(a.stat&&b.stat){order=a.stat.rank-b.stat.rank;if(!order)order=(a.stat.rank===0?a.stat.n!-b.stat.n!:compare(a.stat.raw||'',b.stat.raw||''))*multiplier;}
  else{const key=['name','setName','type','rarity'].includes(o.sort)?o.sort as 'name'|'setName'|'type'|'rarity':'name';order=compare(a.card[key],b.card[key])*multiplier;}
  return order||compare(a.card.name,b.card.name)||compare(a.card.id,b.card.id);
 });return decorated.map(x=>x.card);
}
