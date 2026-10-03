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
import java.util.function.BooleanSupplier;
import static org.junit.Assert.*;
/** Actual nested Sense plays while a revealed insert is pending. Board placement and physical insert depth are fixture controls. */
public class NativeEngineInsertResponseOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/insert-response-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 void until(VirtualTableScenario s,BooleanSupplier check){for(int i=0;i<500&&!check.getAsBoolean();i++)pass(s);assertTrue(check.getAsBoolean());}
 boolean can(VirtualTableScenario s,String side,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(side)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&(side.equals(LS)?s.LSCardPlayAvailable(c):s.DSCardPlayAvailable(c));}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("anger","4_16","second","1_42","sense","1_109","hero","101_2")),new HashMap<>(Map.of("telepathy","5_149","sense","1_267","hero","101_5")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("anger"),s.GetLSCard("second"),s.GetLSCard("sense"));s.MoveCardsToDSHand(s.GetDSCard("telepathy"),s.GetDSCard("sense"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("hero"),s.GetDSCard("hero"));return s;}
 @Test public void nestedSense(){for(int destiny:List.of(0,6))for(boolean adjacent:List.of(false,true))for(boolean covered:List.of(false,true)){
  var s=fixture();var anger=s.GetLSCard("anger");var second=s.GetLSCard("second");var telepathy=s.GetDSCard("telepathy");var lsSense=s.GetLSCard("sense");var dsSense=s.GetDSCard("sense");var reveals=new ArrayList<Integer>();
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof InsertCardRevealedResult r&&!reveals.contains(r.getCard().getPermanentCardId()))reveals.add(r.getCard().getPermanentCardId());return null;}});
  s.PrepareLSDestiny(0);s.PrepareDSDestiny(destiny);s.PrepareDSDestiny(1);
  s.gameState().removeCardsFromZone(List.of(anger));anger.setInserted(true);s.gameState().addCardToZone(anger,Zone.RESERVE_DECK,DS);
  if(adjacent){s.gameState().removeCardsFromZone(List.of(second));second.setInserted(true);s.gameState().addCardToZone(second,Zone.RESERVE_DECK,DS);}
  new NativeEngineInsertTimingOracleTests().position(s,DS,1);var activation=new TopLevelGameTextAction(anger,anger.getCardId());activation.appendEffect(new ActivateForceEffect(activation,DS,1));s.game().getActionsEnvironment().addActionToStack(activation);until(s,()->anger.isInsertCardRevealed());
  assertEquals(anger,s.gameState().getReserveDeck(DS,false).getFirst());if(covered)s.PrepareDSDestiny(destiny);
  until(s,()->can(s,DS,telepathy));s.DSPlayCard(telepathy);until(s,()->can(s,LS,lsSense));s.LSPlayCard(lsSense);if(s.GetDecidingPlayer().equals(LS)&&s.GetCurrentDecision().getText().contains("highest-ability"))s.LSChooseCard(s.GetLSCard("hero"));
  until(s,()->can(s,DS,dsSense));int before=s.GetDSReserveDeckCount();s.DSPlayCard(dsSense);if(s.GetDecidingPlayer().equals(DS)&&s.GetCurrentDecision().getText().contains("highest-ability"))s.DSChooseCard(s.GetDSCard("hero"));
  until(s,()->s.GetDSUsedPile().contains(dsSense));boolean pending=anger.isInsertCardRevealed();boolean hidden=!second.isInsertCardRevealed()&&!s.GetLSLostPile().contains(second);int darkDraws=before-s.GetDSReserveDeckCount();
  until(s,()->s.GetDSUsedPile().contains(telepathy)||s.GetDSLostPile().contains(telepathy));
  var row=new LinkedHashMap<String,Object>();row.put("kind","sense-chain");row.put("destiny",destiny);row.put("adjacent",adjacent);row.put("covered",covered);row.put("darkOrdinaryDraws",darkDraws);row.put("lightSenseLost",s.GetLSLostPile().contains(lsSense));row.put("telepathyUsed",s.GetDSUsedPile().contains(telepathy));row.put("firstRemainedPendingDuringDraw",pending);row.put("secondStayedHiddenDuringDraw",hidden);row.put("angerInDarkUsed",s.GetDSUsedPile().contains(anger));row.put("angerInLightUsed",s.GetLSUsedPile().contains(anger));row.put("angerLost",s.GetLSLostPile().contains(anger));row.put("revealsAtTelepathyCompletion",reveals.size());rows.add(row);
 }}
}
