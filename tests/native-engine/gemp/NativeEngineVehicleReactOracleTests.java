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
/** Actual react actions, optional boarding and Sense; controlled initial opponents. */
public class NativeEngineVehicleReactOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/vehicle-react-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("REACT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 void menu(VirtualTableScenario s,String name){for(int i=0;i<100&&!s.LSDecisionAvailable("Choose "+name+" action");i++)pass(s);assertTrue(s.LSDecisionAvailable("Choose "+name+" action"));}
 VirtualTableScenario fixture(String bp,String rider){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host",bp,"han","1_11","rider",rider,"gun","1_152","dune","1_130","camp","1_131","echo","3_59","droid","1_5","zero","1_132")),new HashMap<>(Map.of("trooper","1_194","vader","101_5","gun","1_317","high","1_252","sense","1_267")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();for(String key:List.of("dune","camp","echo"))s.MoveLocationToTable(s.GetLSCard(key));s.MoveCardsToLSHand(s.GetLSCard("host"),s.GetLSCard("han"),s.GetLSCard("rider"),s.GetLSCard("gun"));s.LSActivateForceCheat(25);s.DSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);
  var host=s.GetLSCard("host");s.LSDeployCard(host);for(int i=0;i<80&&host.getAtLocation()!=s.GetLSStartingLocation();i++){if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(s.GetLSStartingLocation());else pass(s);}assertEquals(s.GetLSStartingLocation(),host.getAtLocation());menu(s,"Deploy");
  var helper=new NativeEngineCrewOracleTests();helper.deploy(s,true,s.GetLSCard("han"),host,"Driver",null);helper.deploy(s,true,s.GetLSCard("rider"),host,"Passenger",null);return s;
 }
 @Test public void reacts(){for(String mode:List.of("ride","board","disembark","board-exit","cancel","sense-fails","closed")){
  var s=fixture(mode.equals("closed")?"1_151":"1_149","101_2");PhysicalCardImpl host=s.GetLSCard("host"),luke=s.GetLSCard("rider"),han=s.GetLSCard("han"),from=s.GetLSStartingLocation(),to=s.GetLSCard("camp"),vader=s.GetDSCard("vader");
  if(mode.startsWith("board")||(mode.equals("cancel")||mode.equals("sense-fails")))s.MoveCardsToLocation(from,luke);
  s.MoveCardsToLocation(to,vader);s.MoveCardsToDSHand(s.GetDSCard("sense"));s.SkipToDSTurn(Phase.CONTROL);s.PrepareDSDestiny(mode.equals("sense-fails")?6:0);int lostBefore=s.GetLSLostPile().size();s.DSForceDrainAt(to);
  for(int i=0;i<80&&!s.LSCardActionAvailable(host,"react");i++)pass(s);assertTrue(s.LSCardActionAvailable(host,"react"));int before=s.GetLSForcePileCount();s.LSUseCardAction(host,"react");if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(to);
  boolean boarded=false,exited=false,sensed=false;boolean cancel=mode.equals("cancel"),trySense=cancel||mode.equals("sense-fails");for(int i=0;i<160;i++){
   if(s.LSDecisionAvailable("Perform a movement before")){
    if((mode.startsWith("board")||trySense)&&!boarded){assertEquals(1,before-s.GetLSForcePileCount());s.LSUseCardAction(luke,"Embark");boarded=true;}
    else s.LSPass();
   }else if(s.LSDecisionAvailable("Choose where")&&s.LSHasCardChoiceAvailable(host))s.LSChooseCard(host);
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Passenger");
   else if(s.LSDecisionAvailable("Perform a movement after")){
    if((mode.equals("disembark")||mode.equals("board-exit"))&&!exited){s.LSUseCardAction(luke,"Disembark");exited=true;}
    else s.LSPass();
   }else if(trySense&&!sensed&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(s.GetDSCard("sense"))){s.DSPlayCard(s.GetDSCard("sense"));sensed=true;if(s.DSDecisionAvailable("highest-ability"))s.DSChooseCard(vader);}
   else if(cancel&&s.GetDSUsedPile().contains(s.GetDSCard("sense"))&&s.gameState().getMoveAsReactState()==null)break;
   else if(s.DSDecisionAvailable("Choose Control action"))break;
   else pass(s);
  }
  assertEquals(cancel?from:to,host.getAtLocation());if(trySense)assertTrue(sensed);var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("aboard",luke.getAttachedTo()==host);row.put("hostMoved",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(host));row.put("lukeMoved",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(luke));row.put("arrived",host.getAtLocation()==to);if(cancel){row.put("hostLocked",s.game().getModifiersQuerying().isProhibitedFromParticipatingInReact(s.gameState(),host));row.put("boarderLocked",s.game().getModifiersQuerying().isProhibitedFromParticipatingInReact(s.gameState(),luke));row.put("driverLocked",s.game().getModifiersQuerying().isProhibitedFromParticipatingInReact(s.gameState(),han));}else row.put("lostToDrain",s.GetLSLostPile().size()-lostBefore);rows.add(row);
 }}
}
