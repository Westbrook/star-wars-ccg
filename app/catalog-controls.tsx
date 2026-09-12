'use client';
import {useMemo} from 'react';
import {Plus,X} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import type {CatalogCard,CatalogManifest} from '@/lib/catalog';
import {catalogStats,operators,ruleError,statLabel,type CatalogOptions,type StatRule} from '@/lib/catalog-filters';

export function Filter({label,value,onChange,items}:{label:string;value:string;onChange:(value:string)=>void;items:{value:string;label:string}[]}){
 return <Select value={value} onValueChange={onChange}><SelectTrigger className="choice-select" aria-label={label}><SelectValue>{items.find(item=>item.value===value)?.label}</SelectValue></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select>;
}
function Facet({label,value,items,onChange}:{label:string;value:string;items:string[];onChange:(v:string)=>void}){
 return <div className="catalog-field"><span>{label}</span><Combobox items={items} value={value==='all'?null:value} onValueChange={v=>onChange(v||'all')}><ComboboxInput aria-label={label} placeholder={'Any '+label.toLowerCase()} showClear/><ComboboxContent><ComboboxEmpty>No matches.</ComboboxEmpty><ComboboxList>{(item:string)=><ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>;
}
export function CatalogSort({stats,options,onChange}:{stats:string[];options:CatalogOptions;onChange:(patch:Partial<CatalogOptions>)=>void}){
 return <div className="catalog-sort"><span>Sort by</span><Filter label="Sort cards by" value={options.sort} onChange={sort=>onChange({sort})} items={[{value:'name',label:'Name'},{value:'setName',label:'Expansion set'},{value:'type',label:'Card type'},{value:'rarity',label:'Rarity code'},...stats.map(s=>({value:'stat:'+s,label:statLabel(s)}))]}/><Filter label="Sort direction" value={options.direction} onChange={direction=>onChange({direction:direction as CatalogOptions['direction']})} items={[{value:'asc',label:options.sort.startsWith('stat:')?'Low → high':'A → Z'},{value:'desc',label:options.sort.startsWith('stat:')?'High → low':'Z → A'}]}/></div>;
}
export function CatalogControls({cards,manifest,options,onChange,type,set,era,onType,onSet,onEra,onReset}:{cards:CatalogCard[];manifest:CatalogManifest;options:CatalogOptions;onChange:(patch:Partial<CatalogOptions>)=>void;type:string;set:string;era:string;onType:(v:string)=>void;onSet:(v:string)=>void;onEra:(v:string)=>void;onReset:()=>void}){
 const facets=useMemo(()=>{const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));return {subType:unique(cards.map(c=>c.subType)),rarity:unique(cards.map(c=>c.rarity)),persona:unique(cards.flatMap(c=>c.personas)),characteristic:unique(cards.flatMap(c=>c.characteristics)),icon:unique(cards.flatMap(c=>[...c.icons,...(c.back?.icons||[])])),uniqueness:unique(cards.map(c=>c.uniqueness)),stats:catalogStats(cards)}},[cards]);
 const updateRule=(id:string,patch:Partial<StatRule>)=>onChange({rules:options.rules.map(r=>r.id===id?{...r,...patch}:r)});
 return <div className="catalog-controls">
  <div className="catalog-control-heading"><div><h3>Find your next play</h3><p>Combine card details and printed stats to narrow the archive.</p></div><button className="text-button" onClick={onReset}>Reset all filters</button></div>
  <div className="catalog-facets">
   <div className="catalog-field"><span>Card type</span><Filter label="Card type" value={type} onChange={onType} items={[{value:'all',label:'All card types'},...Object.keys(manifest.types).sort().map(t=>({value:t,label:t}))]}/></div>
   <div className="catalog-field"><span>Expansion set</span><Filter label="Expansion set" value={set} onChange={onSet} items={[{value:'all',label:'All expansion sets'},...manifest.sets.map(s=>({value:s.id,label:s.name}))]}/></div>
   <div className="catalog-field"><span>Card era</span><Filter label="Card era" value={era} onChange={onEra} items={[{value:'all',label:'Decipher + virtual'},{value:'decipher',label:'Decipher originals'},{value:'virtual',label:'Players Committee virtual'}]}/></div>
   {(['subType','rarity','persona','icon','characteristic'] as const).filter(key=>facets[key].length).map(key=><Facet key={key} label={{subType:'Subtype',rarity:'Rarity',persona:'Persona',icon:'Icon',characteristic:'Characteristic'}[key]} value={options[key]} items={facets[key]} onChange={value=>onChange({[key]:value})}/>)}
   <div className="catalog-field"><span>Uniqueness</span><Filter label="Uniqueness" value={options.uniqueness} onChange={uniqueness=>onChange({uniqueness})} items={[{value:'all',label:'Any uniqueness'},{value:'none',label:'Non-unique'},...facets.uniqueness.map(s=>({value:s,label:s}))]}/></div>
   <div className="catalog-field"><span>Card layout</span><Filter label="Card layout" value={options.layout} onChange={layout=>onChange({layout})} items={[{value:'all',label:'All layouts'},{value:'single',label:'Single face'},{value:'double',label:'Two faces'}]}/></div>
   <div className="catalog-field"><span>Match stats & icons on</span><Filter label="Card face for stats and icons" value={options.face} onChange={face=>onChange({face:face as CatalogOptions['face']})} items={[{value:'either',label:'Either face'},{value:'front',label:'Front face'},{value:'back',label:'Back face only'}]}/></div>
  </div>
  <div className="catalog-stat-heading"><div><h4>Printed stats</h4><p>Every condition must match the same face. Unfinished conditions are not applied.</p></div><button className="button" onClick={()=>onChange({rules:[...options.rules,{id:crypto.randomUUID(),field:facets.stats[0]||'deploy',operator:'eq',value:'3',upper:''}]})}><Plus size={16}/>Add condition</button></div>
  <div className="catalog-stat-rules">{options.rules.map((r,i)=>{const error=ruleError(r),hasValue=!['special','present','missing'].includes(r.operator);return <div className="catalog-stat-rule" key={r.id}>
   <span className="catalog-rule-number">{i===0?'WHERE':'AND'}</span>
   <Filter label={'Stat for condition '+(i+1)} value={r.field} onChange={field=>updateRule(r.id,{field})} items={facets.stats.map(s=>({value:s,label:statLabel(s)}))}/>
   <Filter label={'Comparison for condition '+(i+1)} value={r.operator} onChange={operator=>updateRule(r.id,{operator:operator as StatRule['operator']})} items={[...operators]}/>
   <div className="catalog-rule-values">{hasValue&&<input aria-label={'Value for condition '+(i+1)} aria-invalid={!!error} aria-describedby={error?'rule-error-'+r.id:undefined} placeholder={r.operator==='printed'?'e.g. X or 0 or 7':'e.g. 3'} value={r.value} onChange={e=>updateRule(r.id,{value:e.target.value})}/>}{r.operator==='range'&&<><span>to</span><input aria-label={'Upper value for condition '+(i+1)} aria-invalid={!!error} aria-describedby={error?'rule-error-'+r.id:undefined} placeholder="Upper value" value={r.upper} onChange={e=>updateRule(r.id,{upper:e.target.value})}/></>}</div>
   <button className="catalog-remove-rule" aria-label={'Remove condition '+(i+1)} onClick={()=>onChange({rules:options.rules.filter(x=>x.id!==r.id)})}><X size={18}/></button>
   {error&&<p className="catalog-rule-error" id={'rule-error-'+r.id} role="status">{error} This condition is not applied.</p>}
  </div>})}</div>
  <p className="catalog-filter-help">Compare numbers, fractions and π. Use “Printed value is” for exact text, or “Variable / special” for values such as X, *, or 0 or 7. Cards without a number do not match numeric comparisons.</p>
 </div>;
}
