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
public class NativeEngineDockingOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/docking-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("DOCK "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void dockMenu(VirtualTableScenario s){for(int i=0;i<80&&!s.DSDecisionAvailable("Perform a ship-docked action");i++)pass(s);assertTrue(s.DSDecisionAvailable("Perform a ship-docked action"));}
 void transfer(VirtualTableScenario s,PhysicalCardImpl c,String role){s.DSUseCardAction(c,"Transfer to other starship");for(int i=0;i<80&&!s.DSDecisionAvailable("Perform a ship-docked action");i++){if(s.DSDecisionAvailable("Choose capacity"))s.DSChoose(role);else pass(s);}dockMenu(s);}
 @Test public void docking(){for(String mode:List.of("none","crew","cargo","fighter","multiple","return")){
  var s=new VirtualTableScenario(new HashMap<>(),new HashMap<>(Map.of("a","1_302","b","1_302","crawler","1_309","driver","1_184","pilot","1_179","tie","1_305")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var planet=s.GetDSStartingLocation();var a=s.GetDSCard("a");var b=s.GetDSCard("b");var crawler=s.GetDSCard("crawler");var driver=s.GetDSCard("driver");var pilot=s.GetDSCard("pilot");var tie=s.GetDSCard("tie");s.MoveCardsToDSHand(a,b,crawler,driver,pilot,tie);s.DSActivateForceCheat(40);s.SkipToPhase(Phase.DEPLOY);var helper=new NativeEngineVesselsOracleTests();helper.deploy(s,a,planet,null);helper.deploy(s,b,planet,null);helper.deploy(s,crawler,site,null);helper.deploy(s,driver,crawler,"Driver");helper.deploy(s,pilot,a,"Pilot");helper.deploy(s,tie,a,"Starship");s.SkipToPhase(Phase.MOVE);var movement=new NativeEngineShuttleOracleTests();movement.move(s,crawler,a,"Shuttle","Vehicle");int before=s.GetDSForcePileCount();s.DSUseCardAction(a,"Ship-dock");
  for(int i=0;i<80&&!s.DSDecisionAvailable("Perform a ship-docked action");i++){if(s.DSDecisionAvailable("Choose starship to ship-dock"))s.DSChooseCard(b);else pass(s);}dockMenu(s);
  if(List.of("crew","multiple","return").contains(mode))transfer(s,pilot,"Passenger");
  if(List.of("cargo","multiple").contains(mode))transfer(s,crawler,"Vehicle");
  if(List.of("fighter","multiple").contains(mode))transfer(s,tie,"Starship");
  if(mode.equals("return"))transfer(s,pilot,"Pilot");
  s.DSPass();movement.menu(s);var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetDSForcePileCount());row.put("pilotOnSecond",pilot.getAttachedTo()==b);row.put("pilotSlot",pilot.isPilotOf());row.put("cargoOnSecond",crawler.getAttachedTo()==b);row.put("fighterOnSecond",tie.getAttachedTo()==b);row.put("driverInCargo",driver.getAttachedTo()==crawler);row.put("firstPower",s.GetPower(a));row.put("secondPower",s.GetPower(b));row.put("firstMoved",q.hasPerformedRegularMoveThisTurn(a));row.put("secondMoved",q.hasPerformedRegularMoveThisTurn(b));row.put("pilotMoved",q.hasPerformedRegularMoveThisTurn(pilot));row.put("cargoMoved",q.hasPerformedRegularMoveThisTurn(crawler));row.put("fighterMoved",q.hasPerformedRegularMoveThisTurn(tie));rows.add(row);
 }}
}
