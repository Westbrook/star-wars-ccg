package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.MayNotDrawMoreThanBattleDestinyModifier;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Production draw/limit behavior inside a real battle. A fixture modifier
 * supplies the cap; controlled cancel/substitute interventions test the kernel,
 * without claiming the cards that would grant those interventions. */
public class NativeEngineDestinyLimitOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/destiny-limit-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 @Test public void limits(){for(String mode:new String[]{"zero","one","two","cancel","redraw","substitute-first","substitute-late","select-cap-one","select-cap-two","convert-cap-one","convert-cap-two","cost-skip","substitute-cap-lowered"}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("one","1_28","five","1_115","zero","1_124","luke","101_2","rebel","1_28")),new HashMap<>(Map.of("vader","101_5")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);s.LSActivateForceCheat(4);var site=s.GetLSStartingLocation();
  s.MoveCardsToLocation(site,s.GetLSCard("luke"),s.GetLSCard("rebel"),s.GetDSCard("vader"));
  s.MoveCardsToLSHand(s.GetLSCard("one"),s.GetLSCard("five"),s.GetLSCard("zero"));
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassBattleStartResponses();
  s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("zero"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("five"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));
  int limit=mode.equals("zero")?0:mode.equals("two")||mode.endsWith("cap-two")?2:1;
  s.game().getModifiersEnvironment().addUntilEndOfBattleModifier(new MayNotDrawMoreThanBattleDestinyModifier(site,limit,VirtualTableScenario.LS));
  var action=new SystemQueueAction();var result=new LinkedHashMap<String,Object>();var events=new ArrayList<String>();var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());int[] before={0},physical={0};boolean[] intervened={false};
  boolean select=mode.startsWith("select");
  var draw=new DrawDestinyEffect(action,VirtualTableScenario.LS,select?1:2,select?3:0,select?1:0,false,DestinyType.BATTLE_DESTINY){@Override protected void destinyDraws(SwccgGame g,List<PhysicalCard> cards,List<Float> values,Float total){result.put("total",total);result.put("done",true);}};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){
   if(!seen.add(e)||result.containsKey("done"))return null;
   if(e instanceof CostToDrawDestinyCardResult c){events.add("cost");if(mode.equals("cost-skip"))c.costToDrawCardFailed(true);}
   if(e instanceof AboutToDrawDestinyCardResult){events.add("before");before[0]++;
    if(mode.equals("substitute-first")&&before[0]==1||mode.equals("substitute-late")&&before[0]==2)draw.setSubstituteDestiny(3f);
    if(mode.equals("substitute-cap-lowered")&&before[0]==1){g.getModifiersEnvironment().addUntilEndOfBattleModifier(new MayNotDrawMoreThanBattleDestinyModifier(site,0,VirtualTableScenario.LS));draw.setSubstituteDestiny(3f);}
    if(mode.startsWith("convert")&&!intervened[0]){intervened[0]=true;boolean can=draw.canDrawAndChoose(g,2);result.put("conversion",can);if(can)draw.setDrawXAndChooseY(2,1);}
   }
   if(e instanceof DestinyDrawnResult d){events.add("drawn");if(d.getCard()!=null)physical[0]++;if(!intervened[0]&&(mode.equals("cancel")||mode.equals("redraw"))){intervened[0]=true;draw.cancelDestiny(mode.equals("redraw"));}}
   if(e instanceof DestinyDrawCompleteResult)events.add("complete");
   if(e instanceof AboutToCompleteDrawingDestinyResult)events.add("total");return null;
  }});
  action.appendEffect(draw);s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  for(int i=0;i<200&&!result.containsKey("done");i++){
   var text=s.GetCurrentDecision().getText().toLowerCase();if(text.startsWith("choose")&&text.contains("destiny"))s.LSChooseCard(s.GetLSCard("one"));else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertTrue(mode,result.containsKey("done"));result.remove("done");result.put("name",mode);result.put("events",events);result.put("physicalReveals",physical[0]);result.put("unresolved",s.gameState().getUnresolvedDestinyDraw(VirtualTableScenario.LS).size());results.add(result);
 }}
}
