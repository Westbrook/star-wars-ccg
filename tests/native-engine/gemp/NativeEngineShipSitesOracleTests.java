package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.decisions.CardActionSelectionDecision;
import com.google.gson.GsonBuilder;
import org.junit.Test;import org.junit.AfterClass;
import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
/** Actual Launch Bay deployment and Tractor Beam use. Host/beam losses are
 * controlled effects, executed through the unchanged GEMP action stack. */
public class NativeEngineShipSitesOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/ship-sites-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{var text=s.GetCurrentDecision().getText();System.out.println("BAY "+s.GetDecidingPlayer()+" "+text);if(text.contains("Choose card to put on"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(VirtualTableScenario.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 void inject(VirtualTableScenario s,TopLevelGameTextAction a){var d=(CardActionSelectionDecision)s.GetCurrentDecision();int i=d.getDecisionParameters().get("actionId").length;d.addAction(a);s.PlayerDecided(s.GetDecidingPlayer(),String.valueOf(i));}
 void ready(VirtualTableScenario s,PhysicalCardImpl card){for(int i=0;i<120&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSDeployAvailable(card));i++)pass(s);assertTrue(s.DSDeployAvailable(card));}
 void bay(VirtualTableScenario s,String label){var bay=s.GetDSCard(label);ready(s,bay);s.DSDeployCard(bay);for(int i=0;i<100&&bay.getZone()!=Zone.LOCATIONS;i++){var text=s.GetCurrentDecision().getText();if(text.contains("On which side"))s.DSChoose("Right");else if(text.contains("starship")||text.contains("Starship"))s.DSChooseCard(s.GetDSCard("host"));else pass(s);}assertEquals(Zone.LOCATIONS,bay.getZone());}
 @Test public void shipSiteLifecycle(){for(String mode:List.of("release","two-bays","host-loss","late-bay")){
  var ls=new HashMap<String,String>(Map.of("ship","1_140","pilot","1_19","passenger","1_28","gun","1_152"));var ds=new HashMap<String,String>(Map.of("host","1_302","beam","2_115","bay","4_165","extra","4_165","high","1_241"));
  var s=new VirtualTableScenario(ls,ds,20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);
  var site=s.GetLSStartingLocation();var host=s.GetDSCard("host");var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var passenger=s.GetLSCard("passenger");var gun=s.GetLSCard("gun");var beam=s.GetDSCard("beam");var bay=s.GetDSCard("bay");var extra=s.GetDSCard("extra");s.MoveCardsToLocation(site,ship,host);s.AttachCardsTo(ship,pilot,passenger);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.gameState().moveCardToAttachedInPassengerCapacitySlot(passenger,ship);s.AttachCardsTo(pilot,gun);s.MoveCardsToDSHand(beam,bay,extra);s.SkipToPhase(Phase.DEPLOY);
  if(!mode.equals("late-bay")){bay(s,"bay");if(mode.equals("two-bays"))bay(s,"extra");}
  ready(s,beam);s.DSDeployCard(beam);if(beam.getAttachedTo()!=host)s.DSChooseCard(host);for(int i=0;i<100&&beam.getAttachedTo()!=host;i++)pass(s);assertSame(host,beam.getAttachedTo());s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  for(int i=0;i<160&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(beam));i++){if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromForcePile();else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromForcePile();else pass(s);}
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("high"));s.DSUseCardAction(beam);boolean choseBay=false;for(int i=0;i<120&&!ship.isCapturedStarship();i++){if(s.GetCurrentDecision().getText().contains("Capture starship under which card")){s.DSChooseCard(extra);choseBay=true;}else pass(s);}assertTrue(ship.isCapturedStarship());assertSame(mode.equals("late-bay")?host:mode.equals("two-bays")?extra:bay,ship.getAttachedTo());
  var row=new LinkedHashMap<String,Object>();row.put("name",mode);row.put("heldAtBay",ship.getAttachedTo()==bay||ship.getAttachedTo()==extra);row.put("choseBay",choseBay);row.put("beamOnShip",beam.getAttachedTo()==host);
  if(mode.equals("late-bay")){s.SkipToDSTurn(Phase.DEPLOY);bay(s,"bay");assertSame(host,ship.getAttachedTo());row.put("retainedOriginalCustody",true);rows.add(row);continue;}
  if(mode.equals("two-bays")){rows.add(row);continue;}
  s.SkipToPhase(Phase.MOVE);for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision() instanceof CardActionSelectionDecision);i++)pass(s);
  var loss=new TopLevelGameTextAction(beam,VirtualTableScenario.DS,beam.getCardId());loss.setText("Controlled holding-card loss");loss.appendEffect(new LoseCardFromTableEffect(loss,mode.equals("host-loss")?host:beam));inject(s,loss);
  if(mode.equals("host-loss")){for(int i=0;i<150&&!(s.GetDSLostPile().contains(bay)&&s.GetLSLostPile().contains(gun));i++)pass(s);row.put("bayLost",s.GetDSLostPile().contains(bay));row.put("shipLost",s.GetLSLostPile().contains(ship));row.put("gunLost",s.GetLSLostPile().contains(gun));}
  else{for(int i=0;i<120&&!s.GetCurrentDecision().getText().contains("Choose release option");i++)pass(s);s.LSChoose("Launch");for(int i=0;i<100&&ship.isCapturedStarship();i++){if(s.GetCurrentDecision().getText().contains("Choose where to launch"))s.LSChooseCard(site);else pass(s);}row.put("releasedAtSystem",!ship.isCapturedStarship()&&ship.getAtLocation()==site);}
  rows.add(row);
 }}
}
