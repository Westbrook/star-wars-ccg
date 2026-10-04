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
/** Actual granted deployments and Sense. Locations, grant, opponent and destiny are controlled. */
public class NativeEngineDeployReactOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/deploy-react-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("DEPLOYREACT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario fixture(String bp){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host",bp,"copy",bp,"han","1_11","cz","1_6","dune","1_130","camp","1_131")),new HashMap<>(Map.of("vader","101_5","sense","1_267")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.MoveLocationToTable(s.GetLSCard("dune"));s.MoveLocationToTable(s.GetLSCard("camp"));s.MoveCardsToLocation(s.GetLSCard("dune"),s.GetLSCard("cz"));s.MoveCardsToLocation(s.GetLSCard("camp"),s.GetDSCard("vader"));s.MoveCardsToLSHand(s.GetLSCard("host"),s.GetLSCard("copy"),s.GetLSCard("han"));s.MoveCardsToDSHand(s.GetDSCard("sense"));s.LSActivateForceCheat(25);s.DSActivateForceCheat(20);s.SkipToDSTurn(Phase.CONTROL);s.PrepareDSDestiny(0);s.DSForceDrainAt(s.GetLSCard("camp"));return s;
 }
 void ready(VirtualTableScenario s){for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(s.GetLSCard("cz")));i++)pass(s);assertTrue(s.LSCardActionAvailable(s.GetLSCard("cz")));}
 void deploy(VirtualTableScenario s,PhysicalCardImpl card,PhysicalCardImpl target,boolean cancel,String sourceChange){
  ready(s);s.LSUseCardAction(s.GetLSCard("cz"));boolean selected=false,sensed=false,changed=false;
  for(int i=0;i<140;i++){
   if(s.LSDecisionAvailable("simultaneously deploy"))s.LSChooseNo();
   else if(s.LSDecisionAvailable("Choose card to deploy")){s.LSChooseCard(card);selected=true;}
   else if(s.LSDecisionAvailable("Choose where")){s.LSChooseCard(target);selected=true;}
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Driver");
   else if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(s.GetDSCard("sense"))){
    if(!sourceChange.isEmpty()&&!changed){s.MoveCardsToLSHand(s.GetLSCard("cz"));if(sourceChange.equals("return"))s.MoveCardsToLocation(s.GetLSCard("dune"),s.GetLSCard("cz"));changed=true;}
    if(cancel&&!sensed){s.DSPlayCard(s.GetDSCard("sense"));sensed=true;if(s.DSDecisionAvailable("highest-ability"))s.DSChooseCard(s.GetDSCard("vader"));}else pass(s);
   }else if(selected&&(card.getAtLocation()==target||card.getAttachedTo()==target)||cancel&&sensed&&s.GetDSUsedPile().contains(s.GetDSCard("sense")))return;
   else pass(s);
  }throw new AssertionError("Deployment boundary missing");
 }
 @Test public void deployment(){for(String mode:List.of("vehicle","crew","cancel-vehicle","cancel-crew","source-leave","source-return")){
  var s=fixture(mode.equals("cancel-vehicle")?"1_151":"1_149");var host=s.GetLSCard("host");var crew=s.GetLSCard("han");int before=s.GetLSForcePileCount();
  deploy(s,host,s.GetLSCard("camp"),mode.equals("cancel-vehicle"),mode.startsWith("source-")?mode.substring(7):"");boolean cancelledAfterVehicle=!s.gameState().getForceDrainState().canContinue();
  if(mode.equals("crew")||mode.equals("cancel-crew"))deploy(s,crew,host,mode.equals("cancel-crew"),"");
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("vehicleAtSite",host.getAtLocation()==s.GetLSCard("camp"));row.put("vehicleInHand",s.GetLSHand().contains(host));row.put("crewAboard",crew.getAttachedTo()==host);row.put("crewInHand",s.GetLSHand().contains(crew));row.put("drainStoppedAfterVehicle",cancelledAfterVehicle);row.put("drainStopped",!s.gameState().getForceDrainState().canContinue());rows.add(row);
 }}
 @Test public void comlink(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("han","1_11","dune","1_130","camp","1_131")),new HashMap<>(Map.of("host","1_310","crew","1_194","bearer","1_184","comlink","1_201")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSCard("camp");var host=s.GetDSCard("host");var crew=s.GetDSCard("crew");var grant=s.GetDSCard("comlink");s.MoveLocationToTable(s.GetLSCard("dune"));s.MoveLocationToTable(site);s.MoveCardsToLocation(site,s.GetLSCard("han"));s.MoveCardsToLocation(s.GetLSCard("dune"),s.GetDSCard("bearer"));s.AttachCardsTo(s.GetDSCard("bearer"),grant);s.MoveCardsToDSHand(host,crew);s.LSActivateForceCheat(20);s.DSActivateForceCheat(20);s.SkipToLSTurn(Phase.CONTROL);s.LSForceDrainAt(site);int before=s.GetDSForcePileCount();boolean afterVehicle=false;
  for(var card:List.of(host,crew)){
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(grant));i++)pass(s);assertTrue(s.DSCardActionAvailable(grant));s.DSUseCardAction(grant);
   for(int i=0;i<100;i++){
    if(s.DSDecisionAvailable("simultaneously deploy"))s.DSChooseNo();
    else if(s.DSDecisionAvailable("Choose card to deploy"))s.DSChooseCard(card);
    else if(s.DSDecisionAvailable("Choose where"))s.DSChooseCard(card==host?site:host);
    else if(s.DSDecisionAvailable("Choose capacity"))s.DSChoose("Driver");
    else if(card==host?host.getAtLocation()==site:crew.getAttachedTo()==host)break;
    else pass(s);
   }
   assertTrue(card==host?host.getAtLocation()==site:crew.getAttachedTo()==host);if(card==host)afterVehicle=!s.gameState().getForceDrainState().canContinue();
  }
  rows.add(Map.of("mode","comlink","cost",before-s.GetDSForcePileCount(),"vehicleAtSite",host.getAtLocation()==site,"vehicleInHand",s.GetDSHand().contains(host),"crewAboard",crew.getAttachedTo()==host,"crewInHand",s.GetDSHand().contains(crew),"drainStoppedAfterVehicle",afterVehicle,"drainStopped",!s.gameState().getForceDrainState().canContinue()));
 }

}
