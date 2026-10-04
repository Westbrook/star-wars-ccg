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
public class NativeEngineHothOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/hoth-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void log(VirtualTableScenario s){System.out.println("HOTH "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("generator","3_61","ridge","3_62","trench","3_63"));var ds=new HashMap<String,String>(Map.of("ice","3_148","mountain","104_4","cave","3_150","trooper","1_194","wampa","3_93"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("3_59"),StartingSetup.DSStartingLocation("3_144"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");return s;}
 @Test public void generatorPrerequisite(){var s=fixture();s.MoveCardsToLSHand(s.GetLSCard("generator"));s.SkipToLSTurn(Phase.DEPLOY);s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("ridge"));s.LSDeployCard(s.GetLSCard("generator"));boolean selected=false,prior=false;
  for(int n=0;n<80;n++){log(s);String t=s.GetCurrentDecision().getText();if(t.contains("Choose Deploy action")&&s.GetLSCard("generator").getZone()==Zone.LOCATIONS)break;
   if(t.contains("Choose 4th Marker")){assertNotEquals(Zone.LOCATIONS,s.GetLSCard("generator").getZone());selected=true;s.LSChooseCard(s.GetLSCard("ridge"));}
   else if(t.startsWith("On which side"))s.LSChoose("Left");
   else if(t.startsWith("Choose where")){s.LSChooseCard(s.GetDSStartingLocation());}
   else s.PlayerPass(s.GetDecidingPlayer());
   if(s.GetLSCard("ridge").getZone()==Zone.LOCATIONS&&s.GetLSCard("generator").getZone()!=Zone.LOCATIONS)prior=true;
  }
  assertTrue(selected);assertTrue(prior);assertEquals(Zone.LOCATIONS,s.GetLSCard("generator").getZone());assertEquals(Zone.LOCATIONS,s.GetLSCard("ridge").getZone());rows.add(new LinkedHashMap<>(Map.of("case","normal-deployment","ridgeBeforeGenerator",prior,"generatorDeployed",true)));
 }
 @Test public void shieldBoundaries(){var s=fixture();s.MoveLocationToTable(s.GetLSCard("generator"));s.MoveLocationToTable(s.GetLSCard("ridge"));s.MoveLocationToTable(s.GetLSCard("trench"));for(String key:List.of("ice","mountain","cave"))s.MoveLocationToTable(s.GetDSCard(key));var flags=new LinkedHashMap<String,Boolean>();for(var c:List.of(s.GetLSStartingLocation(),s.GetLSCard("generator"),s.GetLSCard("trench"),s.GetDSStartingLocation(),s.GetLSCard("ridge"),s.GetDSCard("ice"),s.GetDSCard("mountain"),s.GetDSCard("cave")))flags.put(c.getBlueprintId(true),s.game().getModifiersQuerying().isLocationUnderHothEnergyShield(s.gameState(),c));assertEquals(List.of(true,true,true,true,false,false,false,false),new ArrayList<>(flags.values()));s.MoveOutOfPlay(s.GetLSCard("generator"));assertFalse(s.game().getModifiersQuerying().isLocationUnderHothEnergyShield(s.gameState(),s.GetDSStartingLocation()));rows.add(new LinkedHashMap<>(Map.of("case","shield-boundaries","shielded",flags,"afterGeneratorLeaves",false)));
 }
 @Test public void startingGenerator(){var s=new VirtualTableScenario(new HashMap<>(Map.of("ridge","3_62")),new HashMap<>(),55,55,StartingSetup.LSStartingLocation("3_61"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame(false);log(s);assertEquals(0,s.gameState().getHand(s.LS).size());if(s.GetCurrentDecision().getText().startsWith("Choose 4th Marker"))s.LSChooseCard(s.GetLSCard("ridge"));else assertEquals(Zone.LOCATIONS,s.GetLSCard("ridge").getZone());for(int n=0;n<30&&s.gameState().getHand(s.LS).isEmpty();n++){log(s);if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");else s.PlayerPass(s.GetDecidingPlayer());}assertEquals(8,s.gameState().getHand(s.LS).size());assertEquals(Zone.LOCATIONS,s.GetLSCard("ridge").getZone());rows.add(new LinkedHashMap<>(Map.of("case","starting-generator","openingHand",8,"ridgeDeployed",true)));}
 @Test public void shieldRestrictions(){var s=fixture();s.MoveLocationToTable(s.GetLSCard("generator"));s.MoveLocationToTable(s.GetLSCard("ridge"));var q=s.game().getModifiersQuerying();var g=s.gameState();var target=s.GetDSStartingLocation();var outer=s.GetLSCard("ridge");var trooper=s.GetDSCard("trooper");var creature=s.GetDSCard("wampa");var flags=new LinkedHashMap<String,Boolean>();flags.put("darkCharacterDeployment",q.isProhibitedFromDeployingTo(g,trooper,target,null));flags.put("creatureDeployment",q.isProhibitedFromDeployingTo(g,creature,target,null));flags.put("outerCharacterDeployment",q.isProhibitedFromDeployingTo(g,trooper,outer,null));flags.put("transitIn",q.mayNotMoveFromLocationToLocationUsingDockingBayTransit(g,trooper,outer,target));flags.put("transitOut",q.mayNotMoveFromLocationToLocationUsingDockingBayTransit(g,trooper,target,outer));assertEquals(List.of(true,false,false,true,true),new ArrayList<>(flags.values()));rows.add(new LinkedHashMap<>(Map.of("case","shield-restrictions","prohibited",flags)));}

}
