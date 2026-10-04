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
/** Actual Comlink cargo deployments and Sense; starting fleets, Force and destiny are fixtures. */
public class NativeEngineCargoReactOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/cargo-react-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("CARGOREACT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void cargoReactions(){for(String mode:List.of("scout","vehicle","unpiloted","cancel-scout","cancel-vehicle","source-leave","source-return")){
  String bp=mode.contains("vehicle")?"1_310":mode.equals("unpiloted")?"1_300":"1_305";
  var s=new VirtualTableScenario(new HashMap<>(Map.of("corvette","1_140","han","1_11","sense","1_109","planet","1_127")),new HashMap<>(Map.of("carrier","1_302","pilot","1_179","grant","1_201","cargo",bp)),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var planet=s.GetLSCard("planet");var carrier=s.GetDSCard("carrier");var pilot=s.GetDSCard("pilot");var grant=s.GetDSCard("grant");var cargo=s.GetDSCard("cargo");var sense=s.GetLSCard("sense");
  s.MoveLocationToTable(planet);s.MoveCardsToLocation(planet,carrier,s.GetLSCard("corvette"));s.AttachCardsTo(carrier,pilot);s.AttachCardsTo(pilot,grant);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("han"));s.MoveCardsToDSHand(cargo);s.MoveCardsToLSHand(sense);s.LSActivateForceCheat(20);s.DSActivateForceCheat(20);s.SkipToLSTurn(Phase.BATTLE);s.PrepareLSDestiny(0);s.LSInitiateBattle(planet);
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(grant));i++)pass(s);assertTrue(s.DSCardActionAvailable(grant));int before=s.GetDSForcePileCount();s.DSUseCardAction(grant);boolean selected=false,sensed=false,changed=false;
  for(int i=0;i<180;i++){
   if(s.DSDecisionAvailable("simultaneously deploy"))s.DSChooseNo();
   else if(s.DSDecisionAvailable("Choose card to deploy")){s.DSChooseCard(cargo);selected=true;}
   else if(s.DSDecisionAvailable("Choose where"))s.DSChooseCard(carrier);
   else if(s.DSDecisionAvailable("Choose capacity"))s.DSChoose(bp.equals("1_310")?"Vehicle":"Starship");
   else if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(sense)){
    if(mode.startsWith("source-")&&!changed){s.MoveCardsToDSHand(grant);if(mode.equals("source-return"))s.AttachCardsTo(pilot,grant);changed=true;}
    if(mode.startsWith("cancel-")&&!sensed){s.LSPlayCard(sense);sensed=true;if(s.LSDecisionAvailable("highest-ability"))s.LSChooseCard(s.GetLSCard("han"));}else pass(s);
   }else if(mode.startsWith("cancel-")?sensed&&s.GetLSUsedPile().contains(sense):cargo.getAttachedTo()==carrier)break;
   else pass(s);
  }
  assertEquals(!mode.startsWith("cancel-"),cargo.getAttachedTo()==carrier);
  for(int i=0;i<120&&!(s.LSDecisionAvailable("Choose weapons segment action")||s.DSDecisionAvailable("Choose weapons segment action"));i++)pass(s);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetDSForcePileCount());row.put("cargoAboard",cargo.getAttachedTo()==carrier);row.put("cargoInHand",s.GetDSHand().contains(cargo));row.put("cargoBattles",s.gameState().isParticipatingInBattle(cargo));row.put("carrierBattles",s.gameState().isParticipatingInBattle(carrier));rows.add(row);
 }}
}
