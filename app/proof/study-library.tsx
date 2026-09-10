import {ArrowUpRight,Orbit,Search,Swords,X} from 'lucide-react';
import type {ReactNode} from 'react';
import {Input} from '@/components/ui/input';
import {matchingStudies,studies,studyTopics} from '@/lib/native-proof/study-library';
import type {StudyFilter} from '@/lib/native-proof/study-library';
import type {ScenarioId} from '@/lib/native-proof/types';

export function StudyLibrary({filter,onFilter,busy,onLaunch,children}:{filter:StudyFilter;onFilter:(filter:StudyFilter)=>void;busy:boolean;onLaunch:(id:ScenarioId)=>void;children:ReactNode}){
 const visible=matchingStudies(filter),queryMatches=matchingStudies({...filter,topic:'all'}),filtered=!!filter.query.trim()||filter.topic!=='all';
 return <section className="proof-library" aria-label="Study library">
  <fieldset className="proof-library-toolbar" disabled={busy} aria-label="Find a study">
   <label htmlFor="proof-study-search">Find an experiment</label>
   <div className="proof-library-search"><Search size={19} aria-hidden="true"/><Input id="proof-study-search" type="search" value={filter.query} maxLength={200} autoComplete="off" placeholder="Search titles, cards or rules…" onChange={event=>onFilter({...filter,query:event.target.value})} aria-controls="proof-study-results"/>{filter.query&&<button type="button" aria-label="Clear study search" onClick={()=>onFilter({...filter,query:''})}><X size={17}/></button>}</div>
   <div className="proof-library-filters" role="group" aria-label="Filter by rules focus">{studyTopics.map(topic=><button type="button" key={topic.id} aria-pressed={filter.topic===topic.id} aria-controls="proof-study-results" onClick={()=>onFilter({...filter,topic:topic.id})}>{topic.label}<span>{topic.id==='all'?queryMatches.length:queryMatches.filter(study=>study.topics.includes(topic.id)).length}</span></button>)}</div>
   <div className="proof-library-summary"><p role="status" aria-live="polite" aria-atomic="true">{visible.length} of {studies.length} studies{filtered?' match':' available'}</p>{filtered&&<button type="button" className="text-button" onClick={()=>onFilter({query:'',topic:'all'})}>Clear filters<X size={14}/></button>}</div>
  </fieldset>
  {children}
  <div id="proof-study-results">{visible.length?<div className="proof-scenarios">{visible.map(study=><article key={study.id}>
   <div className="proof-scenario-top"><span>EXPERIMENT / {study.number}</span>{study.topics.includes('battle')?<Swords/>:<Orbit/>}</div>
   <span className="eyebrow amber">{study.subtitle}</span><h2>{study.title}</h2><p>{study.description}</p>
   <div className="proof-rule-tags">{study.rules.map(rule=><span key={rule}>{rule}</span>)}</div>
   <button className="button" disabled={busy} onClick={()=>onLaunch(study.id)}>Enter checkpoint<ArrowUpRight size={16}/></button>
  </article>)}</div>:<div className="proof-library-empty"><Search size={26} aria-hidden="true"/><h2>No matching studies</h2><p>Try a title such as “Return fire,” a rule such as “attrition,” or a different focus.</p><button type="button" className="button" disabled={busy} onClick={()=>onFilter({query:'',topic:'all'})}>Show all studies<ArrowUpRight size={16}/></button></div>}</div>
 </section>;
}
