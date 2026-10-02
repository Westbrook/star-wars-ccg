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
public class NativeEngineAccidentOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/accident-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(boolean light,boolean droid){
  var ls=new HashMap<>(Map.of("a","1_28","b",droid&&!light?"1_18":"1_28","card","1_80","gun","1_152","belt","1_40"));
  var ds=new HashMap<>(Map.of("a","1_194","b",droid&&light?"1_186":"1_194","card","1_237","gun","1_317","belt","1_207"));
  return new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
 }
 @Test public void accidentOutcomes(){for(boolean light:new boolean[]{true,false})for(int value:new int[]{0,1,2,3,-1,9}){
  boolean armed=value==9;int draw=armed?0:value;var s=fixture(light,armed);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);var site=s.GetLSStartingLocation();
  var a=light?s.GetDSCard("a"):s.GetLSCard("a");var b=light?s.GetDSCard("b"):s.GetLSCard("b");var own=light?s.GetLSCard("a"):s.GetDSCard("a");var gun=light?s.GetDSCard("gun"):s.GetLSCard("gun");var belt=light?s.GetDSCard("belt"):s.GetLSCard("belt");var card=light?s.GetLSCard("card"):s.GetDSCard("card");
  s.MoveCardsToLocation(site,a,b,own);s.AttachCardsTo(a,gun);if(armed)s.AttachCardsTo(a,belt);if(light)s.MoveCardsToLSHand(card);else s.MoveCardsToDSHand(card);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<25&&!(s.GetDecidingPlayer().equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS)&&(light?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card)));i++)s.PlayerPass(s.GetDecidingPlayer());
  if(draw<0){for(var c:new ArrayList<>(light?s.GetLSReserveDeck():s.GetDSReserveDeck())){if(light)s.MoveCardsToLSHand((PhysicalCardImpl)c);else s.MoveCardsToDSHand((PhysicalCardImpl)c);}}else if(light)s.PrepareLSDestiny(draw);else s.PrepareDSDestiny(draw);
  int force=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSPlayCard(card);else s.DSPlayCard(card);
  for(int i=0;i<150&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(card);i++){
   var text=s.GetCurrentDecision().getText().toLowerCase();var who=s.GetDecidingPlayer();if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}
   boolean chosen=false;for(var c:new PhysicalCardImpl[]{armed?a:b,gun,belt}){if(who.equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);chosen=true;break;}if(who.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);chosen=true;break;}}if(!chosen)throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue((light?s.GetLSLostPile():s.GetDSLostPile()).contains(card));if(armed)for(int i=0;i<30&&s.gameState().isDuringBattle();i++)s.PlayerPass(s.GetDecidingPlayer());
  var lost=light?s.GetDSLostPile():s.GetLSLostPile();results.add(Map.of("name",(light?"light":"dark")+"-"+(armed?"armed":String.valueOf(draw)),"firstLost",lost.contains(a),"secondLost",lost.contains(b),"gunLost",lost.contains(gun),"beltLost",lost.contains(belt),"interruptLost",true,"forceSpent",force-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()),"battleContinues",s.gameState().isDuringBattle()));
 }}
}
