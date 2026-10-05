package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real Ability, Ability, Ability deployment and phase-end triggers. Fixture
 * relocations and synthetic ability modifiers are explicitly named probes. */
public class NativeEnginePhaseTextOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/phase-text-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("base","1_28","troop","1_28","extra","1_28","droid","1_6","alter","1_71")),new HashMap<>(Map.of("effect","5_110","a","1_194","b","1_194","barrier","1_237")),16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.LSActivateForceCheat(8);s.DSActivateForceCheat(8);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("base"),s.GetDSCard("a"),s.GetDSCard("b"));s.MoveCardsToDSHand(s.GetDSCard("effect"));s.SkipToPhase(Phase.DEPLOY);s.DSPlayCard(s.GetDSCard("effect"));s.PassAllResponses();assertEquals(Zone.SIDE_OF_TABLE,s.GetDSCard("effect").getZone());s.MoveCardsToLSHand(s.GetLSCard("troop"),s.GetLSCard("extra"),s.GetLSCard("droid"),s.GetLSCard("alter"));s.SkipToLSTurn(Phase.DEPLOY);s.PassAllResponses();return s;}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private void deploy(VirtualTableScenario s,String key){var c=s.GetLSCard(key);for(int i=0;i<20&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(c));i++)pass(s);s.LSPlayCard(c);s.LSChooseCard(s.GetLSStartingLocation());s.PassAllResponses();assertEquals(Zone.AT_LOCATION,c.getZone());}
 private Map<String,Object> finish(VirtualTableScenario s,String name){for(int i=0;i<100&&!s.AwaitingLSForceLossPayment()&&s.gameState().getCurrentPhase()!=Phase.BATTLE;i++)pass(s);var row=new LinkedHashMap<String,Object>();row.put("name",name);row.put("loss",s.AwaitingLSForceLossPayment()?s.gameState().getTopForceLossState().getLoseForceEffect().getForceLossRemaining(s.game()):0);row.put("effectLost",s.GetDSLostPile().contains(s.GetDSCard("effect")));row.put("phase",s.gameState().getCurrentPhase().toString());return row;}
 @Test public void suppression(){for(String mode:new String[]{"suppressed","suppressed-outnumbered","restore-after-deploy","restore-no-deploy"}){
  var s=fixture();var effect=s.GetDSCard("effect");boolean[] active={true};effect.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(s.GetLSStartingLocation(),effect,(state,query)->active[0]));
  if(mode.equals("suppressed-outnumbered")){deploy(s,"troop");deploy(s,"extra");}
  if(mode.equals("restore-after-deploy"))deploy(s,"troop");
  if(mode.startsWith("restore")){active[0]=false;effect.setGameTextCanceled(false);}
  var row=finish(s,mode);results.add(row);
 }}
}
