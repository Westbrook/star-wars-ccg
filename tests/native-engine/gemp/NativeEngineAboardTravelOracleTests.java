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
/** Real Interrupt initiation and movement; starting occupants, locations and Force are fixtures. */
public class NativeEngineAboardTravelOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/aboard-travel-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("ABOARD "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void movement(){for(String mode:List.of("run-ground","run-open","run-closed","escape-open","escape-open-only","escape-landed-only","escape-closed-only","escape-closed","escape-landed","escape-no-force")){
  boolean run=mode.startsWith("run"),only=mode.endsWith("only");String bp=mode.startsWith("escape-landed")?"1_147":mode.contains("open")?"1_149":"1_151";
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host",bp,"luke","101_2","han","1_11","rebel","1_28","gun","1_152","dune","1_130","interrupt",run?"101_3":"1_98")),new HashMap<>(Map.of("storm","1_194")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var near=s.GetLSCard("dune");var host=s.GetLSCard("host");var luke=s.GetLSCard("luke");var han=s.GetLSCard("han");var gun=s.GetLSCard("gun");var interrupt=s.GetLSCard("interrupt");
  s.MoveLocationToTable(near);s.MoveCardsToLocation(run?near:site,host);if(mode.equals("run-ground"))s.MoveCardsToLocation(near,luke);else s.AttachCardsTo(host,luke);s.AttachCardsTo(luke,gun);
  s.MoveCardsToLocation(site,s.GetLSCard("rebel"),s.GetDSCard("storm"));if(!run&&!only)s.MoveCardsToLocation(site,han);s.MoveCardsToLSHand(interrupt);s.DSActivateForceCheat(10);s.SkipToDSTurn(Phase.BATTLE);
  while(s.GetLSForcePileCount()>0)s.LSUseForceCheat(1);if(!mode.equals("escape-no-force"))s.LSActivateForceCheat(1);
  s.DSInitiateBattle(site);for(int i=0;i<80&&!s.GetDecidingPlayer().equals(VirtualTableScenario.LS);i++)pass(s);
  boolean available=s.LSCardPlayAvailable(interrupt);int before=s.GetLSForcePileCount();
  if(available){s.LSPlayCard(interrupt);for(int i=0;i<140&&!(run?s.GetLSLostPile():s.GetLSUsedPile()).contains(interrupt);i++){
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(luke))s.LSChooseCard(luke);
   else if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(han))s.LSChooseCard(han);
   else if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(run?site:near))s.LSChooseCard(run?site:near);
   else pass(s);
  }assertTrue((run?s.GetLSLostPile():s.GetLSUsedPile()).contains(interrupt));}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("available",available);row.put("cost",before-s.GetLSForcePileCount());row.put("lukeMoved",luke.getAtLocation()==(run?site:near));row.put("aboard",luke.getAttachedTo()==host);row.put("gunCarried",gun.getAttachedTo()==luke);row.put("regularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(luke));row.put("interruptDone",(run?s.GetLSLostPile():s.GetLSUsedPile()).contains(interrupt));rows.add(row);
 }}
}
