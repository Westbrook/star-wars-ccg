package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.decisions.CardActionSelectionDecision;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled placement, then actual capture effect, required ship rules and
 * the real captured-crew mode of We Have A Prisoner. No production overrides. */
public class NativeEngineCapturedShipOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/captured-ship-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{var text=s.GetCurrentDecision().getText();if(text.contains("Choose card to put on"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(VirtualTableScenario.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 void inject(VirtualTableScenario s,TopLevelGameTextAction a){var d=(CardActionSelectionDecision)s.GetCurrentDecision();int index=d.getDecisionParameters().get("actionId").length;d.addAction(a);s.PlayerDecided(s.GetDecidingPlayer(),String.valueOf(index));}
 @Test public void capturedShipLifecycle(){for(String mode:List.of("crew","launch","escape","empty")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_140","pilot","1_19","passenger","1_28","gun","1_152")),new HashMap<>(Map.of("host","1_302","beam","2_115","card","2_142","escort","1_168")),20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var passenger=s.GetLSCard("passenger");var gun=s.GetLSCard("gun");var host=s.GetDSCard("host");var beam=s.GetDSCard("beam");var card=s.GetDSCard("card");var escort=s.GetDSCard("escort");
  s.MoveCardsToLocation(site,ship,host);s.AttachCardsTo(host,beam,escort);s.gameState().moveCardToAttachedInPilotCapacitySlot(escort,host);s.MoveCardsToDSHand(card);if(!mode.equals("empty")){s.AttachCardsTo(ship,pilot,passenger);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.gameState().moveCardToAttachedInPassengerCapacitySlot(passenger,ship);s.AttachCardsTo(pilot,gun);}
  var a=new TopLevelGameTextAction(beam,VirtualTableScenario.DS,beam.getCardId());a.setText("Capture controlled ship");a.appendEffect(new CaptureStarshipEffect(a,ship,beam));inject(s,a);
  for(int i=0;i<100&&!ship.isCapturedStarship()&&!ship.getOwner().equals(VirtualTableScenario.DS);i++)pass(s);
  assertTrue(ship.isCapturedStarship()||mode.equals("empty"));
  if(mode.equals("empty")){
   for(int i=0;i<100&&!ship.getOwner().equals(VirtualTableScenario.DS);i++)pass(s);
   for(int i=0;i<100&&ship.getAttachedTo()!=null;i++){if(s.GetCurrentDecision().getText().contains("Choose where to steal"))s.DSChooseCard(site);else pass(s);}
   assertEquals(VirtualTableScenario.DS,ship.getOwner());rows.add(Map.of("name",mode,"stolen",true,"captured",ship.isCapturedStarship(),"detached",ship.getAttachedTo()==null));continue;
  }
  int force=s.GetDSForcePileCount();
  if(mode.equals("crew")){
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(card));i++)pass(s);
   s.DSPlayCard(card);s.DSChooseCard(ship);boolean seized=false;
   for(int i=0;i<160&&!(s.GetDSLostPile().contains(card)&&ship.getOwner().equals(VirtualTableScenario.DS)&&ship.getAttachedTo()==null);i++){
    String t=s.GetCurrentDecision().getText();
    if(t.contains("Choose character to capture"))s.DSChooseCard(!pilot.isCaptive()?pilot:passenger);
    else if(t.contains("Choose option for capturing")){s.DSChoose(seized?"Escape":"Seize");seized=true;}
    else if(t.contains("escort"))s.DSChooseCard(escort);
    else if(t.contains("Choose where to steal"))s.DSChooseCard(site);
    else pass(s);
   }
   assertTrue(s.GetDSLostPile().contains(card));assertTrue(pilot.isCaptive());assertTrue(s.GetLSUsedPile().contains(passenger));assertEquals(VirtualTableScenario.DS,ship.getOwner());assertSame(pilot,gun.getAttachedTo());
   rows.add(Map.of("name",mode,"cost",force-s.GetDSForcePileCount(),"pilotCaptive",pilot.isCaptive(),"passengerUsed",s.GetLSUsedPile().contains(passenger),"gunAttached",gun.getAttachedTo()==pilot,"stolen",ship.getOwner().equals(VirtualTableScenario.DS),"captured",ship.isCapturedStarship()));
  }else{
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision() instanceof CardActionSelectionDecision);i++)pass(s);
   var loss=new TopLevelGameTextAction(beam,VirtualTableScenario.DS,beam.getCardId());loss.setText("Lose holding beam");loss.appendEffect(new LoseCardFromTableEffect(loss,beam));inject(s,loss);
   for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose release option");i++)pass(s);
   s.LSChoose(mode.equals("launch")?"Launch":"Escape");
   for(int i=0;i<120&&(ship.isCapturedStarship()||mode.equals("escape")&&!(s.GetLSUsedPile().contains(ship)&&s.GetLSUsedPile().contains(pilot)&&s.GetLSUsedPile().contains(passenger)&&s.GetLSUsedPile().contains(gun)));i++){
    if(s.GetCurrentDecision().getText().contains("Choose where to launch"))s.LSChooseCard(site);else pass(s);
   }
   assertFalse(ship.isCapturedStarship());rows.add(Map.of("name",mode,"shipUsed",s.GetLSUsedPile().contains(ship),"pilotUsed",s.GetLSUsedPile().contains(pilot),"passengerUsed",s.GetLSUsedPile().contains(passenger),"gunUsed",s.GetLSUsedPile().contains(gun),"gunAttached",gun.getAttachedTo()==pilot,"pilotAttached",pilot.getAttachedTo()==ship,"captured",ship.isCapturedStarship()));
  }
 }}

 @Test public void realTractorBeam(){for(int destiny:List.of(6,1)){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_140","pilot","1_19")),new HashMap<>(Map.of("host","1_302","beam","2_115")),20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var host=s.GetDSCard("host");var beam=s.GetDSCard("beam");s.MoveCardsToLocation(site,ship,host);s.AttachCardsTo(ship,pilot);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.MoveCardsToDSHand(beam);
  s.SkipToPhase(Phase.DEPLOY);int deployForce=s.GetDSForcePileCount();s.DSDeployCard(beam);s.DSChooseCard(host);
  for(int i=0;i<80&&beam.getAttachedTo()!=host;i++)pass(s);assertSame(host,beam.getAttachedTo());int deployCost=deployForce-s.GetDSForcePileCount();
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<120&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(beam));i++){
   if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());
   else if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromForcePile();
   else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromForcePile();else pass(s);
  }
  int force=s.GetDSForcePileCount();s.PrepareDSDestiny(destiny);s.DSUseCardAction(beam);
  assertTrue(s.gameState().isDuringUsingTractorBeam());
  for(int i=0;i<120&&s.gameState().isDuringUsingTractorBeam();i++)pass(s);
  assertFalse(s.gameState().isDuringUsingTractorBeam());
  if(destiny==6)for(int i=0;i<80&&!ship.isCapturedStarship();i++)pass(s);
  assertEquals(destiny==6,ship.isCapturedStarship());rows.add(Map.of("name","tractor-"+destiny,"deployCost",deployCost,"useCost",force-s.GetDSForcePileCount(),"captured",ship.isCapturedStarship()));
 }}
}
