package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineStakesOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/stakes-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void pass(VirtualTableScenario s,boolean draw){String t=s.GetCurrentDecision().getText().toLowerCase();try{if(t.contains("battle destiny?")){if(draw)s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerChooseNo(s.GetDecidingPlayer());}else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(t+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 private VirtualTableScenario fixture(boolean lightTurn,int light,int dark,boolean han,boolean doomed,boolean droid){
  var ls=new HashMap<String,String>(Map.of("c0","1_77","c1","1_77","c2","1_77","bad","1_91","bad2","1_91","han","1_11","doom","1_120","droid","1_5"));var ds=new HashMap<String,String>(Map.of("c0","1_279","c1","1_279","c2","1_279"));for(int i=0;i<7;i++){ls.put("t"+i,"1_28");ds.put("t"+i,"1_194");}
  var s=new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();if(lightTurn)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);
  for(int i=0;i<3;i++){s.MoveCardsToLSHand(s.GetLSCard("c"+i));s.MoveCardsToDSHand(s.GetDSCard("c"+i));}s.MoveCardsToLSHand(s.GetLSCard("bad"),s.GetLSCard("bad2"),s.GetLSCard("doom"));if(han)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("han"));else s.MoveCardsToLSHand(s.GetLSCard("han"));if(droid)s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("droid"));else s.MoveCardsToLSHand(s.GetLSCard("droid"));
  for(int i=0;i<light;i++)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("t"+i));for(int i=0;i<dark;i++)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("t"+i));
  if(doomed){while(s.GetLSLifeForceRemaining()>14)s.MoveCardsToLSHand(s.GetTopOfLSReserveDeck());s.SkipToPhase(Phase.CONTROL);play(s,true,"doom");for(int i=0;i<40&&!s.GetLSUsedPile().contains(s.GetLSCard("doom"));i++)pass(s,false);assertTrue(s.GetLSUsedPile().contains(s.GetLSCard("doom")));}
  s.SkipToPhase(Phase.BATTLE);if(lightTurn)s.LSInitiateBattle(s.GetLSStartingLocation());else s.DSInitiateBattle(s.GetLSStartingLocation());return s;
 }
 private void play(VirtualTableScenario s,boolean light,String key){var c=light?s.GetLSCard(key):s.GetDSCard(key);String player=light?VirtualTableScenario.LS:VirtualTableScenario.DS;for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(player)&&(light?s.LSCardPlayAvailable(c):s.DSCardPlayAvailable(c)));i++)pass(s,false);assertEquals(player,s.GetDecidingPlayer());if(light)s.LSPlayCard(c);else s.DSPlayCard(c);}
 private void lost(VirtualTableScenario s,boolean light,String key){var c=light?s.GetLSCard(key):s.GetDSCard(key);for(int i=0;i<80&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(c);i++)pass(s,false);assertTrue((light?s.GetLSLostPile():s.GetDSLostPile()).contains(c));}
 private void damage(VirtualTableScenario s,boolean draw){if(draw){s.PrepareLSDestiny(6);s.PrepareDSDestiny(1);}for(int i=0;i<200&&!s.IsReachedDamageSegment();i++)pass(s,draw);assertTrue(s.IsReachedDamageSegment());}
 private void record(VirtualTableScenario s,String name){results.add(Map.of("name",name,"lightDamage",s.GetUnpaidLSBattleDamage(),"darkDamage",s.GetUnpaidDSBattleDamage(),"lightAttrition",s.GetUnpaidLSAttrition(),"darkAttrition",s.GetUnpaidDSAttrition()));}
 @Test public void chanceMirrors(){for(boolean lightTurn:new boolean[]{false,true})for(boolean lightLoses:new boolean[]{false,true}){var s=fixture(lightTurn,lightLoses?1:4,lightLoses?4:1,false,false,false);play(s,!lightTurn,"c0");damage(s,false);record(s,"chance-"+(lightTurn?"light":"dark")+"-"+(lightLoses?"light":"dark"));}}
 @Test public void chanceResponses(){for(String mode:new String[]{"boost","chain","repeat-boost","repeat-base"}){var s=fixture(false,1,4,false,false,false);play(s,true,"c0");if(mode.equals("repeat-base")){lost(s,true,"c0");play(s,true,"c1");}else{play(s,false,"c0");if(mode.equals("chain"))play(s,true,"c1");if(mode.equals("repeat-boost")){lost(s,false,"c0");play(s,false,"c1");}}damage(s,false);record(s,mode);}}
 @Test public void badFeeling(){for(String mode:new String[]{"plain","han","combined","repeat"}){boolean han=mode.equals("han");var s=fixture(true,han?1:4,5,han,false,false);play(s,true,"bad");for(int i=0;i<60&&!s.GetLSUsedPile().contains(s.GetLSCard("bad"));i++)pass(s,false);assertTrue(s.GetLSUsedPile().contains(s.GetLSCard("bad")));if(mode.equals("combined"))play(s,false,"c0");if(mode.equals("repeat"))play(s,true,"bad2");damage(s,true);record(s,"bad-"+mode);}}
 @Test public void doomed(){for(boolean droid:new boolean[]{false,true}){var s=fixture(false,1,4,false,true,droid);play(s,true,"c0");damage(s,false);record(s,"doomed-"+droid);}}
}
