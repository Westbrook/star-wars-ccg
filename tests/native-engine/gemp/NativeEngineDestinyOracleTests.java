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

/** Passive event observer on actual card actions; never changes GEMP results. */
public class NativeEngineDestinyOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/destiny-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());
  final Set<Integer> drawn=new HashSet<>();final List<Map<String,Object>> events=new ArrayList<>();
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){
   if(seen.contains(e))return null;String stage=null;Float value=null;
   if(e instanceof DestinyDrawnResult d){if(d.getCard()==null)return null;stage="drawn";drawn.add(d.getCard().getPermanentCardId());value=game.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().getDestinyDrawValue();}
   else if(e instanceof DestinyDrawCompleteResult d){stage="complete";value=d.getDestinyValue();}
   else if(e instanceof AboutToCompleteDrawingDestinyResult d){stage="total";value=d.getTotalDestiny(game);}
   if(stage!=null){seen.add(e);String side=e.getPerformingPlayerId();events.add(Map.of("stage",stage,"side",side.equals(VirtualTableScenario.DS)?"dark":"light","value",value,"unresolved",game.getGameState().getUnresolvedDestinyDraw(side).stream().filter(c->drawn.contains(c.getPermanentCardId())).count(),"used",game.getGameState().getUsedPile(side).stream().filter(c->drawn.contains(c.getPermanentCardId())).count()));}
   return null;
  }
 }
 private VirtualTableScenario fixture(){return fixture("1_129");}
 private VirtualTableScenario fixture(String lightSite){return new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","rebel","1_28","dice","1_84","gun","1_153","one","1_28","five","1_115","zero","1_124")),new HashMap<>(Map.of("trooper","1_194","droid","1_186","reinforce","1_251","lost","1_194","gun","1_312")),10,10,
  StartingSetup.LSStartingLocation(lightSite),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);}
 private Trace observe(VirtualTableScenario s){var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);return t;}
 private void pass(VirtualTableScenario s,PhysicalCardImpl... choices){var text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("optional")||text.contains("response")||text.startsWith("verify lost pile")){s.PlayerPass(s.GetDecidingPlayer());return;}for(var c:choices){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);return;}if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);return;}}throw new AssertionError(text);}
 @Test public void ordinaryCompletion(){for(int value:new int[]{0,1,-1}){
  var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);var card=s.GetDSCard("reinforce");s.MoveCardsToLSHand(s.GetLSCard("dice"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"));s.MoveCardsToDSHand(card);s.MoveCardsToTopOfDSLostPile(s.GetDSCard("lost"));s.SkipToPhase(Phase.DEPLOY);
  if(value<0)for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.PrepareDSDestiny(value);
  var t=observe(s);s.DSPlayCard(card);for(int i=0;i<100&&!s.GetDSLostPile().contains(card);i++)pass(s,s.GetDSCard("lost"));assertTrue(s.GetDSLostPile().contains(card));assertEquals(value<0?0:3,t.events.size());results.add(Map.of("name",value<0?"general-empty":"general-"+value,"events",t.events));
 }}
 private VirtualTableScenario battle(){var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);s.LSActivateForceCheat(6);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("luke"),s.GetLSCard("rebel"),s.GetDSCard("trooper"),s.GetDSCard("droid"));s.MoveCardsToLSHand(s.GetLSCard("dice"));s.AttachCardsTo(s.GetLSCard("luke"),s.GetLSCard("gun"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);return s;}
 @Test public void weaponZero(){var s=battle();s.PassBattleStartResponses();if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSPass();s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("zero"));var t=observe(s);s.LSUseCardAction(s.GetLSCard("gun"),"Fire");for(int i=0;i<100&&t.events.stream().noneMatch(e->e.get("stage").equals("total"));i++)pass(s,s.GetDSCard("droid"));assertEquals(3,t.events.size());assertEquals(0f,(Float)t.events.get(1).get("value"),0);assertEquals(0f,(Float)t.events.get(2).get("value"),0);results.add(Map.of("name","weapon-zero","events",t.events));}
 @Test public void eachWeaponDraw(){for(String bp:new String[]{"1_284","1_132"}){
  var s=fixture(bp.equals("1_132")?bp:"1_129");s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);s.LSActivateForceCheat(4);
  var site=bp.equals("1_284")?s.GetDSStartingLocation():s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetDSCard("trooper"),s.GetLSCard("rebel"));s.AttachCardsTo(s.GetDSCard("trooper"),s.GetDSCard("gun"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassBattleStartResponses();s.PrepareDSDestiny(0);var t=observe(s);s.DSUseCardAction(s.GetDSCard("gun"),"Fire");
  for(int i=0;i<100&&t.events.stream().noneMatch(e->e.get("stage").equals("total"));i++)pass(s,s.GetLSCard("rebel"));
  assertEquals(3,t.events.size());for(var e:t.events)assertEquals(1f,(Float)e.get("value"),0);results.add(Map.of("name","weapon-each-"+bp,"events",t.events));
 }}
 @Test public void battleAndRedraw(){for(boolean redraw:new boolean[]{false,true}){
  var s=battle();s.SkipToPowerSegment();var dice=s.GetLSCard("dice");s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("five"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));var t=observe(s);
  for(int i=0;i<100&&t.events.stream().noneMatch(e->e.get("stage").equals("total"));i++){
   if(s.DSDecisionAvailable("battle destiny?")){s.DSChooseNo();continue;}if(s.LSDecisionAvailable("battle destiny?")){s.LSChooseYes();continue;}
   if(redraw&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&dice.getZone()==Zone.HAND&&s.LSCardPlayAvailable(dice)){s.LSPlayCard(dice);continue;}
   pass(s,s.GetLSCard("luke"));
  }
  assertEquals(redraw?4:3,t.events.size());results.add(Map.of("name",redraw?"battle-redraw":"battle-one","events",t.events));
 }}
}
