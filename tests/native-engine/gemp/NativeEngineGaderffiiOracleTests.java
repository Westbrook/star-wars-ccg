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
public class NativeEngineGaderffiiOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/gaffi-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void pass(VirtualTableScenario s){String t=s.GetCurrentDecision().getText().toLowerCase();try{if(t.contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(t+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 private VirtualTableScenario fixture(boolean lightTurn,String site,int first,int second,boolean deployed){
  var ls=new HashMap<String,String>(Map.of("t","1_28","t2","1_28","gun","1_152","gun2","1_152","rifle","1_153"));
  var ds=new HashMap<String,String>(Map.of("raider","1_196","raider2","1_196","stick","1_315","stick2","1_315","d1",blueprint(first),"d2",blueprint(second)));
  var s=new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation(site),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();if(lightTurn)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);
  s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("t"),s.GetLSCard("t2"),s.GetDSCard("raider"),s.GetDSCard("raider2"));
  s.AttachCardsTo(s.GetLSCard("t"),s.GetLSCard("gun"),s.GetLSCard("rifle"));s.AttachCardsTo(s.GetLSCard("t2"),s.GetLSCard("gun2"));
  if(deployed)s.AttachCardsTo(s.GetDSCard("raider"),s.GetDSCard("stick"),s.GetDSCard("stick2"));else s.MoveCardsToDSHand(s.GetDSCard("stick"),s.GetDSCard("stick2"));
  s.MoveCardsToDSHand(s.GetDSCard("d1"),s.GetDSCard("d2"));return s;
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
 @Test public void outcomes(){for(boolean lightTurn:new boolean[]{false,true})for(int[] draws:new int[][]{{2,2},{2,3},{3,3},{0,6},{6,-1}}){
  var s=fixture(lightTurn,"1_129",draws[0],Math.max(0,draws[1]),true);int spent=fire(s,lightTurn,draws[1]);
  var row=new LinkedHashMap<String,Object>();row.put("name",(lightTurn?"light":"dark")+"-"+draws[0]+"-"+draws[1]);row.put("initiator",lightTurn?"light":"dark");row.put("draws",draws);row.put("gunAvailable",s.LSCardActionAvailable(s.GetLSCard("gun"),"Fire"));row.put("rifleAvailable",s.LSCardActionAvailable(s.GetLSCard("rifle"),"Fire"));row.put("otherAvailable",s.LSCardActionAvailable(s.GetLSCard("gun2"),"Fire"));row.put("forceSpent",spent);row.put("weaponZone",s.GetLSCard("gun").getZone().name());row.put("usedBlueprints",s.GetDSUsedPile().stream().limit(draws[1]<0?1:2).map(c -> c.getBlueprintId(true)).toList());results.add(row);
 }}
 @Test public void locationBonus(){var s=fixture(false,"1_132",2,2,true);fire(s,false,2);results.add(Map.of("name","location-bonus","gunAvailable",s.LSCardActionAvailable(s.GetLSCard("gun"),"Fire"),"otherAvailable",s.LSCardActionAvailable(s.GetLSCard("gun2"),"Fire")));}
 @Test public void deploymentAndTransfer(){var s=fixture(false,"1_129",2,2,false);s.SkipToPhase(Phase.DEPLOY);int before=s.GetDSForcePileCount();s.DSDeployCard(s.GetDSCard("stick"));s.DSChooseCard(s.GetDSCard("raider"));for(int i=0;i<80&&s.GetDSCard("stick").getAttachedTo()!=s.GetDSCard("raider");i++)pass(s);assertEquals(s.GetDSCard("raider"),s.GetDSCard("stick").getAttachedTo());results.add(Map.of("name","deploy","forceSpent",before-s.GetDSForcePileCount()));
  before=s.GetDSForcePileCount();for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSTransferAvailable(s.GetDSCard("stick")));i++)pass(s);s.DSUseCardAction(s.GetDSCard("stick"),"Transfer");s.DSChooseCard(s.GetDSCard("raider2"));for(int i=0;i<80&&s.GetDSCard("stick").getAttachedTo()!=s.GetDSCard("raider2");i++)pass(s);assertEquals(s.GetDSCard("raider2"),s.GetDSCard("stick").getAttachedTo());results.add(Map.of("name","transfer","forceSpent",before-s.GetDSForcePileCount()));
 }
}
