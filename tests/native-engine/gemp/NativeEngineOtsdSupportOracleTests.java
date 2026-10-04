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
public class NativeEngineOtsdSupportOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/otsd-support-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario fixture(boolean dark,Map<String,String> cards){var s=new VirtualTableScenario(dark?new HashMap<>():new HashMap<>(cards),dark?new HashMap<>(cards):new HashMap<>(),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);return s;}
 @Test public void recruit(){for(boolean dark:List.of(false,true))for(boolean leader:List.of(false,true)){
  var s=fixture(dark,Map.of("source",dark?"106_16":"106_6","trooper",dark?"1_194":"1_28","leader",dark?"1_179":"1_8"));var source=dark?s.GetDSCard("source"):s.GetLSCard("source");var troop=dark?s.GetDSCard("trooper"):s.GetLSCard("trooper");var lead=dark?s.GetDSCard("leader"):s.GetLSCard("leader");var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,troop);if(leader)s.MoveCardsToLocation(site,lead);s.MoveCardsToHand(source);if(dark)s.SkipToDSTurn(Phase.DEPLOY);else s.SkipToLSTurn(Phase.DEPLOY);int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();if(dark)s.DSDeployCard(source);else s.LSDeployCard(source);
  for(int i=0;i<100&&source.getAtLocation()!=site;i++){if(dark&&(s.DSDecisionAvailable("Choose target")||s.DSDecisionAvailable("Choose where")))s.DSChooseCard(site);else if(!dark&&(s.LSDecisionAvailable("Choose target")||s.LSDecisionAvailable("Choose where")))s.LSChooseCard(site);else pass(s);}assertEquals(site,source.getAtLocation());int cost=before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount());String text=dark?"Add 1 to an Imperial's power":"Add 1 to a Rebel's power";
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&(dark?s.DSCardActionAvailable(source,text):s.LSCardActionAvailable(source,text)));i++)pass(s);int power=s.GetPower(troop);if(dark){s.DSUseCardAction(source,text);s.DSChooseCard(troop);}else{s.LSUseCardAction(source,text);s.LSChooseCard(troop);}for(int i=0;i<100&&s.GetPower(troop)==power;i++)pass(s);assertEquals(power+1,s.GetPower(troop));rows.add(Map.of("kind","recruit","dark",dark,"leader",leader,"cost",cost,"powerBonus",s.GetPower(troop)-power,"clearsAttrition",s.game().getModifiersQuerying().isSatisfyAllAttritionWhenForfeited(s.gameState(),source)));
 }}
 @Test public void alien(){for(boolean dark:List.of(false,true)){
  var s=fixture(dark,Map.of("source",dark?"106_11":"106_1","target",dark?"1_196":"1_31"));var source=dark?s.GetDSCard("source"):s.GetLSCard("source");var target=dark?s.GetDSCard("target"):s.GetLSCard("target");var site=s.GetLSStartingLocation();s.MoveCardsToHand(source);if(dark)s.SkipToDSTurn(Phase.DEPLOY);else s.SkipToLSTurn(Phase.DEPLOY);if(dark)s.MoveCardsToTopOfDSReserveDeck(target);else s.MoveCardsToTopOfLSReserveDeck(target);if(dark)s.DSDeployCard(source);else s.LSDeployCard(source);
  for(int i=0;i<100&&source.getAtLocation()!=site;i++){if(dark&&(s.DSDecisionAvailable("Choose target")||s.DSDecisionAvailable("Choose where")))s.DSChooseCard(site);else if(!dark&&(s.LSDecisionAvailable("Choose target")||s.LSDecisionAvailable("Choose where")))s.LSChooseCard(site);else pass(s);}assertEquals(site,source.getAtLocation());
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&(dark?s.DSCardActionAvailable(source):s.LSCardActionAvailable(source)));i++)pass(s);if(dark)s.DSUseCardAction(source);else s.LSUseCardAction(source);
  for(int i=0;i<100&&!(s.GetCurrentDecision().getText().toLowerCase().contains("choose")&&s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS));i++)pass(s);
  if(dark)s.DSChooseCard(target);else s.LSChooseCard(target);for(int i=0;i<100&&!(dark?s.GetDSHand():s.GetLSHand()).contains(target);i++)pass(s);assertTrue((dark?s.GetDSHand():s.GetLSHand()).contains(target));rows.add(Map.of("kind","search","dark",dark,"target",target.getBlueprintId(false),"inHand",true));
 }}
}
