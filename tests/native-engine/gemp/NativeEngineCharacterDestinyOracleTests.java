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
public class NativeEngineCharacterDestinyOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/character-destiny-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
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
 private VirtualTableScenario fixture(){var ls=new HashMap<>(Map.of("han","1_11","luke","101_2","rebel","1_28","lost","1_28","gun","1_153","reinforce","1_106","c3po","1_5","r2","2_14"));var ds=new HashMap<>(Map.of("vader","1_168","tarkin","1_179","praji","1_167","trooper","1_194"));var s=new VirtualTableScenario(ls,ds,30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(12);s.DSActivateForceCheat(12);return s;}
 private void pass(VirtualTableScenario s,PhysicalCardImpl... choices){var text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("optional")||text.contains("response")||text.startsWith("verify lost pile")){s.PlayerPass(s.GetDecidingPlayer());return;}for(var c:choices){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);return;}if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);return;}}throw new AssertionError(text);}
 @Test public void characterResponses(){for(String who:List.of("han","tarkin"))for(String kind:List.of("battle","weapon","general")){
  var s=fixture();var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("han"),s.GetLSCard("luke"),s.GetLSCard("rebel"),s.GetDSCard("vader"),s.GetDSCard("tarkin"),s.GetDSCard("praji"),s.GetDSCard("trooper"));s.MoveCardsToLSHand(s.GetLSCard("reinforce"));s.MoveCardsToTopOfLSLostPile(s.GetLSCard("lost"));s.AttachCardsTo(s.GetLSCard("han"),s.GetLSCard("gun"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);
  if(kind.equals("battle"))s.SkipToPowerSegment();else{s.PassBattleStartResponses();if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS))s.DSPass();}
  s.PrepareLSDestiny(5);s.PrepareLSDestiny(1);var original=s.GetLSReserveDeck().getFirst();var t=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(t);int force=s.GetLSForcePileCount(),uses=0;
  if(kind.equals("weapon"))s.LSUseCardAction(s.GetLSCard("gun"),"Fire");if(kind.equals("general"))s.LSPlayCard(s.GetLSCard("reinforce"));
  for(int i=0;i<180;i++){
   if(who.equals("tarkin")&&uses>0&&s.GetLSUsedPile().contains(original)||who.equals("han")&&t.events.stream().anyMatch(e->e.get("stage").equals("total")))break;
   if(s.DSDecisionAvailable("battle destiny?")){s.DSChooseNo();continue;}if(s.LSDecisionAvailable("battle destiny?")){s.LSChooseYes();continue;}
   if(who.equals("han")&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(s.GetLSCard("han"),"Cancel")){force=s.GetLSForcePileCount();s.LSUseCardAction(s.GetLSCard("han"),"Cancel");uses++;continue;}
   if(who.equals("tarkin")&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("tarkin"),"Cancel")){force=s.GetLSForcePileCount();s.DSUseCardAction(s.GetDSCard("tarkin"),"Cancel");uses++;continue;}
   pass(s,s.GetDSCard("trooper"),s.GetLSCard("lost"));
  }
  assertEquals(1,uses);assertEquals(who.equals("han")?4:1,t.events.size());results.add(Map.of("name",who+"-"+kind,"events",t.events,"uses",uses,"cost",force-s.GetLSForcePileCount()));
 }}
 @Test public void praji(){for(String mode:List.of("absent","present","remote","hand","return")){
  var s=fixture();var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("c3po"),s.GetLSCard("r2"),s.GetLSCard("rebel"),s.GetLSCard("luke"));var praji=s.GetDSCard("praji");
  if(!mode.equals("absent"))s.MoveCardsToLocation(mode.equals("remote")?s.GetDSStartingLocation():site,praji);if(mode.equals("hand")||mode.equals("return"))s.MoveCardsToDSHand(praji);if(mode.equals("return"))s.MoveCardsToLocation(site,praji);
  s.SkipToPhase(Phase.DEPLOY);var q=s.game().getModifiersQuerying();assertEquals(mode.equals("present")||mode.equals("return"),q.isGameTextCanceled(s.gameState(),s.GetLSCard("r2")));results.add(Map.of("name","praji-"+mode,"power",q.getTotalPowerAtLocation(s.gameState(),site,VirtualTableScenario.LS,false,false),"forfeit",q.getForfeit(s.gameState(),s.GetLSCard("r2")),"c3poCanceled",q.isGameTextCanceled(s.gameState(),s.GetLSCard("c3po")),"r2Canceled",q.isGameTextCanceled(s.gameState(),s.GetLSCard("r2"))));
 }}
}
