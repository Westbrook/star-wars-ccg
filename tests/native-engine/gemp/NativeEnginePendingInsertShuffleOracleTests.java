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
/** Production shuffle/activation and insert effects; a fixture proxy grants the shuffle response. */
public class NativeEnginePendingInsertShuffleOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/pending-insert-shuffle-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 @Test public void pendingShuffle(){for(String owner:List.of(LS,DS))for(int count:List.of(0,1,4))for(boolean cancel:List.of(false,true)){
  var base=new NativeEngineReserveInsertOracleTests();var s=base.fixture(owner,Math.max(2,count+1));var card=base.deploy(s,owner);String target=s.game().getOpponent(owner);if(count==0)s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)s.gameState().getReserveDeck(target).getLast());new NativeEngineInsertTimingOracleTests().position(s,target,1);boolean[]shuffled={false},pending={false},ordinary={false};int[]depth={-1},reveals={0};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof InsertCardRevealedResult ir&&ir.getCard()==card&&!shuffled[0]){
   shuffled[0]=true;reveals[0]++;var a=new RequiredGameTextTriggerAction(card,card.getCardId());a.setText("Controlled shuffle response");a.appendEffect(new ShuffleReserveDeckEffect(a,target,target));a.appendEffect(new PassthruEffect(a){@Override protected void doPlayEffect(SwccgGame g){pending[0]=card.isInsertCardRevealed();ordinary[0]=!g.getGameState().getReserveDeck(target,false).getFirst().isInserted();depth[0]=g.getGameState().getReserveDeck(target,false).indexOf(card);}});if(cancel)a.appendEffect(new CancelRevealedInsertCardEffect(a,ir));return List.of(a);}return null;}});
  boolean[]done={false};var activation=new TopLevelGameTextAction(card,card.getCardId());activation.appendEffect(new ActivateForceEffect(activation,target,1));activation.appendEffect(new PassthruEffect(activation){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(activation);for(int i=0;i<150&&!done[0];i++)base.pass(s);assertTrue(done[0]);assertTrue(pending[0]);assertEquals(count>0,ordinary[0]);assertEquals(count>0,depth[0]>0);assertTrue(s.gameState().getLostPile(owner).contains(card));rows.add(Map.of("kind","shuffle","owner",owner.equals(LS)?"light":"dark","count",count,"cancel",cancel,"pendingAfterShuffle",pending[0],"topOrdinary",ordinary[0],"buried",depth[0]>0,"ownerLost",true,"ordinaryRemaining",s.gameState().getReserveDeck(target).size(),"prohibited",s.game().getModifiersQuerying().isActivatingForceProhibited(s.gameState(),target)));
 }}
 @Test public void nestedExposure(){
  var s=new NativeEngineInsertResponseOracleTests().fixture();var first=s.GetLSCard("anger");var second=s.GetLSCard("second");var telepathy=s.GetDSCard("telepathy");var order=new ArrayList<String>();boolean[]granted={false},parentPending={false};
  for(var card:List.of(first,second)){s.gameState().removeCardsFromZone(List.of(card));card.setInserted(true);s.gameState().addCardToZone(card,Zone.RESERVE_DECK,DS);}new NativeEngineInsertTimingOracleTests().position(s,DS,1);
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof InsertCardRevealedResult ir){var card=ir.getCard();if(card==second){order.add("second");parentPending[0]=first.isInsertCardRevealed();}if(card==first&&!granted[0]){granted[0]=true;order.add("first");var a=new RequiredGameTextTriggerAction(first,first.getCardId());a.setText("Controlled shuffle and later exposure");a.appendEffect(new ShuffleReserveDeckEffect(a,DS,DS));a.appendEffect(new PassthruEffect(a){@Override protected void doPlayEffect(SwccgGame g){
   // Controlled post-shuffle layout: ordinary, second, ordinary, first.
   var real=new ArrayList<>(g.getGameState().getReserveDeck(DS));g.getGameState().removeCardsFromZone(new ArrayList<>(g.getGameState().getReserveDeck(DS,false)));for(var c:real)g.getGameState().addCardToZone(c,Zone.RESERVE_DECK,DS);g.getGameState().removeCardsFromZone(real.subList(0,2));g.getGameState().addCardToTopOfZone(first,Zone.RESERVE_DECK,DS);g.getGameState().addCardToTopOfZone(real.get(1),Zone.RESERVE_DECK,DS);g.getGameState().addCardToTopOfZone(second,Zone.RESERVE_DECK,DS);g.getGameState().addCardToTopOfZone(real.get(0),Zone.RESERVE_DECK,DS);first.setInserted(true);first.setInsertCardRevealed(true);second.setInserted(true);
  }});a.appendEffect(new ActivateForceEffect(a,DS,1));return List.of(a);}}return null;}});
  boolean[]done={false};var a=new TopLevelGameTextAction(first,first.getCardId());a.appendEffect(new ActivateForceEffect(a,DS,1));a.appendEffect(new PassthruEffect(a){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(a);var base=new NativeEngineReserveInsertOracleTests();for(int i=0;i<200&&!done[0];i++)base.pass(s);assertTrue(done[0]);assertTrue(parentPending[0]);assertEquals(List.of("first","second"),order);assertTrue(s.GetLSLostPile().containsAll(List.of(first,second)));rows.add(Map.of("kind","nested","order",order,"parentPendingAtSecond",parentPending[0],"bothOwnerLost",true));
 }
}
