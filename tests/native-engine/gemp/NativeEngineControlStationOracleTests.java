package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.Action;
import com.google.gson.GsonBuilder;
import org.junit.Test;import org.junit.AfterClass;
import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
/** Controlled table fixtures query unchanged card providers; ordinary Light
 * permission also executes a real move. Stolen-owner observation is retained
 * even if it differs from the printed side-specific permission. */
public class NativeEngineControlStationOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/control-station-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 List<String> moves(VirtualTableScenario s,PhysicalCardImpl ship,String actor){List<Action> actions=actor.equals(ship.getOwner())?ship.getBlueprint().getTopLevelActions(actor,s.game(),ship):ship.getBlueprint().getOpponentsCardTopLevelActions(actor,s.game(),ship);return actions.stream().map(a->a.getText()).filter(x->x.startsWith("Move")||x.startsWith("Transfer")).toList();}
 @Test public void controlStation(){for(String mode:List.of("controlled","uncontrolled","contested","text-canceled","stolen","leader","leader-canceled")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("rebel","1_28")),new HashMap<>(Map.of("ship","4_167","station","4_160","theatre","4_161","corridor","4_162","leader","1_179","trooper","1_194","destination","5_164")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var from=s.GetDSStartingLocation();var ship=s.GetDSCard("ship");var station=s.GetDSCard("station");var target=s.GetDSCard("destination");var rebel=s.GetLSCard("rebel");var leader=s.GetDSCard("leader");
  for(String name:List.of("destination","station","theatre","corridor"))s.MoveLocationToTable(s.GetDSCard(name));s.MoveCardsToLocation(from,ship);
  if(!mode.equals("uncontrolled")&&!mode.startsWith("leader"))s.MoveCardsToLocation(station,rebel);
  if(mode.equals("contested"))s.MoveCardsToLocation(station,s.GetDSCard("trooper"));
  if(mode.startsWith("leader"))s.MoveCardsToLocation(station,leader);
  if(mode.equals("stolen"))ship.setOwner(LS);
  s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);s.SkipToPhase(Phase.MOVE);
  if(mode.equals("text-canceled")||mode.equals("leader-canceled")){var card=mode.equals("text-canceled")?station:leader;card.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(from,card));}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("owner",ship.getOwner().equals(LS)?"light":"dark");row.put("darkMoves",moves(s,ship,DS));row.put("lightMoves",moves(s,ship,LS));row.put("power",s.GetPower(ship));
  if(mode.equals("controlled")){
   for(int i=0;i<40&&!(s.GetDecidingPlayer().equals(LS)&&s.LSCardActionAvailable(ship,"Move"));i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(s.LSCardActionAvailable(ship,"Move"));int lf=s.GetLSForcePileCount(),df=s.GetDSForcePileCount();s.LSUseCardAction(ship,"Move");s.LSChooseCard(target);for(int i=0;i<80&&ship.getAtLocation()!=target;i++)s.PlayerPass(s.GetDecidingPlayer());assertEquals(target,ship.getAtLocation());row.put("lightCost",lf-s.GetLSForcePileCount());row.put("darkCost",df-s.GetDSForcePileCount());row.put("regularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(ship));
  }
  rows.add(row);
 }}
}
