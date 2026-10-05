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
/** Prepared boards; unmodified production queries and actual paid/free actions. */
public class NativeEngineBattlePlanOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/battle-plan-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(boolean light,boolean plan,boolean order,boolean ground,boolean space,boolean contested,String mode,Phase phase){
  var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();ls.put("t","1_28");ds.put("t","1_194");ls.put("ship","1_140");ds.put("ship","1_302");ls.put("effect","8_35");ds.put("effect","8_118");ls.put("system","1_127");ls.put("alter","1_71");ds.put("alter","1_234");
  var s=new VirtualTableScenario(ls,ds,40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.MoveLocationToTable(s.GetLSCard("system"));
  if(ground)s.MoveCardsToLocation(s.GetLSStartingLocation(),light?s.GetLSCard("t"):s.GetDSCard("t"));
  if(space)s.MoveCardsToLocation(s.GetLSCard("system"),light?s.GetLSCard("ship"):s.GetDSCard("ship"));
  if(contested){s.MoveCardsToLocation(s.GetLSStartingLocation(),light?s.GetDSCard("t"):s.GetLSCard("t"));s.MoveCardsToLocation(s.GetLSCard("system"),light?s.GetDSCard("ship"):s.GetLSCard("ship"));}
  if(plan&&!mode.equals("deploy"))s.MoveCardsToSideOfTable(s.GetLSCard("effect"));else s.MoveCardsToHand(s.GetLSCard("effect"));
  if(order&&!mode.equals("deploy"))s.MoveCardsToSideOfTable(s.GetDSCard("effect"));else s.MoveCardsToHand(s.GetDSCard("effect"));
  s.MoveCardsToHand(s.GetLSCard("alter"),s.GetDSCard("alter"));s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);
  if(mode.equals("suppressed-plan")){s.GetLSCard("effect").setGameTextCanceled(true);s.ApplyAdHocModifier(new CancelsGameTextModifier(s.GetLSStartingLocation(),s.GetLSCard("effect")));}
  if(light)s.SkipToLSTurn(phase);else s.SkipToDSTurn(phase);return s;
 }
 void pass(VirtualTableScenario s){if(s.AwaitingLSForceLossPayment())s.LSPayForceLossFromReserveDeck();else if(s.AwaitingDSForceLossPayment())s.DSPayForceLossFromReserveDeck();else if(s.GetCurrentDecision().getText().toLowerCase().contains("required responses"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("actionId")[0]);else s.PlayerPass(s.GetDecidingPlayer());}
 int force(VirtualTableScenario s,boolean light){return light?s.GetLSForcePileCount():s.GetDSForcePileCount();}
 @Test public void costs(){for(boolean light:new boolean[]{false,true})for(String source:List.of("plan","order","both"))for(boolean ground:new boolean[]{false,true})for(boolean space:new boolean[]{false,true})check(light,source,ground,space,false,"normal");for(boolean light:new boolean[]{false,true}){check(light,"both",true,true,true,"normal");check(light,"both",true,false,false,"suppressed-plan");}}
 void check(boolean light,String source,boolean ground,boolean space,boolean contested,String mode){
  var s=fixture(light,!source.equals("order"),!source.equals("plan"),ground,space,contested,mode,Phase.CONTROL);var q=s.game().getModifiersQuerying();var site=s.GetLSStartingLocation();String player=light?LS:DS;
  float drain=q.getInitiateForceDrainCost(s.gameState(),site,player);boolean free=q.mayInitiateBattleForFreeAtLocation(s.gameState(),site,player);assertEquals(ground&&space||mode.equals("suppressed-plan")?0:3,drain,0);
  rows.add(Map.of("kind","query","side",light?"light":"dark","source",source,"ground",ground,"space",space,"contested",contested,"mode",mode,"drain",drain,"free",free));
 }
 @Test public void payments(){for(boolean light:new boolean[]{false,true}){
  for(boolean space:new boolean[]{false,true}){var s=fixture(light,true,true,true,space,false,"normal",Phase.CONTROL);int before=force(s,light);if(light)s.LSForceDrainAt(s.GetLSStartingLocation());else s.DSForceDrainAt(s.GetLSStartingLocation());for(int n=0;n<120;n++){if(n>0&&(light?s.AwaitingLSControlPhaseActions():s.AwaitingDSControlPhaseActions())&&s.gameState().getForceDrainState()==null)break;pass(s);}assertNull(s.gameState().getForceDrainState());int cost=before-force(s,light);assertEquals(space?0:3,cost);rows.add(Map.of("kind","drain","side",light?"light":"dark","space",space,"cost",cost));}
  for(boolean free:new boolean[]{false,true}){var s=fixture(light,true,true,true,false,true,"normal",Phase.BATTLE);var d=s.GetCurrentDecision();var p=d.getDecisionParameters();String answer=null;var offered=new ArrayList<String>();for(int i=0;i<p.get("actionId").length;i++)if(p.get("actionText")[i].startsWith("Initiate battle")){String text=p.get("actionText")[i];offered.add(text);if(text.equals(free?"Initiate battle for free":"Initiate battle"))answer=p.get("actionId")[i];}assertNotNull(offered.toString(),answer);int before=force(s,light);s.PlayerDecided(light?LS:DS,answer);for(int n=0;n<120&&s.gameState().getBattleState()==null;n++)pass(s);assertNotNull(s.gameState().getBattleState());int cost=before-force(s,light);assertEquals(free?0:1,cost);rows.add(Map.of("kind","battle","side",light?"light":"dark","free",free,"cost",cost,"offered",offered));}
 }}
 @Test public void deployments(){for(boolean light:new boolean[]{false,true}){var s=fixture(light,true,true,true,false,false,"deploy",Phase.DEPLOY);var c=light?s.GetLSCard("effect"):s.GetDSCard("effect");int before=force(s,light);if(light)s.LSPlayCard(c);else s.DSPlayCard(c);for(int n=0;n<100&&c.getZone()!=Zone.SIDE_OF_TABLE;n++)pass(s);assertEquals(Zone.SIDE_OF_TABLE,c.getZone());assertEquals(before,force(s,light));assertTrue(c.getBlueprint().isImmuneToCardTitle(Title.Alter));rows.add(Map.of("kind","deployment","side",light?"light":"dark","cost",before-force(s,light),"alterImmune",true));}}
}
