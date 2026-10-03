package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Production primitives and real battles. Controlled modifiers only. */
public class NativeEngineActivationBattleOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/activation-battle-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("hero","101_2","source","1_72")),new HashMap<>(Map.of("hero","101_5")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("source"));return s;}
 @Test public void activation(){for(String mode:List.of("zero","one","three","short","blocked","mid-block","source-leaves","changed-top")){
  var s=fixture();s.SkipToPhase(Phase.DEPLOY);var source=s.GetLSCard("source");int count=mode.equals("zero")?0:mode.equals("one")?1:3;
  if(mode.equals("short"))for(var c:new ArrayList<>(s.GetLSReserveDeck()).subList(1,s.GetLSReserveDeckCount()))s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)c);
  if(mode.equals("blocked"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new SpecialFlagModifier(source,ModifierFlag.MAY_NOT_ACTIVATE_FORCE,LS));
  var originals=new ArrayList<>(s.GetLSReserveDeck());var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());var order=new ArrayList<Integer>();boolean[] done={false};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof ActivatedForceResult a&&seen.add(e)){order.add(originals.indexOf(a.getCard()));if(order.size()==1){if(mode.equals("mid-block"))g.getModifiersEnvironment().addUntilEndOfTurnModifier(new SpecialFlagModifier(source,ModifierFlag.MAY_NOT_ACTIVATE_FORCE,LS));if(mode.equals("source-leaves"))s.MoveCardsToTopOfLSLostPile(source);if(mode.equals("changed-top"))s.MoveCardsToTopOfLSReserveDeck((PhysicalCardImpl)originals.getLast());}}return null;}});
  var action=new TopLevelGameTextAction(source,source.getCardId());action.appendEffect(new ActivateForceEffect(action,LS,count));action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);pass(s);for(int i=0;i<150&&!done[0];i++)pass(s);assertTrue(done[0]);
  rows.add(Map.of("kind","activation","name",mode,"count",count,"activated",order.size(),"order",order,"reserveCount",originals.size(),"generationActivated",s.game().getModifiersQuerying().getForceActivatedThisTurn(LS,true)));
 }}
 @Test public void generation(){for(float amount:new float[]{0.14159f,0.5f,1.49f,1.5f,2.6f}){var s=fixture();s.gameState().setPlayersTotalForceGeneration(LS,amount);var q=s.game().getModifiersQuerying();int n=0;while(!q.isActivateForceFromForceGenerationLimitReached(s.gameState(),LS)){q.forceActivated(LS,true);n++;assertTrue(n<5);}rows.add(Map.of("kind","generation","amount",amount,"limit",n));}}
 @Test public void battle(){for(float damage:new float[]{0.14159f,0.49f,0.5f,1.49f,1.5f,3.14f})for(boolean forfeit:List.of(false,true)){
  var s=fixture();var site=s.GetLSStartingLocation();var luke=s.GetLSCard("hero");var vader=s.GetDSCard("hero");s.MoveCardsToLocation(site,luke,vader);s.DSActivateForceCheat(3);float fv=forfeit?(damage<1?0.1f:damage<2?0.5f:3f):0;
  s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new PowerModifier(site,vader,damage-2));if(forfeit)s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetForfeitModifier(site,luke,fv));
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToDamageSegment(false);float initial=s.gameState().getBattleState().getBattleDamageRemaining(s.game(),LS);boolean forfeited=false;int cards=0;var remainder=new ArrayList<Float>();
  for(int i=0;i<250&&s.gameState().getBattleState()!=null;i++){
   if(s.GetDecidingPlayer().equals(LS)&&s.GetCurrentDecision().getText().startsWith("Choose Force to lose or a card from battle to forfeit")){
    float remaining=s.gameState().getBattleState().getBattleDamageRemaining(s.game(),LS);remainder.add(remaining);
    if(forfeit&&!forfeited){s.LSChooseCard(luke);forfeited=true;}else{cards++;s.LSChooseCard(s.GetTopOfLSReserveDeck());}
   }else pass(s);
  }
  assertNull(s.gameState().getBattleState());assertEquals(forfeit,forfeited);assertEquals(damage,initial,0.00001);
  rows.add(Map.of("kind","battle","damage",damage,"forfeit",fv,"cardsLost",cards,"remainder",remainder,"characterLost",forfeited));
 }}
}
