package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.gempukku.swccgo.cards.effects.CancelBattleEffect;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import java.util.function.BooleanSupplier;
import static org.junit.Assert.*;
/** Actual card plays and phase triggers. Fixed insert depth and the named battle-cancellation proxy are fixture controls. */
public class NativeEngineTelepathyOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/telepathy-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("anger","4_16","troop","1_28","hero","101_2","sense","1_109")),new HashMap<>(Map.of("telepathy","5_149","second","5_149","troop","1_194","alter","1_234")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(8);s.DSActivateForceCheat(8);s.MoveCardsToLSHand(s.GetLSCard("anger"),s.GetLSCard("sense"));s.MoveCardsToDSHand(s.GetDSCard("telepathy"),s.GetDSCard("second"),s.GetDSCard("alter"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("troop"),s.GetDSCard("troop"));return s;}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().equals("You have not activated Force. Do you want to Pass?"))s.PlayerDecided(s.GetDecidingPlayer(),"0");else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new RuntimeException("phase="+s.GetCurrentPhase()+" player="+s.GetDecidingPlayer()+" decision="+s.GetCurrentDecision().getText()+" params="+s.GetCurrentDecision().getDecisionParameters(),e);}}
 void until(VirtualTableScenario s,BooleanSupplier check){for(int i=0;i<700&&!check.getAsBoolean();i++)pass(s);assertTrue(s.GetCurrentDecision().getText(),check.getAsBoolean());}
 boolean can(VirtualTableScenario s,String side,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(side)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&(side.equals(LS)?s.LSCardPlayAvailable(c):s.DSCardPlayAvailable(c));}
 boolean used(VirtualTableScenario s,PhysicalCardImpl c){return s.gameState().getUsedPile(c.getOwner()).contains(c);}
 void reveal(VirtualTableScenario s){var c=s.GetLSCard("anger");s.gameState().removeCardsFromZone(List.of(c));c.setInserted(true);s.gameState().addCardToZone(c,Zone.RESERVE_DECK,DS);new NativeEngineInsertTimingOracleTests().position(s,DS,1);var a=new TopLevelGameTextAction(c,c.getCardId());a.appendEffect(new ActivateForceEffect(a,DS,1));s.game().getActionsEnvironment().addActionToStack(a);until(s,()->c.isInsertCardRevealed());}
 @Test public void insertCancellation(){for(String mode:List.of("insert","reveal"))for(boolean sense:List.of(false,true)){
  var s=fixture();var a=s.GetLSCard("anger");var t=s.GetDSCard("telepathy");s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("hero"));s.PrepareLSDestiny(0);
  if(mode.equals("insert")){s.SkipToLSTurn(Phase.DEPLOY);s.LSDeployCard(a);}else reveal(s);
  until(s,()->can(s,DS,t));assertFalse(can(s,DS,s.GetDSCard("alter")));s.DSPlayCard(t);
  if(sense){var c=s.GetLSCard("sense");until(s,()->can(s,LS,c));s.LSPlayCard(c);if(s.GetDecidingPlayer().equals(LS)&&s.GetCurrentDecision().getText().contains("highest-ability"))s.LSChooseCard(s.GetLSCard("hero"));until(s,()->used(s,c));}
  until(s,()->used(s,t)||s.GetDSLostPile().contains(t));
  if(mode.equals("insert")&&sense)until(s,()->a.isInserted());
  if(mode.equals("reveal")&&sense)until(s,()->s.GetLSLostPile().contains(a));
  assertEquals(sense,s.GetDSLostPile().contains(t));assertEquals(!sense,used(s,t));assertEquals(!sense||mode.equals("reveal"),s.GetLSLostPile().contains(a));
  rows.add(Map.of("kind",mode,"sense",sense,"telepathyLost",s.GetDSLostPile().contains(t),"telepathyUsed",used(s,t),"angerLost",s.GetLSLostPile().contains(a),"angerInserted",a.isInserted()));
 }}
 @Test public void payOrCancel(){for(String mode:List.of("battle","drain"))for(int force:List.of(0,1,2,3))for(boolean pay:List.of(false,true)){
  var s=fixture();var t=s.GetDSCard("telepathy");if(mode.equals("drain"))s.MoveCardsToDSHand(s.GetDSCard("troop"));s.SkipToLSTurn(mode.equals("battle")?Phase.BATTLE:Phase.CONTROL);
  int before=force+(mode.equals("battle")?1:0);while(s.GetLSForcePileCount()>before)s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)s.GetLSForcePile().getFirst());while(s.GetLSForcePileCount()<before)s.LSActivateForceCheat(1);
  int[]ending={0};boolean[]canceled={false};s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof CancelBattleResult)canceled[0]=true;if(e instanceof BattleEndingResult||e instanceof BattleEndedResult)ending[0]++;return null;}});
  if(mode.equals("battle"))s.LSInitiateBattle(s.GetLSStartingLocation());else s.LSForceDrainAt(s.GetLSStartingLocation());until(s,()->can(s,DS,t));var drainState=s.gameState().getForceDrainState();s.DSPlayCard(t);
  if(force>=2){until(s,()->s.GetDecidingPlayer().equals(LS)&&s.GetCurrentDecision().getText().equals("Choose effect"));s.PlayerDecided(LS,pay?"0":"1");}
  until(s,()->used(s,t));if(mode.equals("drain"))canceled[0]=!drainState.canContinue();boolean paid=force>=2&&pay;assertEquals(force-(paid?2:0),s.GetLSForcePileCount());assertEquals(!paid,canceled[0]);assertFalse(can(s,DS,s.GetDSCard("second")));if(mode.equals("battle")&&!paid){until(s,()->s.gameState().getBattleState()==null);assertEquals(0,ending[0]);}
  rows.add(Map.of("kind",mode,"force",force,"pay",pay,"forceRemaining",s.GetLSForcePileCount(),"canceled",canceled[0],"telepathyUsed",true,"endingEventsAtObservation",ending[0]));
 }}
 @Test public void deadline(){for(Phase phase:List.of(Phase.CONTROL,Phase.BATTLE,Phase.DRAW)){
  var s=fixture();s.SkipToPhase(phase);reveal(s);until(s,()->s.GetLSLostPile().contains(s.GetLSCard("anger")));s.MoveCardsToLSHand(s.GetLSCard("anger"));
  int[]nextTurns={0};s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof StartOfTurnResult)nextTurns[0]++;return null;}});
  until(s,s::AwaitingDSForceLossPayment);float loss=s.gameState().getTopForceLossState().getLoseForceEffect().getForceLossRemaining(s.game());assertEquals(4,loss,0);assertEquals(Phase.BATTLE,s.GetCurrentPhase());assertEquals(phase==Phase.CONTROL?0:2,nextTurns[0]);
  rows.add(Map.of("kind","deadline","revealedDuring",phase.toString(),"turnsLater",nextTurns[0],"loss",loss,"sourceRetrieved",true));
 }}
 @Test public void initiatedCanceledBattleSatisfies(){var s=fixture();reveal(s);until(s,()->s.GetLSLostPile().contains(s.GetLSCard("anger")));
  boolean[]canceled={false};s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction>getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof BattleInitiatedResult&&!canceled[0]){canceled[0]=true;var a=new RequiredGameTextTriggerAction(s.GetDSCard("troop"),s.GetDSCard("troop").getCardId());a.setText("Controlled battle cancellation");a.appendEffect(new CancelBattleEffect(a));return List.of(a);}return null;}});
  until(s,s::AwaitingDSBattlePhaseActions);s.DSInitiateBattle(s.GetLSStartingLocation());until(s,()->s.GetCurrentPhase()==Phase.MOVE||s.AwaitingDSForceLossPayment());assertTrue(canceled[0]);assertFalse(s.AwaitingDSForceLossPayment());rows.add(Map.of("kind","canceled-battle-satisfies","loss",0,"controlledCancel",true));
 }
}
