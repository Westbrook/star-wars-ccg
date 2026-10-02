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

/** Actual Gambler's Luck and Han's Dice card actions, passive destiny tracing.
 * Participant changes are explicit fixture interventions at weapons timing. */
public class NativeEngineGamblersLuckOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/gamblers-luck-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());
  final List<Map<String,Object>> events=new ArrayList<>();
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){
   if(seen.contains(e)||!VirtualTableScenario.LS.equals(e.getPerformingPlayerId()))return null;String stage=null;Float value=null;
   if(e instanceof AboutToDrawDestinyCardResult){stage="before";}
   else if(e instanceof DestinyDrawnResult d){stage="drawn";value=game.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().getDestinyDrawValue();}
   else if(e instanceof DestinyDrawCompleteResult d){stage="complete";value=d.getDestinyValue();}
   else if(e instanceof AboutToCompleteDrawingDestinyResult d){stage="total";value=d.getTotalDestiny(game);}
   if(stage!=null){seen.add(e);var record=new HashMap<String,Object>(Map.of("stage",stage,"unresolved",game.getGameState().getUnresolvedDestinyDraw(VirtualTableScenario.LS).size()));record.put("value",value);events.add(record);}
   return null;
  }
 }
 private boolean can(VirtualTableScenario s,PhysicalCardImpl c,String text){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.LSCardActionAvailable(c,text);}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void luck(){for(String mode:new String[]{"han-one","lando-one","lando-two","base-plus","departed","skip","dice","short","canceled","repeat","decline","delay","delay-base","smoke-delay"}){
  boolean han=mode.equals("han-one")||mode.equals("dice")||mode.equals("smoke-delay"),one=han||mode.equals("lando-one");
  var ls=new HashMap<String,String>(Map.of("gambler",han?"1_11":"5_5","luck","5_48","dice","1_84","one","1_28","five","1_115","zero","1_124","three","5_69","luke","101_2","rebel","1_28"));
  ls.put("copy","5_48");ls.put("smoke","5_69");
  var s=new VirtualTableScenario(ls,new HashMap<>(Map.of("vader","101_5","sense","1_267")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("luck"),s.GetLSCard("copy"),s.GetLSCard("dice"),s.GetLSCard("one"),s.GetLSCard("five"),s.GetLSCard("zero"),s.GetLSCard("three"),s.GetLSCard("luke"),s.GetLSCard("rebel"));s.LSActivateForceCheat(6);s.DSActivateForceCheat(6);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("gambler"),s.GetDSCard("vader"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());s.PassBattleStartResponses();if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSPass();
  s.MoveCardsToLSHand(s.GetLSCard("smoke"));s.MoveCardsToDSHand(s.GetDSCard("sense"));var luck=s.GetLSCard("luck");var dice=s.GetLSCard("dice");s.LSUseCardAction(luck,one?"Add one":"Add two");
  if(mode.equals("canceled")){
   for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.DSCardPlayAvailable(s.GetDSCard("sense")));i++)pass(s);
   s.PrepareDSDestiny(0);s.DSPlayCard(s.GetDSCard("sense"));if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(s.GetDSCard("vader")))s.DSChooseCard(s.GetDSCard("vader"));
  }
  for(int i=0;i<80&&!s.GetLSLostPile().contains(luck);i++)pass(s);assertTrue(s.GetLSLostPile().contains(luck));
  if(mode.equals("repeat")){
   for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose weapons segment"));i++)pass(s);
   assertTrue(s.GetCurrentDecision().getText().contains("Choose weapons segment"));assertFalse(can(s,s.GetLSCard("copy"),"Add two"));
  }
  if((mode.equals("base-plus")||mode.equals("delay-base")||mode.equals("smoke-delay")))s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"));
  if(mode.equals("departed")){s.MoveCardsToLSHand(s.GetLSCard("gambler"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("rebel"));}
  s.gameState().getBattleState().updateParticipants(s.game());
  if(mode.equals("short"))for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);
  else {if((mode.equals("base-plus")||mode.equals("delay-base")||mode.equals("delay")))s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("three"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("zero"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("five"));}
  s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);boolean usedDice=false,usedSmoke=false;
  for(int i=0;i<250&&!s.IsReachedDamageSegment();i++){
   if(s.DSDecisionAvailable("battle destiny?")){s.DSChooseNo();continue;}
   if(s.LSDecisionAvailable("battle destin")&&s.GetCurrentDecision().getDecisionParameters().get("results")!=null){if(mode.equals("skip"))s.LSChooseNo();else s.LSChooseYes();continue;}
   if(mode.equals("smoke-delay")&&!usedSmoke&&can(s,s.GetLSCard("smoke"),null)){s.LSPlayCard(s.GetLSCard("smoke"));usedSmoke=true;continue;}
   if(can(s,luck,"Draw ")&&!mode.equals("decline")&&(!(mode.equals("delay")||mode.equals("delay-base"))||t.events.stream().anyMatch(e->e.get("stage").equals("complete")))){s.LSUseCardAction(luck,one?"Draw two":"Draw three");continue;}
   if(mode.equals("dice")&&!usedDice&&can(s,dice,null)){s.LSPlayCard(dice);usedDice=true;continue;}
   String text=s.GetCurrentDecision().getText().toLowerCase();
   if(text.startsWith("choose")&&text.contains("destiny")){if(one||mode.equals("short"))s.LSChooseCard(s.GetLSCard(mode.equals("dice")?"five":"one"));else if(mode.equals("delay")||mode.equals("delay-base"))s.LSChooseCards(s.GetLSCard("five"),s.GetLSCard("zero"));else s.LSChooseCards(s.GetLSCard("one"),s.GetLSCard("five"));continue;}
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(s.GetLSCard("gambler"))){s.LSChooseCard(s.GetLSCard("gambler"));continue;}
   pass(s);
  }
  assertTrue(s.IsReachedDamageSegment());var labels=new HashMap<PhysicalCard,String>();for(String label:new String[]{"one","five","zero","three"})labels.put(s.GetLSCard(label),label);
  results.add(Map.of("name",mode,"events",t.events,"used",s.GetLSUsedPile().stream().filter(labels::containsKey).map(labels::get).toList(),"darkAttrition",s.GetUnpaidDSAttrition(),"darkDamage",s.GetUnpaidDSBattleDamage(),"lightDamage",s.GetUnpaidLSBattleDamage(),"luckLost",s.GetLSLostPile().contains(luck),"repeatAvailable",false));
 }}
}
