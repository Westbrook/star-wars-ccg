package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.DrawDestinyEffect;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;

/** Exercise the production generic draw effect. The fixture schedules the
 * effect directly; it does not claim to implement or verify a granting card. */
public class NativeEngineSelectionOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/selection-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());
  final List<Map<String,Object>> events=new ArrayList<>();
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){
   if(seen.contains(e))return null;String stage=null;Float value=null;
   if(e instanceof AboutToDrawDestinyCardResult){stage="before";}
   else if(e instanceof DestinyDrawnResult d){stage="drawn";value=game.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().getDestinyDrawValue();}
   else if(e instanceof DestinyDrawCompleteResult d){stage="complete";value=d.getDestinyValue();}
   else if(e instanceof AboutToCompleteDrawingDestinyResult d){stage="total";value=d.getTotalDestiny(game);}
   if(stage!=null){seen.add(e);String side=e.getPerformingPlayerId();var record=new HashMap<String,Object>(Map.of("stage",stage,"unresolved",game.getGameState().getUnresolvedDestinyDraw(side).size()));record.put("value",value);events.add(record);}
   return null;
  }
 }
 @Test public void selection(){for(String mode:new String[]{"first","second","three-two","hand","short","empty","canceled","redraw","zero","relocated"}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("one","1_28","five","1_115","zero","1_124")),new HashMap<>(Map.of("trooper","1_194")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("one"),s.GetLSCard("five"),s.GetLSCard("zero"));s.LSActivateForceCheat(2);
  for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);
  var one=s.GetLSCard("one");var five=s.GetLSCard("five");var zero=s.GetLSCard("zero");
  if(mode.equals("three-two")||mode.equals("redraw"))s.MoveCardsToTopOfLSReserveDeck(zero);
  if(!mode.equals("short")&&!mode.equals("empty"))s.MoveCardsToTopOfLSReserveDeck(five);
  if(!mode.equals("empty"))s.MoveCardsToTopOfLSReserveDeck(mode.equals("zero")?zero:one);
  var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);
  var result=new HashMap<String,Object>();var action=new SystemQueueAction();
  action.appendEffect(new DrawDestinyEffect(action,VirtualTableScenario.LS,mode.equals("three-two")?3:2,mode.equals("three-two")||mode.equals("short")?2:1,mode.equals("hand")){
   @Override protected void destinyDraws(SwccgGame game,List<PhysicalCard> cards,List<Float> values,Float total){result.put("values",new ArrayList<>(values));result.put("total",total);result.put("done",true);}
  });
  s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  boolean intervened=false;
  for(int i=0;i<150&&!result.containsKey("done");i++){
   if(!intervened&&(mode.equals("canceled")||mode.equals("redraw"))&&t.events.stream().anyMatch(e->e.get("stage").equals("drawn"))){s.gameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().cancelDestiny(mode.equals("redraw"));intervened=true;}
   if(!intervened&&mode.equals("relocated")&&t.events.stream().anyMatch(e->e.get("stage").equals("complete"))){s.MoveCardsToLSHand(one);intervened=true;}
   String text=s.GetCurrentDecision().getText().toLowerCase();
   if(text.startsWith("choose")&&text.contains("destiny")){
    if(mode.equals("three-two"))s.LSChooseCards(five,one);
    else s.LSChooseCard(mode.equals("second")||mode.equals("canceled")||mode.equals("redraw")?five:mode.equals("zero")?zero:one);
   }else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertTrue(result.containsKey("done"));result.remove("done");result.put("name",mode);result.put("events",t.events);
  var labels=new HashMap<PhysicalCard,String>();labels.put(one,"one");labels.put(five,"five");labels.put(zero,"zero");
  result.put("used",s.GetLSUsedPile().stream().filter(labels::containsKey).map(labels::get).toList());
  result.put("hand",s.GetLSHand().stream().filter(labels::containsKey).map(labels::get).sorted().toList());
  results.add(result);
 }}
}
