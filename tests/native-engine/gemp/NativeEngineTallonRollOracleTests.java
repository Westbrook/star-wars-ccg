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
public class NativeEngineTallonRollOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/tallon-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 boolean can(VirtualTableScenario s,boolean dark,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(dark?s.DSCardPlayAvailable(c):s.LSCardPlayAvailable(c));}
 void pass(VirtualTableScenario s){System.out.println("TALLON "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 void play(VirtualTableScenario s,boolean dark,PhysicalCardImpl c,PhysicalCardImpl target){for(int i=0;i<100&&!can(s,dark,c);i++)pass(s);assertTrue(can(s,dark,c));if(dark)s.DSPlayCard(c);else s.LSPlayCard(c);for(int i=0;i<100&&!(dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(c);i++){if(s.GetCurrentDecision().getText().contains("Choose starfighter")){if(dark)s.DSChooseCard(target);else s.LSChooseCard(target);}else pass(s);}assertTrue((dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(c));}
 @Test public void tallon(){for(String mode:List.of("tie","dark-win","light-win","failed-dark","failed-light","both-fail","slip","slip-few","dark-maneuvers","reduce","unpiloted","leave-before","leave-after","leave-after-high","leave-failed-dark","battle")){
  System.out.println("MODE "+mode);boolean dFail=mode.equals("leave-failed-dark")||mode.equals("failed-dark")||mode.equals("both-fail"),lFail=mode.equals("failed-light")||mode.equals("both-fail");
  var ls=new HashMap<String,String>(Map.of("ship",mode.equals("unpiloted")?"1_144":"1_147","slip","2_47","few","1_70","han","1_11","d",mode.equals("leave-after-high")?"1_70":(mode.equals("dark-win")||mode.equals("battle"))||mode.equals("failed-dark")?"1_28":"1_115"));var ds=new HashMap<String,String>(Map.of("tie","1_300","pilot","1_179","roll","1_270","maneuver","1_241","d",(mode.equals("dark-win")||mode.equals("battle"))?"1_317":"1_194"));
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var ship=s.GetLSCard("ship");var tie=s.GetDSCard("tie");var pilot=s.GetDSCard("pilot");var roll=s.GetDSCard("roll");s.MoveCardsToLocation(s.GetLSStartingLocation(),ship,tie);s.BoardAsPilot(tie,pilot);if(mode.equals("light-win"))s.BoardAsPilot(ship,s.GetLSCard("han"));s.MoveCardsToDSHand(roll,s.GetDSCard("maneuver"));s.MoveCardsToLSHand(s.GetLSCard("slip"),s.GetLSCard("few"));s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);s.SkipToDSTurn(Phase.CONTROL);
  if(mode.equals("reduce"))play(s,false,s.GetLSCard("slip"),tie);
  if(dFail)for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d"));if(lFail)for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);else s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("d"));
  if(mode.equals("battle")){s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("weapons segment");i++)pass(s);}
  for(int i=0;i<100&&!can(s,true,roll);i++)pass(s);assertTrue(can(s,true,roll));s.DSPlayCard(roll);
  for(int i=0;i<20&&(s.GetCurrentDecision().getText().contains("Choose your starfighter")||s.GetCurrentDecision().getText().contains("Choose opponent's starfighter"));i++){if(s.GetCurrentDecision().getText().contains("your starfighter"))s.DSChooseCard(tie);else s.DSChooseCard(ship);}
  if(mode.startsWith("slip"))play(s,false,s.GetLSCard("slip"),ship);
  if(mode.equals("leave-before")||mode.equals("leave-failed-dark"))s.MoveCardsToLSHand(ship);
  if(mode.equals("dark-maneuvers"))play(s,true,s.GetDSCard("maneuver"),tie);
  if(mode.equals("slip-few"))play(s,false,s.GetLSCard("few"),ship);
  if(mode.startsWith("leave-after")){for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("DESTINY_DRAWN")&&!s.GetCurrentDecision().getText().contains("Just drew");i++)pass(s);s.MoveCardsToLSHand(ship);}
  for(int i=0;i<200&&!s.GetDSUsedPile().contains(roll);i++){
   if(s.GetCurrentDecision().getText().toLowerCase().contains("lost pile")&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null){if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSChooseCard(s.DSHasCardChoiceAvailable(tie)?tie:pilot);else s.LSChooseCard(s.LSHasCardChoiceAvailable(ship)?ship:s.GetLSCard("han"));}else pass(s);
  }assertTrue(s.GetDSUsedPile().contains(roll));var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("darkLost",s.GetDSLostPile().contains(tie));row.put("lightLost",s.GetLSLostPile().contains(ship));row.put("pilotLost",s.GetDSLostPile().contains(pilot));row.put("darkDrew",!dFail&&s.GetDSUsedPile().contains(s.GetDSCard("d")));row.put("lightDrew",!lFail&&s.GetLSUsedPile().contains(s.GetLSCard("d")));row.put("slipUsed",s.GetLSUsedPile().contains(s.GetLSCard("slip")));row.put("maneuverUsed",s.GetDSUsedPile().contains(s.GetDSCard("maneuver")));row.put("fewUsed",s.GetLSUsedPile().contains(s.GetLSCard("few")));row.put("rollUsed",true);rows.add(row);
 }}
}
