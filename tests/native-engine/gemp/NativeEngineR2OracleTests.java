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
public class NativeEngineR2OracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/r2-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
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
 private VirtualTableScenario fixture(String site){return new VirtualTableScenario(new HashMap<>(Map.of("r2","2_14","luke","101_2","rebel","1_28","dice","1_84")),new HashMap<>(Map.of("trooper","1_194","reinforce","1_251","lost","1_194")),30,30,
  StartingSetup.LSStartingLocation(site),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);}
 private Trace observe(VirtualTableScenario s){var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);return t;}
 private void pass(VirtualTableScenario s,PhysicalCardImpl... choices){var text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("optional")||text.contains("response")||text.startsWith("verify lost pile")){s.PlayerPass(s.GetDecidingPlayer());return;}for(var c:choices){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);return;}if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);return;}}throw new AssertionError(text);}
 @Test public void printedChoice(){for(int value:new int[]{2,5}){
  var s=fixture("1_129");s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);s.LSActivateForceCheat(4);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("luke"),s.GetLSCard("rebel"),s.GetDSCard("trooper"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToPowerSegment();s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("r2"));var t=observe(s);boolean chosen=false;
  for(int i=0;i<100&&t.events.stream().noneMatch(e->e.get("stage").equals("total"));i++){
   if(s.DSDecisionAvailable("battle destiny?")){s.DSChooseNo();continue;}if(s.LSDecisionAvailable("battle destiny?")){s.LSChooseYes();continue;}
   if(!chosen && s.GetDecidingPlayer().equals(VirtualTableScenario.LS) && s.LSChoiceAvailable("2") && s.LSChoiceAvailable("5")){assertEquals(0,t.events.size());s.LSChoose(""+value);chosen=true;continue;}
   pass(s);
  }
  assertTrue(chosen);assertEquals(3,t.events.size());for(var e:t.events)assertEquals((float)value,(Float)e.get("value"),0);results.add(Map.of("name","printed-"+value,"events",t.events));
 }}
 @Test public void scompResponse(){for(String site:new String[]{"1_129","1_130"})for(int value:new int[]{0,1,3,4,6,7}){
  var s=fixture(site);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(4);var r2=s.GetLSCard("r2");var card=s.GetDSCard("reinforce");s.MoveCardsToLocation(s.GetLSStartingLocation(),r2);s.MoveCardsToDSHand(card);s.MoveCardsToTopOfDSLostPile(s.GetDSCard("lost"));s.SkipToPhase(Phase.DEPLOY);s.PrepareDSDestiny(value);var t=observe(s);int force=s.GetLSForcePile().size(),hand=s.GetLSHand().size(),uses=0;s.DSPlayCard(card);
  for(int i=0;i<120&&!s.GetDSLostPile().contains(card);i++){
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(r2)){
    assertEquals("drawn",t.events.getLast().get("stage"));s.LSUseCardAction(r2);uses++;continue;
   }
   pass(s,s.GetDSCard("lost"));
  }
  assertTrue(s.GetDSLostPile().contains(card));boolean eligible=site.equals("1_129")&&value>=1&&value<=6;assertEquals(eligible?1:0,uses);
  results.add(Map.of("name","scomp-"+site+"-"+value,"uses",uses,"force",s.GetLSForcePile().size()-force,"hand",s.GetLSHand().size()-hand));
 }}
}
