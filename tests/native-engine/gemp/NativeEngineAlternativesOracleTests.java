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
/** Real Card2_044 actions on controlled captured-ship fixtures. No source overrides. */
public class NativeEngineAlternativesOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/alternatives-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 boolean can(VirtualTableScenario s,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision() instanceof CardActionSelectionDecision&&s.LSCardActionAvailable(c);}
 void inject(VirtualTableScenario s,TopLevelGameTextAction a){var d=(CardActionSelectionDecision)s.GetCurrentDecision();int index=d.getDecisionParameters().get("actionId").length;d.addAction(a);s.PlayerDecided(s.GetDecidingPlayer(),String.valueOf(index));}
 @Test public void alternatives(){for(String mode:List.of("remote","battle","same-bay")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_140","pilot","1_19","passenger","1_28","gun","1_152","card","2_44","bay","1_129")),new HashMap<>(Map.of("host","1_302","beam",mode.equals("same-bay")?"2_111":"2_115","escort","1_168","bay","1_285")),20,20,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation(mode.equals("same-bay")?"2_143":"1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);
  var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var passenger=s.GetLSCard("passenger");var gun=s.GetLSCard("gun");var card=s.GetLSCard("card");var host=s.GetDSCard("host");var beam=s.GetDSCard("beam");var escort=s.GetDSCard("escort");var bay=mode.equals("same-bay")?s.GetDSCard("bay"):s.GetLSCard("bay");
  s.MoveLocationToTable(bay);s.MoveCardsToLocation(site,ship,host);s.AttachCardsTo(ship,pilot,passenger);s.gameState().moveCardToAttachedInPilotCapacitySlot(pilot,ship);s.gameState().moveCardToAttachedInPassengerCapacitySlot(passenger,ship);s.AttachCardsTo(pilot,gun);s.MoveCardsToLSHand(card);
  if(mode.equals("battle")){
   s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);for(int i=0;i<100&&!can(s,card);i++)pass(s);assertTrue(can(s,card));int force=s.GetLSForcePileCount();s.LSPlayCard(card);
   for(int i=0;i<120&&s.gameState().isDuringBattle();i++)pass(s);
   assertFalse(s.gameState().isDuringBattle());assertTrue(s.GetLSLostPile().contains(card));assertEquals(3,force-s.GetLSForcePileCount());rows.add(Map.of("mode",mode,"cost",3,"cardLost",true,"battleEnded",true));continue;
  }
  s.AttachCardsTo(mode.equals("same-bay")?bay:host,beam);if(mode.equals("same-bay"))s.MoveCardsToLocation(bay,escort);
  if(mode.equals("same-bay"))System.out.println("ATF weapon beforecapture zone="+gun.getZone()+" attached="+gun.getAttachedTo());
  var a=new TopLevelGameTextAction(beam,VirtualTableScenario.DS,beam.getCardId());a.setText("Capture controlled ship");a.appendEffect(new CaptureStarshipEffect(a,ship,beam));inject(s,a);
  for(int i=0;i<100&&!ship.isCapturedStarship();i++)pass(s);assertTrue(ship.isCapturedStarship());if(mode.equals("same-bay"))System.out.println("ATF weapon aftercapture zone="+gun.getZone()+" attached="+gun.getAttachedTo());
  for(int i=0;i<100&&!can(s,card);i++)pass(s);assertTrue(can(s,card));int force=s.GetLSForcePileCount();s.LSPlayCard(card);
  for(int i=0;i<180&&!(s.GetLSLostPile().contains(card)&&ship.getOwner().equals(VirtualTableScenario.DS)&&ship.getAttachedTo()==null);i++){
   String t=s.GetCurrentDecision().getText();if(mode.equals("same-bay"))System.out.println("ATF "+i+" "+s.GetDecidingPlayer()+" "+t+" pilot="+pilot.getZone()+" at="+pilot.getAtLocation()+" attached="+pilot.getAttachedTo()+" passenger="+passenger.getZone()+" at="+passenger.getAtLocation()+" shipOwner="+ship.getOwner());if(t.contains("Choose captured starship"))s.LSChooseCard(ship);else if(t.contains("Choose docking bay"))s.LSChooseCard(bay);else if(t.contains("Choose where to steal"))s.DSChooseCard(mode.equals("same-bay")?s.GetDSStartingLocation():site);else pass(s);
  }
  if(mode.equals("same-bay")){System.out.println("ATF weapon afterrelease zone="+gun.getZone()+" attached="+gun.getAttachedTo());rows.add(Map.of("mode","same-bay-observation","pilotReleased",pilot.getAtLocation()==bay&&pilot.getAttachedTo()==null,"passengerReleased",passenger.getAtLocation()==bay&&passenger.getAttachedTo()==null,"cardLost",s.GetLSLostPile().contains(card),"shipStolen",ship.getOwner().equals(VirtualTableScenario.DS),"gunAttached",gun.getAttachedTo()==pilot,"gunZone",gun.getZone().name(),"cost",force-s.GetLSForcePileCount()));}
  assertTrue(mode+" interruptLost",s.GetLSLostPile().contains(card));assertSame(mode+" pilotAtBay",bay,pilot.getAtLocation());assertSame(mode+" passengerAtBay",bay,passenger.getAtLocation());assertNull(mode+" pilotDetached",pilot.getAttachedTo());assertNull(mode+" passengerDetached",passenger.getAttachedTo());assertSame(mode+" weaponAttached",pilot,gun.getAttachedTo());assertEquals(mode+" shipStolen",VirtualTableScenario.DS,ship.getOwner());assertEquals(mode+" free",force,s.GetLSForcePileCount());
  rows.add(Map.of("mode",mode,"cost",0,"crewReleased",true,"gunAttached",true,"cardLost",true,"shipStolen",true,"regularMoveUsed",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(pilot)));
 }}
}
