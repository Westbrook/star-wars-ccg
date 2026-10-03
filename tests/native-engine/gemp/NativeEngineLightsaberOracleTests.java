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
public class NativeEngineLightsaberOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/lightsaber-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(String bp,boolean equipped,String phase){
  var ls=new HashMap<String,String>(Map.of("host","1_21","luke","1_19","jedi","9_24","troop","1_28","talz","1_31","saber",bp.equals("1_324")?"1_155":bp,"copy","1_155","gun","1_152"));
  var ds=new HashMap<String,String>(Map.of("host","1_168","target","101_5","saber","1_324","gun","1_317"));
  ls.put("d1","1_109");ls.put("d2","1_109");ls.put("d3","1_115");ls.put("d4","1_28");ls.put("d5","1_28");
  ls.put("d6","1_115");ds.put("d6","1_262");
  ds.put("d1","1_317");ds.put("d2","1_317");ds.put("d3","1_262");ds.put("d4","1_194");ds.put("d5","1_194");
  var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();boolean dark=bp.equals("1_324");if(dark)s.SkipToPhase(Phase.ACTIVATE);else s.SkipToLSTurn(Phase.ACTIVATE);s.DSActivateForceCheat(10);s.LSActivateForceCheat(10);
  var host=dark?s.GetDSCard("host"):s.GetLSCard("host");var target=dark?s.GetLSCard("luke"):s.GetDSCard("target");var saber=dark?s.GetDSCard("saber"):s.GetLSCard("saber");
  s.MoveCardsToLocation(s.GetLSStartingLocation(),host);if(!phase.equals("drain"))s.MoveCardsToLocation(s.GetLSStartingLocation(),target);if(equipped)s.AttachCardsTo(host,saber);else if(dark)s.MoveCardsToDSHand(saber);else s.MoveCardsToLSHand(saber);return s;
 }
 @Test public void firing(){for(String bp:new String[]{"1_324","1_157","1_155"})for(int[] draws:new int[][]{{1,1},{3,3},{5,5},{5,-1}}){
  var s=fixture(bp,true,"battle");boolean dark=bp.equals("1_324");var saber=dark?s.GetDSCard("saber"):s.GetLSCard("saber");var target=dark?s.GetLSCard("luke"):s.GetDSCard("target");String player=dark?VirtualTableScenario.DS:VirtualTableScenario.LS;
  s.SkipToPhase(Phase.BATTLE);if(dark)s.DSInitiateBattle(s.GetLSStartingLocation());else s.LSInitiateBattle(s.GetLSStartingLocation());
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(player)&&(dark?s.DSCardActionAvailable(saber,"Fire"):s.LSCardActionAvailable(saber,"Fire")));i++)pass(s);
  if(draws[1]<0){if(dark){for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d3"));}else{for(var c:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)c);s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("d3"));}}
  else {String a=draws[0]==1?"d4":draws[0]==5?"d3":"d1",b=draws[0]==1?"d5":draws[0]==5?"d6":"d2";if(dark)s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard(b),s.GetDSCard(a));else s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard(b),s.GetLSCard(a));}
  int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();
  if(dark){s.DSUseCardAction(saber,"Fire");s.DSChooseCard(target);}else{s.LSUseCardAction(saber,"Fire");s.LSChooseCard(target);}
  for(int i=0;i<100&&!(s.gameState().getWeaponFiringState()==null && s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);
  assertNull(s.gameState().getWeaponFiringState());var q=s.game().getModifiersQuerying();rows.add(Map.of("name",bp+"-"+draws[0]+"-"+draws[1],"hit",target.isHit(),"forfeit",q.getForfeit(s.gameState(),target),"spent",before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount())));
 }}
 @Test public void deployment(){for(String bp:new String[]{"1_324","1_157","1_155"}){
  var s=fixture(bp,false,"deploy");boolean dark=bp.equals("1_324");var saber=dark?s.GetDSCard("saber"):s.GetLSCard("saber");var host=dark?s.GetDSCard("host"):s.GetLSCard("host");s.SkipToPhase(Phase.DEPLOY);int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();
  if(dark){s.DSDeployCard(saber);s.DSChooseCard(host);}else{s.LSDeployCard(saber);s.LSChooseCard(host);}for(int i=0;i<60&&saber.getAttachedTo()!=host;i++)pass(s);assertEquals(host,saber.getAttachedTo());rows.add(Map.of("name","deploy-"+bp,"spent",before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount())));
 }}
 @Test public void drains(){for(String mode:new String[]{"skip","use","duplicates"}){
  boolean duplicates=mode.equals("duplicates");String bp=duplicates?"1_155":"1_324";var s=fixture(bp,true,"drain");boolean dark=!duplicates;var saber=dark?s.GetDSCard("saber"):s.GetLSCard("saber");String player=dark?VirtualTableScenario.DS:VirtualTableScenario.LS;
  if(duplicates){s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("troop"));s.AttachCardsTo(s.GetLSCard("troop"),s.GetLSCard("copy"));}
  s.SkipToPhase(Phase.CONTROL);if(dark)s.DSForceDrainAt(s.GetLSStartingLocation());else s.LSForceDrainAt(s.GetLSStartingLocation());
  if(!mode.equals("skip")){
   for(int i=0;i<60&&!(s.GetDecidingPlayer().equals(player)&&(dark?s.DSCardActionAvailable(saber,"Add 1"):s.LSCardActionAvailable(saber,"Add 1")));i++)pass(s);
   if(dark)s.DSUseCardAction(saber,"Add 1");else s.LSUseCardAction(saber,"Add 1");
   if(duplicates){var copy=s.GetLSCard("copy");for(int i=0;i<60&&!(s.GetDecidingPlayer().equals(player)&&s.LSCardActionAvailable(copy,"Add 1"));i++)pass(s);s.LSUseCardAction(copy,"Add 1");}
  }
  for(int i=0;i<80&&!s.GetCurrentDecision().getText().toLowerCase().contains("choose force to lose");i++){if(s.gameState().getForceDrainState()!=null&&s.GetCurrentDecision().getText().toLowerCase().contains("force loss"))break;pass(s);}
  assertNotNull(s.gameState().getForceDrainState());rows.add(Map.of("name","drain-"+mode,"total",s.GetForceDrainTotal()));
 }}
 @Test public void talzRestoresForfeit(){
  var s=fixture("1_324",true,"battle");var saber=s.GetDSCard("saber");var target=s.GetLSCard("luke");var talz=s.GetLSCard("talz");s.MoveCardsToLocation(s.GetLSStartingLocation(),talz);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(saber,"Fire"));i++)pass(s);
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));s.DSUseCardAction(saber,"Fire");s.DSChooseCard(target);
  for(int i=0;i<100&&!target.isHit();i++)pass(s);assertTrue(target.isHit());assertEquals(0f,s.game().getModifiersQuerying().getForfeit(s.gameState(),target),0f);
  for(int i=0;i<150&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(talz,"restore"));i++)pass(s);s.LSUseCardAction(talz,"restore");if(s.GetCurrentDecision().getDecisionParameters().containsKey("cardId"))s.LSChooseCard(target);
  for(int i=0;i<80&&target.isHit();i++)pass(s);assertFalse(target.isHit());rows.add(Map.of("name","talz-restored","forfeit",s.game().getModifiersQuerying().getForfeit(s.gameState(),target),"talzLost",s.GetLSLostPile().contains(talz)));
 }
 @Test public void armedLuke(){var s=fixture("1_155",true,"drain");var luke=s.GetLSCard("jedi");var saber=s.GetLSCard("saber");s.MoveCardsToLocation(s.GetLSStartingLocation(),luke);s.AttachCardsTo(luke,saber);var q=s.game().getModifiersQuerying();rows.add(Map.of("name","luke-armed","power",q.getPower(s.gameState(),luke),"immunity",q.getImmunityToAttritionLessThan(s.gameState(),luke)));s.MoveCardsToLSHand(s.GetLSCard("host"));rows.add(Map.of("name","luke-alone-armed","power",q.getPower(s.gameState(),luke),"immunity",q.getImmunityToAttritionLessThan(s.gameState(),luke)));}
}
