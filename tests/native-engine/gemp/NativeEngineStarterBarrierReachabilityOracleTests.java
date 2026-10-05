package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled initial board, followed only by actual deployment, Barrier, battle and accident actions. */
public class NativeEngineStarterBarrierReachabilityOracleTests {
 @Test public void barrierThenFriendlyFire() throws Exception {
  var rows=new ArrayList<Map<String,Object>>();for(boolean extra:new boolean[]{false,true}) {
  var s=new VirtualTableScenario(new HashMap<>(Map.of("rebel","1_28","barrier","1_105","accident","1_80")),new HashMap<>(Map.of("raider","1_194","storm","1_194","gun","1_317","extra","1_194")),20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);var site=s.GetLSStartingLocation();var storm=s.GetDSCard("storm");var raider=s.GetDSCard("raider");var barrier=s.GetLSCard("barrier");var accident=s.GetLSCard("accident");
  s.MoveCardsToLocation(site,s.GetLSCard("rebel"),raider);if(extra)s.MoveCardsToLocation(site,s.GetDSCard("extra"));s.AttachCardsTo(raider,s.GetDSCard("gun"));s.MoveCardsToDSHand(storm);s.MoveCardsToLSHand(barrier,accident);s.DSActivateForceCheat(10);s.LSActivateForceCheat(10);s.PrepareLSDestiny(0);s.SkipToPhase(Phase.DEPLOY);
  if(!s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.LSPass();assertTrue(s.DSDeployAvailable(storm));s.DSDeployCard(storm);s.DSChooseCard(site);
  for(int i=0;i<60&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(barrier));i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(s.LSCardPlayAvailable(barrier));s.LSPlayCard(barrier);
  for(int i=0;i<60&&!s.GetLSUsedPile().contains(barrier);i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(storm))s.LSChooseCard(storm);else s.PlayerPass(s.GetDecidingPlayer());}
  assertTrue(s.GetLSUsedPile().contains(barrier));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  var menus=new ArrayList<Map<String,Object>>();boolean offered=false, sawBattleInitiated=false;
  for(int i=0;i<60;i++){
   var text=s.GetCurrentDecision().getText();if(text.contains("BATTLE_INITIATED") || text.startsWith("Battle just initiated"))sawBattleInitiated=true;var who=s.GetDecidingPlayer();String[] acts=s.GetCurrentDecision().getDecisionParameters().get("actionText");menus.add(Map.of("side",who.equals(VirtualTableScenario.LS)?"light":"dark","text",text,"actions",acts==null?List.of():Arrays.asList(acts)));
   if(who.equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(accident)){assertTrue(text.startsWith("Battle just initiated"));offered=true;break;}
   if(text.toLowerCase().contains("weapons segment")||text.toLowerCase().contains("battle destiny"))break;
   if(!text.toLowerCase().contains("optional")&&!text.toLowerCase().contains("response"))throw new AssertionError("Unrecognized boundary "+text);
   s.PlayerPass(who);
  }
  assertTrue("Actual battle-initiated response reached",sawBattleInitiated);assertEquals(extra,offered);assertFalse(s.gameState().getBattleState().getCardsParticipating(VirtualTableScenario.DS).contains(storm));
  int participants=s.gameState().getBattleState().getCardsParticipating(VirtualTableScenario.DS).stream().filter(c -> c.getBlueprint().getCardCategory() == CardCategory.CHARACTER).toList().size();assertEquals(extra?2:1,participants);
  boolean barredSelectable=false,activeSelectable=false;if(offered){s.LSPlayCard(accident);
   for(int i=0;i<120&&!s.GetLSLostPile().contains(accident);i++){
    var text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("optional")||text.contains("response")){s.PlayerPass(s.GetDecidingPlayer());continue;}
    if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)){
     barredSelectable|=s.DSHasCardChoiceAvailable(storm);activeSelectable|=s.DSHasCardChoiceAvailable(extra?s.GetDSCard("extra"):raider);boolean chosen=false;
     for(var c:List.of(storm,s.GetDSCard("extra"),raider,s.GetDSCard("gun")))if(s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);chosen=true;break;}
     if(!chosen)throw new AssertionError(text);
    }else throw new AssertionError(text);
   }
  }
  assertFalse(barredSelectable);assertEquals(extra,activeSelectable);assertTrue(storm.getAtLocation()==site);assertEquals(extra,s.GetLSLostPile().contains(accident));if(extra)assertTrue(s.GetDSLostPile().contains(s.GetDSCard("extra")));
  var row=new LinkedHashMap<String,Object>();row.put("case",extra?"two-active-plus-barred":"one-active-plus-barred");row.put("actualBattleInitiatedResponse",sawBattleInitiated);row.put("barrierPlayed",true);row.put("barrierUsed",true);row.put("darkParticipantsBeforeAccident",participants);row.put("barredParticipates",false);row.put("friendlyFireOffered",offered);row.put("barredSelectable",barredSelectable);row.put("activeSelectable",activeSelectable);row.put("barredStillAtSite",storm.getAtLocation()==site);row.put("interruptLost",s.GetLSLostPile().contains(accident));row.put("menus",menus);rows.add(row);
  }
  Files.writeString(Path.of("/opt/gemp-swccg/starter-timing-reachability-barrier-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
 }
}
