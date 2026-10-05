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
/** Real deploy/move/cancel/capture actions from controlled placement. */
public class NativeEngineCentralCoreOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/central-core-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{var text=s.GetCurrentDecision().getText();System.out.println("CORE "+s.GetDecidingPlayer()+" "+text+" "+s.GetCurrentDecision().getDecisionParameters());if(text.contains("Choose card to put on"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(VirtualTableScenario.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(){
  var ls=new HashMap<String,String>(Map.of("ship","1_140","pilot","1_19","passenger","1_28","gun","1_152","hero","1_13"));
  var ds=new HashMap<String,String>(Map.of("host","1_302","beam","2_111","secondBeam","2_111","guard","1_168","first","1_241","second","1_194","bay","1_285","core","1_283","wrong","1_232"));
  var s=new VirtualTableScenario(ls,ds,20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("2_143"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);if(!s.gameState().getCurrentPlayerId().equals(VirtualTableScenario.DS))s.SkipToDSTurn(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);s.MoveLocationToTable(s.GetDSCard("core"));s.MoveLocationToTable(s.GetDSCard("bay"));s.MoveCardsToDSHand(s.GetDSCard("beam"),s.GetDSCard("wrong"));return s;
 }
 @Test public void pricesAndDrain(){for(String mode:List.of("unoccupied","dark","light","contested")){
  var s=fixture();var core=s.GetDSCard("core");if(List.of("dark","contested").contains(mode))s.MoveCardsToLocation(core,s.GetDSCard("guard"));if(List.of("light","contested").contains(mode))s.MoveCardsToLocation(core,s.GetLSCard("hero"));s.SkipToPhase(Phase.DEPLOY);
  float drain=s.game().getModifiersQuerying().getForceDrainAmount(s.gameState(),core,VirtualTableScenario.LS);int before=s.GetDSForcePileCount();var wrong=s.GetDSCard("wrong");s.DSDeployCard(wrong);for(int i=0;i<100&&wrong.getZone()!=Zone.SIDE_OF_TABLE;i++)pass(s);assertEquals(Zone.SIDE_OF_TABLE,wrong.getZone());rows.add(Map.of("name",mode,"drain",drain,"wrongCost",before-s.GetDSForcePileCount()));
 }}
 @Test public void cancelDeployment(){var s=fixture();s.MoveCardsToLocation(s.GetDSCard("core"),s.GetLSCard("hero"));s.SkipToPhase(Phase.DEPLOY);int before=s.GetDSForcePileCount();var beam=s.GetDSCard("beam");s.DSDeployCard(beam);if(beam.getAttachedTo()!=s.GetDSCard("bay")&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSChooseCard(s.GetDSCard("bay"));for(int i=0;i<120&&!s.GetDSLostPile().contains(beam);i++)pass(s);assertTrue(s.GetDSLostPile().contains(beam));rows.add(Map.of("name","deploy-canceled","beamLost",true,"cost",before-s.GetDSForcePileCount()));}
 @Test public void cancelCapturedShip(){for(String mode:List.of("launch","escape","two-beams")){
  var s=fixture();var site=s.GetDSStartingLocation();var bay=s.GetDSCard("bay");var core=s.GetDSCard("core");var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var passenger=s.GetLSCard("passenger");var gun=s.GetLSCard("gun");var beam=s.GetDSCard("beam");var extra=s.GetDSCard("secondBeam");
  s.MoveCardsToLocation(site,ship,s.GetDSCard("host"));s.AttachCardsTo(ship,pilot,passenger);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.gameState().moveCardToAttachedInPassengerCapacitySlot(passenger,ship);s.AttachCardsTo(pilot,gun);s.MoveCardsToLocation(bay,s.GetLSCard("hero"));s.SkipToPhase(Phase.DEPLOY);s.DSDeployCard(beam);if(beam.getAttachedTo()!=bay&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSChooseCard(bay);for(int i=0;i<80&&beam.getAttachedTo()!=bay;i++)pass(s);assertSame(bay,beam.getAttachedTo());
  if(mode.equals("two-beams"))s.AttachCardsTo(bay,extra);
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<120&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(beam));i++){if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromForcePile();else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromForcePile();else pass(s);}
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("second"),s.GetDSCard("first"));s.DSUseCardAction(beam);for(int i=0;i<120&&!ship.isCapturedStarship();i++)pass(s);assertTrue(ship.isCapturedStarship());s.SkipToLSTurn(Phase.MOVE);s.LSMoveCard(s.GetLSCard("hero"),core);
  boolean heldAfterFirst=false;
  for(int i=0;i<180&&!s.GetCurrentDecision().getText().contains("Choose release option");i++){
   if(mode.equals("two-beams")&&(s.GetDSLostPile().contains(beam)^s.GetDSLostPile().contains(extra))){assertTrue(ship.isCapturedStarship());heldAfterFirst=true;}
   if(s.GetCurrentDecision().getText().contains("Target card to cancel"))s.LSChooseCard(s.GetDSLostPile().contains(beam)?extra:beam);else pass(s);
  }
  assertTrue(s.GetDSLostPile().contains(beam));if(mode.equals("two-beams")){assertTrue(s.GetDSLostPile().contains(extra));assertTrue(heldAfterFirst);}s.LSChoose(mode.equals("escape")?"Escape":"Launch");
  for(int i=0;i<160&&(ship.isCapturedStarship()||(!mode.equals("escape")&&ship.getAtLocation()!=site)||(mode.equals("escape")&&!s.GetLSUsedPile().contains(gun)));i++){if(s.GetCurrentDecision().getText().contains("Choose where to launch"))s.LSChooseCard(site);else pass(s);}
  rows.add(Map.of("name",mode,"beamLost",s.GetDSLostPile().contains(beam),"extraLost",s.GetDSLostPile().contains(extra),"heldAfterFirst",heldAfterFirst,"captured",ship.isCapturedStarship(),"atSystem",ship.getAtLocation()==site,"shipUsed",s.GetLSUsedPile().contains(ship),"gunUsed",s.GetLSUsedPile().contains(gun),"gunAttached",gun.getAttachedTo()==pilot));
 }}
}
