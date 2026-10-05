package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled initial board, actual deployment, movement and react actions.
 * Laser Gate is absent from this pinned reference and not claimed as parity. */
public class NativeEngineLiftTubeOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/lift-tube-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){if(s.GetCurrentDecision().getText().equals("Choose Force to lose")){s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);return;}System.out.println("LIFT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 boolean menu(VirtualTableScenario s,boolean light,String phase){return light?s.LSDecisionAvailable("Choose "+phase+" action"):s.DSDecisionAvailable("Choose "+phase+" action");}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("tube","1_148","rider","1_28","defender","1_28","bay","1_124","planet","1_127")),new HashMap<>(Map.of("tube","1_308","rider","1_194")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.MoveLocationToTable(s.GetLSCard("bay"));return s;}
 @Test public void deployAndMove(){for(boolean light:List.of(true,false)){
  var s=fixture();var tube=light?s.GetLSCard("tube"):s.GetDSCard("tube");var rider=light?s.GetLSCard("rider"):s.GetDSCard("rider");var from=s.GetDSStartingLocation();var to=s.GetLSCard("bay");s.MoveLocationToTable(s.GetLSCard("planet"));s.MoveCardsToLocation(from,rider);s.MoveCardsToHand(tube);
  if(light){s.SkipToLSTurn(Phase.DEPLOY);s.LSActivateForceCheat(8);}else{s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(8);}int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSDeployCard(tube);else s.DSDeployCard(tube);
  var row=new LinkedHashMap<String,Object>();row.put("mode",light?"light-deploy-move":"dark-deploy-move");row.put("interiorAvailable",light?s.LSHasCardChoiceAvailable(from):s.DSHasCardChoiceAvailable(from));row.put("planetAvailable",light?s.LSHasCardChoiceAvailable(s.GetLSCard("planet")):s.DSHasCardChoiceAvailable(s.GetLSCard("planet")));row.put("outsideAvailable",light?s.LSHasCardChoiceAvailable(s.GetLSStartingLocation()):s.DSHasCardChoiceAvailable(s.GetLSStartingLocation()));if(light)s.LSChooseCard(from);else s.DSChooseCard(from);
  for(int i=0;i<80&&!menu(s,light,"Deploy");i++)pass(s);assertEquals(from,tube.getAtLocation());row.put("deployCost",before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()));s.MoveCardsToHand(rider);row.put("passengerCapacity",s.GetPassengerCapacity(tube));row.put("power",s.GetPower(tube));row.put("presence",s.game().getModifiersQuerying().hasPresenceAt(s.gameState(),light?VirtualTableScenario.LS:VirtualTableScenario.DS,from,false,null,null));
  if(light)s.SkipToLSTurn(Phase.MOVE);else s.SkipToPhase(Phase.MOVE);before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();row.put("emptyMoveAvailable",light?s.LSMoveAvailable(tube):s.DSMoveAvailable(tube));if(light){s.LSUseCardAction(tube,"Move");s.LSChooseCard(to);}else{s.DSUseCardAction(tube,"Move");s.DSChooseCard(to);}for(int i=0;i<80&&!menu(s,light,"Move");i++)pass(s);assertEquals(to,tube.getAtLocation());row.put("moveCost",before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()));row.put("regularMoveUsed",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(tube));rows.add(row);
 }}
 @Test public void react(){for(String mode:List.of("board-drain","empty-drain","carried-battle")){
  var s=fixture();var tube=s.GetLSCard("tube");var rider=s.GetLSCard("rider");var enemy=s.GetDSCard("rider");var from=s.GetDSStartingLocation();var to=s.GetLSCard("bay");s.MoveCardsToLocation(from,tube,rider);s.MoveCardsToLocation(to,enemy);
  boolean battle=mode.equals("carried-battle");if(battle){s.BoardAsPassenger(tube,rider);s.MoveCardsToLocation(to,s.GetLSCard("defender"));}
  s.SkipToDSTurn(battle?Phase.BATTLE:Phase.CONTROL);s.LSActivateForceCheat(8);s.DSActivateForceCheat(8);if(battle)s.DSInitiateBattle(to);else s.DSForceDrainAt(to);for(int i=0;i<80&&!s.LSCardActionAvailable(tube,"react");i++)pass(s);assertTrue(s.LSCardActionAvailable(tube,"react"));int before=s.GetLSForcePileCount(),lost=s.GetLSLostPile().size();s.LSUseCardAction(tube,"react");if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(to);
  boolean boarded=false,exited=false;for(int i=0;i<150;i++){
   if(s.LSDecisionAvailable("Perform a movement before")){if(mode.equals("board-drain")&&!boarded){s.LSUseCardAction(rider,"Embark");boarded=true;}else s.LSPass();}
   else if(s.LSDecisionAvailable("Choose where")&&s.LSHasCardChoiceAvailable(tube))s.LSChooseCard(tube);
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Passenger");
   else if(s.LSDecisionAvailable("Perform a movement after")){if(!mode.equals("empty-drain")&&!exited){s.LSUseCardAction(rider,"Disembark");exited=true;}else s.LSPass();}
   else if(tube.getAtLocation()==to&&s.gameState().getMoveAsReactState()==null&&battle)break;
   else if(!battle&&s.DSDecisionAvailable("Choose Control action"))break;
   else pass(s);
  }
  assertEquals(to,tube.getAtLocation());if(!mode.equals("empty-drain"))assertTrue(exited);var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("arrived",tube.getAtLocation()==to);row.put("boarded",boarded);row.put("exited",exited);row.put("aboard",rider.getAttachedTo()==tube);row.put("lostToDrain",s.GetLSLostPile().size()-lost);row.put("regularMoveUsed",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(tube));rows.add(row);
 }}
}
