package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Actual Ardan ground text plus controlled production modifier/cost providers.
 * No full granting-card or complete deck conformance is implied. */
public class NativeEngineBattleDrawPolicyOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/battle-draw-policy-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 @Test public void policies(){for(String mode:new String[]{"ardan","ardan-cap-zero","ardan-hard-six","add-below-four","hard-denied","fallback-two","fallback-vs-cap","no-limit","fallback-no-limit","cost-involuntary","cost-voluntary","cost-substitution","cost-redraw","cost-cancel"}){
  boolean ardan=mode.startsWith("ardan")||mode.startsWith("cost"),high=Set.of("fallback-vs-cap","no-limit","cost-substitution","cost-cancel").contains(mode);
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2")),new HashMap<>(Map.of("ardan","4_103","trooper","1_194","vader","101_5","one","1_194","five","1_262","zero","1_284")),10,10,
   StartingSetup.LSStartingLocation(mode.equals("ardan-hard-six")?"1_130":"1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);s.LSActivateForceCheat(4);var site=s.GetLSStartingLocation();var character=s.GetDSCard(ardan?"ardan":"trooper");
  s.MoveCardsToLocation(site,s.GetLSCard("luke"),character);if(high)s.MoveCardsToLocation(site,s.GetDSCard("vader"));
  s.MoveCardsToDSHand(s.GetDSCard("one"),s.GetDSCard("five"),s.GetDSCard("zero"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassBattleStartResponses();
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("zero"));s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("five"));s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("one"));
  var env=s.game().getModifiersEnvironment();
  int add=Set.of("add-below-four","hard-denied","fallback-vs-cap","no-limit").contains(mode)?2:Set.of("cost-substitution","cost-cancel").contains(mode)?1:0;
  if(add>0)env.addUntilEndOfBattleModifier(new AddsBattleDestinyModifier(site,add,VirtualTableScenario.DS));
  if(mode.equals("hard-denied"))env.addUntilEndOfBattleModifier(new AbilityRequiredForBattleDestinyModifier(site,6,VirtualTableScenario.DS));
  if(mode.startsWith("fallback"))env.addUntilEndOfBattleModifier(new DrawsBattleDestinyIfUnableToOtherwiseModifier(character,(com.gempukku.swccgo.logic.conditions.Condition)null,2));
  if(mode.equals("ardan-cap-zero")||mode.equals("fallback-no-limit"))env.addUntilEndOfBattleModifier(new MayNotDrawMoreThanBattleDestinyModifier(site,0,VirtualTableScenario.DS));
  if(mode.equals("fallback-vs-cap")||mode.equals("no-limit"))env.addUntilEndOfBattleModifier(new MayNotDrawMoreThanBattleDestinyModifier(site,1,VirtualTableScenario.DS));
  if(mode.endsWith("no-limit"))env.addUntilEndOfBattleModifier(new NumberOfBattleDestinyDrawsMayNotBeLimitedForEitherPlayerModifier(site,site));
  var q=s.game().getModifiersQuerying();int count=q.getNumBattleDestinyDraws(s.gameState(),VirtualTableScenario.DS,false,false),cap=q.getNumBattleDestinyDraws(s.gameState(),VirtualTableScenario.DS,true,false);
  var result=new LinkedHashMap<String,Object>();result.put("name",mode);result.put("count",count);result.put("limit",cap==Integer.MAX_VALUE?null:cap);result.put("minimum",q.getNumBattleDestinyDrawsIfUnableToOtherwise(s.gameState(),VirtualTableScenario.DS));
  var action=new SystemQueueAction();var events=new ArrayList<String>();var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());int[] costs={0},before={0},physical={0};boolean[] intervened={false};
  var draw=new DrawDestinyEffect(action,VirtualTableScenario.DS,count,DestinyType.BATTLE_DESTINY){@Override protected void destinyDraws(SwccgGame g,List<PhysicalCard> cards,List<Float> values,Float total){result.put("total",total);result.put("done",true);}};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){
   if(!seen.add(e)||result.containsKey("done"))return null;
   if(e instanceof CostToDrawDestinyCardResult c){events.add("cost");costs[0]++;if(mode.startsWith("cost")&&(!mode.equals("cost-substitution")||costs[0]>1))c.costToDrawCardFailed(mode.equals("cost-voluntary"));}
   if(e instanceof AboutToDrawDestinyCardResult){events.add("before");before[0]++;if(mode.equals("cost-substitution")&&before[0]==1)draw.setSubstituteDestiny(3f);}
   if(e instanceof DestinyDrawnResult d){events.add("drawn");if(d.getCard()!=null)physical[0]++;if(!intervened[0]&&(mode.equals("cost-redraw")||mode.equals("cost-cancel"))){intervened[0]=true;draw.cancelDestiny(mode.equals("cost-redraw"));}}
   if(e instanceof DestinyDrawCompleteResult)events.add("complete");
   if(e instanceof AboutToCompleteDrawingDestinyResult)events.add("total");return null;
  }});
  action.appendEffect(draw);s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  for(int i=0;i<200&&!result.containsKey("done");i++)s.PlayerPass(s.GetDecidingPlayer());
  assertTrue(mode,result.containsKey("done"));result.remove("done");result.put("events",events);result.put("physicalReveals",physical[0]);result.put("unresolved",s.gameState().getUnresolvedDestinyDraw(VirtualTableScenario.DS).size());results.add(result);
 }}
}
