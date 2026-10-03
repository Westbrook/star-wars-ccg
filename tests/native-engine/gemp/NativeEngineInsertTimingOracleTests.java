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
/** Real insert cards/effects; fixed physical depth and cancellation grant are fixture controls. */
public class NativeEngineInsertTimingOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/insert-timing-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void position(VirtualTableScenario s,String target,int n){var cards=new ArrayList<>(s.gameState().getReserveDeck(target));s.gameState().removeCardsFromZone(cards);for(var c:cards)s.gameState().addCardToZone(c,Zone.RESERVE_DECK,target);for(int i=n-1;i>=0;i--){var c=cards.get(i);s.gameState().removeCardsFromZone(List.of(c));s.gameState().addCardToTopOfZone(c,Zone.RESERVE_DECK,target);}}
 @Test public void activation(){for(String owner:List.of(LS,DS))for(int depth:List.of(1,2))for(boolean cancel:List.of(false,true)){
  var base=new NativeEngineReserveInsertOracleTests();var s=base.fixture(owner,6);var insert=base.deploy(s,owner);String target=s.game().getOpponent(owner);position(s,target,depth);int force=s.gameState().getForcePile(target).size();boolean[]done={false};var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());var revealedAt=new ArrayList<Integer>();
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof InsertCardRevealedResult ir&&seen.add(e)){revealedAt.add(g.getGameState().getForcePile(target).size()-force);if(cancel){var a=new RequiredGameTextTriggerAction(insert,insert.getCardId());a.setText("Controlled insert cancellation");a.appendEffect(new CancelRevealedInsertCardEffect(a,ir));return List.of(a);}}return null;}});
  var action=new TopLevelGameTextAction(insert,insert.getCardId());action.appendEffect(new ActivateForceEffect(action,target,3));action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);for(int i=0;i<200&&!done[0];i++)base.pass(s);assertTrue(done[0]);int activated=s.gameState().getForcePile(target).size()-force;assertEquals(cancel?3:depth,activated);assertEquals(List.of(depth),revealedAt);assertTrue(s.gameState().getLostPile(owner).contains(insert));boolean prohibited=s.game().getModifiersQuerying().isActivatingForceProhibited(s.gameState(),target);assertEquals(!cancel,prohibited);
  rows.add(Map.of("kind","activation","owner",owner.equals(LS)?"light":"dark","depth",depth,"cancel",cancel,"activated",activated,"revealedAt",revealedAt,"ownerLost",true,"prohibited",prohibited));
 }}
 @Test public void titleLimit(){for(String owner:List.of(LS,DS)){
  var base=new NativeEngineReserveInsertOracleTests();var s=base.fixture(owner,6);var insert=base.deploy(s,owner);if(owner.equals(LS))s.MoveCardsToLSHand(insert);else s.MoveCardsToDSHand(insert);s.SkipToNextTurn(owner);s.SkipToPhase(Phase.DEPLOY);boolean again=owner.equals(LS)?s.LSDeployAvailable(insert):s.DSDeployAvailable(insert);assertFalse(again);rows.add(Map.of("kind","title-limit","owner",owner.equals(LS)?"light":"dark","again",again));
 }}
}
