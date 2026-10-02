package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import com.gempukku.swccgo.logic.modifiers.MayNotMoveModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled lifecycle interventions, not a claim that a particular return or
 * redeployment card has been played. Exercise the production identity registry. */
public class NativeEngineIdentityOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void lifecycle(){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host","1_28","gun","1_152","device","1_35")),new HashMap<>(Map.of("barrier","1_249")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.ACTIVATE);var host=s.GetLSCard("host");var gun=s.GetLSCard("gun");var device=s.GetLSCard("device");var site=s.GetLSStartingLocation();var gs=s.gameState();var mods=s.game().getModifiersQuerying();
  s.MoveCardsToLocation(site,host);s.AttachCardsTo(host,gun,device);
  var target=Filters.sameCardId(host);var physical=Filters.samePermanentCardId(host);
  mods.regularMovePerformed(host);mods.participatedInBattle(host,site);mods.weaponUsedBy(host,gun);mods.deviceUsedBy(host,device);
  s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotMoveModifier(s.GetDSCard("barrier"),host));
  results.add(Map.of("name","before","targetMatches",target.accepts(gs,mods,host),"physicalMatches",physical.accepts(gs,mods,host),"moved",mods.hasPerformedRegularMoveThisTurn(host),"battled",mods.hasParticipatedInBattle(host),"barred",mods.mayNotMove(gs,host),"differentWeapon",!mods.otherWeaponsUsed(host,gun).isEmpty(),"differentDevice",!mods.otherDevicesUsed(host,device).isEmpty()));
  s.MoveCardsToLSHand(gun,device);s.AttachCardsTo(host,gun,device);
  results.add(Map.of("name","equipment-return","targetMatches",target.accepts(gs,mods,host),"physicalMatches",physical.accepts(gs,mods,host),"moved",mods.hasPerformedRegularMoveThisTurn(host),"battled",mods.hasParticipatedInBattle(host),"barred",mods.mayNotMove(gs,host),"differentWeapon",!mods.otherWeaponsUsed(host,gun).isEmpty(),"differentDevice",!mods.otherDevicesUsed(host,device).isEmpty()));
  s.MoveCardsToLSHand(gun,device,host);s.MoveCardsToLocation(site,host);s.AttachCardsTo(host,gun,device);
  results.add(Map.of("name","host-return","targetMatches",target.accepts(gs,mods,host),"physicalMatches",physical.accepts(gs,mods,host),"moved",mods.hasPerformedRegularMoveThisTurn(host),"battled",mods.hasParticipatedInBattle(host),"barred",mods.mayNotMove(gs,host),"differentWeapon",!mods.otherWeaponsUsed(host,gun).isEmpty(),"differentDevice",!mods.otherDevicesUsed(host,device).isEmpty()));
  assertFalse(target.accepts(gs,mods,host));assertTrue(physical.accepts(gs,mods,host));
 }
 private VirtualTableScenario revivalFixture(boolean attachments, boolean charactersLost) {
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
 private void passRevival(VirtualTableScenario s,PhysicalCardImpl... ordered) {
  var text=s.GetCurrentDecision().getText().toLowerCase();
  if(text.contains("optional")||text.contains("response")||text.startsWith("verify lost pile")){s.PlayerPass(s.GetDecidingPlayer());return;}
  for(var c:ordered){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);return;}
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);return;}}
  throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
 }

 @Test public void actualOldBenHistory(){
  var s=revivalFixture(false,true);var luke=s.GetLSCard("luke");var ben=s.GetLSCard("ben");s.LSChooseCard(luke);
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(ben));i++)passRevival(s,luke);
  s.LSPlayCard(ben);for(int i=0;i<100&&!s.GetLSLostPile().contains(ben);i++)passRevival(s,luke);
  assertEquals(Zone.AT_LOCATION,luke.getZone());
  results.add(Map.of("name","old-ben-return","battled",s.game().getModifiersQuerying().hasParticipatedInBattle(luke),"participating",s.gameState().getBattleState().isCardParticipatingInBattle(luke)));
 }
}
