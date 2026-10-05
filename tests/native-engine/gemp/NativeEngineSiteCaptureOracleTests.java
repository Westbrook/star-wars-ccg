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
/** Controlled placement, real Death Star Tractor Beam deploy/use, and normal
 * disembark actions followed by mandatory stealing. No production overrides. */
public class NativeEngineSiteCaptureOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/site-capture-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{var text=s.GetCurrentDecision().getText();if(text.contains("Choose card to put on"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(VirtualTableScenario.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}


 @Test public void deathStarBeamAndDisembark(){for(String mode:List.of("miss","dark-bay","light-bay","guard","droid","contested","convert")){
  boolean lightBay=mode.equals("light-bay");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_140","pilot","1_19","passenger","1_28","gun","1_152","ally","1_13","bay","1_124")),new HashMap<>(Map.of("host","1_302","beam","2_111","guard","1_168","droid","1_175","first",mode.equals("miss")?"1_194":"1_241","second","1_194","bay","1_285")),20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("2_143"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);if(!s.gameState().getCurrentPlayerId().equals(VirtualTableScenario.DS))s.SkipToDSTurn(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);
  var site=s.GetDSStartingLocation();var bay=lightBay?s.GetLSCard("bay"):s.GetDSCard("bay");s.MoveLocationToTable(bay);var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var passenger=s.GetLSCard("passenger");var gun=s.GetLSCard("gun");var host=s.GetDSCard("host");var beam=s.GetDSCard("beam");
  s.MoveCardsToLocation(site,ship,host);s.AttachCardsTo(ship,pilot,passenger);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.gameState().moveCardToAttachedInPassengerCapacitySlot(passenger,ship);s.AttachCardsTo(pilot,gun);s.MoveCardsToDSHand(beam);
  if(mode.equals("guard")||mode.equals("contested"))s.MoveCardsToLocation(bay,s.GetDSCard("guard"));if(mode.equals("droid"))s.MoveCardsToLocation(bay,s.GetDSCard("droid"));if(mode.equals("contested"))s.MoveCardsToLocation(bay,s.GetLSCard("ally"));
  s.SkipToPhase(Phase.DEPLOY);int force=s.GetDSForcePileCount();s.DSDeployCard(beam);if(beam.getAttachedTo()!=bay&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSChooseCard(bay);for(int i=0;i<80&&beam.getAttachedTo()!=bay;i++)pass(s);assertSame(bay,beam.getAttachedTo());int deploy=force-s.GetDSForcePileCount();
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<120&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(beam));i++){
   if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromForcePile();else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromForcePile();else pass(s);
  }
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("second"),s.GetDSCard("first"));force=s.GetDSForcePileCount();s.DSUseCardAction(beam);assertTrue(s.gameState().isDuringUsingTractorBeam());for(int i=0;i<120&&s.gameState().isDuringUsingTractorBeam();i++)pass(s);
  if(!mode.equals("miss"))for(int i=0;i<80&&!ship.isCapturedStarship();i++)pass(s);
  var row=new LinkedHashMap<String,Object>();row.put("name",mode);row.put("deployCost",deploy);row.put("useCost",force-s.GetDSForcePileCount());row.put("captured",ship.isCapturedStarship());row.put("heldAtBay",ship.getAttachedTo()==bay);assertEquals(!mode.equals("miss"),ship.isCapturedStarship());
  if(mode.equals("miss")){rows.add(row);continue;}
  if(mode.equals("convert")){s.MoveCardsToLSHand(s.GetLSCard("bay"));s.SkipToLSTurn(Phase.DEPLOY);s.LSDeployCard(s.GetLSCard("bay"));for(int i=0;i<100&&ship.getAttachedTo()!=s.GetLSCard("bay");i++)pass(s);bay=s.GetLSCard("bay");assertSame(bay,ship.getAttachedTo());assertSame(bay,beam.getAttachedTo());row.put("conversionPreservesCustody",true);s.SkipToPhase(Phase.MOVE);}else s.SkipToLSTurn(Phase.MOVE);boolean available=s.LSCardActionAvailable(pilot,"Disembark");row.put("disembark",available);assertEquals(!List.of("guard","contested").contains(mode),available);
  if(available){
   int before=s.GetLSForcePileCount();s.LSUseCardAction(pilot,"Disembark");
   for(int i=0;i<100&&pilot.getAttachedTo()!=null;i++){if(s.GetCurrentDecision().getText().contains("Choose where to disembark"))s.LSChooseCard(bay);else pass(s);}
   assertNull(pilot.getAttachedTo());assertSame(pilot,gun.getAttachedTo());
   row.put("firstCost",before-s.GetLSForcePileCount());row.put("gunAttached",gun.getAttachedTo()==pilot);row.put("stillCaptured",ship.isCapturedStarship());
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(passenger,"Disembark"));i++)pass(s);
   s.LSUseCardAction(passenger,"Disembark");
   for(int i=0;i<150&&!(ship.getOwner().equals(VirtualTableScenario.DS)&&ship.getAttachedTo()==null);i++){String text=s.GetCurrentDecision().getText();if(text.contains("Choose where to disembark"))s.LSChooseCard(bay);else if(text.contains("Choose where to steal"))s.DSChooseCard(site);else pass(s);}
   assertEquals(VirtualTableScenario.DS,ship.getOwner());assertNull(passenger.getAttachedTo());row.put("stolenAfterLast",true);row.put("bothAtBay",pilot.getAtLocation()==bay&&passenger.getAtLocation()==bay);
  }
  rows.add(row);
 }}
}
