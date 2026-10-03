package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineBattleCourageOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/battle-courage-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(boolean beginner){var ls=new HashMap<>(Map.of("hero",beginner?"101_2":"1_19","card","5_41","troop","1_28"));var ds=new HashMap<>(Map.of("hero",beginner?"101_5":"1_168","card","5_141","troop","1_194"));var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("hero"),s.GetDSCard("hero"));s.MoveCardsToLSHand(s.GetLSCard("card"));s.MoveCardsToDSHand(s.GetDSCard("card"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassAllResponses();return s;}
 private boolean can(VirtualTableScenario s,boolean light){return s.GetDecidingPlayer().equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS)&&(light?s.LSCardPlayAvailable(s.GetLSCard("card")):s.DSCardPlayAvailable(s.GetDSCard("card")));}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private Map<String,Object> stats(VirtualTableScenario s,boolean light,String name){var h=light?s.GetLSCard("hero"):s.GetDSCard("hero");var q=s.game().getModifiersQuerying();return new LinkedHashMap<>(Map.of("name",name,"ability",q.getAbility(s.gameState(),h),"power",q.getPower(s.gameState(),h),"battleAbility",q.getAbilityForBattleDestiny(s.gameState(),h),"immunity",q.getImmunityToAttritionLessThan(s.gameState(),h),"sourceLost",(light?s.GetLSLostPile():s.GetDSLostPile()).contains(light?s.GetLSCard("card"):s.GetDSCard("card"))));}
 @Test public void actualInterrupts(){for(boolean light:new boolean[]{false,true})for(String mode:new String[]{"normal","ability-change","immunity-gone"}){
  var s=fixture(false);for(int i=0;i<8&&!can(s,light);i++)pass(s);assertTrue(can(s,light));var h=light?s.GetLSCard("hero"):s.GetDSCard("hero");var c=light?s.GetLSCard("card"):s.GetDSCard("card");if(light)s.LSPlayCard(c);else s.DSPlayCard(c);
  if(s.GetCurrentDecision().getText().contains("Choose Vader")||s.GetCurrentDecision().getText().contains("Choose Skywalker")){if(light)s.LSChooseCard(h);else s.DSChooseCard(h);}
  if(mode.equals("ability-change"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetDSStartingLocation(),h,2.5f));
  if(mode.equals("immunity-gone"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelImmunityToAttritionModifier(s.GetDSStartingLocation(),h));
  for(int i=0;i<60&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(c);i++){var text=s.GetCurrentDecision().getText();if(text.contains("Choose Vader")||text.contains("Choose Skywalker")){if(light)s.LSChooseCard(h);else s.DSChooseCard(h);}else {try{pass(s);}catch(RuntimeException e){throw new AssertionError(mode+" cardZone="+c.getZone()+" "+text+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}}
  assertTrue((light?s.GetLSLostPile():s.GetDSLostPile()).contains(c));results.add(stats(s,light,(light?"light":"dark")+"-"+mode));
 }}
 @Test public void frozenImmunity(){for(int destiny:new int[]{4,5}){
  var s=fixture(false);var h=s.GetDSCard("hero");s.PrepareDSDestiny(0);s.PrepareLSDestiny(destiny);s.SkipToDamageSegment(true);assertTrue(s.IsReachedDamageSegment());var q=s.game().getModifiersQuerying();float before=q.getImmunityToAttritionLessThan(s.gameState(),h);
  s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelImmunityToAttritionModifier(s.GetDSStartingLocation(),h));
  results.add(Map.of("name","frozen-"+destiny,"before",before,"after",q.getImmunityToAttritionLessThan(s.gameState(),h),"attrition",s.GetUnpaidDSAttrition()));
 }}
 @Test public void printedImmunity(){for(String bp:new String[]{"1_171","1_4","1_19","3_3","1_21","4_1","1_168","9_109","4_103","9_24"}){
  boolean light=Set.of("1_4","1_19","3_3","1_21","4_1","9_24").contains(bp);var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();(light?ls:ds).put("hero",bp);ls.put("alien","1_4");ls.put("troop","1_28");var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);var h=light?s.GetLSCard("hero"):s.GetDSCard("hero");s.MoveCardsToLocation(s.GetLSStartingLocation(),h);var q=s.game().getModifiersQuerying();float value=q.getImmunityToAttritionLessThan(s.gameState(),h);results.add(Map.of("name","printed-"+bp,"immunity",value>999?"all":value));
  if(bp.equals("4_103")||bp.equals("9_24")){s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard(bp.equals("4_103")?"alien":"troop"));results.add(Map.of("name","printed-company-"+bp,"immunity",q.getImmunityToAttritionLessThan(s.gameState(),h)));}
 }}
 @Test public void noImmunity(){for(boolean light:new boolean[]{false,true}){var s=fixture(true);if(!s.GetDecidingPlayer().equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS))pass(s);assertFalse(can(s,light));results.add(Map.of("name",(light?"light":"dark")+"-no-immunity","available",can(s,light)));}}
}
