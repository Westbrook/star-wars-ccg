package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineStunOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/stun-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(boolean droid){
  return new VirtualTableScenario(new HashMap<>(Map.of("target",droid?"1_18":"1_28","other","1_28","gun","1_152")),new HashMap<>(Map.of("own","1_194","card","1_268","belt","1_207")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
 }
 private void run(boolean droid,int value,boolean battle,boolean outside,boolean gear){
  var s=fixture(droid);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(3);var site=s.GetLSStartingLocation();var target=s.GetLSCard("target");var own=s.GetDSCard("own");var card=s.GetDSCard("card");var gun=s.GetLSCard("gun");var belt=s.GetDSCard("belt");s.MoveCardsToLocation(outside?s.GetDSStartingLocation():site,target);s.MoveCardsToLocation(site,own);if(outside)s.MoveCardsToLocation(site,s.GetLSCard("other"));if(gear){s.AttachCardsTo(target,gun);s.AttachCardsTo(target,belt);}s.MoveCardsToDSHand(card);s.SkipToPhase(battle?Phase.BATTLE:Phase.CONTROL);
  if(battle){s.DSInitiateBattle(site);s.PassBattleStartResponses();}
  if(value<0)for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.PrepareDSDestiny(value);
  for(int i=0;i<20&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(card));i++)s.PlayerPass(s.GetDecidingPlayer());
  assertTrue(s.DSCardPlayAvailable(card));int force=s.GetDSForcePileCount();s.DSPlayCard(card);
  for(int i=0;i<120&&!s.GetDSLostPile().contains(card);i++){
   String text=s.GetCurrentDecision().getText().toLowerCase(),who=s.GetDecidingPlayer();
   if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}
   if(who.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(target)){s.DSChooseCard(target);continue;}
   throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue(s.GetDSLostPile().contains(card));if(battle&&!outside)for(int i=0;i<30&&s.gameState().isDuringBattle();i++)s.PlayerPass(s.GetDecidingPlayer());
  results.add(Map.of("name",(droid?"droid":"trooper")+"-"+value+"-"+(battle?outside?"outside":"battle":gear?"gear":"control"),"targetReturned",s.GetLSHand().contains(target),"gunReturned",gear&&s.GetLSHand().contains(gun),"beltReturned",gear&&s.GetDSHand().contains(belt),"forceSpent",force-s.GetDSForcePileCount(),"interruptLost",true,"battleContinues",s.gameState().isDuringBattle()));
 }
 @Test public void stunOutcomes(){for(boolean droid:new boolean[]{false,true})for(int value:new int[]{0,1,2,3,-1})run(droid,value,false,false,false);run(false,2,false,false,true);run(false,2,true,false,false);run(false,2,true,true,false);}
}
