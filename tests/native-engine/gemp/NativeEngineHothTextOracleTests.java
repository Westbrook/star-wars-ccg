package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.ModifierType;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineHothTextOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/hoth-text-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){return fixture(false);}
 VirtualTableScenario fixture(boolean darkPerimeter){var ls=new HashMap<String,String>(Map.of("rifle","1_153","echo","3_6","trench","3_63","trooper","1_28","generator","3_61"));var ds=new HashMap<String,String>(Map.of("gun","1_312","ice","3_148","mountains","104_4","ridge","3_149","trooper","1_194","walker","3_155","wampa","3_93","ship","1_305"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation(darkPerimeter?"3_59":"3_56"),StartingSetup.DSStartingLocation(darkPerimeter?"3_144":"1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();for(String k:List.of("ice","mountains","ridge"))s.MoveLocationToTable(s.GetDSCard(k));s.MoveLocationToTable(s.GetLSCard("trench"));return s;}
 float deploy(VirtualTableScenario s,PhysicalCard c,PhysicalCard to){return s.game().getModifiersQuerying().getDeployCost(s.gameState(),c,c,to,false,null,false,0,null,false);}
 @Test public void modifiers(){var s=fixture();var q=s.game().getModifiersQuerying();var g=s.gameState();var values=new LinkedHashMap<String,Number>();
  s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("trooper"));values.put("lightPerimeterDrain",q.getForceDrainAmount(g,s.GetLSStartingLocation(),s.LS));values.put("echoDeploy",deploy(s,s.GetLSCard("echo"),s.GetLSStartingLocation()));
  s.MoveCardsToLocation(s.GetDSCard("mountains"),s.GetLSCard("trooper"));values.put("mountainsLightDrain",q.getForceDrainAmount(g,s.GetDSCard("mountains"),s.LS));values.put("imperialDeploy",deploy(s,s.GetDSCard("trooper"),s.GetDSCard("mountains")));values.put("walkerDeploy",deploy(s,s.GetDSCard("walker"),s.GetDSCard("mountains")));
  s.MoveCardsToLocation(s.GetDSCard("ice"),s.GetLSCard("trooper"));values.put("iceWithoutGenerator",q.getForceDrainAmount(g,s.GetDSCard("ice"),s.LS));s.MoveLocationToTable(s.GetLSCard("generator"));values.put("iceWithGenerator",q.getForceDrainAmount(g,s.GetDSCard("ice"),s.LS));
  float before=q.getForceGenerationFromLocation(g,s.GetLSCard("trench"),s.DS);s.MoveCardsToLocation(s.GetLSCard("trench"),s.GetDSCard("trooper"));values.put("trenchGenerationBonus",q.getForceGenerationFromLocation(g,s.GetLSCard("trench"),s.DS)-before);
  s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("echo"));values.put("echoHothPower",s.GetPower(s.GetLSCard("echo")));s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("echo"));values.put("echoAwayPower",s.GetPower(s.GetLSCard("echo")));
  assertEquals(List.of(2f,1f,2f,0f,5f,2f,1f,1f,2,1),new ArrayList<>(values.values()));rows.add(new LinkedHashMap<>(Map.of("case","modifiers","values",values)));
 }
 float weaponBonus(VirtualTableScenario s,PhysicalCard host,PhysicalCard gun){float total=0;var q=s.game().getModifiersQuerying();for(var modifier:q.getModifiers(s.gameState(),ModifierType.EACH_WEAPON_DESTINY))total+=modifier.getWeaponDestinyModifier(s.gameState(),q,host,gun,null,List.of());return total;}
 @Test public void weaponAndForfeit(){var s=fixture(true);var rebel=s.GetLSCard("trooper");var imperial=s.GetDSCard("trooper");var gun=s.GetDSCard("gun");var rifle=s.GetLSCard("rifle");s.MoveCardsToLocation(s.GetDSStartingLocation(),rebel,imperial);s.AttachCardsTo(imperial,gun);int forfeit=s.GetForfeit(rebel);float darkBonus=weaponBonus(s,imperial,gun);s.MoveCardsToLocation(s.GetLSCard("trench"),rebel);s.AttachCardsTo(rebel,rifle);float lightBonus=weaponBonus(s,rebel,rifle);assertEquals(1,forfeit);assertEquals(1f,darkBonus,0);assertEquals(1f,lightBonus,0);rows.add(new LinkedHashMap<>(Map.of("case","weapon-forfeit","rebelForfeit",forfeit,"darkWeaponBonus",darkBonus,"lightWeaponBonus",lightBonus)));}
 @Test public void freeNorthRidge(){var s=fixture();s.MoveCardsToLocation(s.GetDSCard("ice"),s.GetDSCard("walker"));float cost=s.game().getModifiersQuerying().getMoveUsingLandspeedCost(s.gameState(),s.GetDSCard("walker"),s.GetDSCard("ice"),s.GetDSCard("ridge"),false,0);float shuttle=s.game().getModifiersQuerying().getShuttleCost(s.gameState(),s.GetDSCard("walker"),null,s.GetDSCard("ridge"),0);assertEquals(0f,cost,0);assertEquals(0f,shuttle,0);rows.add(new LinkedHashMap<>(Map.of("case","north-ridge","cost",cost,"shuttleCost",shuttle)));}
 void move(String key,boolean aboard){var s=fixture();var ice=s.GetDSCard("ice");var mountains=s.GetDSCard("mountains");var card=s.GetDSCard(key);s.MoveCardsToLocation(ice,card);if(aboard){s.MoveCardsToLocation(ice,s.GetDSCard("walker"));s.BoardAsPassenger(s.GetDSCard("walker"),card);}s.SkipToDSTurn(Phase.MOVE);int before=s.GetDSForcePile().size();s.DSUseCardAction(ice,"Move from here to Mountains");
  for(int i=0;i<60&&card.getAtLocation()!=mountains;i++){var d=s.GetCurrentDecision();System.out.println("HOTH-TEXT "+key+" "+d.getText()+" "+new GsonBuilder().create().toJson(d.getDecisionParameters()));if(d.getText().startsWith("Choose card to move from"))s.DSChooseCard(ice);else if(d.getText().startsWith("Choose card to move to,"))s.DSChooseCard(mountains);else if(d.getText().startsWith("Choose card to move"))s.DSChooseCard(card);else s.PlayerPass(s.GetDecidingPlayer());}
  assertEquals(mountains,card.getAtLocation());assertEquals(before,s.GetDSForcePile().size());assertFalse(Filters.hasNotPerformedRegularMove.accepts(s.game(),card));rows.add(new LinkedHashMap<>(Map.of("case","move-"+key+(aboard?"-aboard":""),"destination","104_4","forceSpent",before-s.GetDSForcePile().size(),"regularMoveUsed",true)));
 }
 @Test public void characterMove(){move("trooper",false);}
 @Test public void walkerMove(){move("walker",false);}
 @Test public void creatureMove(){move("wampa",false);}
 @Test public void passengerMove(){var s=fixture();var ice=s.GetDSCard("ice");var mountains=s.GetDSCard("mountains");var card=s.GetDSCard("trooper");var walker=s.GetDSCard("walker");s.MoveCardsToLocation(ice,walker);s.BoardAsPassenger(walker,card);s.SkipToDSTurn(Phase.MOVE);s.DSUseCardAction(ice,"Move from here to Mountains");s.DSChooseCard(ice);s.DSChooseCard(mountains);var choices=Arrays.asList(s.GetCurrentDecision().getDecisionParameters().get("cardId"));assertFalse(choices.contains(String.valueOf(card.getCardId())));assertTrue(choices.contains(String.valueOf(walker.getCardId())));s.DSChooseCard(walker);for(int i=0;i<40&&walker.getAtLocation()!=mountains;i++)s.PlayerPass(s.GetDecidingPlayer());assertEquals(mountains,walker.getAtLocation());assertEquals(walker,card.getAttachedTo());rows.add(new LinkedHashMap<>(Map.of("case","passenger","independentMove",false,"carriedWithVehicle",true)));}
 @Test public void landedShipEligibility(){var s=fixture();var card=s.GetDSCard("ship");s.MoveCardsToLocation(s.GetDSCard("ice"),card);boolean legal=Filters.canMoveToUsingLocationText(card,true,0,0).accepts(s.game(),s.GetDSCard("mountains"));System.out.println("SHIP-ELIGIBILITY "+legal);assertFalse(legal);rows.add(new LinkedHashMap<>(Map.of("case","landed-TIE","legal",legal)));}
}
