package com.gempukku.swccgo.rules.devices;

import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Component boards use actual weapon, Talz, Old Ben, Timer Mine and Kintan actions.
 * Fixture placement/pile preparation is explicit; production source remains unchanged. */
public class NativeEngineStarterCompoundOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/starter-compound-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){
  try {if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
  catch(Throwable e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}
 }
 boolean light(VirtualTableScenario s){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS);}
 boolean dark(VirtualTableScenario s){return s.GetDecidingPlayer().equals(VirtualTableScenario.DS);}
 VirtualTableScenario start(Map<String,String> ls,Map<String,String> ds){
  var s=new VirtualTableScenario(new HashMap<>(ls),new HashMap<>(ds),25,25,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();return s;
 }
 @Test public void talzThenOldBen(){
  var ds=new HashMap<>(Map.of("gun","1_317","die","1_317"));for(int i=0;i<10;i++)ds.put("trooper"+i,"1_194");
  var s=start(Map.of("target","1_28","talz","1_31","ben","1_100"),ds);s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(8);s.LSActivateForceCheat(5);
  var site=s.GetLSStartingLocation();var target=s.GetLSCard("target");var talz=s.GetLSCard("talz");var ben=s.GetLSCard("ben");var gun=s.GetDSCard("gun");
  s.MoveCardsToLocation(site,target,talz);for(int i=0;i<10;i++)s.MoveCardsToLocation(site,s.GetDSCard("trooper"+i));s.AttachCardsTo(s.GetDSCard("trooper0"),gun);s.MoveCardsToLSHand(ben);
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<100&&!(dark(s)&&s.DSCardActionAvailable(gun,"Fire"));i++)pass(s);
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);
  for(int i=0;i<100&&!target.isHit();i++)pass(s);assertTrue(target.isHit());
  for(int i=0;i<150&&!(light(s)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(talz,"restore"));i++)pass(s);
  int before=s.GetUnpaidLSBattleDamage(),force=s.GetLSForcePileCount();int value=s.GetForfeit(talz);s.LSUseCardAction(talz,"restore");if(light(s)&&s.LSHasCardChoiceAvailable(target))s.LSChooseCard(target);
  for(int i=0;i<100&&!(light(s)&&s.LSCardPlayAvailable(ben));i++)pass(s);
  assertTrue(s.LSCardPlayAvailable(ben));assertTrue(target.isHit());assertTrue(s.GetLSLostPile().contains(talz));int paid=s.GetUnpaidLSBattleDamage();assertEquals(Math.max(0,before-value),paid);
  s.LSPlayCard(ben);for(int i=0;i<100&&!s.GetLSLostPile().contains(ben);i++){
   if(light(s)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.LSHasCardChoiceAvailable(talz))s.LSChooseCard(talz);else pass(s);
  }
  assertEquals(Zone.AT_LOCATION,talz.getZone());assertTrue(target.isHit());assertFalse(s.gameState().getBattleState().isCardParticipatingInBattle(talz));
  for(int i=0;i<100&&target.isHit();i++)pass(s);
  assertFalse(target.isHit());assertEquals(paid,s.GetUnpaidLSBattleDamage());assertEquals(force-1,s.GetLSForcePileCount());
  results.add(Map.of("name","talz-old-ben","damageBefore",before,"damageAfter",paid,"forfeit",value,"returned",talz.getAtLocation()==site,"returnedParticipating",s.gameState().getBattleState().isCardParticipatingInBattle(talz),"targetRestored",!target.isHit(),"targetParticipating",s.gameState().getBattleState().isCardParticipatingInBattle(target),"forceSpent",force-s.GetLSForcePileCount(),"interruptLost",s.GetLSLostPile().contains(ben)));
 }
 @Test public void mineThenKintanBetweenCasualties(){
  var s=start(Map.of("one","1_28","two","1_28","three","1_28"),Map.of("mine","1_322","kintan","1_254","retrieve","1_194","die","1_186"));
  s.SkipToLSTurn(Phase.DRAW);s.DSActivateForceCheat(4);var site=s.GetLSStartingLocation();var mine=s.GetDSCard("mine");var one=s.GetLSCard("one");var two=s.GetLSCard("two");var three=s.GetLSCard("three");var kintan=s.GetDSCard("kintan");var retrieve=s.GetDSCard("retrieve");
  s.MoveCardsToLocation(site,mine,one,two,three);s.MoveCardsToDSHand(kintan);s.MoveCardsToTopOfDSLostPile(retrieve);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));int force=s.GetDSForcePileCount();
  s.SkipToDSTurn();for(int i=0;i<150&&!(dark(s)&&s.DSCardPlayAvailable(kintan));i++){
   if(light(s)&&s.LSHasCardChoiceAvailable(two))s.LSChooseCard(two);else if(light(s)&&s.LSHasCardChoiceAvailable(one))s.LSChooseCard(one);else if(light(s)&&s.LSHasCardChoiceAvailable(three))s.LSChooseCard(three);else pass(s);
  }
  assertTrue(s.DSCardPlayAvailable(kintan));assertTrue(s.GetLSLostPile().contains(two));assertEquals(Zone.AT_LOCATION,one.getZone());assertEquals(Zone.AT_LOCATION,three.getZone());assertEquals(Zone.AT_LOCATION,mine.getZone());
  s.DSPlayCard(kintan);for(int i=0;i<100&&!s.GetDSLostPile().contains(kintan);i++){if(dark(s)&&s.DSHasCardChoiceAvailable(retrieve))s.DSChooseCard(retrieve);else pass(s);}
  assertEquals(Zone.HAND,retrieve.getZone());assertEquals(Zone.AT_LOCATION,one.getZone());assertEquals(Zone.AT_LOCATION,three.getZone());assertEquals(Zone.AT_LOCATION,mine.getZone());
  for(int i=0;i<150&&!s.GetDSLostPile().contains(mine);i++){if(light(s)&&s.LSHasCardChoiceAvailable(three))s.LSChooseCard(three);else if(light(s)&&s.LSHasCardChoiceAvailable(one))s.LSChooseCard(one);else pass(s);}
  assertTrue(s.GetDSLostPile().contains(mine));assertTrue(s.GetLSLostPile().contains(one));assertTrue(s.GetLSLostPile().contains(three));
  results.add(Map.of("name","mine-kintan","retrievedBetweenCasualties",true,"remainingCasualtiesBeforeResume",2,"minePresentDuringRetrieval",true,"allVictimsLost",s.GetLSLostPile().containsAll(List.of(one,two,three)),"mineLost",s.GetDSLostPile().contains(mine),"forceSpent",force-s.GetDSForcePileCount(),"interruptLost",s.GetDSLostPile().contains(kintan),"retrieved",s.GetDSHand().contains(retrieve)));
 }
}
