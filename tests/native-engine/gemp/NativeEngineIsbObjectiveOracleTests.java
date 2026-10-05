package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;import org.junit.AfterClass;
import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
/** Actual starting Objective and mandatory flips; post-setup table and pile
 * changes are controlled fixtures. StartGame(false) preserves real opening hands. */
public class NativeEngineIsbObjectiveOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/isb-objective-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("ISB "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());if(s.GetCurrentDecision().getText().contains("Do you want to Pass?"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario setup(boolean missing){
  StartingSetup objective=new StartingSetup(){public HashMap<String,String> Cards(){var x=new HashMap<String,String>();x.put("objective","7_299");if(!missing)x.put("coruscant","12_166");return x;}public void Setup(VirtualTableScenario s){for(int i=0;i<50&&!s.GetDSCard("objective").isObjectiveDeploymentComplete()&&s.GetDSCard("objective").getZone()!=Zone.OUT_OF_PLAY;i++){var text=s.GetCurrentDecision().getText();if(!missing&&text.contains("Coruscant"))s.DSChooseCard(s.GetDSCard("coruscant"));else pass(s);}}};
  var s=new VirtualTableScenario(new HashMap<>(Map.of("echo","3_63","luke","1_19","han","1_11","leia","1_17")),new HashMap<>(Map.of("tarl","8_114","chall","106_11","yularen","1_166","veers","104_6","plain","3_144","hoth","3_143")),50,50,StartingSetup.LSStartingLocation("1_130"),objective,StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame(false);return s;
 }
 void flipped(VirtualTableScenario s,PhysicalCardImpl objective,boolean back){for(int i=0;i<120&&objective.isFlipped()!=back;i++)pass(s);assertEquals(back,objective.isFlipped());}
 @Test public void objective(){for(String mode:List.of("setup","missing","four-agents","two-bases","drains","retrieve","veers-restriction")){
  var s=setup(mode.equals("missing"));var obj=s.GetDSCard("objective");var veers=s.GetDSCard("veers");var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("objectiveZone",obj.getZone().toString());row.put("complete",obj.isObjectiveDeploymentComplete());row.put("openingDark",s.GetDSHand().size());row.put("openingLight",s.GetLSHand().size());var q=s.game().getModifiersQuerying();row.put("veersSpy",q.hasKeyword(s.gameState(),veers,Keyword.SPY));row.put("veersAgent",q.hasKeyword(s.gameState(),veers,Keyword.ISB_AGENT));
  if(mode.equals("setup")||mode.equals("missing")){rows.add(row);continue;}
  var bay=s.GetDSCard("coruscant");var a=s.GetLSCard("echo");var b=s.GetDSCard("plain");var system=s.GetDSCard("hoth");s.MoveLocationToTable(a);s.MoveLocationToTable(b);s.MoveLocationToTable(system);s.DSActivateForceCheat(10);
  if(mode.equals("veers-restriction")){s.MoveCardsToDSHand(veers);s.SkipToPhase(Phase.DEPLOY);s.DSDeployCard(veers);row.put("coruscantAllowed",s.DSHasCardChoiceAvailable(bay));rows.add(row);continue;}
  if(mode.equals("two-bases")){s.MoveCardsToLocation(a,s.GetDSCard("tarl"));s.MoveCardsToLocation(b,s.GetDSCard("chall"));}else for(String label:List.of("tarl","chall","yularen","veers"))s.MoveCardsToLocation(mode.equals("drains")?a:bay,s.GetDSCard(label));
  flipped(s,obj,true);row.put("flipped",obj.isFlipped());row.put("darkDrainAtAgent",q.getForceDrainAmount(s.gameState(),mode.equals("drains")?a:bay,DS));row.put("lightDrainRelatedSite",q.getForceDrainAmount(s.gameState(),b,LS));row.put("lightDrainRelatedSystem",q.getForceDrainAmount(s.gameState(),system,LS));
  if(mode.equals("retrieve")){s.MoveCardsToTopOfDSLostPile(veers);s.SkipToPhase(Phase.DRAW);s.DSUseCardAction(obj,"Retrieve");for(int i=0;i<60&&!s.GetDSUsedPile().contains(veers);i++){if(s.GetDecidingPlayer().equals(DS)&&s.DSHasCardChoiceAvailable(veers))s.DSChooseCard(veers);else pass(s);}row.put("retrievedToUsed",s.GetDSUsedPile().contains(veers));}
  if(mode.equals("four-agents")){for(String label:List.of("tarl","chall","yularen","veers"))s.MoveCardsToDSHand(s.GetDSCard(label));flipped(s,obj,false);row.put("flippedBack",!obj.isFlipped());row.put("remainderSpy",q.hasKeyword(s.gameState(),veers,Keyword.SPY));}
  rows.add(row);
 }}
}
