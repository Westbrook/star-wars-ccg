package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
/** State observation only: removal below is a fixture intervention, not a card action. */
public class NativeEngineReactCancellationOracleTests {
 @Test public void drainAfterReactPresenceLeaves() throws Exception {
  var s=new VirtualTableScenario(new HashMap<>(Map.of("wolf","1_30")),new HashMap<>(Map.of("trooper","1_194","corridor","1_284")),10,10,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();
  s.SkipToPhase(Phase.ACTIVATE);
  s.LSActivateForceCheat(3);
  s.DSActivateForceCheat(3);
  var bay=s.GetLSStartingLocation();
  var wolf=s.GetLSCard("wolf");
  s.MoveCardsToLocation(bay,s.GetDSCard("trooper"));
  s.MoveLocationToTable(s.GetDSCard("corridor"));
  s.MoveCardsToLocation(s.GetDSCard("corridor"),wolf);
  s.SkipToPhase(Phase.CONTROL);
  s.DSForceDrainAt(bay);
  for(int i=0;i<30;i++){var d=s.GetAwaitingDecision(VirtualTableScenario.LS);if(d!=null&&d.getDecisionParameters().get("cardId")!=null&&s.ActionAvailable(VirtualTableScenario.LS,wolf,"Move"))break;
  s.PlayerPass(s.GetDecidingPlayer());}
  s.LSUseCardAction(wolf,"Move");if(s.GetCurrentDecision().getText().contains("Choose where"))s.LSChooseCard(bay);
  for(int i=0;i<40&&wolf.getAtLocation()!=bay;i++)s.PlayerPass(s.GetDecidingPlayer());assertEquals(bay,wolf.getAtLocation());
  var drain=s.gameState().getForceDrainState();assertNotNull(drain);boolean whilePresent=drain.canContinue();
  s.MoveCardsToLSHand(wolf);boolean afterRemoved=drain.canContinue();
  Files.writeString(Path.of("/opt/gemp-swccg/react-cancellation-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(Map.of("whileReactPresencePresent",whilePresent,"afterFixtureRemoval",afterRemoved)));
  assertFalse(whilePresent);assertTrue(afterRemoved);
 }
}
