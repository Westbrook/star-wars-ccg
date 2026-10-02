package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.common.Zone;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;

/** Actual forfeitures and Interrupt plays; no GEMP production source changes. */
public class NativeEngineRevivalOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/revival-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(boolean attachments, boolean charactersLost) {
  var dark=new HashMap<>(Map.of("kintan","1_254","second","1_254","deep","1_194","nearest","1_186","other","1_317"));
  for(int i=0;i<10;i++)dark.put("trooper"+i,"1_194");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","rebel","1_28","ben","1_100","weapon","1_152","belt","1_40")),dark,10,10,
    StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(5);s.LSActivateForceCheat(5);
  var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("luke"),s.GetLSCard("rebel"));
  for(int i=0;i<10;i++)s.MoveCardsToLocation(site,s.GetDSCard("trooper"+i));
  if(attachments)s.AttachCardsTo(s.GetLSCard("luke"),s.GetLSCard("weapon"),s.GetLSCard("belt"));
  s.MoveCardsToLSHand(s.GetLSCard("ben"));s.MoveCardsToDSHand(s.GetDSCard("kintan"),s.GetDSCard("second"));
  if(charactersLost){s.MoveCardsToTopOfDSLostPile(s.GetDSCard("deep"));s.MoveCardsToTopOfDSLostPile(s.GetDSCard("nearest"));}else s.MoveCardsToDSHand(s.GetDSCard("deep"),s.GetDSCard("nearest"));s.MoveCardsToTopOfDSLostPile(s.GetDSCard("other"));
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToDamageSegment();
  for(int i=0;i<60&&!s.AwaitingLSBattleDamagePayment();i++)s.PlayerPass(s.GetDecidingPlayer());
  assertTrue(s.AwaitingLSBattleDamagePayment());return s;
 }
 private void pass(VirtualTableScenario s,PhysicalCardImpl... ordered) {
  var text=s.GetCurrentDecision().getText().toLowerCase();
  if(text.contains("optional")||text.contains("response")||text.startsWith("verify lost pile")){s.PlayerPass(s.GetDecidingPlayer());return;}
  for(var c:ordered){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);return;}
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);return;}}
  throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
 }
 @Test public void oldBenReturnsWithoutRejoining() {
  for(boolean attachments:new boolean[]{false,true}){
   var s=fixture(attachments,true);var luke=s.GetLSCard("luke");var ben=s.GetLSCard("ben");var weapon=s.GetLSCard("weapon");var belt=s.GetLSCard("belt");int before=s.GetUnpaidLSBattleDamage();int forfeit=s.GetForfeit(luke);int force=s.GetLSForcePileCount();
   s.LSChooseCard(luke);
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(ben));i++)pass(s,luke,weapon,belt);
   assertTrue(s.LSCardPlayAvailable(ben));s.LSPlayCard(ben);
   for(int i=0;i<100&&!s.GetLSLostPile().contains(ben);i++)pass(s,luke);
   assertEquals(Zone.AT_LOCATION,luke.getZone());assertEquals(s.GetLSStartingLocation(),luke.getAtLocation());assertFalse(s.gameState().getBattleState().isCardParticipatingInBattle(luke));assertEquals(force-1,s.GetLSForcePileCount());assertEquals(Math.max(0,before-forfeit),s.GetUnpaidLSBattleDamage());
   if(attachments){assertTrue(s.GetLSLostPile().contains(weapon));assertTrue(s.GetLSLostPile().contains(belt));}
   results.add(Map.of("name",attachments?"old-ben-attachments":"old-ben","returned",true,"participating",false,"damage",s.GetUnpaidLSBattleDamage(),"forceSpent",force-s.GetLSForcePileCount(),"attachmentsLost",attachments,"interruptLost",s.GetLSLostPile().contains(ben)));
  }
 }
 @Test public void kintanTopmostCharacterAndFailedSearch() {
  for(boolean found:new boolean[]{true,false}){
   var s=fixture(false,found);var card=s.GetDSCard("kintan");var deep=s.GetDSCard("deep");var nearest=s.GetDSCard("nearest");var other=s.GetDSCard("other");int force=s.GetDSForcePileCount();
   s.LSChooseCard(s.GetLSCard("luke"));
   for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(card));i++)pass(s);
   assertTrue(s.DSCardPlayAvailable(card));s.DSPlayCard(card);
   for(int i=0;i<100&&!s.GetDSLostPile().contains(card);i++)pass(s,nearest);
   assertEquals(force-1,s.GetDSForcePileCount());assertTrue(s.GetDSHand().contains(nearest));assertEquals(found,s.GetDSLostPile().contains(deep));assertTrue(s.GetDSLostPile().contains(other));
   assertEquals(found,com.gempukku.swccgo.cards.GameConditions.canSearchLostPile(s.game(),VirtualTableScenario.DS,s.GetDSCard("second"),com.gempukku.swccgo.common.GameTextActionId.KINTAN_STRIDER__RETRIEVE_TOPMOST_CHARACTER));
   results.add(Map.of("name",found?"kintan-character":"kintan-no-character","retrieved",found?1:0,"searchAllowed",com.gempukku.swccgo.cards.GameConditions.canSearchLostPile(s.game(),VirtualTableScenario.DS,s.GetDSCard("second"),com.gempukku.swccgo.common.GameTextActionId.KINTAN_STRIDER__RETRIEVE_TOPMOST_CHARACTER),"deepStillLost",s.GetDSLostPile().contains(deep),"noncharacterLost",s.GetDSLostPile().contains(other),"forceSpent",force-s.GetDSForcePileCount(),"interruptLost",s.GetDSLostPile().contains(card)));
  }
 }
}
