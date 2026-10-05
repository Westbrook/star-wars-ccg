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
/** Controlled initial placement; actual Special Modifications/Tractor Beam
 * deployments, battle and Tractor Beam action. No injected action or override. */
public class NativeEngineTheftResponseOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/theft-response-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows)); }
 Map<String,Object> card(VirtualTableScenario s,PhysicalCard c){var r=new LinkedHashMap<String,Object>();r.put("blueprint",c.getBlueprintId(true));r.put("owner",c.getOwner());r.put("zone",c.getZone().name());r.put("attachedTo",c.getAttachedTo()==null?null:c.getAttachedTo().getBlueprintId(true));r.put("atLocation",c.getAtLocation()==null?null:c.getAtLocation().getBlueprintId(true));r.put("captured",c.isCapturedStarship());return r;}
 void pass(VirtualTableScenario s){var t=s.GetCurrentDecision().getText();if(t.contains("Choose card to put on"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(s.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void theftMenusAndEffectOwner(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_147","effect","1_65","alter","1_71","sense","1_109","shuffle","1_115","scan","1_113","reduce","1_90","escape","1_88")),new HashMap<>(Map.of("host","1_302","beam","2_115","alter","1_234","sense","1_267","shuffle","1_262","maneuver","1_241","prisoner","2_142","stun","1_268")),30,30,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(20);s.LSActivateForceCheat(20);
  var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var effect=s.GetLSCard("effect");var host=s.GetDSCard("host");var beam=s.GetDSCard("beam");s.MoveCardsToLocation(site,ship,host);
  for(var key:List.of("effect","alter","sense","shuffle","scan","reduce","escape"))s.MoveCardsToLSHand(s.GetLSCard(key));
  for(var key:List.of("beam","alter","sense","shuffle","maneuver","prisoner","stun"))s.MoveCardsToDSHand(s.GetDSCard(key));
  s.SkipToLSTurn(Phase.DEPLOY);s.LSDeployCard(effect);s.LSChooseCard(ship);for(int i=0;i<80&&effect.getAttachedTo()!=ship;i++)pass(s);assertSame(ship,effect.getAttachedTo());assertEquals(s.LS,effect.getOwner());
  s.SkipToDSTurn(Phase.DEPLOY);s.DSDeployCard(beam);s.DSChooseCard(host);for(int i=0;i<80&&beam.getAttachedTo()!=host;i++)pass(s);assertSame(host,beam.getAttachedTo());
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<160&&!(s.GetDecidingPlayer().equals(s.DS)&&s.DSCardActionAvailable(beam));i++){
   String t=s.GetCurrentDecision().getText();if(t.toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromForcePile();else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromForcePile();else pass(s);
  }
  assertTrue(s.DSCardActionAvailable(beam));s.PrepareDSDestiny(6);s.DSUseCardAction(beam);
  var trace=new ArrayList<Map<String,Object>>();boolean stolen=false;int stolenMenus=0;
  for(int i=0;i<160;i++){
   String t=s.GetCurrentDecision().getText();var d=new LinkedHashMap<String,Object>();d.put("text",t);d.put("side",s.GetDecidingPlayer());d.put("parameters",s.GetCurrentDecision().getDecisionParameters());d.put("ship",card(s,ship));d.put("effect",card(s,effect));trace.add(d);
   if(t.startsWith("STOLEN -")){stolen=true;stolenMenus++;assertEquals(s.DS,ship.getOwner());assertEquals(s.DS,effect.getOwner());assertSame(host,ship.getAttachedTo());}
   if(stolen&&ship.getAttachedTo()==null)break;
   pass(s);
  }
  assertEquals(2,stolenMenus);assertEquals(s.DS,ship.getOwner());assertEquals(s.DS,effect.getOwner());assertSame(ship,effect.getAttachedTo());assertNull(ship.getAttachedTo());
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(s.DS)&&s.DSCardActionAvailable(s.GetDSCard("shuffle")));i++)pass(s);
  assertTrue("Same shuffle card is actually legal after theft response closes",s.DSCardActionAvailable(s.GetDSCard("shuffle")));
  var baseline=new LinkedHashMap<String,Object>();baseline.put("text",s.GetCurrentDecision().getText());baseline.put("parameters",s.GetCurrentDecision().getDecisionParameters());
  rows.add(Map.of("positiveTopLevelBaseline",baseline,"name","special-modifications-owner-and-supported-response-menus","trace",trace,"finalShip",card(s,ship),"finalEffect",card(s,effect),"limitation","Controlled initial placements and prepared destiny 6; no complete match claim. Current GEMP changes attached Effect owner, in conflict with official rule retained by native."));
 }
}
