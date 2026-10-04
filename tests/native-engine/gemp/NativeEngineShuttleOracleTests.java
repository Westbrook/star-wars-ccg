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
/** Actual deploy and shuttle/embark actions; starting locations and opponent board are fixtures. */
public class NativeEngineShuttleOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/shuttle-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("SHUTTLE "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void menu(VirtualTableScenario s){for(int i=0;i<80&&!s.DSDecisionAvailable("Choose Move action");i++)pass(s);assertTrue(s.DSDecisionAvailable("Choose Move action"));}
 void move(VirtualTableScenario s,PhysicalCardImpl card,PhysicalCardImpl target,String action,String role){menu(s);s.DSUseCardAction(card,action);for(int i=0;i<100;i++){
  if(target.getBlueprint().getCardCategory()==CardCategory.LOCATION?card.getAtLocation()==target:card.getAttachedTo()==target)break;
  if(s.DSDecisionAvailable("Choose capacity"))s.DSChoose(role);else if(s.DSDecisionAvailable("Choose where"))s.DSChooseCard(target);else pass(s);
 }assertTrue(target.getBlueprint().getCardCategory()==CardCategory.LOCATION?card.getAtLocation()==target:card.getAttachedTo()==target);menu(s);}
 @Test public void shuttle(){for(String mode:List.of("vehicle-up","empty-up","vehicle-down","character-up","character-down","bridge","cargo-battle","tie-deploy","tie-launch")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("corvette","1_140")),new HashMap<>(Map.of("carrier","1_302","crawler","1_309","driver","1_184","pilot","1_179","tie","1_305")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var planet=s.GetDSStartingLocation();var carrier=s.GetDSCard("carrier");var crawler=s.GetDSCard("crawler");var driver=s.GetDSCard("driver");var pilot=s.GetDSCard("pilot");var tie=s.GetDSCard("tie");s.MoveCardsToDSHand(carrier,crawler,driver,pilot,tie);s.DSActivateForceCheat(20);s.SkipToPhase(Phase.DEPLOY);var helper=new NativeEngineVesselsOracleTests();helper.deploy(s,carrier,planet,null);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);
  if(mode.startsWith("tie")){
   int before=s.GetDSForcePileCount();helper.deploy(s,tie,carrier,"Starship");row.put("deploymentCost",before-s.GetDSForcePileCount());s.SkipToPhase(Phase.MOVE);before=s.GetDSForcePileCount();if(mode.equals("tie-launch"))move(s,tie,planet,"Disembark",null);row.put("cost",before-s.GetDSForcePileCount());row.put("cargo",tie.getAttachedTo()==carrier);row.put("power",s.GetPower(tie));row.put("moved",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(tie));rows.add(row);continue;
  }
  if(mode.startsWith("character")){helper.deploy(s,pilot,site,null);}else{helper.deploy(s,crawler,site,null);if(!mode.equals("empty-up"))helper.deploy(s,driver,crawler,"Driver");}
  s.SkipToPhase(Phase.MOVE);int before=s.GetDSForcePileCount();
  if(mode.startsWith("character"))move(s,pilot,carrier,"Shuttle","Pilot");else move(s,crawler,carrier,"Shuttle","Vehicle");
  if(mode.endsWith("down")){s.SkipToLSTurn(Phase.MOVE);s.SkipToDSTurn(Phase.MOVE);before=s.GetDSForcePileCount();move(s,mode.startsWith("character")?pilot:crawler,site,"Shuttle",null);}
  if(mode.equals("bridge")){before=s.GetDSForcePileCount();move(s,driver,carrier,"Disembark","Passenger");}
  row.put("cost",before-s.GetDSForcePileCount());var q=s.game().getModifiersQuerying();row.put("systemAbility",q.getTotalAbilityAtLocation(s.gameState(),DS,planet));row.put("carrierPower",s.GetPower(carrier));
  if(mode.startsWith("character")){row.put("aboard",pilot.getAttachedTo()==carrier);row.put("moved",q.hasPerformedRegularMoveThisTurn(pilot));}
  else{row.put("cargo",crawler.getAttachedTo()==carrier);row.put("vehiclePower",s.GetPower(crawler));row.put("crewInVehicle",driver.getAttachedTo()==crawler);row.put("vehicleMoved",q.hasPerformedRegularMoveThisTurn(crawler));row.put("crewMoved",q.hasPerformedRegularMoveThisTurn(driver));}
  if(mode.equals("cargo-battle")){s.MoveCardsToLocation(planet,s.GetLSCard("corvette"));s.SkipToLSTurn(Phase.BATTLE);s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(planet);for(int i=0;i<60&&!s.DSDecisionAvailable("Choose weapons segment action");i++)pass(s);row.put("carrierBattles",s.gameState().isParticipatingInBattle(carrier));row.put("cargoBattles",s.gameState().isParticipatingInBattle(crawler));row.put("crewBattles",s.gameState().isParticipatingInBattle(driver));}
  rows.add(row);
 }}
}
