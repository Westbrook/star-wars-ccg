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
public class NativeEngineSubstitutionOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/substitution-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());
  final Set<Integer> drawn=new HashSet<>();final List<Map<String,Object>> events=new ArrayList<>();
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){
   if(seen.contains(e))return null;String stage=null;Float value=null;
   if(e instanceof AboutToDrawDestinyCardResult){stage="before";}
   else if(e instanceof DestinyDrawnResult d){stage="drawn";if(d.getCard()!=null)drawn.add(d.getCard().getPermanentCardId());value=game.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().getDestinyDrawValue();}
   else if(e instanceof DestinyDrawCompleteResult d){stage="complete";value=d.getDestinyValue();}
   else if(e instanceof AboutToCompleteDrawingDestinyResult d){stage="total";value=d.getTotalDestiny(game);}
   if(stage!=null){seen.add(e);String side=e.getPerformingPlayerId();var record=new HashMap<String,Object>(Map.of("stage",stage,"side",side.equals(VirtualTableScenario.DS)?"dark":"light","unresolved",game.getGameState().getUnresolvedDestinyDraw(side).stream().filter(c->drawn.contains(c.getPermanentCardId())).count(),"used",game.getGameState().getUsedPile(side).stream().filter(c->drawn.contains(c.getPermanentCardId())).count()));record.put("value",value);events.add(record);}
   return null;
  }
 }
 private boolean can(VirtualTableScenario s,String player,PhysicalCardImpl card){return s.GetDecidingPlayer().equals(player)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(player.equals(VirtualTableScenario.LS)?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card));}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void smoke(){for(String mode:new String[]{"normal","target-leave","reserve-empty","canceled"}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","rebel","1_28","smoke","5_69","dice","1_84","one","1_28")),new HashMap<>(Map.of("vader","101_5","trooper","1_194","sense","1_267")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(5);s.LSActivateForceCheat(5);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"),s.GetLSCard("rebel"),s.GetDSCard("vader"),s.GetDSCard("trooper"));s.MoveCardsToLSHand(s.GetLSCard("smoke"),s.GetLSCard("dice"),s.GetLSCard("one"));s.MoveCardsToDSHand(s.GetDSCard("sense"));s.SkipToPhase(Phase.BATTLE);s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));s.DSInitiateBattle(s.GetLSStartingLocation());s.SkipToPowerSegment();var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);
  for(int i=0;i<100&&!(can(s,VirtualTableScenario.LS,s.GetLSCard("smoke")));i++){
   if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseNo();else if(s.LSDecisionAvailable("battle destiny?"))s.LSChooseYes();else pass(s);
  }
  assertTrue(s.LSCardPlayAvailable(s.GetLSCard("smoke")));s.LSPlayCard(s.GetLSCard("smoke"));if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(s.GetLSCard("luke")))s.LSChooseCard(s.GetLSCard("luke"));
  if(mode.equals("target-leave")){s.MoveCardsToLSHand(s.GetLSCard("luke"));s.gameState().getBattleState().updateParticipants(s.game());}
  if(mode.equals("reserve-empty"))for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);
  int reserve=s.GetLSReserveDeckCount();
  if(mode.equals("canceled")){
   for(int i=0;i<100&&!(can(s,VirtualTableScenario.DS,s.GetDSCard("sense")));i++)pass(s);assertTrue(s.DSCardPlayAvailable(s.GetDSCard("sense")));s.PrepareDSDestiny(0);s.DSPlayCard(s.GetDSCard("sense"));if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(s.GetDSCard("vader")))s.DSChooseCard(s.GetDSCard("vader"));
  }
  boolean dice=false;for(int i=0;i<140&&t.events.stream().noneMatch(e->e.get("side").equals("light")&&e.get("stage").equals("total"));i++){if(can(s,VirtualTableScenario.LS,s.GetLSCard("dice")))dice=true;pass(s);}
  var events=t.events.stream().filter(e->e.get("side").equals("light")).toList();assertTrue(events.stream().anyMatch(e->e.get("stage").equals("total")));
  results.add(Map.of("name",mode,"events",events,"cardsDrawn",reserve-s.GetLSReserveDeckCount(),"smokeLost",s.GetLSLostPile().contains(s.GetLSCard("smoke")),"diceOffered",dice));
 }}
}
