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
public class NativeEngineMatchingPilotOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/matching-pilot-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("PILOT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario table(Map<String,String> ls,Map<String,String> ds){return new VirtualTableScenario(new HashMap<>(ls),new HashMap<>(ds),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);}
 void deploy(VirtualTableScenario s,boolean dark,PhysicalCardImpl pilot,PhysicalCardImpl ship){if(dark)s.DSDeployCard(pilot);else s.LSDeployCard(pilot);for(int i=0;i<100;i++){if(s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose Deploy action")&&pilot.getAttachedTo()==ship)return;if(s.GetCurrentDecision().getText().contains("Choose capacity")){if(dark)s.DSChoose("Pilot");else s.LSChoose("Pilot");}else if(s.GetCurrentDecision().getText().contains("Choose where")||s.GetCurrentDecision().getText().contains("Choose target")){if(dark)s.DSChooseCard(ship);else s.LSChooseCard(ship);}else pass(s);}fail("deploy did not settle");}
 @Test public void matching(){for(String pilotBp:List.of("1_3","2_23","1_173"))for(String mode:List.of("matched","other-ship","landed","pilot-canceled","ship-canceled")){
  boolean dark=pilotBp.equals("1_173");String shipBp=mode.equals("other-ship")?(dark?"1_305":"1_147"):dark?"1_299":pilotBp.equals("2_23")?"2_70":"1_145";
  var ls=new HashMap<String,String>(Map.of("planet","1_127"));var ds=new HashMap<String,String>();var own=dark?ds:ls;own.put("pilot",pilotBp);own.put("ship",shipBp);(dark?ls:ds).put("enemy",dark?"1_147":"1_302");var s=table(ls,ds);s.StartGame();var planet=s.GetLSCard("planet");var pilot=dark?s.GetDSCard("pilot"):s.GetLSCard("pilot");var ship=dark?s.GetDSCard("ship"):s.GetLSCard("ship");var enemy=dark?s.GetLSCard("enemy"):s.GetDSCard("enemy");s.MoveLocationToTable(planet);s.MoveCardsToLocation(mode.equals("landed")?s.GetLSStartingLocation():planet,ship);s.MoveCardsToLocation(planet,enemy);if(dark){s.MoveCardsToDSHand(pilot);s.DSActivateForceCheat(12);s.SkipToDSTurn(Phase.DEPLOY);}else{s.MoveCardsToLSHand(pilot);s.LSActivateForceCheat(12);s.SkipToLSTurn(Phase.DEPLOY);}int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();deploy(s,dark,pilot,ship);int cost=before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount());
  if(mode.endsWith("canceled")){var target=mode.startsWith("pilot")?pilot:ship;target.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,target));}
  Integer draws=null;if(!mode.equals("landed")){s.SkipToPhase(Phase.BATTLE);if(dark)s.DSInitiateBattle(planet);else s.LSInitiateBattle(planet);for(int n=0;n<100&&!s.GetCurrentDecision().getText().contains("weapons segment");n++)pass(s);assertTrue(s.GetCurrentDecision().getText().contains("weapons segment"));draws=s.game().getModifiersQuerying().getNumBattleDestinyDraws(s.gameState(),dark?VirtualTableScenario.DS:VirtualTableScenario.LS,false,false);}
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("kind","pilot");row.put("pilot",pilotBp);row.put("mode",mode);row.put("deploymentCost",cost);row.put("power",s.GetPower(ship));row.put("maneuver",s.GetManeuver(ship));row.put("immunity",q.getImmunityToAttritionLessThan(s.gameState(),ship));row.put("draws",draws);rows.add(row);
 }}
 @Test public void search(){for(String mode:List.of("success","repeat","failure","source-leaves")){
  System.out.println("SEARCH "+mode);var s=table(Map.of("wedge","2_23","slip","2_47","second","2_47"),Map.of());s.StartGame();var wedge=s.GetLSCard("wedge");var slip=s.GetLSCard("slip");var second=s.GetLSCard("second");s.MoveCardsToLocation(s.GetLSStartingLocation(),wedge);s.LSActivateForceCheat(8);s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToTopOfLSReserveDeck(slip,second);if(mode.equals("failure"))s.MoveCardsToLSHand(slip,second);int before=s.GetLSForcePileCount();boolean again=false;
  for(int round=0;round<(mode.equals("repeat")?2:1);round++){
   for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(wedge));i++)pass(s);s.LSUseCardAction(wedge);if(mode.equals("source-leaves"))s.MoveCardsToLSHand(wedge);
   for(int i=0;i<150;i++){
    var text=s.GetCurrentDecision().getText();System.out.println("SEARCH DECISION "+text+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));
    if(text.contains("Choose Control action")&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS))break;
    var params=s.GetCurrentDecision().getDecisionParameters();if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&params.get("cardId")!=null&&params.get("min")!=null){if(params.get("max")[0].equals("0"))s.PlayerDecided(VirtualTableScenario.LS,"");else s.LSChooseCard(s.LSHasCardChoiceAvailable(slip)?slip:second);}else if(text.toLowerCase().contains("verify")||text.toLowerCase().contains("look at")||text.toLowerCase().contains("reshuff"))s.PlayerDecided(s.GetDecidingPlayer(),"0");else pass(s);
   }
  }
  again=s.LSCardActionAvailable(wedge);var row=new LinkedHashMap<String,Object>();row.put("kind","search");row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("slipsInHand",(s.GetLSHand().contains(slip)?1:0)+(s.GetLSHand().contains(second)?1:0));row.put("again",again);rows.add(row);
 }}
}
