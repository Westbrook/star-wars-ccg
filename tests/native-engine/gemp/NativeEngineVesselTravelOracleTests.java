package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual movement commands on a controlled board. Deployment helper uses real actions. */
public class NativeEngineVesselTravelOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/vessel-travel-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("TRAVEL "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void movement(){for(String mode:List.of("hyperspace","land-bay","takeoff-bay","landspeed-one","landspeed-two","unpiloted","ywing-land","ywing-takeoff")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ywing","1_147","han","1_11","dune","1_130","camp","1_131","yavin","1_135")),new HashMap<>(Map.of("scout","1_305","crawler","1_309","pilot","1_179","driver","1_184")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var bay=s.GetLSStartingLocation();var planet=s.GetDSStartingLocation();var dune=s.GetLSCard("dune");var camp=s.GetLSCard("camp");var yavin=s.GetLSCard("yavin");s.MoveLocationToTable(dune);s.MoveLocationToTable(camp);s.MoveLocationToTable(yavin);
  boolean light=mode.startsWith("ywing"),vehicle=mode.startsWith("landspeed")||mode.equals("unpiloted");var host=light?s.GetLSCard("ywing"):s.GetDSCard(vehicle?"crawler":"scout");var crew=light?s.GetLSCard("han"):s.GetDSCard(vehicle?"driver":"pilot");
  var from=vehicle||mode.equals("takeoff-bay")?bay:mode.equals("ywing-takeoff")?dune:planet;var to=mode.equals("hyperspace")?yavin:mode.equals("land-bay")?bay:mode.equals("ywing-land")?dune:mode.equals("landspeed-one")?dune:mode.equals("landspeed-two")?camp:planet;
  if(light){s.MoveCardsToLocation(from,host);s.BoardAsPilot(host,crew);s.SkipToLSTurn(Phase.MOVE);s.LSActivateForceCheat(8);}else{s.MoveCardsToDSHand(host,crew);s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(15);var helper=new NativeEngineVesselsOracleTests();helper.deploy(s,host,from,null);if(!mode.equals("unpiloted"))helper.deploy(s,crew,host,vehicle?"Driver":"Pilot");s.SkipToPhase(Phase.MOVE);}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);var q=s.game().getModifiersQuerying();
  if(mode.equals("unpiloted")){row.put("moveAvailable",s.DSMoveAvailable(host));rows.add(row);continue;}
  int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();var steps=new ArrayList<String>();
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof MovedUsingLandspeedResult r&&r.getMovedCards().contains(host))steps.add(r.getMovedTo().getBlueprintId(true)+":"+r.isInitialMove()+":"+r.isMoveComplete());return null;}});
  String action=mode.contains("takeoff")?"Take off":mode.contains("land")&&!vehicle?"Land":"Move";
  if(light)s.LSUseCardAction(host,action);else s.DSUseCardAction(host,action);
  if(light)s.LSChooseCard(to);else s.DSChooseCard(to);
  for(int i=0;i<120&&host.getAtLocation()!=to;i++)pass(s);assertEquals(to,host.getAtLocation());
  for(int i=0;i<80&&!(light?s.LSDecisionAvailable("Choose Move action"):s.DSDecisionAvailable("Choose Move action"));i++)pass(s);
  row.put("cost",before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()));row.put("destination",host.getAtLocation().getBlueprintId(true));row.put("crewAboard",crew.getAttachedTo()==host);row.put("hostMoved",q.hasPerformedRegularMoveThisTurn(host));row.put("crewMoved",q.hasPerformedRegularMoveThisTurn(crew));row.put("power",s.GetPower(host));row.put("steps",steps);rows.add(row);
 }}
 @Test public void deploymentTargets(){for(boolean light:List.of(false,true)){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_147","dune","1_130")),new HashMap<>(Map.of("ship","1_305")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.MoveLocationToTable(s.GetLSCard("dune"));var ship=light?s.GetLSCard("ship"):s.GetDSCard("ship");s.MoveCardsToHand(ship);
  if(light){s.SkipToLSTurn(Phase.DEPLOY);s.LSActivateForceCheat(8);s.LSDeployCard(ship);}else{s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(8);s.DSDeployCard(ship);}
  var row=new LinkedHashMap<String,Object>();row.put("mode",light?"ywing-deploy-sites":"scout-deploy-sites");row.put("bay",light?s.LSHasCardChoiceAvailable(s.GetLSStartingLocation()):s.DSHasCardChoiceAvailable(s.GetLSStartingLocation()));row.put("planet",light?s.LSHasCardChoiceAvailable(s.GetDSStartingLocation()):s.DSHasCardChoiceAvailable(s.GetDSStartingLocation()));row.put("exterior",light?s.LSHasCardChoiceAvailable(s.GetLSCard("dune")):s.DSHasCardChoiceAvailable(s.GetLSCard("dune")));rows.add(row);
 }}

}
