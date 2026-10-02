package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;

public class NativeEngineAssaultOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/assault-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());final List<Float> draws=new ArrayList<>();Float total=null;
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){if(!seen.add(e))return null;if(e instanceof DestinyDrawCompleteResult d)draws.add(d.getDestinyValue());else if(e instanceof AboutToCompleteDrawingDestinyResult d)total=d.getTotalDestiny(game);return null;}
 }
 private VirtualTableScenario fixture(boolean light,int value){
  var ls=new HashMap<>(Map.of("a","1_28","b","1_28","assault","1_113"));var ds=new HashMap<>(Map.of("a","1_194","b","1_194","assault","1_238"));
  for(int i=0;i<2;i++){ls.put("draw"+i,value==0?"1_124":value==1?"1_28":"1_113");ds.put("draw"+i,value==0?"1_285":value==1?"1_194":"1_238");}
  return new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
 }
 private void run(boolean light,int value,int count,boolean own,boolean remove){
  var s=fixture(light,value);s.StartGame();boolean drainLight=own?light:!light;if(drainLight)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);
  s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var site=s.GetLSStartingLocation();var a=drainLight?s.GetLSCard("a"):s.GetDSCard("a");var b=drainLight?s.GetLSCard("b"):s.GetDSCard("b");s.MoveCardsToLocation(site,a,b);
  var card=light?s.GetLSCard("assault"):s.GetDSCard("assault");if(light)s.MoveCardsToLSHand(card);else s.MoveCardsToDSHand(card);
  s.SkipToPhase(Phase.CONTROL);
  for(var c:new ArrayList<>(light?s.GetLSReserveDeck():s.GetDSReserveDeck())){if(light)s.MoveCardsToLSHand((PhysicalCardImpl)c);else s.MoveCardsToDSHand((PhysicalCardImpl)c);}
  for(int i=count-1;i>=0;i--){if(light)s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("draw"+i));else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("draw"+i));}
  if(drainLight)s.LSForceDrainAt(site);else s.DSForceDrainAt(site);
  for(int i=0;i<25&&!(s.GetDecidingPlayer().equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS)&&(light?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card)));i++)s.PlayerPass(s.GetDecidingPlayer());
  var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);int df=s.GetDSForcePileCount(),lf=s.GetLSForcePileCount();if(light)s.LSPlayCard(card);else s.DSPlayCard(card);boolean removed=false;
  for(int i=0;i<180&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(card);i++){
   // Deliberate fixture intervention at the completed first draw, to observe
   // whether later power is re-read. It is not a claimed implemented card effect.
   if(remove&&!removed&&!t.draws.isEmpty()){if(drainLight){s.MoveCardsToTopOfLSLostPile(a);s.MoveCardsToTopOfLSLostPile(b);}else{s.MoveCardsToTopOfDSLostPile(a);s.MoveCardsToTopOfDSLostPile(b);}removed=true;}
   var text=s.GetCurrentDecision().getText().toLowerCase();var who=s.GetDecidingPlayer();
   if(!text.contains("optional")&&!text.contains("response")&&text.contains("lose")&&text.contains("force")){if(who.equals(VirtualTableScenario.LS))s.LSPayForceLossFromForcePile();else s.DSPayForceLossFromForcePile();continue;}
   if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue((light?s.GetLSLostPile():s.GetDSLostPile()).contains(card));
  var o=new LinkedHashMap<String,Object>();o.put("name",(light?"light":"dark")+"-"+(own?"own":remove?"remove":"normal")+"-"+value+"-"+count);o.put("draws",t.draws);o.put("total",t.total);o.put("darkForceLost",df-s.GetDSForcePileCount()-(light?0:1));o.put("lightForceLost",lf-s.GetLSForcePileCount()-(light?1:0));o.put("interruptLost",true);results.add(o);
 }
 @Test public void assaultOutcomes(){for(boolean light:new boolean[]{true,false}){for(int[] c:new int[][]{{3,2},{1,2},{0,2},{3,0},{3,1}})run(light,c[0],c[1],false,false);run(light,3,0,true,false);}}
 @Test public void frozenPowerObservation(){for(boolean light:new boolean[]{true,false})run(light,3,2,false,true);}
}
