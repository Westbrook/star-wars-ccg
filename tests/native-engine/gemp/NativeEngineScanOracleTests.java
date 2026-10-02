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
public class NativeEngineScanOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/scan-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void run(String mode){
  boolean noRebel=mode.equals("no-rebel"),battle=mode.equals("battle"),lightTurn=mode.equals("light-turn"),decline=mode.equals("decline");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("trooper","1_28","luke","101_2","alien","1_30","droid","1_18","barrier","1_105","fighter","1_28")),new HashMap<>(Map.of("card","1_266","fighter","1_194")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();if(lightTurn)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(5);s.LSActivateForceCheat(3);
  for(var c:new ArrayList<>(s.GetLSHand()))s.MoveCardsToTopOfLSReserveDeck((PhysicalCardImpl)c);
  var card=s.GetDSCard("card");var trooper=s.GetLSCard("trooper");var luke=s.GetLSCard("luke");s.MoveCardsToDSHand(card);s.MoveCardsToLSHand(s.GetLSCard("alien"),s.GetLSCard("droid"),s.GetLSCard("barrier"));if(!noRebel)s.MoveCardsToLSHand(trooper,luke);
  if(battle)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("fighter"),s.GetDSCard("fighter"));s.SkipToPhase(battle?Phase.BATTLE:Phase.CONTROL);if(battle){s.DSInitiateBattle(s.GetLSStartingLocation());s.PassBattleStartResponses();}
  for(int i=0;i<20&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(card));i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(s.DSCardPlayAvailable(card));int force=s.GetDSForcePileCount(),hand=s.GetLSHandCount();s.DSPlayCard(card);boolean inspected=false,offered=false;int viewed=0;
  for(int i=0;i<150&&!s.GetDSUsedPile().contains(card);i++){
   String text=s.GetCurrentDecision().getText().toLowerCase(),who=s.GetDecidingPlayer();
   if(text.equals("opponent's hand")){assertEquals(VirtualTableScenario.DS,who);inspected=true;viewed=s.GetCurrentDecision().getDecisionParameters().get("blueprintId").length;assertEquals(hand,viewed);s.DSChooseCards();continue;}
   if(text.contains("do you want to place a rebel")){offered=true;if(decline)s.DSChooseNo();else s.DSChooseYes();continue;}
   if(text.contains("choose rebel")){s.DSChooseCard(mode.equals("luke")?luke:trooper);continue;}
   if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}
   throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue(s.GetDSUsedPile().contains(card));var target=mode.equals("luke")?luke:trooper;
  results.add(Map.of("name",mode,"inspected",inspected,"viewedCount",viewed,"selectionOffered",offered,"handRemoved",hand-s.GetLSHandCount(),"trooperUsed",s.GetLSUsedPile().contains(trooper),"lukeUsed",s.GetLSUsedPile().contains(luke),"selectedOnTop",!noRebel&&!decline&&s.GetLSUsedPile().getFirst()==target,"forceSpent",force-s.GetDSForcePileCount(),"interruptUsed",true));
 }
 @Test public void scanningOutcomes(){for(var mode:List.of("trooper","luke","decline","no-rebel","battle","light-turn"))run(mode);}
}
