package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.google.gson.GsonBuilder;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual defuse actions with controlled zone changes during their response window. */
public class NativeEngineMineIdentityOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/mine-identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void defuse(){for(String mode:List.of("stay","target-leave","target-return","target-move","source-leave","source-return","source-move")){
  try {
   var s=new VirtualTableScenario(new HashMap<>(Map.of("mine","1_162")),new HashMap<>(Map.of("droid","1_186")),20,20,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
   s.StartGame();s.SkipToPhase(Phase.CONTROL);var site=s.GetLSStartingLocation();var mine=s.GetLSCard("mine");var droid=s.GetDSCard("droid");s.MoveCardsToLocation(site,mine,droid);s.DSActivateForceCheat(3);s.SkipToPhase(Phase.DEPLOY);
   int force=s.GetDSForcePileCount();s.DSUseCardAction(droid,"Defuse");if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(mine))s.DSChooseCard(mine);
   assertTrue(s.GetCurrentDecision().getText(),s.GetCurrentDecision().getText().toLowerCase().contains("response"));
   if(mode.startsWith("target")){if(mode.endsWith("move"))s.MoveCardsToLocation(s.GetDSStartingLocation(),mine);else{s.MoveCardsToLSHand(mine);if(mode.endsWith("return"))s.MoveCardsToLocation(site,mine);}}
   if(mode.startsWith("source")){if(mode.endsWith("move"))s.MoveCardsToLocation(s.GetDSStartingLocation(),droid);else{s.MoveCardsToDSHand(droid);if(mode.endsWith("return"))s.MoveCardsToLocation(site,droid);}}
   s.PassAllResponses();results.add(Map.of("mode",mode,"mineLost",s.GetLSLostPile().contains(mine),"forceSpent",force-s.GetDSForcePileCount()));
  }catch(Throwable e){throw new AssertionError(mode,e);}
 }}
 @Test public void mineCasualtyTiming(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("victim","1_28","gun","1_152")),new HashMap<>(Map.of("mine","1_322")),20,20,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.DRAW);var mine=s.GetDSCard("mine");var victim=s.GetLSCard("victim");var gun=s.GetLSCard("gun");s.MoveCardsToLocation(s.GetLSStartingLocation(),mine,victim);s.AttachCardsTo(victim,gun);s.PrepareDSDestiny(1);
  var events=new ArrayList<Map<String,Object>>();var seen=Collections.newSetFromMap(new IdentityHashMap<EffectResult,Boolean>());
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){
   if(!seen.add(e))return null;
   if(e instanceof AboutToLoseCardFromTableResult)events.add(Map.of("stage","about-to-lose","actor",e.getPerformingPlayerId().equals(VirtualTableScenario.DS)?"dark":"light"));
   if(e instanceof LostCardFromTableResult l)events.add(Map.of("stage","lost","actor",e.getPerformingPlayerId().equals(VirtualTableScenario.DS)?"dark":"light","card",l.getCard().getBlueprintId(false)));
   return null;
  }});
  s.SkipToDSTurn();for(int i=0;i<120&&!s.GetDSLostPile().contains(mine);i++){
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(victim)){s.LSChooseCard(victim);continue;}
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(gun)){s.LSChooseCard(gun);continue;}
   s.PlayerPass(s.GetDecidingPlayer());
  }
  assertTrue(s.GetLSLostPile().contains(victim));assertTrue(s.GetLSLostPile().contains(gun));assertTrue(s.GetDSLostPile().contains(mine));results.add(Map.of("mode","casualty-timing","events",events));
 }

 @Test public void peekEligibility(){for(boolean empty:new boolean[]{false,true}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host","1_28","bin","1_35")),new HashMap<>(),20,20,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("host"));s.AttachCardsTo(s.GetLSCard("host"),s.GetLSCard("bin"));s.LSActivateForceCheat(4);if(empty)for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);s.SkipToPhase(Phase.DEPLOY);
  results.add(Map.of("mode",empty?"peek-empty":"peek-nonempty","available",s.LSCardActionAvailable(s.GetLSCard("bin"))));
 }}

}
