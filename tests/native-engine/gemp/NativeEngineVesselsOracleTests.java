package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual ship/vehicle/crew deployments; starting locations and opposing board are controlled fixtures. */
public class NativeEngineVesselsOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/vessels-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){if(s.GetCurrentDecision().getText().startsWith("Choose card to put on Lost Pile")){s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);return;}System.out.println("VESSEL "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void menu(VirtualTableScenario s){for(int i=0;i<60&&!s.DSDecisionAvailable("Choose Deploy action");i++)pass(s);assertTrue(s.DSDecisionAvailable("Choose Deploy action"));}
 void deploy(VirtualTableScenario s,PhysicalCardImpl c,PhysicalCardImpl target,String role){menu(s);s.DSDeployCard(c);for(int i=0;i<80;i++){
   if(role==null?c.getAtLocation()==target:c.getAttachedTo()==target)break;
   System.out.println("DEPLOY "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());
   if(s.DSDecisionAvailable("Choose capacity"))s.DSChoose(role);else if(s.DSDecisionAvailable("Choose where")||s.DSDecisionAvailable("Choose target"))s.DSChooseCard(target);else pass(s);
  }assertTrue(role==null?c.getAtLocation()==target:c.getAttachedTo()==target);menu(s);
 }
 @Test public void occupancy(){for(String mode:List.of("scout-pilot","scout-passenger","scout-shared","landed","crawler-driver","crawler-passenger","unpiloted")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ywing","1_147","han","1_11")),new HashMap<>(Map.of("scout","1_305","crawler","1_309","pilot","1_179","passenger","1_194","driver","1_184")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();boolean vehicle=mode.startsWith("crawler")||mode.equals("unpiloted");var host=s.GetDSCard(vehicle?"crawler":"scout");var location=vehicle||mode.equals("landed")?s.GetLSStartingLocation():s.GetDSStartingLocation();var pilot=s.GetDSCard("pilot");var passenger=s.GetDSCard("passenger");var driver=s.GetDSCard("driver");s.MoveCardsToDSHand(host,pilot,passenger,driver);s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(15);int force=s.GetDSForcePileCount();deploy(s,host,location,null);int deployedCost=force-s.GetDSForcePileCount();
  if(mode.equals("scout-pilot")||mode.equals("scout-shared")||mode.equals("landed"))deploy(s,pilot,host,"Pilot");
  if(mode.equals("scout-passenger")||mode.equals("scout-shared")||mode.equals("crawler-passenger"))deploy(s,passenger,host,"Passenger");
  if(mode.equals("crawler-driver"))deploy(s,driver,host,"Driver");
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("deploymentCost",deployedCost);row.put("hostPower",s.GetPower(host));row.put("ability",q.getTotalAbilityAtLocation(s.gameState(),DS,location));row.put("presence",q.hasPresenceAt(s.gameState(),DS,location,false,null,null));row.put("pilot",s.IsAboardAsPilot(host,pilot));row.put("passenger",s.IsAboardAsPassenger(host,passenger));row.put("freePassengers",s.GetPassengerCapacity(host));rows.add(row);
 }}
 @Test public void spaceBattle(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ywing","1_147","han","1_11","top","1_115")),new HashMap<>(Map.of("scout","1_305","pilot","1_179","passenger","1_194","top","1_194")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var planet=s.GetDSStartingLocation();var scout=s.GetDSCard("scout");var pilot=s.GetDSCard("pilot");var passenger=s.GetDSCard("passenger");s.MoveCardsToDSHand(scout,pilot,passenger);s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(15);deploy(s,scout,planet,null);deploy(s,pilot,scout,"Pilot");deploy(s,passenger,scout,"Passenger");s.MoveCardsToLocation(planet,s.GetLSCard("ywing"));s.BoardAsPilot(s.GetLSCard("ywing"),s.GetLSCard("han"));s.SkipToPhase(Phase.BATTLE);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("top"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("top"));
  var row=new LinkedHashMap<String,Object>();row.put("mode","space-battle");
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof BattleDestinyDrawsCompleteForBothPlayersResult){row.put("darkPower",s.GetDSTotalPower());row.put("lightPower",s.GetLSTotalPower());}return null;}});
  s.DSInitiateBattle(planet);for(int i=0;i<160&&!s.IsReachedDamageSegment();i++){if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseYes();else if(s.LSDecisionAvailable("battle destiny?"))s.LSChooseYes();else pass(s);}assertTrue(s.IsReachedDamageSegment());row.put("darkDamage",s.GetUnpaidDSBattleDamage());row.put("darkAttrition",s.GetUnpaidDSAttrition());
  for(int i=0;i<60&&!s.AwaitingDSBattleDamagePayment();i++)pass(s);s.DSChooseCard(scout);if(s.DSDecisionAvailable("Do you still want to forfeit"))s.DSChooseYes();for(int i=0;i<100&&!s.GetDSLostPile().containsAll(List.of(scout,pilot,passenger));i++)pass(s);assertTrue(s.GetDSLostPile().containsAll(List.of(scout,pilot,passenger)));row.put("afterDamage",s.GetUnpaidDSBattleDamage());row.put("afterAttrition",s.GetUnpaidDSAttrition());row.put("crewLost",true);rows.add(row);
 }

}
