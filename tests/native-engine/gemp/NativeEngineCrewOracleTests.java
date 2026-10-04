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
/** Controlled starting ships, real character deployments, Barrier and battles. */
public class NativeEngineCrewOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/crew-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 boolean decision(VirtualTableScenario s,boolean light,String text){return light?s.LSDecisionAvailable(text):s.DSDecisionAvailable(text);}
 void pass(VirtualTableScenario s){System.out.println("CREW "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void deploy(VirtualTableScenario s,boolean light,PhysicalCardImpl card,PhysicalCardImpl ship,String role,PhysicalCardImpl barrier){
  if(light)s.LSDeployCard(card);else s.DSDeployCard(card);boolean played=false;
  for(int i=0;i<140;i++){
   if(decision(s,light,"Choose Deploy action")&&card.getAttachedTo()==ship)break;
   if(decision(s,light,"Choose capacity")){if(light)s.LSChoose(role);else s.DSChoose(role);}
   else if(decision(s,light,"Choose where")||decision(s,light,"Choose target")){if(light)s.LSChooseCard(ship);else s.DSChooseCard(ship);}
   else if(barrier!=null&&!played&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(barrier)){s.LSPlayCard(barrier);played=true;}
   else pass(s);
  }
  assertEquals(ship,card.getAttachedTo());assertTrue(decision(s,light,"Choose Deploy action"));if(barrier!=null)assertTrue(played);
 }
 @Test public void crew(){for(String mode:List.of("light-match","dark-match","dark-nonmatch","gold-squadron","light-passenger","light-landed","barrier-permanent","barrier-unpiloted","pilot-text-canceled","ship-text-canceled")){
  boolean light=mode.startsWith("light")||mode.equals("gold-squadron"),landed=mode.equals("light-landed"),barrierMode=mode.startsWith("barrier");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("gold","1_141","dutch","1_8","han","1_11","enemy","1_147","barrier","1_105")),new HashMap<>(Map.of("black","1_300","pilot","1_174","scout","1_305","other","1_305")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var planet=s.GetDSStartingLocation();var site=s.GetLSStartingLocation();var pilot=light?s.GetLSCard("dutch"):s.GetDSCard("pilot");var ship=light?s.GetLSCard("gold"):Set.of("dark-nonmatch","barrier-permanent","ship-text-canceled").contains(mode)?s.GetDSCard("scout"):s.GetDSCard("black");var han=s.GetLSCard("han");var barrier=s.GetLSCard("barrier");var other=s.GetDSCard("other");
  s.MoveCardsToLocation(landed?site:planet,ship);s.MoveCardsToLocation(planet,light?other:s.GetLSCard("enemy"));if(mode.equals("barrier-unpiloted"))s.MoveCardsToLocation(planet,other);s.MoveCardsToLSHand(barrier,han);if(light)s.MoveCardsToLSHand(pilot);else s.MoveCardsToDSHand(pilot);s.DSActivateForceCheat(20);s.LSActivateForceCheat(20);if(light)s.SkipToLSTurn(Phase.DEPLOY);else s.SkipToPhase(Phase.DEPLOY);
  if(!mode.equals("ship-text-canceled"))deploy(s,light,pilot,ship,mode.equals("light-passenger")?"Passenger":"Pilot",barrierMode?barrier:null);
  if(Set.of("gold-squadron","light-passenger").contains(mode))deploy(s,true,han,ship,"Pilot",null);
  if(mode.endsWith("text-canceled")){var target=mode.startsWith("pilot")?pilot:ship;s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,target));s.DSPass();s.LSPass();}
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("beforePower",s.GetPower(ship));row.put("beforeManeuver",s.GetManeuver(ship));row.put("beforePiloted",q.isPiloted(s.gameState(),ship,false));row.put("hanForfeit",mode.equals("gold-squadron")||mode.equals("light-passenger")?s.GetForfeit(han):null);
  if(landed||mode.endsWith("text-canceled")){row.put("initiationPower",null);row.put("battlePower",null);row.put("battleManeuver",null);row.put("battlePiloted",null);row.put("draws",null);}
  else{s.SkipToPhase(Phase.BATTLE);if(light)s.LSInitiateBattle(planet);else s.DSInitiateBattle(planet);s.PassBattleStartResponses();row.put("initiationPower",s.GetPower(ship));for(int i=0;i<80&&!s.AwaitingDSWeaponsSegmentActions()&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);assertTrue(s.AwaitingDSWeaponsSegmentActions()||s.AwaitingLSWeaponsSegmentActions());row.put("battlePower",s.GetPower(ship));row.put("battleManeuver",s.GetManeuver(ship));row.put("battlePiloted",q.isPiloted(s.gameState(),ship,false));row.put("draws",q.getNumBattleDestinyDraws(s.gameState(),light?VirtualTableScenario.LS:VirtualTableScenario.DS,false,false));}
  rows.add(row);
 }}
}
