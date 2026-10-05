import identities from '../../data/native-engine/identities.json';
import type {objectiveView} from './objectives';
import type {undercoverView} from './undercover';
import type {occupancyView} from './occupancy';
import type {publicValues} from './public-values';
import type {vehicleReactView} from './vehicle-react';
import type {laserGatesView} from './laser-gate';
import type {capturedShipView} from './captured-ships';
import type {Battle} from './battle';
import {definition} from './board';
import {premiereLocations,premiereSites,premiereSystems} from './premiere-setup';
import type {project} from './runtime';
import {other, type Side} from './types';

export const computerPolicy = 'native-cpu-34';
type View = ReturnType<typeof project>;

/** A deterministic, conservative opponent, not a rules implementation. Its only
 * input is the same private projection a player receives. Current public values
 * are used when available, with printed values as fallback estimates; the engine alone supplies and validates every legal choice.
 * No hidden pile lookup, match stack, engine entropy or wall clock is available. */
export function chooseComputerAction(view: View, side: Side): string | null {
  const p = view.prompt;
  if (view.status === 'finished' || !p || p.side !== side || !p.choices.length) return null;
  const own = view.players[side], opponent = other(side);
  const visible = [...view.table, ...own.hand, ...own.lost, ...own.destiny];
  const rules = view.rules as {objectives?:ReturnType<typeof objectiveView>['objectives'];undercoverSpies?:ReturnType<typeof undercoverView>['undercoverSpies'];vehicleReact?:ReturnType<typeof vehicleReactView>['vehicleReact']; laserGates?:ReturnType<typeof laserGatesView>['laserGates']; capturedShips?:ReturnType<typeof capturedShipView>['capturedShips'];battleDrawPolicy?:Record<Side,{count:number;limit:number|null}>;forceLossCredits?:Record<string,number>;values?: ReturnType<typeof publicValues>; vessels?:ReturnType<typeof occupancyView>['vessels']; battle?: Battle | null} | undefined;
  const battle = rules?.battle?.stage === 'damage' ? rules.battle : null;
  const cards = new Map(visible.map(c => [c.id, c]));
  const stat = (id: string, field: string) => {
    const c = cards.get(id);if (!c) return 0;
    const current = rules?.values?.characters[id];
    if (current && field in current) return current[field as keyof typeof current];
    const n = Number((definition(c.blueprint,c.face).stats as Record<string,string>)[field]);
    return Number.isFinite(n) ? n : 0;
  };
  const at = (site: string, seat: Side) => view.table.filter(c => c.zone === 'table' && c.owner === seat && c.location === site && !c.attachedTo && definition(c.blueprint).type === 'Character');
  const strength = (site: string, seat: Side, defending = false) => rules?.values?.sites[site]?.[seat]?.[defending ? 'defendingPower' : 'power'] ?? at(site,seat).reduce((n,c) => n + stat(c.id,'power'),0);
  const icons = (site: string, seat: Side) => cards.get(site)?.blownAway?0:premiereLocations[cards.get(site)?.blueprint ?? '']?.icons[seat] ?? 0;
  const value = (id: string) => stat(id,'power') * 2 + stat(id,'ability') - stat(id,'deploy');
  const wantsCard = own.hand.length < 9 && (own.lifeForce === null || own.lifeForce > 1);
  const ownStations = view.table.filter(c => c.zone === 'table' && !c.coveredBy && c.owner === side && c.blueprint === '1_37');
  const vaporators = view.table.filter(c => c.zone === 'table' && !c.coveredBy && c.blueprint === '1_41');
  const near = (a: string | undefined, b: string | undefined) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const locations = view.locations ?? [], i = locations.indexOf(a), j = locations.indexOf(b);
    const system = premiereSites[cards.get(a)?.blueprint ?? '']?.system;
    return i >= 0 && j >= 0 && Math.abs(i-j) === 1 && !!system && system === premiereSites[cards.get(b)?.blueprint ?? '']?.system;
  };
  const cheapestCharacter = Math.min(6,...own.hand.filter(c => definition(c.blueprint).type === 'Character').map(c => Math.max(0,stat(c.id,'deploy'))));
  // This is a planning estimate, not a deployment-cost or activation rule.
  // Keep enough projected Force for a character plus a move/battle when the
  // hand already has options. A nearly empty hand needs cards first.
  const activationLeft = view.turn.side === side && view.turn.phase === 'activate' ? Math.min(own.counts?.reserve ?? 0,Math.max(0,view.turn.generation-view.turn.activated)) : 0;
  const canSpareActivation = own.hand.length < 3 || (own.counts?.force ?? 0) + activationLeft > cheapestCharacter + 1;
  const farmScore = (id: string, site: string) => {
    if (cards.get(id)?.blueprint === '1_37') return ownStations.length || own.lifeForce !== null && own.lifeForce <= 4 ? -5 : 22 + at(site,side).filter(c => c.blueprint === '1_2').length * 3;
    if (cards.get(id)?.blueprint !== '1_41') return -5;
    const unprotected = view.table.filter(c => c.zone === 'table' && !c.attachedTo && !c.coveredBy && definition(c.blueprint).type === 'Character' && near(site,c.location) && !vaporators.some(v => near(v.attachedTo,c.location)));
    const protection = unprotected.reduce((n,c) => n + (c.owner === side ? 3 : -3),0);
    const extraDraw = ownStations.length && !vaporators.length ? 12 : 0;
    const owen = at(site,side).some(c => c.blueprint === '1_22') && !vaporators.some(v => v.attachedTo === site) ? 6 : 0;
    const benefit = protection + extraDraw + owen;
    return benefit > 0 ? 10 + benefit : -5;
  };
  const handLoss = (id: string) => 12 - value(id);
  const remainingDamage = battle?.damage[side] ?? 0, remainingAttrition = battle?.attrition[side] ?? 0;
  const hits = battle?.hits.filter(id => cards.get(id)?.owner === side) ?? [];
  const requiredAttrition = p.choices.some(c => c.id.startsWith('forfeit:') && !battle?.attritionProtected?.some(ref => ref.id === c.id.slice(8))) ? remainingAttrition : 0;
  const hitCredit = hits.reduce((sum,id) => sum + stat(id,'forfeit'),0);
  // Mandatory forfeits can clear both obligations. Do not spend an Interrupt
  // reducing damage already covered by hit casualties or required attrition.
  const avoidableDamage = Math.max(0, remainingDamage - Math.max(hitCredit,requiredAttrition));
  const forfeitScore = (id: string) => hits.includes(id) ? 100 - value(id) :
    8 + Math.min(stat(id,'forfeit'),Math.max(remainingDamage,remainingAttrition)) * 4 - value(id);
  const amounts = p.choices.filter(c => c.id.startsWith('battle-reduce:')).map(c => Number(c.id.split(':')[2]));
  const reduceAmount = Math.min(Math.ceil(avoidableDamage),Math.max(0,...amounts));
  const extraActivations = p.choices.filter(c => c.id.startsWith('stew:amount:')).map(c => Number(c.id.split(':')[2]));
  const extraActivation = Math.min(Math.max(0,...extraActivations),Math.max(0,(own.counts?.reserve ?? 0)-1),Math.max(0,6-(own.counts?.force ?? 0)));
  const isTube = (id: string) => ['1_148','1_308'].includes(cards.get(id)?.blueprint ?? '');
  const passengers = (id: string) => view.table.filter(c => c.zone === 'table' && c.owner === side && c.attachedTo === id && c.aboardRole && definition(c.blueprint).type === 'Character');
  // A route is actionable only when the engine offers it. Boarding keeps a
  // garrison and targets a stronger uncontested drain, or retreats from danger.
  const tubeRouteScore = (host: string, to: string) => {
    const from=cards.get(host)?.location;if(!from)return -5;
    const cargo=passengers(host),safe=strength(to,opponent)===0;
    const retreat=strength(from,opponent)>strength(from,side);
    const spread=at(from,side).some(c=>stat(c.id,'ability')>0)&&!at(to,side).some(c=>stat(c.id,'ability')>0)&&icons(to,opponent)>0;
    return cargo.some(c=>stat(c.id,'ability')>0)&&safe&&(retreat||spread||icons(to,opponent)>icons(from,opponent))?30+icons(to,opponent):-5;
  };
  const offeredTubeRoutes = (host: string) => p.choices.filter(c=>c.id.startsWith('voyage:landspeed:'+host+':')).map(c=>c.id.split(':')[3]);
  const canBoardTube = (id: string, host: string) => {
    const from=cards.get(host)?.location;if(!from||stat(id,'ability')<=0)return false;
    const retreat=strength(from,opponent)>strength(from,side);
    return (retreat||at(from,side).some(c=>c.id!==id&&stat(c.id,'ability')>0))&&offeredTubeRoutes(host).some(to=>strength(to,opponent)===0&&(retreat||!at(to,side).some(c=>stat(c.id,'ability')>0)&&icons(to,opponent)>0||icons(to,opponent)>icons(from,opponent)));
  };
  // Gate text restricts both players. This is a public mobility estimate, not
  // another legality implementation; suppression and offered routes win.
  const gateBenefit = (pair: string[]) => view.table.filter(c=>c.zone==='table'&&!c.coveredBy&&!c.attachedTo&&pair.includes(c.location??'')).reduce((sum,c)=>{
    const type=definition(c.blueprint).type,blocked=type==='Character'?stat(c.id,'power')+stat(c.id,'ability')<=4:type==='Vehicle'&&!isTube(c.id);
    return sum+(blocked?(c.owner===side?-1:1)*(1+Math.max(0,stat(c.id,'power'))):0);
  },0);
  const gateRemoval = (id: string) => {const gate=rules?.laserGates?.[id];return gate?.active?-gateBenefit(gate.sites):0;};
  const siegeBalance = (ship: string) => {
    const captured=rules?.capturedShips?.find(c=>c.id===ship);if(!captured)return -Infinity;
    const host=cards.get(captured.host),aboard=host&&definition(host.blueprint).type==='Starship';
    const attackers=view.table.filter(c=>c.zone==='table'&&c.owner===side&&definition(c.blueprint).type==='Character'&&(aboard?c.attachedTo===captured.host:!c.attachedTo&&c.location===captured.host));
    // Inactive trapped cards have no derived active values: printed power is
    // only an estimate until the engine starts their special battle.
    return attackers.reduce((n,c)=>n+stat(c.id,'power'),0)-captured.crew.reduce((n,id)=>n+stat(id,'power'),0);
  };
  const score = (c: typeof p.choices[number]): number => {
    const [kind,a,b] = c.id.split(':');
    if (c.id === 'concede') return -Infinity;
    if (c.id === 'pass') return 0;
    if(kind==='objective'&&a==='retrieve'){
      const eligible=rules?.objectives?.find(x=>x.card===b)?.retrievable??[];
      return eligible.length?30+Math.max(...eligible.map(value)):-5;
    }
    if(kind==='undercover'){
      const id=a==='deploy'?c.id.split(':')[3]:b,spy=cards.get(id),site=spy?.location;
      if(!spy||!site)return -5;
      const ours=strength(site,side),theirs=strength(site,opponent);
      if(a==='deploy')return theirs>0&&ours<=theirs?55+icons(site,side)*5:-5;
      if(a==='break')return theirs===0&&at(site,side).length===0?30:ours>theirs&&theirs>0?25:-5;
      if(a==='move'){
        const to=c.id.split(':')[3];
        // Undercover movement takes place on the opponent's turn. Preserve
        // a useful drain block instead of repeatedly following empty sites.
        const blockedHere=theirs>0?icons(site,side):0;
        const blockedThere=strength(to,opponent)>0?icons(to,side):0;
        return blockedThere>blockedHere?25+(blockedThere-blockedHere)*5:-5;
      }
      return p.mandatory?1:-5;
    }
    if(kind==='starship-effect'&&a==='deploy'){
      const host=c.id.split(':')[3],card=cards.get(host),vessel=rules?.vessels?.[host];
      if(!card||card.owner!==side||!vessel?.operational)return -5;
      const identity=identities as Record<string,{personas:string[]}>;
      const matching=identity[card.blueprint]?.personas.includes('FALCON')&&vessel.crew.some(crew=>crew.role==='pilot'&&crew.active&&identity[cards.get(crew.id)?.blueprint??'']?.personas.some(p=>['HAN','LANDO','CHEWIE'].includes(p)));
      return 20+(matching?15:0)+Math.min(5,vessel.power);
    }
    if(kind==='alternatives'){
      const target=c.id.split(':')[3],destination=c.id.split(':')[4];
      if(b==='battle'){
        const active=rules?.battle;if(!active||active.stage!=='begin'||active.besieged)return -5;
        const deficit=strength(active.site,opponent,active.initiator===side)-strength(active.site,side,active.initiator!==side);
        // Spend the three Force only to avoid a visibly unfavorable battle;
        // unknown destiny remains unknown, never estimated from hidden piles.
        return deficit>0?65+Math.min(20,deficit):-5;
      }
      if(b==='deployment')return rules?.capturedShips?.some(ship=>ship.crew.some(id=>cards.get(id)?.owner===side))?55:-5;
      if(b==='effect'){
        const ship=rules?.capturedShips?.find(ship=>ship.id===cards.get(target)?.attachedTo);
        // Canceling an existing Besieged prevents future attacks, but does not
        // cancel a battle already underway or itself free the trapped crew.
        return ship?.crew.some(id=>cards.get(id)?.owner===side)?45:-5;
      }
      if(b==='release'){
        const ship=rules?.capturedShips?.find(ship=>ship.id===target),crew=ship?.crew.filter(id=>cards.get(id)?.owner===side)??[];
        if(!crew.length||!destination)return -5;
        const crewPower=crew.reduce((sum,id)=>sum+stat(id,'power'),0),enemy=strength(destination,opponent);
        const active=rules?.battle,alreadyCounted=active&&active.stage!=='complete'&&active.site===destination?crew.filter(id=>active.participants[side].includes(id)).reduce((sum,id)=>sum+stat(id,'power'),0):0;
        if(enemy>strength(destination,side)+crewPower-alreadyCounted)return -5;
        const newPresence=!at(destination,side).some(card=>stat(card.id,'ability')>0)&&crew.some(id=>stat(id,'ability')>0);
        return 80+Math.min(15,crewPower)+icons(destination,opponent)*3+(newPresence?5:0)-enemy*4;
      }
    }
    if(kind==='besieged'){
      if(a==='deploy'||a==='select')return siegeBalance(c.id.split(':')[3])>=0?(a==='deploy'?32:40):-5;
      if(a==='add')return 90+stat(b,'power')+stat(b,'ability');
      if(a==='begin-free')return 70;
      if(a==='begin')return 60;
      if(a==='cancel')return -20;
    }
    if(kind==='laser-gate'&&a==='deploy'){const benefit=gateBenefit(c.id.split(':').slice(3));return benefit>0?25+benefit:-5;}
    if(kind==='sniping'){
      if(a==='bonus')return 80;
      if(a==='target')return 40+gateRemoval(b);
      if(a==='play'){
        const host=cards.get(cards.get(c.id.split(':')[3])?.attachedTo??''),site=host?.location;
        const benefit=Math.max(0,...Object.entries(rules?.laserGates??{}).filter(([id,g])=>cards.get(id)?.owner===opponent&&g.active&&!!site&&g.sites.includes(site)).map(([id])=>gateRemoval(id)));
        return benefit>0?45+benefit:-5;
      }
    }
    if(kind==='retract'){
      if(a==='play')return c.id.split(':')[3]==='cancel'?75:-5;
      if(a==='site')return 50-(view.locations??[]).indexOf(b);
      if(a==='gate'){
        const current=c.card?rules?.laserGates?.[c.card]:undefined,benefit=current?.active?gateBenefit(b==='keep'?current.sites:c.id.split(':').slice(2)):0;
        return 20+benefit+(b==='keep'?0.5:0);
      }
    }
    if(kind==='vehicle-react'&&isTube(a)){
      const from=cards.get(a)?.location,cargo=passengers(a),available=[...cargo,...(from?at(from,side):[])];
      const reinforces=rules?.battle?.stage!=='complete'&&rules?.battle?.site===b;
      const power=available.reduce((n,c)=>n+stat(c.id,'power'),0);
      return available.some(c=>stat(c.id,'ability')>0)&&(!reinforces||strength(b,side)+power>=strength(b,opponent))?55:-5;
    }
    if(c.id==='continue-react'&&rules?.vehicleReact?.name==='Lift Tube')return 20;
    if(kind==='board'&&rules?.vehicleReact?.name==='Lift Tube'&&p.choices.some(c=>c.id==='continue-react'))return 40+stat(a,'power')+stat(a,'ability');
    if(kind==='exit'&&rules?.vehicleReact?.name==='Lift Tube'&&p.choices.some(c=>c.id==='continue-react'))return 60+stat(a,'power');
    if(kind==='tractor')return a==='cancel'?-50:a==='target'?50:a==='use'?40:a==='deploy'?25:15;
    if(kind==='captured-ship')return a==='escape'?(own.lifeForce!==null&&own.lifeForce<=2?100:10):70+icons(b,opponent)-strength(b,opponent);
    if(kind==='prisoner'){
      if(a==='ship-play')return 40; // Capturing the crew also steals the emptied ship.
      if(a==='ship-character')return 30+value(b);
      if(a==='prison')return 85;
      if(a==='escort')return 60+value(b)-(rules?.battle?.hits.includes(b)?100:0);
      if(a==='escape')return 5;
      // Optional capture needs a visible custody plan. The rules still decide
      // eligibility/capacity; this conservative estimate never examines a hand
      // or destination choice belonging to another player.
      const target=cards.get(b),site=target?.location;
      const prison=site&&(identities[cards.get(site)?.blueprint as keyof typeof identities]?.keywords as readonly string[]|undefined)?.includes('PRISON');
      const escort=site&&at(site,side).some(c=>(definition(c.blueprint).icons as readonly string[]).includes('Warrior')&&!rules?.battle?.hits.includes(c.id));
      return prison||escort?30+Math.max(0,value(b)):-5;
    }
    if(kind==='captives'){
      if(a==='deliver')return 35;
      if(a==='take')return -5; // Keep an imprisoned captive secured; avoid a free delivery/take loop.
      if(a==='escape')return own.lifeForce!==null&&own.lifeForce<=2?90:10;
      if(a==='rally')return c.id.endsWith(':pilot')||c.id.endsWith(':driver')?75:70;
    }
    if(kind==='battle-plan')return 35;
    if(kind==='resistance')return 35;
    if(kind==='prep-start')return a==='deploy'?40:a==='done'?20:30;
    if(kind==='starting-select')return 30;
    if (p.timing === 'setup') return c.forceIcons ? 20 + c.forceIcons[side] * 3 - c.forceIcons[opponent] : 10;
    if (c.id === 'core:activate' || c.id === 'core:declare-activation') return 100;
    if (c.id.startsWith('core:activation-amount:')) return 100 + Number(c.id.split(':')[2]);
    if (c.id === 'core:draw') return wantsCard ? 20 : -10;
    // Labria trades an unknown top card for information and optional usable Force.
    // Avoid the risk at low Life Force; choose only from the public prompt.
    if (kind === 'labria' && a === 'reveal') return own.lifeForce !== null && own.lifeForce > 4 && (own.counts?.force ?? 0) < 4 ? 12 : -5;
    if (c.id === 'labria:return:force') return 70;
    if (c.id === 'labria:return:reserve') return 20;
    if (c.id === 'labria:return:used') return 10;
    if (c.id === 'noble:retrieve') return 80;
    if (c.id === 'noble:decline') return -5;
    if (kind === 'noble' && a === 'play') {
      const id = c.id.split(':')[3], target = cards.get(id), site = target?.location;
      // Emergency trade of a small ground unit for Life Force. Do not abandon
      // an uncontested garrison, sacrifice equipment, or assume hidden cards.
      const recovery = Math.min(own.lost.length,stat(id,'forfeit'));
      const plans = view.table.some(c => c.blueprint === '13_86' && c.owner === opponent);
      return own.lifeForce !== null && own.lifeForce <= 4 && recovery >= 2 && stat(id,'power') <= 1 && stat(id,'ability') <= 1 &&
        !!site && (at(site,side).length > 1 || at(site,opponent).length > 0) && !view.table.some(c => c.attachedTo === id) && !plans ? 30 + recovery : -5;
    }
    if (kind === 'farm-deploy') return farmScore(a,b);
    if (kind === 'hydroponics') return wantsCard && canSpareActivation ? 30 : -5;
    if (kind === 'r2') return b === 'activate' ? 90 : b === 'draw' && wantsCard ? 60 : -5;
    if (kind === 'stew') {
      if (a === 'first') return b === side ? 70 : 60;
      if (a === 'amount') return Number(b) === extraActivation ? 70 : -5;
      if (a === 'play') return (own.counts?.reserve ?? 0) > 2 && own.hand.length >= 2 && (own.counts?.force ?? 0) < 3 ? 18 : -5;
    }
    // No hidden destiny distribution is available. Prefer low-ability targets
    // using their current public value; uncertain high-ability shots can wait.
    if (kind === 'gravel' && a === 'play') {
      const target = c.id.split(':')[3], ability = stat(target,'ability');
      return (own.counts?.reserve ?? 0) > 0 && cards.has(target) && ability <= 3 ? 50 + Math.min(12,Math.max(0,value(target))) - ability * 10 : -5;
    }
    if (c.id === 'draw-destiny') return 80;
    if (c.id === 'skip-destiny') return -10;
    if (kind === 'obi') {
      // The engine offers only legal targets/routes. Remove the strongest
      // opposing participant; preserve our own card by taking a free exit.
      if (a === 'use') return 65 + Math.max(0,value(c.id.split(':')[3]));
      if (a === 'move') return 80 + icons(b,opponent) - strength(b,opponent);
      if (a === 'lose') return -20;
    }
    if (kind === 'drain') return 100 + icons(a,opponent);
    if (kind === 'site'||kind==='ship-site') return 50;
    if(c.id==='undock')return 10;
    if(kind==='dock')return -5; // Needs coordinated crew/cargo route planning.
    if (kind === 'transport') {
      const target=c.id.split(':')[3],role=c.id.split(':')[4],host=rules?.vessels?.[target];
      if(a==='disembark')return 24; // Launch a carried fighter; do not embark it again without a transport plan.
      if((a==='bridge'||a==='shuttle')&&role==='pilot'&&host?.operational)return 28+stat(b,'ability');
      return -5;
    }
    if (kind === 'voyage') {
      const to=c.id.split(':')[3],from=cards.get(b)?.location;
      if(!from)return -5;
      if(cards.get(b)?.owner!==side){
        // An offered Control Station action can move an enemy ship without
        // changing ownership. Prefer removing its drain or moving it away from
        // our weaker fleet; never send it into another visibly weaker fleet.
        const power=rules?.vessels?.[b]?.power??stat(b,'power');
        const ours=strength(to,side),theirs=strength(to,opponent)+power;
        if(ours>0&&ours<theirs)return -5;
        const drainReduction=icons(from,side)-icons(to,side);
        const relieve=strength(from,side)>0&&strength(from,opponent)>strength(from,side);
        const ambush=ours>theirs;
        return drainReduction>0||relieve||ambush?30+drainReduction*3+(relieve?10:0)+(ambush?10:0):-5;
      }
      if(a==='landspeed'&&isTube(b))return tubeRouteScore(b,to);
      if(a==='takeoff')return 25;
      if(a==='land')return -5; // Landing needs a coordinated crew-delivery plan.
      const threat=strength(from,opponent)>strength(from,side);
      return strength(to,opponent)===0&&(threat||icons(to,opponent)>icons(from,opponent))?24+icons(to,opponent):-5;
    }
    if (kind === 'pair-deploy') {
      const target=cards.get(c.id.split(':')[3]);
      // Use only the offered pair and visible endpoint. Operational deployment
      // to space is preferable to parking a crewed fighter in a bay or cargo.
      return target&&!!premiereSystems[target.blueprint]?55+stat(a,'power')*2+stat(b,'ability'):-5;
    }
    if (kind === 'vessel') {
      const role=c.id.split(':')[4];
      const host=c.id.split(':')[3];
      if(a==='embark'&&isTube(host))return canBoardTube(b,host)?45+stat(b,'power'):-5;
      if(a==='exit'&&isTube(host))return offeredTubeRoutes(host).some(to=>tubeRouteScore(host,to)>0)?-5:35+stat(b,'power');
      if(a==='deploy'&&isTube(b))return at(host,side).some(c=>stat(c.id,'ability')>0)&&!view.table.some(c=>c.zone==='table'&&c.owner===side&&isTube(c.id)&&c.location===host)?26:-5;
      if(a==='escape')return 40+stat(b,'ability');
      if(a==='deploy')return 30+stat(b,'power')*2;
      if(a==='aboard')return role==='pilot'?48+stat(b,'ability'):role==='driver'?45:8;
      if(a==='role')return role==='pilot'||role==='driver'?25:-5;
      // Ground transport and disembark decisions need route planning; do not
      // endlessly embark/disembark simply because unlimited moves are legal.
      return -5;
    }
    if (kind === 'deploy') return 35 + value(a) + (!at(b,side).length ? 12 : 0) + Math.min(10,strength(b,opponent));
    // The offered label exposes Core's free deployment; no private state needed.
    if (kind === 'deploy-effect') return cards.get(a)?.blueprint==='1_232' ? (c.label.endsWith(' · free through Central Core')||(own.counts.force??0)>=cheapestCharacter+4?20:-5) : 25;
    if (kind === 'battle' || kind === 'battle-free') return strength(a,side) >= strength(a,opponent,true) ? (kind==='battle-free'?42:40) : -10;
    if (kind === 'move') {
      const from = cards.get(a)?.location;
      if (!from) return -10;
      // Preserve a sole uncontested garrison. Spread surplus troops or retreat
      // from a losing site; avoid purposeless back-and-forth movement.
      if (!at(b,side).length && !at(b,opponent).length && (at(from,side).length > 1 || strength(from,opponent) > strength(from,side))) return 25 + icons(b,opponent);
      if (strength(b,opponent) && strength(b,side) + stat(a,'power') >= strength(b,opponent) && at(from,side).length > 1) return 15;
      return -10;
    }
    if (kind === 'attach' && cards.get(a)?.blueprint === '5_12') return 35 + stat(b,'power');
    if (kind === 'equip') return 15 + stat(b,'power');
    if (kind === 'transfer') {
      const old = cards.get(a)?.attachedTo;
      return old && stat(b,'power') > stat(old,'power') ? 5 : -10;
    }
    if (kind === 'fire') return 70 + stat(b,'power');
    if (kind === 'rescue') return hits.includes(b) && value(b) > value(a) ? 115 + value(b) - value(a) : -5;
    if(kind==='service')return a==='deploy'&&(rules?.values?.sites[c.id.split(':')[3]]?.[opponent]?.ability??0)>=1?-10:25;
    if(kind==='crush')return cards.get(a)?.owner===opponent?60+value(a):10-value(a);
    if(kind==='compactor'&&a==='play'){
      if(cards.get(b)?.blueprint==='1_89'){
        const site=rules?.battle?.site;
        return site&&strength(site,opponent)>strength(site,side)?65:-10;
      }
      const site=view.table.find(c=>c.blueprint==='1_125'&&!c.coveredBy&&!c.blownAway)?.id;
      if(!site)return -10;
      const victims=view.table.filter(c=>c.location===site&&['Character','Creature','Vehicle','Starship','Weapon','Device'].includes(definition(c.blueprint).type));
      const weight=(seat:Side)=>victims.filter(c=>c.owner===seat).reduce((n,c)=>n+Math.max(1,stat(c.id,'forfeit')+stat(c.id,'power')),0);
      return weight(opponent)>weight(side)?45+weight(opponent)-weight(side):-10;
    }
    if(kind==='disarm'){const target=c.id.split(':')[3];return a==='operate'?(cards.get(target)?.owner===opponent?95:-5):a==='deploy'?55+value(target):p.mandatory?50:-5;}
    if(kind==='mentor'){const mode=c.id.split(':')[3];return a==='play'?(mode==='tie'?(cards.get(c.id.split(':')[4])?.owner===opponent?90:-5):own.hand.some(c=>definition(c.blueprint).type==='Weapon'&&(identities as Record<string,{keywords:string[]}>)[c.blueprint]?.keywords.includes('LIGHTSABER'))?-5:30):a==='take'?50:a==='not-found'||a==='verified'?20:-5;}
    if(kind==='preparation'&&a==='destiny')return 55;
    // These Effects penalize both players. Preserve our visible cancellation
    // options when holding Sense/Alter; never inspect the opponent's hand.
    if(kind==='try-effect'&&a==='deploy')return own.hand.some(card=>['1_109','1_267','1_71','1_234'].includes(card.blueprint))?-5:25;
    if(kind==='battle-add'){
      const title=cards.get(a)?.blueprint?definition(cards.get(a)!.blueprint).name:'';
      const prior=Math.max(0,...(rules?.battle?.drawModifiers??[]).filter(m=>m.side===side&&m.kind==='add'&&m.function==='battle-destiny'&&cards.get(m.source.id)?.blueprint&&definition(cards.get(m.source.id)!.blueprint).name===title).map(m=>m.amount));
      const policy=rules?.battleDrawPolicy?.[side],gain=Number(b)-prior;
      return gain>0&&(own.counts?.reserve===null||(own.counts?.reserve??0)>0)&&(!policy||policy.limit===null||policy.count<policy.limit)?45+gain*15:-5;
    }
    if(kind==='scomp'){const mode=c.id.split(':')[3];return a==='finish'?30:mode==='drain'?(view.turn.side===side?-10:65):mode==='cancel'||mode==='table'?75:5;}
    if(kind==='orders'){
      if(a==='take')return 30+value(b);
      const mode=c.id.split(':')[3];
      if(mode==='drain')return view.turn.side===side?-10:65;
      if(mode==='cancel'||mode==='table')return 75;
      if(mode==='search')return own.lost.some(c=>definition(c.blueprint).subType.startsWith('Starfighter:')&&(identities as Record<string,{nonUnique:boolean}>)[c.blueprint]?.nonUnique)&&own.lifeForce!==null&&own.lifeForce>1?25:-10;
      return 10;
    }
    if(kind==='effect-search')return a==='play'?35:a==='take'?35+value(b):20;
    if(kind==='alien-search')return a==='begin'?35:a==='take'?35+value(b):20;
    if(kind==='recruit')return 20+value(b);
    if (kind === 'forfeit') return forfeitScore(a);
    if (kind === 'lose-mine') return 10 - value(a);
    if (kind === 'battle-reduce') return Number(b) === reduceAmount && reduceAmount > 0 ? 80 + reduceAmount : -5;
    if (kind === 'revival' && a === 'old-ben') return 55 + value(c.id.split(':')[3]);
    if (kind === 'revival' && a === 'kintan') return own.lost.some(c => definition(c.blueprint).type === 'Character') ? 55 : -5;
    if (kind === 'barrier') return 45 + value(b);
    if (kind === 'lose-hand' || kind === 'battle-lose-hand') return handLoss(a)+((rules?.forceLossCredits?.[a]??1)-1)*8;
    if (kind === 'lose' || kind === 'battle-lose') return a === 'used' ? 10 : a === 'force' ? 9 : 8;
    if (kind === 'retrieve' || kind === 'take') return 20 + value(a);
    if (kind === 'choke' || kind === 'accident-lose' || c.id.startsWith('scavenge:lose:')) return 10 - value(kind === 'scavenge' ? b : a);
    if (c.id === 'confirm') return 80;
    if (kind === 'toggle') return c.label.startsWith('Add ') ? 10 + value(a) : -10;
    if (c.id === 'cancel') return -20;
    if (c.id === 'scan:continue') return 20;
    if (c.id === 'keep') return 10;
    // Mandatory unfamiliar decisions still use an offered choice. Optional
    // unfamiliar text passes until a purposeful policy is added; no free loop.
    return p.mandatory ? 1 : -5;
  };
  // Choice identifiers are opaque tie breakers, never decoded as hidden cards.
  // A stable ordering makes retry/restart decisions identical at a revision.
  const ranked = p.choices.map(c => ({id:c.id,score:score(c)})).filter(c => Number.isFinite(c.score));
  ranked.sort((a,b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ranked[0]?.id ?? null;
}
