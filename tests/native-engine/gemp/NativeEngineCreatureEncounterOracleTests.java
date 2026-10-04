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
public class NativeEngineCreatureEncounterOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/creature-encounter-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void log(VirtualTableScenario s){System.out.println("ENCOUNTER "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("trooper","1_28"));var ds=new HashMap<String,String>(Map.of("first","3_93","second","3_93","third","3_93","arm","7_212","low","1_249","equal","1_249","high","1_262"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("3_59"),StartingSetup.DSStartingLocation("3_150"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();log(s);if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");s.MoveCardsToDSHand(s.GetDSCard("first"),s.GetDSCard("second"),s.GetDSCard("third"),s.GetDSCard("arm"),s.GetDSCard("low"),s.GetDSCard("equal"),s.GetDSCard("high"));s.DSActivateForceCheat(15);log(s);s.SkipToPhase(Phase.DEPLOY);return s;}
 void deploy(VirtualTableScenario s,String key){if(!s.GetDecidingPlayer().equals(s.DS))s.LSPass();s.DSDeployCard(s.GetDSCard(key));}
 void idle(VirtualTableScenario s){for(int i=0;i<150;i++){String t=s.GetCurrentDecision().getText();if(t.contains("Choose Deploy action")&&s.gameState().getAttackState()==null)return;log(s);if(t.startsWith("Choose where"))s.DSChooseCard(s.GetDSStartingLocation());else s.PlayerPass(s.GetDecidingPlayer());}fail("Did not reach Deploy phase");}
 @Test public void encounters(){for(boolean tie:List.of(true,false)){
  var s=fixture();int force=s.GetDSForcePileCount();deploy(s,"first");idle(s);assertEquals(force,s.GetDSForcePileCount());assertEquals(3,s.GetDefense(s.GetDSCard("first")));
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard(tie?"equal":"high"),s.GetDSCard("low"));deploy(s,"second");List<Float> totals=null;boolean weapon=false;
  for(int i=0;i<200;i++){log(s);var attack=s.gameState().getAttackState();if(attack!=null&&attack.isReachedDamageSegment()){totals=new ArrayList<>(List.of(attack.getFinalAttackerTotal(),attack.getFinalDefenderTotal()));Collections.sort(totals);}String t=s.GetCurrentDecision().getText();if(t.contains("weapons segment"))weapon=true;if(t.contains("Choose Deploy action")&&attack==null)break;
   if(t.startsWith("Choose where"))s.DSChooseCard(s.GetDSStartingLocation());else if((t.equals("Choose card to put on Lost Pile")||t.equals("Choose card to be lost")))s.DSChooseCard(s.DSHasCardChoiceAvailable(s.GetDSCard("first"))?s.GetDSCard("first"):s.GetDSCard("second"));else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertNull(s.gameState().getAttackState());int lost=(s.GetDSLostPile().contains(s.GetDSCard("first"))?1:0)+(s.GetDSLostPile().contains(s.GetDSCard("second"))?1:0);assertEquals(tie?2:1,lost);assertNotNull(totals);assertEquals(List.of(7f,tie?7f:8f),totals);assertFalse(weapon);
  var r=new LinkedHashMap<String,Object>();r.put("case",tie?"tie":"unequal");r.put("ferocity",totals);r.put("lost",lost);r.put("weaponSegment",weapon);r.put("deploymentCost",force-s.GetDSForcePileCount());rows.add(r);
 }}
 @Test public void persistentSelectivity(){var s=fixture();int force=s.GetDSForcePileCount();deploy(s,"arm");idle(s);deploy(s,"first");idle(s);deploy(s,"second");idle(s);s.MoveCardsToDSHand(s.GetDSCard("arm"));deploy(s,"third");idle(s);assertNull(s.gameState().getAttackState());int survivors=0;for(String key:List.of("first","second","third"))if(s.GetDSCard(key).getAtLocation()==s.GetDSStartingLocation())survivors++;assertEquals(3,survivors);assertEquals(force,s.GetDSForcePileCount());rows.add(new LinkedHashMap<>(Map.of("case","one-arm-left","survivors",survivors,"deploymentCost",force-s.GetDSForcePileCount())));}
 @Test public void relocation(){for(boolean relocate:List.of(false,true)){
  var s=fixture();deploy(s,"first");idle(s);var w=s.GetDSCard("first");var victim=s.GetLSCard("trooper");s.MoveCardsToLocation(s.GetLSStartingLocation(),w,victim);s.SkipToPhase(Phase.BATTLE);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("low"));s.DSUseCardAction(w,"Initiate attack");Float ferocity=null;
  for(int i=0;i<200;i++){log(s);var a=s.gameState().getAttackState();if(a!=null&&a.isReachedDamageSegment())ferocity=a.getFinalAttackerTotal();String t=s.GetCurrentDecision().getText();if(t.contains("Choose Battle action")&&a==null)break;
   if(t.contains("Choose player"))s.DSChoose(s.LS);else if(t.contains("relocated to")){if(relocate)s.DSChooseYes();else s.DSChooseNo();}else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertNull(s.gameState().getAttackState());assertEquals(Float.valueOf(7),ferocity);assertEquals(!relocate,s.GetLSLostPile().contains(victim));if(relocate)assertEquals(s.GetDSStartingLocation(),victim.getAtLocation());rows.add(new LinkedHashMap<>(Map.of("case",relocate?"relocate":"eat","ferocity",ferocity,"victimLost",s.GetLSLostPile().contains(victim),"atCave",victim.getAtLocation()==s.GetDSStartingLocation())));
 }}
}
