import {canCarryWeapon} from './weapon-carrying';
import {disarmActions,disarmAutomatic,disarmInitiate,disarmResolve,assertDisarm} from './disarm';
import {obiWanActions,obiWanInitiate,obiWanResolve,obiWanChoices,obiWanChoose,assertObiWan} from './obi-wan';
import {mentorActions,mentorInitiate,mentorResolve,mentorChoices,mentorChoose,mentorView,assertMentor} from './mentor-interrupts';
import {battleInterruptActions,battleInterruptInitiate,battleInterruptResolve,assertBattleInterrupts} from './battle-interrupts';
import {compactorActions,compactorInitiate,compactorResolve,compactorChoices,compactorChoose,assertCompactor} from './compactor';
import {serviceView,serviceBlueprint,serviceActions,serviceAutomatic,serviceInitiate,serviceResolve,assertService} from './droid-service';
import {scompActions,scompInitiate,scompResolve,scompChoices,scompChoose,scompView,assertScomp} from './scomp';
import {ordersActions,ordersInitiate,ordersResolve,ordersChoices,ordersChoose,assertOrders} from './otsd-orders';
import {alienSearchActions,alienSearchInitiate,alienSearchResolve,alienSearchChoices,alienSearchChoose,alienSearchView,assertAlienSearch} from './alien-search';
import {otsdRecruitActions,otsdRecruitInitiate,otsdRecruitResolve,assertOtsdRecruits} from './otsd-characters';
import {powerDroidAutomatic,powerDroidInitiate,powerDroidResolve,assertPowerDroids} from './power-droid';
import {fusionActions,fusionInitiate,fusionResolve,fusionView,expireFusionLinks,assertFusion} from './power-support';
import {heavyWeaponActions,heavyWeaponInitiate,heavyWeaponResolve,assertHeavyWeapons,heavyWeaponView} from './heavy-weapons';
import {artillery,artilleryView} from './artillery';
import {generatorActions,generatorInitiate,generatorResolve,assertGeneratorShots,generatorView} from './generator-shot';
import {blownAwayResolve,assertBlownAway,destructionView} from './blown-away';
import {hothMoveActions,hothMoveResolve,assertHothMovement} from './hoth-movement';
import {hothView} from './hoth';
import {beginHothDeployment,hothChoices,hothChoose,hothResolve,assertHothDeployment} from './hoth-deployment';
import {scheduleEncounterEnd,rememberSelectiveWampas,encounterAutomatic,encounterInitiate,encounterResolve,encounterView,assertCreatureEncounters} from './creature-encounters';
import {creatureWeaponActions,creatureWeaponInitiate,creatureWeaponResolve,assertCreatureWeapons} from './creature-weapons';
import {groundCreatureActions,groundCreatureInitiate,groundCreatureResolve,assertGroundCreatures} from './ground-creatures';
import {scheduleAttackEnd,creatureActions,creatureAutomatic,creatureInitiate,creatureResolve,creatureChoices,creatureChoose,attackView,assertCreatureAttack} from './creature-attack';
import {scheduleCaveChange,slugActions,slugInitiate,slugResolve,slugView,assertSpaceSlugs} from './space-slug';
import {asteroidActions,asteroidAutomatic,asteroidInitiate,asteroidResolve,asteroidView,assertAsteroids} from './asteroids';
import {sectorActions,sectorInitiate,sectorResolve,assertSectorEffects} from './sector-effects';
import {assertSectors,sectorsView,sectorKind,isCave,locationGroup} from './sectors';
import {scheduleCapacityLoss,capacityChoices,capacityChoose,assertCapacityLoss} from './capacity-loss';
import {lostArtooActions,lostArtooInitiate,lostArtooAutomatic,lostArtooResolve,lostArtooView,assertLostArtoo} from './lost-artoo';
import {fighterTroubleActions,fighterTroubleInitiate,fighterTroubleResolve,fighterTroubleView,assertFighterTrouble} from './fighter-trouble';
import {wedgeActions,wedgeResolve,wedgeChoices,wedgeChoose,wedgeView,assertWedge} from './wedge-search';
import {hyperEscapeActions,hyperEscapeInitiate,hyperEscapeResolve,hyperEscapeChoices,hyperEscapeChoose,hyperEscapeView,assertHyperEscape} from './hyper-escape';
import {ionRepairAutomatic,ionRepairResolve,assertIonRepair} from './ion-repair';
import {tallonActions,tallonInitiate,tallonResolve,tallonView,assertTallon} from './tallon-roll';
import {maneuverActions,maneuverInitiate,maneuverResolve,assertManeuvers} from './maneuvers';
import {mobileActions,mobileResolve,mobileView,assertMobileSystems} from './mobile-systems';
import {starshipWeaponActions,starshipWeaponInitiate,starshipWeaponResolve,assertStarshipWeapons} from './starship-weapons';
import {characterReactActions,characterReactInitiate,characterReactResolve,characterReactChoices,characterReactChoose,characterReactView,assertCharacterReact} from './character-react';
import {vehicleReactActions,vehicleReactInitiate,vehicleReactResolve,vehicleReactChoices,vehicleReactChoose,vehicleReactView,assertVehicleReact} from './vehicle-react';
import {pilotDeployActions,pilotDeployInitiate,pilotDeployResolve,pilotDeployView,assertPilotDeploy} from './pilot-deploy';
import {dockingActions,dockingResolve,dockingChoices,dockingChoose,dockingView,assertDocking} from './docking';
import {transportActions,transportInitiate,transportResolve,assertTransport} from './transport';
import {vesselTravelActions,vesselTravelResolve,assertVesselTravel,vesselTravelView} from './vessel-travel';
import {assertOccupancy,occupancyView} from './occupancy';
import {vesselActions,vesselInitiate,vesselResolve,assertVessels} from './vessels';
import {nighttimeView,sunsdownActions,sunsdownInitiate,sunsdownResolve,assertSunsdown} from './nighttime';
import {locationOrder,isSite} from './board';
import {labriaActions,labriaInitiate,labriaResolve,labriaChoices,labriaChoose,labriaView,assertLabria} from './labria';
import {nobleActions, nobleInitiate, nobleResolve, nobleChoices, nobleChoose, assertNoble} from './noble-sacrifice';
import {angerAutomatic,angerResolve,angerView,assertAnger} from './anger';
import {telepathyActions,telepathyInitiate,telepathyResolve,telepathyChoices,telepathyChoose,assertTelepathy} from './telepathy';
import {darkPathActions,darkPathInitiate,darkPathResolve,darkPathChoices,darkPathChoose,darkPathView,assertDarkPath} from './dark-path';
import {insertActions,insertInitiate,insertResolve,insertChoices,insertChoose,assertInsertEffects,scheduleInserts} from './insert-effects';
import {offEdgeActions, offEdgeInitiate, offEdgeResolve, offEdgeChoices, offEdgeChoose, assertOffEdge} from './off-the-edge';
import {edgeActions, edgeInitiate, edgeResolve, edgeChoices, edgeChoose, assertEdge} from './on-the-edge';
import {stewActions,stewInitiate,stewResolve,stewChoices,stewChoose,assertStew} from './beru-stew';
import {gravelActions, gravelInitiate, gravelResolve, assertGravel} from './gravel-storm';
import {farmDeviceActions, farmDeviceInitiate, farmDeviceResolve, assertFarmDevices} from './farm-devices';
import {larsAutomatic,larsInitiate,larsResolve,assertLars} from './lars';
import {publicValues} from './public-values';
import {gameTextAutomatic, gameTextResolve, assertGameText} from './game-text-actions';
import {assertSearchPolicy} from './search-policy';
import {characterDestinyActions, characterDestinyInitiate, characterDestinyResolve, assertCharacterDestiny} from './character-destiny';
import {astromechActions, astromechInitiate, astromechResolve, assertAstromech} from './astromech';
import {deployEffectActions, deployEffectInitiate, deployEffectResolve, assertDeployEffects} from './deploy-effects';
import {bactaActions, bactaInitiate, bactaResolve, assertBacta} from './bacta';
import {assertStatModifiers} from './stat-modifiers';
import {fxActions, fxInitiate, fxResolve, assertFX} from './fx-droids';
import {forfeitureResolve, assertForfeitures} from './forfeiture';
import {lightsaberActions, lightsaberInitiate, lightsaberResolve, assertLightsaber} from './lightsabers';
import {assertForfeitResets} from './forfeit';
import {trooperAssaultActions, trooperAssaultInitiate, trooperAssaultResolve, assertTrooperAssault} from './trooper-assault';
import {assertCombatModifiers} from './combat-modifiers';
import {assertDuelModifiers} from './duel-modifiers';
import {duelInterruptActions, duelInterruptInitiate, duelInterruptResolve, assertDuelInterrupts} from './duel-interrupts';
import {assertDeployments} from './deployment';
import {phaseEffectActions, phaseEffectAutomatic, phaseEffectInitiate, phaseEffectResolve, assertPhaseEffects} from './phase-effects';
import {abilityEffectActions, abilityEffectInitiate, abilityEffectResolve, assertAbilityEffects} from './ability-effects';
import {assertLocationAbility} from './location-ability';
import {battleEffectActions,battleEffectAutomatic,battleEffectInitiate,battleEffectResolve,assertBattleEffects} from './battle-effects';
import {assertAbility} from './ability';
import {forceEffectActions, forceEffectInitiate, forceEffectResolve, forceEffectChoices, forceEffectChoose, assertForceEffects} from './force-effects';
import {cancellationActions, cancellationInitiate, cancellationResolve, assertCancellation} from './cancellation';
import {actionPlayCard, canPlayCard, recordCardPlay, assertCardPlays} from './persona';
import {assertCharacteristics} from './characteristics';
import {secretPlansAutomatic, secretPlansResolve, secretPlansChoices, secretPlansChoose, assertSecretPlans} from './secret-plans';
import {gamblersLuckActions, gamblersLuckInitiate, gamblersLuckResolve, assertGamblersLuck} from './gamblers-luck';
import {selectionResolve, selectionChoices, selectionChoose, assertDestinySelection} from './destiny-selection';
import {substitutionActions, substitutionInitiate, substitutionResolve, assertSubstitution} from './substitution';
import {gaderffiiActions, gaderffiiInitiate, gaderffiiResolve, assertGaderffii} from './gaderffii';
import {assertWeaponUse} from './weapon-state';
import {stakesActions, stakesInitiate, stakesResolve, assertStakes} from './stakes';
import {doomedActions, doomedInitiate, doomedResolve, doomedView, assertDoomed} from './doomed';
import {worseActions, worseInitiate, worseResolve, assertWorse} from './worse';
import {cardDefinition, citySitesTogether, definition, generation, name, system} from './board';
import {premiereSetup} from './premiere-setup';
import {groundActions, groundAutomatic, groundChoose, groundDecisions, groundInitiate, groundResolve, assertGround, registerReact, resolveCancelledReact, syncForceLosses} from './ground';
import type {Rules} from './runtime';
import type {Json, Side} from './types';
import {assertBattle, battleActions, battleAutomatic, battleCanPass, battleChoose, battleChoices, battleInitiate, battleResolve, battleView, syncBattle} from './battle';
import {equipmentActions, equipmentAutomatic, equipmentInitiate, equipmentResolve, equipmentChoices, equipmentChoose, equipmentView, assertEquipment} from './equipment';
import {resolveDestiny, assertDestiny, destinyChoices, destinyChoose} from './destiny';
import {travelActions, travelInitiate, travelResolve, travelChoices, travelChoose, travelView, assertTravel} from './travel';
import {assertLeaving, tableChoices, tableChoose} from './table';
import {assertInterrupts, interruptActions, interruptInitiate, interruptResolve} from './interrupts';
import {assertRetrieval, retrievalChoices, retrievalChoose, retrievalResolve, retrievalView} from './retrieval';
import {assertCharacterTriggers, characterAutomatic, characterResolve, characterChoices, characterChoose} from './character-triggers';
import {assertRevival, revivalActions, revivalInitiate, revivalResolve} from './revival';
import {accidentActions, accidentInitiate, accidentResolve, accidentChoices, accidentChoose, assertAccident} from './accident';
import {assaultActions, assaultInitiate, assaultResolve, assertAssault} from './assault';
import {scavengeActions, scavengeInitiate, scavengeResolve, scavengeChoices, scavengeChoose, scavengeView, assertScavenge} from './scavenge';
import {scanActions, scanInitiate, scanResolve, scanChoices, scanChoose, scanView, assertScan} from './scan';
import {stunActions, stunInitiate, stunResolve, assertStun} from './stun';
import {medicActions, medicInitiate, medicResolve, assertMedics} from './medics';
import {assertDuel, duelActions, duelInitiate, duelResolve, duelView} from './duel';

