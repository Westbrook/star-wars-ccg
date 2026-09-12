import {ArrowDown,Check,LockKeyhole,Shield,Swords} from 'lucide-react';
import type {Projection,PublicCard,Side} from '@/lib/native-proof/types';
import {LocationForce} from './location-force';
import {TurnCycleStudy} from './turn-cycle-study';

const sideName=(side:Side)=>side==='light'?'Light':'Dark';
export function DeploymentStudy({game,onInspect}:{game:Projection;onInspect:(card:PublicCard)=>void}){
 const turn=game.turn!;
 const stages=['deploy','battle','move','draw','end','complete'];
 const current=stages.indexOf(turn.stage);
 const activeBattle=!!game.battle&&!game.battle.resolved;
 const blocked=turn.restrictions.length>0;
 function unit(c:PublicCard){
  const restriction=turn.restrictions.find(r=>r.target===c.id);
  const expired=turn.expired.some(r=>r.target===c.id);
  const excluded=activeBattle&&!!restriction&&c.location===game.battle!.site;
  return <div className={'proof-deployed-unit'+(restriction?' restricted':'')} key={c.id}>
   <button onClick={()=>onInspect(c)} aria-label={'Inspect '+c.name+' '+c.id.toUpperCase()}><img src={c.image} alt="" loading="lazy"/><span>{c.name}<small>{c.id.toUpperCase()}</small></span></button>
   {c.hit&&<div className="proof-hit-label">Hit · must forfeit after battle</div>}
   {game.table.filter(w=>w.attachedTo===c.id).map(w=><button key={w.id} className="proof-carried-weapon" onClick={()=>onInspect(w)} aria-label={'Inspect attached '+w.name+' '+w.id.toUpperCase()}><span>{w.name}<small>Carried by {c.id.toUpperCase()}{game.battle?.fired?.includes(w.id)?' · fired this battle':''}</small></span></button>)}
   {restriction?<div className="proof-unit-status"><LockKeyhole size={12}/><span>{excluded?'Excluded from this battle':'Barrier · until turn end'}<small>{excluded?'No power, ability or forfeit in this battle':'No movement or battle participation'}</small></span></div>:expired?<div className="proof-unit-status cleared"><Check size={12}/>Barrier expired</div>:turn.moved.includes(c.id)?<div className="proof-unit-status">Regular move used</div>:null}
  </div>;
 }
 return <section className="proof-deployment-study" aria-label={game.cycle?'Two-turn continuity study':'Deployment and Barrier study'}>
  {game.cycle?<TurnCycleStudy game={game}/>:<><div className="proof-turn-heading"><span className="eyebrow amber">{sideName(turn.deployer).toUpperCase()} / ONE TURN STUDY</span><h2>{turn.stage==='complete'?(turn.expired.length?'The Barrier has expired.':'Turn complete.'):game.playing?.length?'A Barrier is resolving.':blocked?'Reinforcements held in place.':'Deploy. Respond. Advance.'}</h2><p>{turn.stage==='complete'?'Both players recirculated. Turn restrictions are cleared; the opponent’s turn is next. This study ends here.':game.playing?.length?'The Force cost is paid. The trooper stays unrestricted until this Interrupt finishes resolving.':blocked?'Barrier blocks this character’s movement and battle participation. It still provides ordinary presence outside battle.':'Follow deployment, battle, movement and drawing. Empty action windows continue automatically; optional choices wait.'}</p></div>
  <ol className="proof-turn-progress" aria-label="Turn progress">{stages.map((stage,i)=><li key={stage} aria-current={i===current?'step':undefined} className={i===current?'current':i<current?'done':''}><span>{i<current?<Check size={11}/>:i+1}</span>{stage==='end'?'Recirculate':stage==='complete'?'Turn ends':stage[0].toUpperCase()+stage.slice(1)}</li>)}</ol></>}
  {game.playing?.map(c=><button className="proof-playing-card" key={c.id} onClick={()=>onInspect(c)}><img src={c.image} alt=""/><span><strong>{c.name}</strong><small>Used Interrupt · awaiting responses</small></span><Shield size={20}/></button>)}
  <div className="proof-connected-sites">{game.locations.map((site,index)=>{
   const eligible=turn.deploymentSites.find(s=>s.site===site.id)!;
   return <div key={site.id}>
    {index>0&&<div className="proof-site-connection"><ArrowDown size={14}/><span>Adjacent sites · regular move costs 1 Force</span></div>}
    <article className="proof-deployment-site" aria-label={site.name}>
     <header><button onClick={()=>onInspect(site)} aria-label={'Inspect '+site.name}><img src={site.image} alt="" loading="lazy"/></button><div><h3>{site.name.replace('Death Star: ','')}</h3><span className="eyebrow">DEATH STAR / INTERIOR</span>{site.forceIcons&&<LocationForce icons={site.forceIcons}/ >}{turn.stage==='deploy'&&<p className={eligible.allowed?'eligible':'ineligible'}>{eligible.allowed?'Deployment allowed':'Cannot deploy here'}<small>{eligible.reason}</small></p>}</div></header>
     <div className="proof-site-units">{(['dark','light'] as const).map(side=><div key={side}><span className="proof-site-side">{sideName(side)}</span><div>{game.table.filter(c=>c.type==='Character'&&c.side===side&&c.location===site.id).map(unit)}</div>{!game.table.some(c=>c.type==='Character'&&c.side===side&&c.location===site.id)&&<p className="proof-site-empty">No characters here</p>}</div>)}</div>
     {game.battle?.site===site.id&&<div className="proof-study-battle"><Swords size={14}/><span>{activeBattle?'Battle power':'Last battle power'}</span><b>Light {game.battle.power.light}</b><b>Dark {game.battle.power.dark}</b></div>}
    </article>
   </div>;
  })}</div>
  {!!game.battle?.shots?.length&&<section className="proof-opening-shots" aria-label="Weapon fire"><h3>Blaster fire</h3>{game.battle.shots.map((shot,i)=><p key={i}><b>{sideName(shot.side)} · {shot.weapon.toUpperCase()} → {shot.target.toUpperCase()}</b><span>{shot.status==='pending'?'Force paid · awaiting responses':shot.status==='drawn'?'Destiny '+shot.destiny+' revealed · awaiting responses':'Destiny '+shot.destiny+' '+(shot.hit?'>':'≤')+' defense '+shot.defense+' · '+(shot.hit?'hit':'miss')}</span></p>)}</section>}
  {game.weaponStudy?.lostOrder&&<p className="proof-turn-note">The character and attached weapons leave together. Choose their order in Lost; the last card placed will be on top.</p>}
  {turn.stage==='draw'&&<div className="proof-turn-note">Drawing moves the top card of Force into hand. Any Force you leave undrawn stays in its pile through recirculation.</div>}
  {turn.stage==='end'&&blocked&&<div className="proof-turn-note">Barrier still applies while players recirculate. It expires after both finish.</div>}
 </section>;
}
