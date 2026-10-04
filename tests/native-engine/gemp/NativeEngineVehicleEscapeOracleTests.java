package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real movement Interrupts on controlled boards; no interventions after play. */
public class NativeEngineVehicleEscapeOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/vehicle-escape-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("VEHICLE ESCAPE "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void movement(){for(String mode:List.of("escape-vehicle","escape-passenger","escape-long","escape-no-force")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host","3_69","luke","101_2","han","1_11","gun","1_152","dune","1_130","camp","1_131","farm","1_132","interrupt","1_98")),new HashMap<>(Map.of("storm","1_194")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var near=s.GetLSCard("dune");var host=s.GetLSCard("host");var luke=s.GetLSCard("luke");var han=s.GetLSCard("han");var gun=s.GetLSCard("gun");var interrupt=s.GetLSCard("interrupt");
  s.MoveLocationToTable(near);s.MoveLocationToTable(s.GetLSCard("camp"));s.MoveLocationToTable(s.GetLSCard("farm"));s.MoveCardsToLocation(site,host,han,s.GetDSCard("storm"));s.AttachCardsTo(host,luke);s.AttachCardsTo(luke,gun);
  s.MoveCardsToLSHand(interrupt);s.DSActivateForceCheat(10);s.SkipToDSTurn(Phase.BATTLE);
  while(s.GetLSForcePileCount()>0)s.LSUseForceCheat(1);if(!mode.equals("escape-no-force"))s.LSActivateForceCheat(mode.equals("escape-passenger")?2:1);
  s.DSInitiateBattle(site);for(int i=0;i<80&&!s.GetDecidingPlayer().equals(VirtualTableScenario.LS);i++)pass(s);
  boolean hasAbility=Filters.hasAbility.accepts(s.gameState(),s.game().getModifiersQuerying(),host);boolean includingPilot=s.game().getModifiersQuerying().hasAbility(s.gameState(),host,true);boolean moveAwayAvailable=host.getBlueprint().getMoveAwayAction(VirtualTableScenario.LS,s.game(),host,false,0,false,Filters.any)!=null;
  boolean available=s.LSCardPlayAvailable(interrupt);assertTrue(available);int before=s.GetLSForcePileCount();s.LSPlayCard(interrupt);
  for(int i=0;i<160&&!s.GetLSUsedPile().contains(interrupt);i++){
   boolean light=s.GetDecidingPlayer().equals(VirtualTableScenario.LS);
   if(light&&mode.equals("escape-passenger")&&s.LSHasCardChoiceAvailable(luke))s.LSChooseCard(luke);
   else if(light&&s.LSHasCardChoiceAvailable(host))s.LSChooseCard(host);
   else if(light&&s.LSHasCardChoiceAvailable(han))s.LSChooseCard(han);
   else if(light&&s.LSHasCardChoiceAvailable(mode.equals("escape-long")?s.GetLSCard("farm"):near))s.LSChooseCard(mode.equals("escape-long")?s.GetLSCard("farm"):near);
   else pass(s);
  }assertTrue(s.GetLSUsedPile().contains(interrupt));
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("filterHasAbility",hasAbility);row.put("abilityIncludingPilot",includingPilot);row.put("moveAwayAvailable",moveAwayAvailable);row.put("available",available);row.put("cost",before-s.GetLSForcePileCount());row.put("vehicleAt",host.getAtLocation().getBlueprintId(true));row.put("lukeAt",s.game().getModifiersQuerying().getLocationThatCardIsAt(s.gameState(),luke).getBlueprintId(true));row.put("aboard",luke.getAttachedTo()==host);row.put("gunCarried",gun.getAttachedTo()==luke);row.put("vehicleRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(host));row.put("lukeRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(luke));row.put("interruptDone",s.GetLSUsedPile().contains(interrupt));rows.add(row);
 }}

 @Test public void reaction(){for(String mode:List.of("react-hoth","react-tatooine")){
  boolean hoth=mode.equals("react-hoth");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host","3_69","han","1_11","to",hoth?"3_62":"1_130")),new HashMap<>(Map.of("storm","1_194")),55,55,StartingSetup.LSStartingLocation(hoth?"3_59":"1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var host=s.GetLSCard("host");var han=s.GetLSCard("han");var from=s.GetLSStartingLocation();var to=s.GetLSCard("to");s.MoveLocationToTable(to);s.MoveCardsToLocation(from,host,han);s.MoveCardsToLocation(to,s.GetDSCard("storm"));s.DSActivateForceCheat(10);s.LSActivateForceCheat(10);s.SkipToDSTurn(Phase.CONTROL);s.DSForceDrainAt(to);
  for(int i=0;i<80&&!s.GetDecidingPlayer().equals(VirtualTableScenario.LS);i++)pass(s);
  boolean available=s.LSCardActionAvailable(host,"react");int before=s.GetLSForcePileCount();int lost=s.GetLSLostPile().size();boolean boarded=false;
  if(available){s.LSUseCardAction(host,"react");for(int i=0;i<160&&!s.DSDecisionAvailable("Choose Control action");i++){
   if(s.LSDecisionAvailable("Perform a movement before")){if(!boarded){s.LSUseCardAction(han,"Embark");boarded=true;}else s.LSPass();}
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Pilot");
   else if(s.LSDecisionAvailable("Choose where")&&s.LSHasCardChoiceAvailable(host))s.LSChooseCard(host);
   else if(s.LSDecisionAvailable("Choose where")&&s.LSHasCardChoiceAvailable(to))s.LSChooseCard(to);
   else pass(s);
  }assertEquals(to,host.getAtLocation());}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("available",available);row.put("cost",before-s.GetLSForcePileCount());row.put("arrived",host.getAtLocation()==to);row.put("pilotAboard",han.getAttachedTo()==host);row.put("power",s.GetPower(host));row.put("lostToDrain",s.GetLSLostPile().size()-lost);rows.add(row);
 }}

 @Test public void ordinaryMove(){for(String mode:List.of("ordinary-near","ordinary-long")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host","3_69","luke","101_2","gun","1_152","dune","1_130","camp","1_131","farm","1_132")),new HashMap<>(),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var host=s.GetLSCard("host");var luke=s.GetLSCard("luke");var gun=s.GetLSCard("gun");var to=s.GetLSCard(mode.equals("ordinary-long")?"farm":"dune");for(String key:List.of("dune","camp","farm"))s.MoveLocationToTable(s.GetLSCard(key));s.MoveCardsToLocation(s.GetLSStartingLocation(),host);s.AttachCardsTo(host,luke);s.AttachCardsTo(luke,gun);s.LSActivateForceCheat(10);s.SkipToLSTurn(Phase.MOVE);int before=s.GetLSForcePileCount();s.LSUseCardAction(host,"Move");s.LSChooseCard(to);
  for(int i=0;i<100&&!s.LSDecisionAvailable("Choose Move action");i++)pass(s);assertEquals(to,host.getAtLocation());
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("vehicleAt",host.getAtLocation().getBlueprintId(true));row.put("lukeAt",s.game().getModifiersQuerying().getLocationThatCardIsAt(s.gameState(),luke).getBlueprintId(true));row.put("aboard",luke.getAttachedTo()==host);row.put("gunCarried",gun.getAttachedTo()==luke);row.put("vehicleRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(host));row.put("lukeRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(luke));rows.add(row);
 }}
}
