package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual ship/pilot deployment; fixed starting locations and Force are fixtures. */
public class NativeEngineCustomTieOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/custom-tie-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void customTie(){for(String mode:List.of("matched","pilot-canceled","ship-canceled","landed","unpiloted","pilot-departed","other-pilot","other-ship")){
  String shipBp=mode.equals("other-ship")?"1_299":"1_306",pilotBp=mode.equals("other-pilot")?"1_179":"1_168";
  var s=new VirtualTableScenario(new HashMap<String,String>(),new HashMap<>(Map.of("ship",shipBp,"pilot",pilotBp)),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("2_143"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=s.GetDSCard("ship");var pilot=s.GetDSCard("pilot");var planet=s.GetDSStartingLocation();var target=List.of("landed","unpiloted").contains(mode)?s.GetLSStartingLocation():planet;
  s.MoveCardsToDSHand(ship,pilot);s.DSActivateForceCheat(20);s.SkipToDSTurn(Phase.DEPLOY);int before=s.GetDSForcePileCount();s.DSDeployCard(ship);
  for(int n=0;n<160;n++){
   if(s.DSDecisionAvailable("Choose Deploy action")&&ship.getAtLocation()==target)break;
   if(s.DSDecisionAvailable("Do you want to simultaneously")){if(mode.equals("unpiloted"))s.DSChooseNo();else s.DSChooseYes();}
   else if(s.DSDecisionAvailable("Choose a pilot from hand"))s.DSChooseCard(pilot);
   else if(s.DSDecisionAvailable("Choose where to deploy"))s.DSChooseCard(target);
   else pass(s);
  }
  assertTrue(s.DSDecisionAvailable("Choose Deploy action"));assertEquals(target,ship.getAtLocation());assertEquals(!mode.equals("unpiloted"),pilot.getAttachedTo()==ship);
  int cost=before-s.GetDSForcePileCount();
  if(mode.endsWith("canceled")){var source=mode.startsWith("pilot")?pilot:ship;source.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,source));}
  if(mode.equals("pilot-departed"))s.MoveCardsToDSHand(pilot);
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",cost);row.put("power",s.GetPower(ship));row.put("maneuver",s.GetManeuver(ship));row.put("hyperspeed",mode.equals("other-ship")?null:s.GetHyperspeed(ship));row.put("immunity",q.getImmunityToAttritionLessThan(s.gameState(),ship));row.put("operational",q.isPiloted(s.gameState(),ship,false));row.put("navigation",q.hasAstromechOrNavComputer(s.gameState(),ship));rows.add(row);
 }}
}
