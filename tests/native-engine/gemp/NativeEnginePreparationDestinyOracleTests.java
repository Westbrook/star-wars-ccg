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
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Explicit component fixtures prepare the battlefield, hands, Force and top
 * destiny. Actual card plays, Sense cancellation and destiny completion run in
 * unchanged GEMP. Relocation is an explicit response-time intervention. */
public class NativeEnginePreparationDestinyOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/preparation-destiny-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());final List<Float> values=new ArrayList<>();
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof DestinyDrawCompleteResult d&&d.getDestinyType()==DestinyType.BATTLE_DESTINY&&seen.add(e))values.add(d.getDestinyValue());return null;}
 }
 boolean can(VirtualTableScenario s,String side,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(side)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&(side.equals(VirtualTableScenario.LS)?s.LSCardPlayAvailable(c):s.DSCardPlayAvailable(c));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()),e);}}
 @Test public void used() {for(boolean light:new boolean[]{false,true})for(String mode:List.of("normal","canceled","relocated")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","trooper","1_28","interrupt","9_51","sense","1_109","die","1_28")),new HashMap<>(Map.of("vader","101_5","interrupt","9_139","sense","1_267","die","1_194")),20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"),s.GetLSCard("trooper"),s.GetDSCard("vader"));
  var card=light?s.GetLSCard("interrupt"):s.GetDSCard("interrupt");var die=light?s.GetLSCard("die"):s.GetDSCard("die");var sense=light?s.GetDSCard("sense"):s.GetLSCard("sense");String side=light?VirtualTableScenario.LS:VirtualTableScenario.DS,opponent=light?VirtualTableScenario.DS:VirtualTableScenario.LS;
  s.MoveCardsToHand(card,sense);s.SkipToPhase(Phase.BATTLE);if(light)s.MoveCardsToTopOfLSReserveDeck(die);else s.MoveCardsToTopOfDSReserveDeck(die);s.DSInitiateBattle(s.GetLSStartingLocation());s.SkipToPowerSegment();var trace=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(trace);
  for(int i=0;i<150&&!can(s,side,card);i++){if(s.DSDecisionAvailable("battle destiny?")){if(light)s.DSChooseNo();else s.DSChooseYes();}else if(s.LSDecisionAvailable("battle destiny?")){if(light)s.LSChooseYes();else s.LSChooseNo();}else pass(s);}
  assertTrue(can(s,side,card));if(light)s.LSPlayCard(card);else s.DSPlayCard(card);
  if(mode.equals("relocated"))s.MoveCardsToHand(die);
  if(mode.equals("canceled")){for(int i=0;i<100&&!can(s,opponent,sense);i++)pass(s);assertTrue(can(s,opponent,sense));if(light){s.PrepareDSDestiny(0);s.DSPlayCard(sense);if(s.DSHasCardChoiceAvailable(s.GetDSCard("vader")))s.DSChooseCard(s.GetDSCard("vader"));}else{s.PrepareLSDestiny(0);s.LSPlayCard(sense);if(s.LSHasCardChoiceAvailable(s.GetLSCard("luke")))s.LSChooseCard(s.GetLSCard("luke"));}}
  for(int i=0;i<150&&trace.values.isEmpty();i++)pass(s);
  assertEquals(1,trace.values.size());assertEquals(mode.equals("canceled")?1f:2f,trace.values.get(0),0.001);
  rows.add(Map.of("side",light?"light":"dark","mode",mode,"value",trace.values.get(0),"interruptZone",card.getZone().toString(),"drawZone",die.getZone().toString()));
 }}
}
