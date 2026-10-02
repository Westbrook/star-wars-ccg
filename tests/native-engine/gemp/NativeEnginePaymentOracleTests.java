package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.UseForceEffect;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.UseForceResult;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Direct production UseForceEffect and actual dual-pile Jawa deployment.
 * Trace is passive; no production effect is replaced. */
public class NativeEnginePaymentOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/payment-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 static class Trace extends AbstractActionProxy {
  final Set<Object> seen=Collections.newSetFromMap(new IdentityHashMap<>());
  final List<Map<String,Object>> events=new ArrayList<>();
  void record(SwccgGame g,Object key,String stage,String player,int amount){
   if(!seen.add(key))return;
   events.add(Map.of("stage",stage,"side",player.equals(VirtualTableScenario.LS)?"light":"dark","amount",amount,
    "lightForce",g.getGameState().getForcePile(VirtualTableScenario.LS).size(),"darkForce",g.getGameState().getForcePile(VirtualTableScenario.DS).size()));
  }
  @Override public List<TriggerAction> getRequiredBeforeTriggers(SwccgGame g,Effect e){if(e instanceof UseForceEffect u&&u.getTotalAmountOfForceToUse()>0)record(g,e,"before",u.getPlayerId(),u.getTotalAmountOfForceToUse());return null;}
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof UseForceResult)record(g,e,"used",e.getPerformingPlayerId(),1);return null;}
 }
 @Test public void payments(){for(String mode:new String[]{"zero","one","three","dual","jawa"}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("jawa","1_12")),new HashMap<>(Map.of("storm","1_194")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("jawa"));
  while(s.GetLSForcePileCount()<4)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>4)s.LSUseForceCheat(1);
  while(s.GetDSForcePileCount()<4)s.DSActivateForceCheat(1);while(s.GetDSForcePileCount()>4)s.DSUseForceCheat(1);
  s.SkipToPhase(Phase.DEPLOY);
  var lightBefore=new ArrayList<>(s.GetLSForcePile());var darkBefore=new ArrayList<>(s.GetDSForcePile());
  var trace=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(trace);boolean[] done={false};
  if(mode.equals("jawa")){s.LSDeployCard(s.GetLSCard("jawa"));s.LSChooseCard(s.GetLSStartingLocation());}
  else {
   var action=new SystemQueueAction();if(mode.equals("dual"))action.appendEffect(new UseForceEffect(action,VirtualTableScenario.DS,1));
   action.appendEffect(new UseForceEffect(action,VirtualTableScenario.LS,mode.equals("zero")?0:mode.equals("three")?3:1));
   action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});
   s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  }
  for(int i=0;i<100&&!(mode.equals("jawa")?s.GetLSCard("jawa").getAtLocation()==s.GetLSStartingLocation():done[0]);i++)s.PlayerPass(s.GetDecidingPlayer());
  assertTrue(mode.equals("jawa")?s.GetLSCard("jawa").getAtLocation()==s.GetLSStartingLocation():done[0]);
  results.add(Map.of("name",mode,"events",trace.events,"lightUsedOrder",s.GetLSUsedPile().stream().filter(lightBefore::contains).map(lightBefore::indexOf).toList(),"darkUsedOrder",s.GetDSUsedPile().stream().filter(darkBefore::contains).map(darkBefore::indexOf).toList()));
 }}
}
