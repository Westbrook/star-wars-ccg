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
public class NativeEngineNamedSectorOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/named-sector-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("city","5_77","site","5_79","ship","1_147","big","4_82","field","4_81","field2","4_81","cave","4_83","rebel","1_11")),new HashMap<>(Map.of("pilot","1_179","ship","1_305","trooper","1_194","cave","4_157","big","4_156","field","4_155")),55,55,StartingSetup.LSStartingLocation("5_76"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.MoveLocationToTable(s.GetLSCard("city"));s.MoveLocationToTable(s.GetLSCard("site"));return s;}
 @Test public void bespin(){for(String mode:List.of("empty","light","dark","contested")){
  var s=fixture();var p=s.GetLSStartingLocation();if(mode.equals("light")||mode.equals("contested"))s.MoveCardsToLocation(p,s.GetLSCard("ship"));if(mode.equals("dark")||mode.equals("contested")){s.MoveCardsToLocation(p,s.GetDSCard("ship"));s.BoardAsPilot(s.GetDSCard("ship"),s.GetDSCard("pilot"));}
  var q=s.game().getModifiersQuerying();var pilot=s.GetDSCard("trooper");float cost=q.getDeployCost(s.gameState(),pilot,pilot,s.GetLSCard("site"),false,null,false,0,null,false);
  rows.add(Map.of("mode","bespin-"+mode,"cost",cost));
 }}
 @Test public void bigOne(){for(boolean owner:List.of(true,false)){
  var s=fixture();for(String k:List.of("field","field2","big","cave"))s.MoveLocationToTable(s.GetLSCard(k));var big=s.GetLSCard("big");if(owner)s.MoveCardsToLocation(big,s.GetLSCard("ship"));else {s.MoveCardsToLocation(big,s.GetDSCard("ship"));s.BoardAsPilot(s.GetDSCard("ship"),s.GetDSCard("pilot"));}
  var q=s.game().getModifiersQuerying();rows.add(Map.of("mode",owner?"big-owner":"big-opponent","drain",q.getForceDrainAmount(s.gameState(),big,owner?s.LS:s.DS)));
 }}
 @Test public void city(){var s=fixture();PhysicalCardImpl city=s.GetLSCard("city"),ship=s.GetLSCard("ship"),site=s.GetLSCard("site");s.MoveCardsToLocation(city,ship);var q=s.game().getModifiersQuerying();rows.add(Map.of("mode","city-stats","power",q.getPower(s.gameState(),ship),"maneuver",q.getManeuver(s.gameState(),ship)));

 s.MoveCardsToLocation(site,s.GetLSCard("rebel"),s.GetDSCard("trooper"));s.DSActivateForceCheat(10);s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(site);
 for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(s.AwaitingLSWeaponsSegmentActions());
 rows.add(Map.of("mode","city-battle","power",q.getTotalPowerAtLocation(s.gameState(),site,s.LS,true,false)));

 }
 @Test public void conversion(){for(String kind:List.of("cave","big","field")){var s=fixture();s.MoveLocationToTable(s.GetLSCard("field"));s.MoveLocationToTable(s.GetLSCard("big"));s.MoveLocationToTable(s.GetLSCard("cave"));PhysicalCardImpl old=s.GetLSCard(kind),convert=s.GetDSCard(kind);s.MoveCardsToDSHand(convert);s.DSActivateForceCheat(10);s.SkipToDSTurn(Phase.DEPLOY);s.DSDeployCard(convert);
  for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose Deploy action");i++){var t=s.GetCurrentDecision().getText();System.out.println("NAMED "+s.GetDecidingPlayer()+" "+t+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));if(t.startsWith("On which side"))s.DSChoose("Convert");else if(t.contains("Choose system"))s.DSChooseCard(s.GetLSStartingLocation());else if(t.contains("Choose where"))s.PlayerDecided(s.GetDecidingPlayer(),"0");else s.PlayerPass(s.GetDecidingPlayer());}
  assertTrue(s.GetCurrentDecision().getText().contains("Choose Deploy action"));assertEquals(Zone.CONVERTED_LOCATIONS,old.getZone());assertEquals(Zone.LOCATIONS,convert.getZone());rows.add(Map.of("mode",kind+"-conversion","converted",true));
 }}
}
