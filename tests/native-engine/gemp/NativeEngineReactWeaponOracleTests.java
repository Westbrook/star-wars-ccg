package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineReactWeaponOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/react-weapons-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void pass(VirtualTableScenario s){String t=s.GetCurrentDecision().getText().toLowerCase();try{if(t.contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(t+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 private VirtualTableScenario fixture(boolean lightTurn,String site,int first,int second,boolean deployed){
  var ls=new HashMap<String,String>(Map.of("t","1_28","t2","1_28","gun","1_152","gun2","1_152","rifle","1_153","sense","1_109","luke","101_2"));
  var ds=new HashMap<String,String>(Map.of("raider","1_196","raider2","1_196","stick","1_315","stick2","1_315","comlink","1_201","d1",blueprint(first),"d2",blueprint(second)));
  for(String key:new String[]{"trooper","trooper2"})ds.put(key,"1_194");for(String key:new String[]{"blaster","blaster2"})ds.put(key,"1_317");for(String key:new String[]{"belt","belt2"})ds.put(key,"1_207");for(String key:new String[]{"mine","mine2"})ds.put(key,"1_322");ds.put("droid","1_186");ds.put("warrior","1_194");
  var s=new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation(site),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();if(lightTurn)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);
  s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("t"),s.GetLSCard("t2"),s.GetDSCard("raider"),s.GetDSCard("raider2"));
  s.AttachCardsTo(s.GetLSCard("t"),s.GetLSCard("gun"),s.GetLSCard("rifle"));s.AttachCardsTo(s.GetLSCard("t2"),s.GetLSCard("gun2"));
  if(deployed)s.AttachCardsTo(s.GetDSCard("raider"),s.GetDSCard("stick"),s.GetDSCard("stick2"));else s.MoveCardsToDSHand(s.GetDSCard("stick"),s.GetDSCard("stick2"));
  s.MoveCardsToDSHand(s.GetDSCard("d1"),s.GetDSCard("d2"));s.MoveCardsToLSHand(s.GetLSCard("sense"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"));s.AttachCardsTo(s.GetDSCard("raider"),s.GetDSCard("comlink"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("droid"),s.GetDSCard("warrior"));for(String key:new String[]{"trooper","trooper2","blaster","blaster2","belt","belt2","mine","mine2"})s.MoveCardsToDSHand(s.GetDSCard(key));return s;
 }
 private String blueprint(int value){return switch(value){case 0->"1_285";case 2->"1_196";case 3->"1_317";case 6->"1_252";default->throw new IllegalArgumentException();};}
 private int fire(VirtualTableScenario s,boolean lightTurn,int second){
  s.SkipToPhase(Phase.BATTLE);int before=s.GetDSForcePileCount();
  if(second<0){for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d1"));}
  else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));
  if(lightTurn)s.LSInitiateBattle(s.GetLSStartingLocation());else s.DSInitiateBattle(s.GetLSStartingLocation());
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("stick"),"Fire"));i++)pass(s);
  assertTrue(s.DSCardActionAvailable(s.GetDSCard("stick"),"Fire"));s.DSUseCardAction(s.GetDSCard("stick"),"Fire");s.DSChooseCard(s.GetLSCard("t"));
  for(int i=0;i<150&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);assertTrue(s.AwaitingLSWeaponsSegmentActions());return before-s.GetDSForcePileCount();
 }

 private void startReact(VirtualTableScenario s){startReact(s,"stick","raider");}
 private void startReact(VirtualTableScenario s,String key,String host){
  s.SkipToPhase(Phase.BATTLE);s.LSInitiateBattle(s.GetLSStartingLocation());
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("comlink")));i++)pass(s);
  s.DSUseCardAction(s.GetDSCard("comlink"));s.DSChooseCard(s.GetDSCard(key));if(host!=null&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(s.GetDSCard(host)))s.DSChooseCard(s.GetDSCard(host));
 }
 @Test public void deployThenFire(){var s=fixture(true,"1_129",3,3,false);s.SkipToPhase(Phase.BATTLE);int before=s.GetDSForcePileCount();startReact(s);
  for(int i=0;i<80&&s.GetDSCard("stick").getAttachedTo()!=s.GetDSCard("raider");i++)pass(s);assertEquals(s.GetDSCard("raider"),s.GetDSCard("stick").getAttachedTo());
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));boolean canFire=false;
  for(int i=0;i<80&&!s.AwaitingLSWeaponsSegmentActions();i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("stick"),"Fire")){canFire=true;break;}pass(s);}
  if(canFire){s.DSUseCardAction(s.GetDSCard("stick"),"Fire");s.DSChooseCard(s.GetLSCard("t"));for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);}
  results.add(Map.of("name","react-then-fire","fireAvailable",canFire,"forceSpent",before-s.GetDSForcePileCount(),"gunAvailable",s.LSCardActionAvailable(s.GetLSCard("gun"),"Fire")));
 }
 @Test public void cancelDeployReact(){for(String key:new String[]{"stick","trooper","blaster","belt","mine"}){var s=fixture(true,"1_129",3,3,false);s.SkipToPhase(Phase.BATTLE);int before=s.GetDSForcePileCount();startReact(s,key,key.equals("blaster")?"warrior":key.equals("stick")||key.equals("belt")?"raider":null);
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(s.GetLSCard("sense")));i++)pass(s);assertTrue(s.LSCardPlayAvailable(s.GetLSCard("sense")));s.PrepareLSDestiny(0);s.LSPlayCard(s.GetLSCard("sense"));
  if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(s.GetLSCard("luke")))s.LSChooseCard(s.GetLSCard("luke"));
  for(int i=0;i<100&&!s.GetDSHand().contains(s.GetDSCard(key));i++)pass(s);assertTrue(s.GetDSHand().contains(s.GetDSCard(key)));
  boolean offered=false;for(int i=0;i<100&&!s.AwaitingLSWeaponsSegmentActions();i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("comlink"))){s.DSUseCardAction(s.GetDSCard("comlink"));offered=s.DSHasCardChoiceAvailable(s.GetDSCard(key+"2"));break;}pass(s);}
  results.add(Map.of("name","cancel-react-"+key,"returnedToHand",true,"forceSpent",before-s.GetDSForcePileCount(),"copyOffered",offered));
 }
}
}
