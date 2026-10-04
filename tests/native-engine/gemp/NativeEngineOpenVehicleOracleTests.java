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
/** Real deployments, moves, firing and forfeiture; controlled locations/opponents/destiny. */
public class NativeEngineOpenVehicleOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/open-vehicles-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){if(s.GetCurrentDecision().getText().startsWith("Choose card to put on Lost Pile")){s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);return;}System.out.println("OPEN "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void menu(VirtualTableScenario s,String name){for(int i=0;i<100&&!s.LSDecisionAvailable("Choose "+name+" action");i++)pass(s);assertTrue(s.LSDecisionAvailable("Choose "+name+" action"));}
 VirtualTableScenario fixture(String bp,String rider){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host",bp,"han","1_11","rider",rider,"gun","1_152","dune","1_130","camp","1_131","echo","3_59","droid","1_5","zero","1_132")),new HashMap<>(Map.of("trooper","1_194","vader","101_5","gun","1_317","high","1_252")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();for(String key:List.of("dune","camp","echo"))s.MoveLocationToTable(s.GetLSCard(key));s.MoveCardsToLSHand(s.GetLSCard("host"),s.GetLSCard("han"),s.GetLSCard("rider"),s.GetLSCard("gun"));s.LSActivateForceCheat(25);s.DSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);
  var host=s.GetLSCard("host");s.LSDeployCard(host);for(int i=0;i<80&&host.getAtLocation()!=s.GetLSStartingLocation();i++){if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(s.GetLSStartingLocation());else pass(s);}assertEquals(s.GetLSStartingLocation(),host.getAtLocation());menu(s,"Deploy");
  var helper=new NativeEngineCrewOracleTests();helper.deploy(s,true,s.GetLSCard("han"),host,"Driver",null);helper.deploy(s,true,s.GetLSCard("rider"),host,"Passenger",null);return s;
 }
 @Test public void movement(){for(String mode:List.of("open-luke","open-beru","closed-luke","closed-beru","closed-owen","host-canceled","rider-canceled","free-transit","mixed-transit","unpiloted-transit")){
  boolean enclosed=mode.startsWith("closed");String bp=enclosed?"1_151":"1_149",rider=mode.endsWith("beru")?"1_2":mode.endsWith("owen")?"1_22":"101_2";var s=fixture(bp,rider);PhysicalCardImpl host=s.GetLSCard("host"),person=s.GetLSCard("rider"),han=s.GetLSCard("han"),from=s.GetLSStartingLocation(),to=s.GetLSCard(mode.endsWith("transit")?"echo":"camp");
  if(mode.endsWith("canceled"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(from,mode.startsWith("host")?host:person));
  if(mode.equals("unpiloted-transit"))s.MoveCardsToLSHand(han);if(mode.equals("mixed-transit"))s.MoveCardsToLocation(from,s.GetLSCard("droid"));s.SkipToPhase(Phase.MOVE);int before=s.GetLSForcePileCount();
  if(mode.endsWith("transit")){s.LSUseCardAction(from,"transit");s.LSChooseCard(to);if(mode.equals("mixed-transit"))s.LSChooseCards(host,s.GetLSCard("droid"));else s.LSChooseCards(host);}
  else{s.LSUseCardAction(host,"Move");s.LSChooseCard(to);}
  for(int i=0;i<120&&host.getAtLocation()!=to;i++)pass(s);assertEquals(to,host.getAtLocation());menu(s,"Move");var q=s.game().getModifiersQuerying();
  rows.add(Map.of("mode",mode,"cost",before-s.GetLSForcePileCount(),"hostMoved",q.hasPerformedRegularMoveThisTurn(host),"crewMoved",q.hasPerformedRegularMoveThisTurn(person),"aboard",person.getAttachedTo()==host));
 }}
 @Test public void battle(){for(String mode:List.of("open-fire","closed-fire","open-miss","forfeit-carrier","forfeit-passenger")){
  var s=fixture(mode.startsWith("closed")?"1_151":"1_149","101_2");var site=s.GetLSStartingLocation();PhysicalCardImpl host=s.GetLSCard("host"),rider=s.GetLSCard("rider"),han=s.GetLSCard("han"),gun=s.GetLSCard("gun"),enemy=s.GetDSCard("trooper"),enemyGun=s.GetDSCard("gun");
  s.MoveCardsToLocation(site,enemy,s.GetDSCard("vader"));s.AttachCardsTo(enemy,enemyGun);s.AttachCardsTo(rider,gun);s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("zero"));s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("high"));s.SkipToPhase(Phase.BATTLE);s.LSInitiateBattle(site);
  for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);assertTrue(s.AwaitingLSWeaponsSegmentActions());var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("defense",q.getDefenseValue(s.gameState(),host));row.put("power",q.getTotalPowerAtLocation(s.gameState(),site,LS,true,false));row.put("draws",q.getNumBattleDestinyDraws(s.gameState(),LS,false,false));row.put("canFire",s.LSCardActionAvailable(gun,"Fire"));
  if(mode.endsWith("fire")||mode.equals("open-miss")){
   if(mode.equals("open-fire")){s.PrepareLSDestiny(6);s.LSUseCardAction(gun,"Fire");s.LSChooseCard(enemy);for(int i=0;i<100&&!s.AwaitingDSWeaponsSegmentActions();i++)pass(s);row.put("enemyHit",enemy.isHit());s.PrepareDSDestiny(6);s.DSUseCardAction(enemyGun,"Fire");row.put("riderTarget",s.DSHasCardChoiceAvailable(rider));s.DSChooseCard(rider);for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);row.put("riderHit",rider.isHit());}
   else{s.LSPass();for(int i=0;i<80&&!s.AwaitingDSWeaponsSegmentActions();i++)pass(s);row.put("enemyCanFire",s.DSCardActionAvailable(enemyGun,"Fire"));s.PrepareDSDestiny(mode.equals("open-miss")?5:6);s.DSUseCardAction(enemyGun,"Fire");row.put("riderTarget",s.DSHasCardChoiceAvailable(rider));row.put("vehicleTarget",s.DSHasCardChoiceAvailable(host));s.DSChooseCard(host);for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);row.put("vehicleHit",host.isHit());}
  }else{
   for(int i=0;i<180&&!s.AwaitingLSBattleDamagePayment();i++){if(s.LSDecisionAvailable("battle destiny?"))s.LSChooseYes();else if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseYes();else pass(s);}assertTrue(s.AwaitingLSBattleDamagePayment());row.put("damage",s.GetUnpaidLSBattleDamage());row.put("attrition",s.GetUnpaidLSAttrition());var sacrificed=mode.endsWith("carrier")?host:rider;s.LSChooseCard(sacrificed);if(s.LSDecisionAvailable("Do you still want to forfeit"))s.LSChooseYes();for(int i=0;i<100&&!(s.GetLSLostPile().contains(sacrificed)&&(!mode.endsWith("carrier")||s.GetLSLostPile().containsAll(List.of(host,rider,han))));i++)pass(s);assertTrue(s.GetLSLostPile().contains(sacrificed));row.put("afterDamage",s.GetUnpaidLSBattleDamage());row.put("afterAttrition",s.GetUnpaidLSAttrition());row.put("hostLost",s.GetLSLostPile().contains(host));row.put("riderLost",s.GetLSLostPile().contains(rider));row.put("driverLost",s.GetLSLostPile().contains(han));
  }rows.add(row);
 }}
}