/** Composable production implementation in progress. No card is admitted to a
 * public full match until its complete reachable behavior is verified. Tests
 * explicitly override admission to exercise each implemented rule component. */
export const premiereRules: Rules = {
  id: 'premiere-native-1',
  starting: premiereSetup,
  definition: id => {const card = definition(id); return {name: card.name, side: card.side as Side};},
  supports: () => false,
  setupComplete: match => match.setup?.stage === 'complete',
  generation,
  interrupt: m=>expireFusionLinks(m)||rememberSelectiveWampas(m)||scheduleCapacityLoss(m)||scheduleCaveChange(m)||scheduleAttackEnd(m)||scheduleEncounterEnd(m)||scheduleInserts(m),
  automatic: (m, w) => [...disarmAutomatic(m,w),...serviceAutomatic(m,w),...powerDroidAutomatic(m,w),...encounterAutomatic(m,w),...creatureAutomatic(m,w),...asteroidAutomatic(m,w),...lostArtooAutomatic(m,w),...ionRepairAutomatic(m,w),...angerAutomatic(m,w),...larsAutomatic(m,w), ...gameTextAutomatic(m,w), ...phaseEffectAutomatic(m,w), ...battleEffectAutomatic(m,w), ...groundAutomatic(m, w), ...battleAutomatic(m, w), ...equipmentAutomatic(m, w), ...characterAutomatic(m, w), ...secretPlansAutomatic(m, w)],
  actions: (m, w, side) => [...disarmActions(m,w,side),...obiWanActions(m,w,side),...mentorActions(m,w,side),...battleInterruptActions(m,w,side),...compactorActions(m,w,side),...serviceActions(m,w,side),...scompActions(m,w,side),...ordersActions(m,w,side),...alienSearchActions(m,w,side),...otsdRecruitActions(m,w,side),...fusionActions(m,w,side),...heavyWeaponActions(m,w,side),...generatorActions(m,w,side),...hothMoveActions(m,w,side),...creatureWeaponActions(m,w,side),...groundCreatureActions(m,w,side),...creatureActions(m,w,side),...slugActions(m,w,side),...asteroidActions(m,w,side),...sectorActions(m,w,side),...lostArtooActions(m,w,side),...fighterTroubleActions(m,w,side),...wedgeActions(m,w,side),...hyperEscapeActions(m,w,side),...tallonActions(m,w,side),...maneuverActions(m,w,side),...mobileActions(m,w,side),...starshipWeaponActions(m,w,side),...characterReactActions(m,w,side),...vehicleReactActions(m,w,side),...pilotDeployActions(m,w,side),...dockingActions(m,w,side),...transportActions(m,w,side),...vesselTravelActions(m,w,side),...vesselActions(m,w,side),...sunsdownActions(m,w,side),...labriaActions(m,w,side),...nobleActions(m,w,side),...telepathyActions(m,w,side),...darkPathActions(m,w,side),...insertActions(m,w,side),...offEdgeActions(m,w,side), ...edgeActions(m,w,side), ...stewActions(m,w,side), ...gravelActions(m,w,side), ...farmDeviceActions(m,w,side), ...characterDestinyActions(m,w,side), ...astromechActions(m,w,side), ...deployEffectActions(m,w,side), ...bactaActions(m,w,side), ...fxActions(m,w,side), ...medicActions(m,w,side), ...lightsaberActions(m,w,side), ...trooperAssaultActions(m,w,side), ...duelInterruptActions(m,w,side), ...phaseEffectActions(m,w,side), ...abilityEffectActions(m,w,side), ...battleEffectActions(m,w,side), ...forceEffectActions(m, w, side), ...cancellationActions(m, w, side), ...groundActions(m, w, side), ...battleActions(m, w, side), ...equipmentActions(m, w, side), ...travelActions(m, w, side), ...interruptActions(m, w, side), ...duelActions(m, w, side), ...revivalActions(m, w, side), ...assaultActions(m, w, side), ...accidentActions(m, w, side), ...stunActions(m, w, side), ...scanActions(m, w, side), ...scavengeActions(m, w, side), ...worseActions(m, w, side), ...doomedActions(m, w, side), ...stakesActions(m, w, side), ...gaderffiiActions(m, w, side), ...substitutionActions(m, w, side), ...gamblersLuckActions(m, w, side)].filter(a => {if(['battle:equip','saber:equip','gaffi:equip','space-weapon:equip','equipment:attach'].includes(a.handler)){const p=a.payload as {card:string;target:string};if(cardDefinition(m,p.card).type==='Weapon'&&!canCarryWeapon(m,p.target))return false;}const card = actionPlayCard(m, a); return !card || canPlayCard(m, card);}),
  initiate: (m, r, context) => {
    if(r.action.handler.startsWith('alien-search:')){alienSearchInitiate(m,r);return;}
    if(r.action.handler.startsWith('recruit:')){otsdRecruitInitiate(m,r);return;}
    const played = actionPlayCard(m, r.action);
    if (played) {if (!canPlayCard(m, played)) throw Error('Card play limit reached.'); recordCardPlay(m, played);}
    if(r.action.handler.startsWith('disarm:')){disarmInitiate(m,r);return;}
    if(r.action.handler.startsWith('service:')){serviceInitiate(m,r);return;}
    if(r.action.handler.startsWith('obi:')){obiWanInitiate(m,r);return;}
    if(r.action.handler.startsWith('mentor:')){mentorInitiate(m,r);return;}
    if(r.action.handler.startsWith('battle-add:')){battleInterruptInitiate(m,r);return;}
    if(r.action.handler.startsWith('compactor:')){compactorInitiate(m,r);return;}
    if(r.action.handler.startsWith('scomp:')){scompInitiate(m,r);return;}
    if(r.action.handler.startsWith('orders:')){ordersInitiate(m,r);return;}
    if(r.action.handler.startsWith('heavy:')){heavyWeaponInitiate(m,r);return;}
    if(r.action.handler.startsWith('generator:')){generatorInitiate(m,r);return;}
    if(r.action.handler.startsWith('hoth-move:'))return;
    if(r.action.handler.startsWith('asteroid:')){asteroidInitiate(m,r);return;}
    if(r.action.handler.startsWith('encounter:')){encounterInitiate(m,r,context);return;}
    if(r.action.handler.startsWith('creature:')){creatureInitiate(m,r,context);return;}
    if(r.action.handler.startsWith('creature-weapon:')){creatureWeaponInitiate(m,r);return;}
    if(r.action.handler.startsWith('ground-creature:')){groundCreatureInitiate(m,r);return;}
    if(r.action.handler.startsWith('slug:')){slugInitiate(m,r);return;}
    if(r.action.handler.startsWith('sector:')){sectorInitiate(m,r);return;}
    if(r.action.handler.startsWith('lost-artoo:')){lostArtooInitiate(m,r);return;}
    if (r.action.handler.startsWith('fighter-trouble:')) {fighterTroubleInitiate(m,r);return;}
    if (r.action.handler.startsWith('wedge:')) return;
    if (r.action.handler.startsWith('hyper-escape:')) {hyperEscapeInitiate(m,r);return;}
    if (r.action.handler.startsWith('ion-repair:')) return;
    if (r.action.handler.startsWith('mobile:')) return;
    if (r.action.handler.startsWith('space-weapon:')) {starshipWeaponInitiate(m,r);return;}
    if (r.action.handler.startsWith('anger:')) return;
    if (r.action.handler.startsWith('noble:')) {nobleInitiate(m,r);return;}
    if (r.action.handler.startsWith('telepathy:')) {telepathyInitiate(m,r);return;}
    if (r.action.handler.startsWith('game-text:') || r.action.handler.startsWith('character:') || r.action.handler.startsWith('plans:')) return;
    if (r.action.handler==='pair:deploy') {pilotDeployInitiate(m,r);return;}
    if (r.action.handler.startsWith('docking:')) return;
    if (r.action.handler.startsWith('transport:')) {transportInitiate(m,r);return;}
    if (r.action.handler.startsWith('character-react:')) {characterReactInitiate(m,r);return;}
    if (r.action.handler.startsWith('vehicle-react:')) {vehicleReactInitiate(m,r);return;}
    if (r.action.handler.startsWith('voyage:')) return;
    if (r.action.handler.startsWith('vessel:')) {vesselInitiate(m,r);return;}
    if (r.action.handler.startsWith('sunsdown:')) {sunsdownInitiate(m,r);return;}
    if (r.action.handler.startsWith('labria:')) labriaInitiate(m,r);
    if (r.action.handler.startsWith('dark-path:')) darkPathInitiate(m,r);
    else if (r.action.handler.startsWith('insert:')) insertInitiate(m,r);
    else if (r.action.handler.startsWith('stew:')) stewInitiate(m,r);
    else if (r.action.handler.startsWith('lars:')) larsInitiate(m,r);
    else if (r.action.handler.startsWith('power-droid:')) powerDroidInitiate(m,r);
    else if (r.action.handler.startsWith('fusion:')) fusionInitiate(m,r);
    else if (r.action.handler.startsWith('character-destiny:')) characterDestinyInitiate(m,r);
    else if (r.action.handler.startsWith('astromech:')) astromechInitiate(m,r);
    else if (r.action.handler.startsWith('deploy-effect:')) deployEffectInitiate(m,r);
    else if (r.action.handler.startsWith('bacta:')) bactaInitiate(m,r);
    else if (r.action.handler.startsWith('fx:')) fxInitiate(m,r);
    else if (r.action.handler.startsWith('medic:')) medicInitiate(m,r);
    else if (r.action.handler.startsWith('saber:')) lightsaberInitiate(m,r);
    else if (r.action.handler.startsWith('trooper-assault:')) trooperAssaultInitiate(m,r);
    else if (r.action.handler.startsWith('duel-interrupt:')) duelInterruptInitiate(m,r);
    else if (r.action.handler.startsWith('phase-effect:')) phaseEffectInitiate(m,r);
    else if (r.action.handler.startsWith('ability-effect:')) abilityEffectInitiate(m,r);
    else if (r.action.handler.startsWith('battle-effect:')) battleEffectInitiate(m,r);
    else if (r.action.handler.startsWith('force-effect:')) forceEffectInitiate(m, r);
    else if (r.action.handler.startsWith('cancel:')) cancellationInitiate(m, r);
    else if (r.action.handler.startsWith('gambler:')) gamblersLuckInitiate(m, r);
    else if (r.action.handler.startsWith('maneuver:')) maneuverInitiate(m,r);
    else if (r.action.handler.startsWith('tallon:')) tallonInitiate(m,r);
    else if (r.action.handler.startsWith('substitution:')) substitutionInitiate(m, r);
    else if (r.action.handler.startsWith('gaffi:')) gaderffiiInitiate(m, r);
    else if (r.action.handler.startsWith('stakes:')) stakesInitiate(m, r);
    else if (r.action.handler.startsWith('doomed:')) doomedInitiate(m, r);
    else if (r.action.handler.startsWith('worse:')) worseInitiate(m, r);
    else if (r.action.handler.startsWith('scavenge:')) scavengeInitiate(m, r);
    else if (r.action.handler.startsWith('scan:')) scanInitiate(m, r);
    else if (r.action.handler.startsWith('off-edge:')) offEdgeInitiate(m,r);
    else if (r.action.handler.startsWith('edge:')) edgeInitiate(m,r);
    else if (r.action.handler.startsWith('gravel:')) gravelInitiate(m,r);
    else if (r.action.handler.startsWith('stun:')) stunInitiate(m, r);
    else if (r.action.handler.startsWith('accident:')) accidentInitiate(m, r);
    else if (r.action.handler.startsWith('assault:')) assaultInitiate(m, r);
    else if (r.action.handler.startsWith('revival:')) revivalInitiate(m, r);
    else if (r.action.handler.startsWith('duel:')) duelInitiate(m, r);
    else if (r.action.handler.startsWith('interrupt:')) interruptInitiate(m, r);
    else if (r.action.handler.startsWith('travel:')) travelInitiate(m, r);
    else if (r.action.handler.startsWith('farm:')) farmDeviceInitiate(m,r);
    else if (r.action.handler.startsWith('equipment:')) equipmentInitiate(m, r);
    else if (r.action.handler.startsWith('battle:')) {
      const p = r.action.payload as {react?: boolean; card?: string};
      if (p.react) registerReact(m, p.card!);
      battleInitiate(m, r);
    } else {groundInitiate(m, r);beginHothDeployment(m,r);}
  },
  resolve: (m, r, context) => {
    if(r.action.handler.startsWith('disarm:')){disarmResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('service:')){serviceResolve(m,r);return;}
    if(r.action.handler.startsWith('obi:')){obiWanResolve(m,r);return;}
    if(r.action.handler.startsWith('mentor:')){mentorResolve(m,r,context);return;}
    if(r.action.handler.startsWith('battle-add:')){battleInterruptResolve(m,r);return;}
    if(r.action.handler.startsWith('compactor:')){compactorResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('scomp:')){scompResolve(m,r,context);return;}
    if(r.action.handler.startsWith('orders:')){ordersResolve(m,r);return;}
    if(r.action.handler.startsWith('alien-search:')){alienSearchResolve(m,r,context);return;}
    if(r.action.handler.startsWith('recruit:')){otsdRecruitResolve(m,r);return;}
    if(r.action.handler.startsWith('asteroid:')){asteroidResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('heavy:')){heavyWeaponResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('generator:')){generatorResolve(m,r);return;}
    if(r.action.handler.startsWith('blow-site:')){blownAwayResolve(m,r);return;}
    if(r.action.handler.startsWith('hoth-move:')){hothMoveResolve(m,r);return;}
    if(r.action.handler.startsWith('hoth:')){hothResolve(m,r,context);return;}
    if(r.action.handler.startsWith('encounter:')){encounterResolve(m,r);return;}
    if(r.action.handler.startsWith('creature:')){creatureResolve(m,r);return;}
    if(r.action.handler.startsWith('creature-weapon:')){creatureWeaponResolve(m,r);return;}
    if(r.action.handler.startsWith('ground-creature:')){groundCreatureResolve(m,r);return;}
    if(r.action.handler.startsWith('slug:')){slugResolve(m,r);return;}
    if(r.action.handler.startsWith('sector:')){sectorResolve(m,r);return;}
    if(r.action.handler.startsWith('lost-artoo:')){lostArtooResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('fighter-trouble:')){fighterTroubleResolve(m,r);return;}
    if(r.action.handler.startsWith('wedge:')){wedgeResolve(m,r,context);return;}
    if(r.action.handler.startsWith('hyper-escape:')){hyperEscapeResolve(m,r);syncBattle(m);return;}
    if(r.action.handler.startsWith('ion-repair:')){ionRepairResolve(m,r);return;}
    if (r.action.handler.startsWith('mobile:')) {mobileResolve(m,r);return;}
    if (r.action.handler.startsWith('space-weapon:')) {if(!resolveCancelledReact(m,r))starshipWeaponResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('anger:')) {angerResolve(m,r);return;}
    if (r.action.handler.startsWith('noble:')) {nobleResolve(m,r);syncBattle(m);syncForceLosses(m);return;}
    if (r.action.handler.startsWith('telepathy:')) {telepathyResolve(m,r);syncBattle(m);syncForceLosses(m);return;}
    if (r.action.handler==='pair:deploy') {pilotDeployResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('docking:')) {dockingResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('transport:')) {transportResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('character-react:') || r.action.handler==='ground:move' && (r.action.payload as {characterReact?:boolean})?.characterReact) {if(!resolveCancelledReact(m,r))characterReactResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('vehicle-react:')) {if(!resolveCancelledReact(m,r))vehicleReactResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('voyage:')) {vesselTravelResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('vessel:')) {vesselResolve(m,r);syncBattle(m);return;}
    if (r.action.handler.startsWith('sunsdown:')) {sunsdownResolve(m,r);return;}
    if (r.action.handler.startsWith('labria:')) {labriaResolve(m,r);return;}
    if (r.action.handler.startsWith('dark-path:')) {darkPathResolve(m,r);return;}
    if (r.action.handler.startsWith('insert:')) {insertResolve(m,r,context);syncBattle(m);syncForceLosses(m);return;}
    if (resolveCancelledReact(m, r)) { /* Shared cancellation owns react disposal and restrictions. */ }
    else if (r.action.handler.startsWith('stew:')) stewResolve(m,r);
    else if (r.action.handler.startsWith('lars:')) larsResolve(m,r);
    else if (r.action.handler.startsWith('game-text:')) gameTextResolve(m,r);
    else if (r.action.handler.startsWith('power-droid:')) powerDroidResolve(m,r);
    else if (r.action.handler.startsWith('fusion:')) fusionResolve(m,r);
    else if (r.action.handler.startsWith('character-destiny:')) characterDestinyResolve(m,r);
    else if (r.action.handler.startsWith('astromech:')) astromechResolve(m,r);
    else if (r.action.handler.startsWith('deploy-effect:')) deployEffectResolve(m,r);
    else if (r.action.handler.startsWith('bacta:')) bactaResolve(m,r);
    else if (r.action.handler.startsWith('forfeiture:')) forfeitureResolve(m,r);
    else if (r.action.handler.startsWith('fx:')) fxResolve(m,r);
    else if (r.action.handler.startsWith('medic:')) medicResolve(m,r);
    else if (r.action.handler.startsWith('saber:')) lightsaberResolve(m,r);
    else if (r.action.handler.startsWith('trooper-assault:')) trooperAssaultResolve(m,r);
    else if (r.action.handler.startsWith('duel-interrupt:')) duelInterruptResolve(m,r);
    else if (r.action.handler.startsWith('phase-effect:')) phaseEffectResolve(m,r);
    else if (r.action.handler.startsWith('ability-effect:')) abilityEffectResolve(m,r);
    else if (r.action.handler.startsWith('battle-effect:')) battleEffectResolve(m,r);
    else if (r.action.handler.startsWith('force-effect:')) forceEffectResolve(m, r);
    else if (r.action.handler.startsWith('cancel:')) cancellationResolve(m, r);
    else if (r.action.handler.startsWith('plans:')) secretPlansResolve(m, r);
    else if (r.action.handler.startsWith('gambler:')) gamblersLuckResolve(m, r);
    else if (r.action.handler.startsWith('maneuver:')) maneuverResolve(m,r);
    else if (r.action.handler.startsWith('tallon:')) tallonResolve(m,r);
    else if (r.action.handler.startsWith('substitution:')) substitutionResolve(m, r);
    else if (r.action.handler.startsWith('gaffi:')) gaderffiiResolve(m, r);
    else if (r.action.handler.startsWith('stakes:')) stakesResolve(m, r);
    else if (r.action.handler.startsWith('doomed:')) doomedResolve(m, r);
    else if (r.action.handler.startsWith('worse:')) worseResolve(m, r);
    else if (r.action.handler.startsWith('scavenge:')) scavengeResolve(m, r);
    else if (r.action.handler.startsWith('scan:')) scanResolve(m, r);
    else if (r.action.handler.startsWith('off-edge:')) offEdgeResolve(m,r);
    else if (r.action.handler.startsWith('edge:')) edgeResolve(m,r);
    else if (r.action.handler.startsWith('gravel:')) gravelResolve(m,r);
    else if (r.action.handler.startsWith('stun:')) stunResolve(m, r);
    else if (r.action.handler.startsWith('accident:')) accidentResolve(m, r);
    else if (r.action.handler.startsWith('assault:')) assaultResolve(m, r);
    else if (r.action.handler.startsWith('revival:')) revivalResolve(m, r);
    else if (r.action.handler.startsWith('duel:')) duelResolve(m, r);
    else if (r.action.handler.startsWith('character:')) characterResolve(m, r);
    else if (r.action.handler.startsWith('interrupt:')) interruptResolve(m, r, context);
    else if (r.action.handler.startsWith('retrieval:')) retrievalResolve(m, r, context);
    else if (r.action.handler.startsWith('travel:')) travelResolve(m, r, context);
    else if (r.action.handler.startsWith('selection:')) selectionResolve(m, r);
    else if (r.action.handler.startsWith('destiny:')) resolveDestiny(m, r);
    else if (r.action.handler.startsWith('farm:')) farmDeviceResolve(m,r);
    else if (r.action.handler.startsWith('equipment:')) equipmentResolve(m, r);
    else if (r.action.handler.startsWith('battle:')) battleResolve(m, r);
    else groundResolve(m, r);
    syncBattle(m);
    syncForceLosses(m);
  },
  decisions: (m, d) => {
    if(d.handler.startsWith('compactor:'))return compactorChoices(m,d);
    if(d.handler.startsWith('scomp:'))return scompChoices();
    if(d.handler.startsWith('orders:'))return ordersChoices(m,d);
    if(d.handler.startsWith('obi:'))return obiWanChoices(m,d);
    if(d.handler.startsWith('mentor:'))return mentorChoices(m,d);
    if(d.handler.startsWith('alien-search:'))return alienSearchChoices(m,d);
    if(d.handler.startsWith('hoth:'))return hothChoices(m,d);
    if(d.handler.startsWith('creature:'))return creatureChoices(m,d);
    if(d.handler.startsWith('character-react:'))return characterReactChoices(m,d);
    if(d.handler.startsWith('vehicle-react:'))return vehicleReactChoices(m,d);
    if (d.handler.startsWith('docking:')) return dockingChoices(m,d);
    if(d.handler==='capacity:used')return capacityChoices(m,d);
    if (d.handler.startsWith('noble:')) return nobleChoices(m,d);
    if (d.handler.startsWith('telepathy:')) return telepathyChoices(m,d);
    if (d.handler.startsWith('labria:')) return labriaChoices(m,d);
    if (d.handler.startsWith('dark-path:')) return darkPathChoices(m,d);
    if (d.handler.startsWith('insert:')) return insertChoices(m,d);
    if (d.handler.startsWith('off-edge:')) return offEdgeChoices(m,d);
    if (d.handler.startsWith('edge:')) return edgeChoices(m,d);
    if (d.handler.startsWith('stew:')) return stewChoices(m,d);
    if (d.handler === 'destiny:value') return destinyChoices(m,d);
    if (d.handler.startsWith('force-effect:')) return forceEffectChoices(m, d);
    if (d.handler.startsWith('plans:')) return secretPlansChoices(m, d);
    if (d.handler.startsWith('selection:')) return selectionChoices(m, d);
    if (d.handler.startsWith('scavenge:')) return scavengeChoices(m, d);
    if (d.handler.startsWith('scan:')) return scanChoices(m, d);
    if (d.handler.startsWith('accident:')) return accidentChoices(m, d);
    if (d.handler.startsWith('character:')) return characterChoices(m, d);
    if (d.handler.startsWith('retrieval:')) return retrievalChoices(m, d);
    if (d.handler.startsWith('wedge:')) return wedgeChoices(m,d);
    if (d.handler.startsWith('hyper-escape:')) return hyperEscapeChoices(m,d);
    if (d.handler.startsWith('travel:')) return travelChoices(m, d);
    if (d.handler.startsWith('equipment:')) return equipmentChoices(m, d);
    if (d.handler === 'table:lost-order') return tableChoices(m, d);
    if (d.handler === 'battle:destiny') return battleChoices(m, d);
    return groundDecisions(m, d);
  },
  choose: (m, d, c, context) => {
    if(d.handler.startsWith('compactor:')){compactorChoose(m,d,c);return;}
    if(d.handler.startsWith('scomp:')){scompChoose(m,d,c);return;}
    if(d.handler.startsWith('orders:')){ordersChoose(m,d,c);return;}
    if(d.handler.startsWith('obi:')){obiWanChoose(m,d,c);return;}
    if(d.handler.startsWith('mentor:')){mentorChoose(m,d,c);return;}
    if(d.handler.startsWith('alien-search:')){alienSearchChoose(m,d,c);return;}
    if(d.handler.startsWith('hoth:')){hothChoose(m,d,c);return;}
    if(d.handler.startsWith('creature:')){creatureChoose(m,d,c);return;}
    if(d.handler==='capacity:used'){capacityChoose(m,d,c);syncBattle(m);return;}
    if(d.handler.startsWith('wedge:')){wedgeChoose(m,d,c);return;}
    if(d.handler.startsWith('hyper-escape:')){hyperEscapeChoose(m,d,c);return;}
    if(d.handler.startsWith('character-react:')){characterReactChoose(m,d,c);syncBattle(m);return;}
    if(d.handler.startsWith('vehicle-react:')){vehicleReactChoose(m,d,c);syncBattle(m);return;}
    if (d.handler.startsWith('docking:')) {dockingChoose(m,d,c);syncBattle(m);return;}
    if (d.handler.startsWith('noble:')) {nobleChoose(m,d,c);syncBattle(m);syncForceLosses(m);return;}
    if (d.handler.startsWith('telepathy:')) {telepathyChoose(m,d,c);syncBattle(m);syncForceLosses(m);return;}
    if (d.handler.startsWith('labria:')) {labriaChoose(m,d,c);return;}
    if (d.handler.startsWith('dark-path:')) {darkPathChoose(m,d,c);return;}
    if (d.handler.startsWith('insert:')) {insertChoose(m,d,c);return;}
    if (d.handler.startsWith('off-edge:')) offEdgeChoose(m,d,c);
    else if (d.handler.startsWith('edge:')) edgeChoose(m,d,c);
    else if (d.handler.startsWith('stew:')) stewChoose(m,d,c);
    else if (d.handler === 'destiny:value') destinyChoose(m,d,c);
    else if (d.handler.startsWith('force-effect:')) forceEffectChoose(m, d, c);
    else if (d.handler.startsWith('plans:')) secretPlansChoose(m, d, c);
    else if (d.handler.startsWith('selection:')) selectionChoose(m, d, c);
    else if (d.handler.startsWith('scavenge:')) scavengeChoose(m, d, c);
    else if (d.handler.startsWith('scan:')) scanChoose(m, d, c);
    else if (d.handler.startsWith('accident:')) accidentChoose(m, d, c);
    else if (d.handler.startsWith('character:')) characterChoose(m, d, c);
    else if (d.handler.startsWith('retrieval:')) retrievalChoose(m, d, c);
    else if (d.handler.startsWith('travel:')) travelChoose(m, d, c, context);
    else if (d.handler.startsWith('equipment:')) equipmentChoose(m, d, c);
    else if (d.handler === 'table:lost-order') tableChoose(m, d, c);
    else if (d.handler === 'battle:destiny') battleChoose(m, d, c);
    else groundChoose(m, d, c);
    syncBattle(m);
    syncForceLosses(m);
  },
  canPass: battleCanPass,
  view: (m, seat, now) => ({...mentorView(m,seat),...serviceView(m,seat),...alienSearchView(m,seat),...heavyWeaponView(m),...fusionView(m),...artilleryView(m),...generatorView(m),...destructionView(m),...hothView(m),values: publicValues(m),...encounterView(m),...attackView(m),...slugView(m),...sectorsView(m),...asteroidView(m),...lostArtooView(m),...fighterTroubleView(m),...wedgeView(m,seat),...hyperEscapeView(m),...tallonView(m) as Record<string,Json>,...mobileView(m),...characterReactView(m),...vehicleReactView(m),...pilotDeployView(m),...dockingView(m),...vesselTravelView(m),...occupancyView(m),...nighttimeView(m),...labriaView(m) as Record<string,Json>,...angerView(m) as Record<string,Json>,...doomedView(m) as Record<string, Json>, ...scavengeView(m) as Record<string, Json>, ...scanView(m, seat) as Record<string, Json>, ...battleView(m) as Record<string, Json>, ...equipmentView(m, seat) as Record<string, Json>,...scompView(m,seat), ...darkPathView(m,seat) as Record<string,Json>, ...travelView(m, seat) as Record<string, Json>, ...retrievalView(m) as Record<string, Json>, ...duelView(m) as Record<string, Json>}),
  validate: match => {
    assertMentor(match);assertObiWan(match);assertBattleInterrupts(match);assertCompactor(match);assertService(match);assertScomp(match);assertOrders(match);assertAlienSearch(match);assertOtsdRecruits(match);
    assertPowerDroids(match);assertFusion(match);assertHeavyWeapons(match);assertGeneratorShots(match);assertBlownAway(match);assertHothMovement(match);assertHothDeployment(match);assertCreatureEncounters(match);assertCreatureWeapons(match);assertGroundCreatures(match);assertCreatureAttack(match);assertSpaceSlugs(match);assertSectors(match);assertSectorEffects(match);assertAsteroids(match);assertMobileSystems(match);assertOccupancy(match);assertVessels(match);
    assertVesselTravel(match);
    assertPilotDeploy(match);
    assertDocking(match);
    assertCharacterReact(match);
    assertVehicleReact(match);
    assertTransport(match);
    assertSunsdown(match);
    assertLabria(match);
    assertNoble(match);
    assertAnger(match);
    assertIonRepair(match);
    assertHyperEscape(match);
    assertWedge(match);
    assertFighterTrouble(match);assertLostArtoo(match);assertCapacityLoss(match);
    assertTelepathy(match);
    assertDarkPath(match);
    assertInsertEffects(match);
    assertOffEdge(match);
    assertEdge(match);
    assertStew(match);
    assertSearchPolicy(match);
    assertGameText(match);
    assertCharacterDestiny(match);
    assertLars(match);
    assertAstromech(match);
    assertDeployments(match);
    assertPhaseEffects(match);
    assertAbility(match);
    assertLocationAbility(match);
    assertAbilityEffects(match);
    assertBattleEffects(match);
    assertDisarm(match);
    assertForceEffects(match);
    assertSecretPlans(match);
    assertGround(match);
    assertEquipment(match); assertFarmDevices(match);
    assertTravel(match);
    assertDestiny(match);
    assertDestinySelection(match);
    assertSubstitution(match);
    assertGamblersLuck(match);
    assertRetrieval(match);
    assertCharacteristics(match);
    assertCardPlays(match);
    assertCancellation(match);
    assertInterrupts(match);
    assertCharacterTriggers(match);
    assertDuel(match);
    assertDuelModifiers(match);
    assertCombatModifiers(match);
    assertTallon(match); assertManeuvers(match); assertStatModifiers(match); assertMedics(match); assertFX(match); assertBacta(match); assertDeployEffects(match); assertForfeitures(match);
    assertLightsaber(match); assertForfeitResets(match);
    assertTrooperAssault(match);
    assertDuelInterrupts(match);
    assertRevival(match);
    assertAssault(match);
    assertAccident(match);
    assertStun(match); assertGravel(match);
    assertScan(match);
    assertScavenge(match);
    assertWorse(match);
    assertDoomed(match);
    assertStakes(match);
    assertGaderffii(match);
    assertWeaponUse(match);assertStarshipWeapons(match);
    assertBattle(match);
    assertLeaving(match);
    if (!citySitesTogether(match, match.locations)) throw Error('Mos Eisley sites must remain together.');
    if (new Set(match.locations.filter(id=>!sectorKind(match,id)&&!isCave(match,id)).map(id => name(match, id))).size !== match.locations.filter(id=>!sectorKind(match,id)&&!isCave(match,id)).length) throw Error('Duplicate active location identity.');
    const groups = new Set(match.locations.map(id => locationGroup(match, id)));
    for (const group of groups) {
      if (!group) throw Error('Location needs its rule metadata.');
      const indices = match.locations.map((id, i) => locationGroup(match, id) === group ? i : -1).filter(i => i >= 0);
      if (indices.some((i, n) => n > 0 && i !== indices[n - 1] + 1)) throw Error('A system must form one contiguous location group.');
      if (!locationOrder(match,indices.map(i=>match.locations[i]))) throw Error('Invalid interior/exterior site arrangement.');
    }
    for (const card of Object.values(match.cards)) {
      const def = cardDefinition(match, card.id);
      if (card.location && !match.locations.includes(card.location)) throw Error('Character or attachment refers to an inactive location.');
      if (card.zone === 'table' && def.type === 'Character' && (!card.location || !card.aboardRole && !isSite(match,card.location))) throw Error('A ground character needs its site.');
      if (card.coveredBy && (def.type !== 'Location' || !match.locations.includes(card.coveredBy) || name(match, card.id) !== name(match, card.coveredBy))) throw Error('Invalid supporting location.');
      if (card.zone === 'table' && def.type === 'Location' && !card.coveredBy && !match.locations.includes(card.id)) throw Error('Missing active location.');
      if (card.attachedTo && card.location !== ((artillery(match,card.id)||serviceBlueprint(card.blueprint))&&match.locations.includes(card.attachedTo)?card.attachedTo:match.cards[card.attachedTo].location)) throw Error('Attachment separated from its host.');
    }
  },
};
