package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.RetrieveForceEffect;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Production retrieval/modifier/payment mechanisms. Real Fenson/Tarl and Secret
 * Plans text; synthetic modifier grants are labeled, not complete card games. */
public class NativeEngineRetrievalPolicyOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/retrieval-policy-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void quantities(){for(String mode:new String[]{"add","subtract","zero","reset","minimum-reset","immune","uncancelable","fenson-on","fenson-off","fenson-other","tarl","tarl-other"}){
  String bp=mode.equals("fenson-on")||mode.equals("tarl-other")?"1_101":mode.equals("fenson-off")?"5_59":"1_99";
  var s=new VirtualTableScenario(new HashMap<>(Map.of("source",bp)),new HashMap<>(Map.of("plans","13_86","fenson","8_108","tarl","8_114")),20,20,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("source"));s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));
  if(mode.startsWith("fenson"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("fenson"));
  if(mode.startsWith("tarl"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("tarl"));
  while(s.GetLSForcePileCount()<8)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>8)s.LSUseForceCheat(1);
  while(s.GetLSLostPileCount()<8)s.MoveCardsToTopOfLSLostPile((PhysicalCardImpl)s.GetLSReserveDeck().getLast());
  s.SkipToPhase(Phase.DEPLOY);
  var env=s.game().getModifiersEnvironment();var source=s.GetLSCard("source");var provider=s.GetDSCard("plans");
  if(mode.equals("add"))env.addUntilEndOfTurnModifier(new ForceRetrievalModifier(provider,2,VirtualTableScenario.LS));
  if(mode.equals("subtract"))env.addUntilEndOfTurnModifier(new ForceRetrievalModifier(provider,-2,VirtualTableScenario.LS));
  if(mode.equals("zero"))env.addUntilEndOfTurnModifier(new ForceRetrievalModifier(provider,-9,VirtualTableScenario.LS));
  if(mode.equals("reset")){env.addUntilEndOfTurnModifier(new ForceRetrievalModifier(provider,9,VirtualTableScenario.LS));env.addUntilEndOfTurnModifier(new ResetForceRetrievalFromCardModifier(provider,source,2,VirtualTableScenario.LS));}
  if(mode.equals("minimum-reset")){env.addUntilEndOfTurnModifier(new ResetForceRetrievalFromCardModifier(provider,source,3,VirtualTableScenario.LS));env.addUntilEndOfTurnModifier(new ResetForceRetrievalFromCardModifier(provider,source,1,VirtualTableScenario.LS));}
  if(mode.equals("immune"))env.addUntilEndOfTurnModifier(new ForceRetrievalImmuneToSecretPlansModifier(provider,source));
  var forceBefore=new ArrayList<>(s.GetLSForcePile());var lostBefore=new ArrayList<>(s.GetLSLostPile());boolean[] done={false};int decisions=0;
  var action=new TopLevelGameTextAction(source,source.getCardId());
  action.appendEffect(new RetrieveForceEffect(action,VirtualTableScenario.LS,5){@Override public boolean mayNotBeCanceled(){return mode.equals("uncancelable");}});
  action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});
  s.game().getActionsEnvironment().addActionToStack(action);s.PlayerPass(s.GetDecidingPlayer());
  for(int i=0;i<250&&!done[0];i++){String text=s.GetCurrentDecision().getText();if(text.contains("proceed with Force retrieval")){decisions++;if(mode.equals("uncancelable"))s.LSChooseNo();else s.LSChooseYes();}else s.PlayerPass(s.GetDecidingPlayer());}
  assertTrue(mode,done[0]);
  results.add(Map.of("name",mode,"source",bp,"spent",8-s.GetLSForcePileCount(),"retrieved",8-s.GetLSLostPileCount(),"decisions",decisions,"usedOrder",s.GetLSUsedPile().stream().filter(c->forceBefore.contains(c)||lostBefore.contains(c)).map(c->forceBefore.contains(c)?"force-"+forceBefore.indexOf(c):"lost-"+lostBefore.indexOf(c)).toList()));
 }}
}
