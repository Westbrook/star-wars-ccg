package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.cards.GameConditions;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real astromech deployments and hyperspace movement; board/crew and cancellation are controlled. */
public class NativeEngineNavigationOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/navigation-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("NAV "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 void deploy(VirtualTableScenario s,PhysicalCardImpl card,PhysicalCardImpl host){s.LSDeployCard(card);for(int i=0;i<100;i++){if(s.LSDecisionAvailable("Choose Deploy action")&&card.getAttachedTo()==host)return;if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Passenger");else if(s.LSDecisionAvailable("Choose where")||s.LSDecisionAvailable("Choose target"))s.LSChooseCard(host);else pass(s);}fail("Deployment did not settle");}
 @Test public void navigation(){for(String mode:List.of("red3-r2","red5-r2","gold5-r2","gold5-mixed","gold5-duplicates","unpiloted","landed","r2-text-canceled","ship-text-canceled","no-droid","departure")){
  String shipId=mode.startsWith("gold5")?"1_142":mode.equals("red5-r2")?"2_71":"1_145";
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship",shipId,"pilot","1_19","r2","2_14","x1","1_24","x2","1_24","planet","1_127","extra","1_11")),new HashMap<>(Map.of("scout","1_305")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("2_143"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=s.GetLSCard("ship");var planet=s.GetLSCard("planet");var droid=s.GetLSCard(mode.equals("gold5-duplicates")?"x1":"r2");var pilot=s.GetLSCard("pilot");s.MoveLocationToTable(planet);s.MoveCardsToLocation(mode.equals("landed")?s.GetLSStartingLocation():planet,ship);if(!mode.equals("unpiloted"))s.BoardAsPilot(ship,pilot);s.MoveCardsToLSHand(droid,s.GetLSCard("x2"),s.GetLSCard("extra"));s.LSActivateForceCheat(24);s.SkipToLSTurn(Phase.DEPLOY);int before=s.GetLSForcePileCount();
  if(!mode.equals("no-droid"))deploy(s,droid,ship);if(mode.equals("gold5-mixed")||mode.equals("gold5-duplicates"))deploy(s,s.GetLSCard("x2"),ship);
  int cost=before-s.GetLSForcePileCount();if(mode.endsWith("text-canceled")){s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,mode.startsWith("r2")?droid:ship));s.LSPass();s.DSPass();}
  var row=new LinkedHashMap<String,Object>();var q=s.game().getModifiersQuerying();row.put("mode",mode);row.put("deploy",cost);row.put("power",s.GetPower(ship));row.put("maneuver",s.GetManeuver(ship));row.put("hyperspeed",s.GetHyperspeed(ship));row.put("navigation",q.hasAstromechOrNavComputer(s.gameState(),ship));row.put("droidNavigation",q.hasAstromech(s.gameState(),ship));row.put("scomp",!mode.equals("no-droid")&&GameConditions.isAtScompLink(s.game(),droid));row.put("astromechCapacity",q.getAstromechCapacity(s.gameState(),ship));row.put("immunity",q.getImmunityToAttritionLessThan(s.gameState(),ship));
  s.SkipToPhase(Phase.MOVE);boolean travel=s.LSCardActionAvailable(ship,"Move using hyperspeed");row.put("canMove",travel);boolean arrived=false;int force=s.GetLSForcePileCount();if(travel){s.LSUseCardAction(ship,"Move using hyperspeed");for(int i=0;i<100&&ship.getAtLocation()!=s.GetDSStartingLocation();i++){if(s.LSDecisionAvailable("Choose")&&s.LSHasCardChoiceAvailable(s.GetDSStartingLocation()))s.LSChooseCard(s.GetDSStartingLocation());else {if(mode.equals("departure")&&s.GetCurrentDecision().getText().contains("MOVING_USING_HYPERSPEED")&&droid.getAttachedTo()==ship)s.MoveCardsToLSHand(droid);pass(s);}}arrived=ship.getAtLocation()==s.GetDSStartingLocation();assertTrue(arrived);}row.put("arrived",arrived);row.put("moveCost",force-s.GetLSForcePileCount());row.put("afterHyperspeed",s.GetHyperspeed(ship));rows.add(row);
 }}
}
