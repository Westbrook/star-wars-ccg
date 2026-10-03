package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.effects.RetrieveForceEffect;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.timing.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real Secret Plans shield trigger and production retrieval/payment effects.
 * Fixture grants retrieval directly; shield setup/play are outside this test. */
public class NativeEngineSecretPlansOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/secret-plans-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void retrievals(){for(String mode:new String[]{"pay","small-lost","insufficient","decline","empty","zero","depart"}){
  int amount=mode.equals("zero")?0:3,force=mode.equals("insufficient")?2:3,lost=mode.equals("empty")?0:mode.equals("small-lost")||mode.equals("insufficient")?1:3;
  var s=new VirtualTableScenario(new HashMap<>(Map.of("a","1_28","b","1_28","c","1_28")),new HashMap<>(Map.of("plans","13_86")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);
  s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));
  for(String key:new String[]{"a","b","c"})s.MoveCardsToLSHand(s.GetLSCard(key));
  for(int i=0;i<lost;i++)s.MoveCardsToTopOfLSLostPile(s.GetLSCard(new String[]{"a","b","c"}[i]));
  while(s.GetLSForcePileCount()<force)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>force)s.LSUseForceCheat(1);
  s.SkipToPhase(Phase.DEPLOY);
  var forceBefore=new ArrayList<>(s.GetLSForcePile());var lostBefore=new ArrayList<>(s.GetLSLostPile());boolean[] done={false};int decisions=0;
  var action=new SystemQueueAction();action.appendEffect(new RetrieveForceEffect(action,VirtualTableScenario.LS,amount));
  action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});
  s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  for(int i=0;i<150&&!done[0];i++){
   String text=s.GetCurrentDecision().getText();
   if(text.contains("proceed with Force retrieval")){decisions++;if(mode.equals("depart"))s.MoveCardsToDSHand(s.GetDSCard("plans"));if(mode.equals("decline"))s.LSChooseNo();else s.LSChooseYes();}
   else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertTrue("completed "+mode,done[0]);
  int spent=force-s.GetLSForcePileCount(),retrieved=lost-s.GetLSLostPileCount();
  assertEquals(mode.equals("insufficient")||mode.equals("decline")||mode.equals("empty")||mode.equals("zero")?0:3,spent);
  assertEquals(spent>0?lost:0,retrieved);
  results.add(Map.of("name",mode,"amount",amount,"force",force,"lost",lost,"spent",spent,"retrieved",retrieved,"decisions",decisions,
   "usedOrder",s.GetLSUsedPile().stream().filter(c->forceBefore.contains(c)||lostBefore.contains(c)).map(c->forceBefore.contains(c)?"force-"+forceBefore.indexOf(c):"lost-"+lostBefore.indexOf(c)).toList()));
 }}
}
