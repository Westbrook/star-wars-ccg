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
/** Actual paired react, Sense and Barrier. Unpiloted grant carrier, Force and destiny are fixtures. */
public class NativeEnginePilotReactOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/pilot-react-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("PILOTREACT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void pairedReactions(){for(String mode:List.of("arrive","cancel","barrier-ship","barrier-pilot","source-leave","source-return")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_144","pilot","1_11","carrier","1_141","cz","1_6","planet","1_127")),new HashMap<>(Map.of("scout","1_305","vader","101_5","sense","1_267","barrier","1_249")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var planet=s.GetLSCard("planet");var ship=s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var carrier=s.GetLSCard("carrier");var cz=s.GetLSCard("cz");var sense=s.GetDSCard("sense");var barrier=s.GetDSCard("barrier");
  s.MoveLocationToTable(planet);s.MoveCardsToLocation(planet,carrier,s.GetDSCard("scout"));s.AttachCardsTo(carrier,cz);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("vader"));s.MoveCardsToLSHand(ship,pilot);s.MoveCardsToDSHand(sense,barrier);s.LSActivateForceCheat(20);s.DSActivateForceCheat(20);s.SkipToDSTurn(Phase.CONTROL);s.PrepareDSDestiny(0);s.DSForceDrainAt(planet);
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(cz));i++)pass(s);
  assertTrue(s.LSCardActionAvailable(cz));int before=s.GetLSForcePileCount();s.LSUseCardAction(cz);boolean selected=false,sensed=false,barred=false,changed=false;
  for(int i=0;i<160;i++){
   if(s.LSDecisionAvailable("simultaneously deploy"))s.LSChooseYes();
   else if(s.LSDecisionAvailable("Choose card to deploy")){s.LSChooseCard(ship);selected=true;}
   else if(s.LSDecisionAvailable("Choose a pilot from hand"))s.LSChooseCard(pilot);
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Pilot");
   else if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(planet);
   else if(selected&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(sense)){
    if(mode.startsWith("source-")&&!changed){s.MoveCardsToLSHand(cz);if(mode.equals("source-return"))s.AttachCardsTo(carrier,cz);changed=true;}
    if(mode.equals("cancel")&&!sensed){s.DSPlayCard(sense);sensed=true;if(s.DSDecisionAvailable("highest-ability"))s.DSChooseCard(s.GetDSCard("vader"));}else pass(s);
   }else if(mode.startsWith("barrier-")&&!barred&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(barrier)){s.DSPlayCard(barrier,"Prevent "+(mode.endsWith("ship")?"Red 1":"Han Solo"));barred=true;}
   else if(mode.equals("cancel")?sensed&&s.GetDSUsedPile().contains(sense):pilot.getAttachedTo()==ship&&(!mode.startsWith("barrier-")||s.GetDSUsedPile().contains(barrier)))break;
   else pass(s);
  }
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("shipAtSystem",ship.getAtLocation()==planet);row.put("shipInHand",s.GetLSHand().contains(ship));row.put("pilotAboard",pilot.getAttachedTo()==ship);row.put("pilotInHand",s.GetLSHand().contains(pilot));row.put("drainStopped",!s.gameState().getForceDrainState().canContinue());row.put("shipBarred",q.mayNotMove(s.gameState(),ship));row.put("pilotBarred",q.mayNotMove(s.gameState(),pilot));rows.add(row);
  assertEquals(5,before-s.GetLSForcePileCount());assertEquals(!mode.equals("cancel"),pilot.getAttachedTo()==ship);
 }}
}
