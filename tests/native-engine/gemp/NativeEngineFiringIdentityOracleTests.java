package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.DestinyDrawnResult;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
/** Actual firing/react actions with explicitly controlled response-boundary
 * interventions. Interventions do not represent an implemented response card. */
public class NativeEngineFiringIdentityOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/firing-identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());int draws;
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){if(e instanceof DestinyDrawnResult && seen.add(e))draws++;return null;}
 }
 private void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 private VirtualTableScenario fixture(boolean stick,boolean reacting){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("target","1_28","backup","1_28","gun","1_152")),new HashMap<>(Map.of("host",stick?"1_196":"1_194","backup","1_194","weapon",stick?"1_315":"1_317","draw1","1_317","draw2","1_317","comlink","1_201","reactor","1_194")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();if(reacting)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("target"),s.GetLSCard("backup"),s.GetDSCard("host"),s.GetDSCard("backup"));s.AttachCardsTo(s.GetLSCard("target"),s.GetLSCard("gun"));s.AttachCardsTo(s.GetDSCard("host"),s.GetDSCard("weapon"),s.GetDSCard("comlink"));s.MoveCardsToDSHand(s.GetDSCard("reactor"),s.GetDSCard("draw1"),s.GetDSCard("draw2"));s.SkipToPhase(Phase.BATTLE);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("draw2"),s.GetDSCard("draw1"));return s;
 }
 private void intervene(VirtualTableScenario s,String who,boolean returned){
  var site=s.GetLSStartingLocation();
  if(who.equals("target")){s.MoveCardsToLSHand(s.GetLSCard("gun"),s.GetLSCard("target"));s.gameState().getBattleState().updateParticipants(s.game());if(returned){s.MoveCardsToLocation(site,s.GetLSCard("target"));s.AttachCardsTo(s.GetLSCard("target"),s.GetLSCard("gun"));}}
  else if(who.equals("host")){s.MoveCardsToDSHand(s.GetDSCard("weapon"),s.GetDSCard("comlink"),s.GetDSCard("host"));s.gameState().getBattleState().updateParticipants(s.game());if(returned){s.MoveCardsToLocation(site,s.GetDSCard("host"));s.AttachCardsTo(s.GetDSCard("host"),s.GetDSCard("weapon"),s.GetDSCard("comlink"));}}
  else {s.MoveCardsToDSHand(s.GetDSCard("weapon"));if(returned)s.AttachCardsTo(s.GetDSCard("host"),s.GetDSCard("weapon"));}
 }
 @Test public void firing(){for(boolean stick:new boolean[]{false,true})for(String who:new String[]{"weapon","host","target"})for(boolean returned:new boolean[]{false,true})for(boolean duringDraw:new boolean[]{false,true}){
  String name=(stick?"stick":"blaster")+"-"+who+"-"+(returned?"return":"leave")+"-"+(duringDraw?"draw":"response");
  try{var s=fixture(stick,false);var trace=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(trace);s.DSInitiateBattle(s.GetLSStartingLocation());if(!stick)s.PassBattleStartResponses();
   for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("weapon"),"Fire"));i++)pass(s);
   int force=s.GetDSForcePileCount();s.DSUseCardAction(s.GetDSCard("weapon"),"Fire");s.DSChooseCard(s.GetLSCard("target"));
   for(int i=0;i<80&&(s.gameState().getWeaponFiringState()==null||s.gameState().getWeaponFiringState().getWeaponFiringEffect()==null);i++)pass(s);
   if(duringDraw){for(int i=0;i<80&&trace.draws==0;i++)pass(s);assertTrue(trace.draws>0);}else assertEquals(0,trace.draws);
   intervene(s,who,returned);s.gameState().getBattleState().updateParticipants(s.game());
   for(int i=0;i<160&&s.gameState().getWeaponFiringState()!=null;i++)pass(s);assertNull(s.gameState().getWeaponFiringState());
   results.add(Map.of("name",name,"draws",trace.draws,"targetHit",s.GetLSCard("target").isHit(),"targetParticipating",s.gameState().getBattleState().isCardParticipatingInBattle(s.GetLSCard("target")),"targetWeaponSuppressed",s.game().getModifiersQuerying().mayNotBeFired(s.gameState(),s.GetLSCard("gun")),"forceSpent",force-s.GetDSForcePileCount()));
  }catch(Throwable e){throw new AssertionError(name,e);}
 }}
 @Test public void reactPermission(){for(String mode:new String[]{"leave","return","move"}){
  var s=fixture(false,true);s.LSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("comlink")));i++)pass(s);s.DSUseCardAction(s.GetDSCard("comlink"));if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(s.GetDSCard("reactor")))s.DSChooseCard(s.GetDSCard("reactor"));
  for(int i=0;i<80&&s.gameState().getDeployAsReactState()==null;i++)pass(s);assertNotNull(s.gameState().getDeployAsReactState());assertEquals(Zone.VOID,s.GetDSCard("reactor").getZone());
  if(mode.equals("move"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("host"));else{s.MoveCardsToDSHand(s.GetDSCard("comlink"));if(mode.equals("return"))s.AttachCardsTo(s.GetDSCard("host"),s.GetDSCard("comlink"));}
  for(int i=0;i<100&&s.GetDSCard("reactor").getZone()!=Zone.AT_LOCATION;i++)pass(s);results.add(Map.of("name","react-source-"+mode,"deployed",s.GetDSCard("reactor").getAtLocation()==s.GetLSStartingLocation()));
 }}
}
