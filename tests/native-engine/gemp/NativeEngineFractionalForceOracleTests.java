package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.evaluators.ConstantEvaluator;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Unmodified production primitives and actual Off The Edge; controlled numeric fixtures. */
public class NativeEngineFractionalForceOracleTests {
 static final String LS=VirtualTableScenario.LS;
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/fractional-force-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().contains("Draw destiny?"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("source","5_59","target","1_31","a","1_28","b","1_28","c","1_28","d","1_28")),new HashMap<>(Map.of("plans","13_86")),40,40,StartingSetup.LSStartingLocation("5_79"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("source"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("target"));for(var key:List.of("a","b","c","d")){s.MoveCardsToLSHand(s.GetLSCard(key));s.MoveCardsToTopOfLSLostPile(s.GetLSCard(key));}while(s.GetLSForcePileCount()<6)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>6)s.LSUseForceCheat(1);return s;
 }
 @Test public void primitives(){for(String kind:List.of("retrieve","loss","use","plans"))for(float amount:new float[]{0.14159f,0.49f,0.5f,1.49f,1.5f,2.6f}){
  var s=fixture();if(kind.equals("plans"))s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));s.SkipToPhase(Phase.DEPLOY);
  var source=s.GetLSCard("source");var action=new TopLevelGameTextAction(source,source.getCardId());boolean[] done={false};
  if(kind.equals("loss"))action.appendEffect(new LoseForceEffect(action,LS,amount));else if(kind.equals("use"))action.appendEffect(new UseForceEffect(action,LS,amount));else action.appendEffect(new RetrieveForceEffect(action,LS,amount));
  action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);pass(s);int payments=0;
  for(int i=0;i<250&&!done[0];i++){String text=s.GetCurrentDecision().getText();if(text.contains("proceed with Force retrieval")){payments++;s.LSChooseYes();}else if(s.AwaitingLSForceLossPayment())s.LSChooseCard(s.GetTopOfLSReserveDeck());else pass(s);}assertTrue(kind+amount,done[0]);
  results.add(Map.of("kind",kind,"amount",amount,"lost",Math.max(0,s.GetLSLostPileCount()-4),"retrieved",Math.max(0,4-s.GetLSLostPileCount()),"spent",6-s.GetLSForcePileCount(),"paymentChoices",payments));
 }}
 @Test public void offEdge(){for(float targetValue:new float[]{2.85841f,2.51f,2.5f,3.14159f,3.49f,3.5f}){
  var s=fixture();var target=s.GetLSCard("target");var source=s.GetLSCard("source");s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new DestinyModifier(s.GetDSStartingLocation(),target,new ConstantEvaluator(targetValue-3)));s.PrepareLSDestiny(3);s.SkipToPhase(Phase.DEPLOY);s.DSPass();s.LSPlayCard(source);
  for(int i=0;i<180&&!s.GetLSLostPile().contains(source);i++){String text=s.GetCurrentDecision().getText();if(text.startsWith("Choose character"))s.LSChooseCard(target);else if(s.AwaitingLSForceLossPayment())s.LSChooseCard(s.GetTopOfLSReserveDeck());else pass(s);}assertTrue(s.GetLSLostPile().contains(source));int retrieved=0;for(var key:List.of("a","b","c","d"))if(s.GetLSUsedPile().contains(s.GetLSCard(key)))retrieved++;
  results.add(Map.of("kind","off-edge","targetValue",targetValue,"lost",s.GetLSLostPileCount()-5+retrieved,"retrieved",retrieved,"lostTarget",s.GetLSLostPile().contains(target)));
 }}
}
