package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Shared mechanism fixture. The proxy supplies a fixed one-Force tax and
 * controlled substitution/redraw; it does not certify a granting card. */
public class NativeEngineDestinyCostOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/destiny-cost-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 @Test public void costs(){for(String mode:new String[]{"paid","declined","unpaid","substituted","redraw","two","second-unpaid","empty"}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("one","1_28","five","1_115")),new HashMap<>(Map.of("storm","1_194")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);
  int available=mode.equals("unpaid")?0:mode.equals("second-unpaid")?1:4;
  s.SkipToPhase(Phase.DEPLOY);
  s.MoveCardsToLSHand(s.GetLSCard("five"),s.GetLSCard("one"));
  while(s.GetLSForcePileCount()<available)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>available)s.LSUseForceCheat(1);
  s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("five"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));
  if(mode.equals("empty"))for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);
  assertEquals(available,s.GetLSForcePileCount());
  var events=new ArrayList<String>();var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());boolean[] redrawn={false},done={false};Float[] total={null};
  var source=s.GetLSStartingLocation();var action=new SystemQueueAction();
  var draw=new DrawDestinyEffect(action,VirtualTableScenario.LS,mode.equals("two")||mode.equals("second-unpaid")?2:1,DestinyType.DESTINY){@Override protected void destinyDraws(SwccgGame g,List<PhysicalCard> cards,List<Float> values,Float value){total[0]=value;}};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){
   @Override public List<TriggerAction> getRequiredBeforeTriggers(SwccgGame g,Effect e){if(e instanceof UseForceEffect&&seen.add(e))events.add("use-before");return null;}
   @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){
    if(!seen.add(e))return null;
    if(e instanceof CostToDrawDestinyCardResult c){
     events.add("cost");var tax=new RequiredGameTextTriggerAction(source,source.getCardId());
     if(mode.equals("declined")||g.getGameState().getForcePile(VirtualTableScenario.LS).isEmpty())tax.appendEffect(new PassthruEffect(tax){@Override protected void doPlayEffect(SwccgGame g){c.costToDrawCardFailed(mode.equals("declined"));}});
     else tax.appendEffect(new UseForceEffect(tax,VirtualTableScenario.LS,1));
     return List.of(tax);
    }
    if(e instanceof UseForceResult)events.add("used");
    if(e instanceof AboutToDrawDestinyCardResult){events.add("before");if(mode.equals("substituted"))draw.setSubstituteDestiny(3f);}
    if(e instanceof DestinyDrawnResult){events.add("drawn");if(mode.equals("redraw")&&!redrawn[0]){redrawn[0]=true;draw.cancelDestiny(true);}}
    if(e instanceof DestinyDrawCompleteResult)events.add("complete");
    if(e instanceof AboutToCompleteDrawingDestinyResult)events.add("total");return null;
   }
  });
  action.appendEffect(draw);action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});
  s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  for(int i=0;i<200&&!done[0];i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(done[0]);
  var result=new LinkedHashMap<String,Object>();result.put("name",mode);result.put("events",events);result.put("total",total[0]);result.put("paid",available-s.GetLSForcePileCount());result.put("unresolved",s.game().getGameState().getUnresolvedDestinyDraw(VirtualTableScenario.LS).size());results.add(result);
 }}
}
