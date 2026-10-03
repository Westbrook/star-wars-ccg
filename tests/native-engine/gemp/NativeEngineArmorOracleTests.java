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
public class NativeEngineArmorOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/armor-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(String host){var s=new VirtualTableScenario(new HashMap<>(Map.of("hero","1_21","saber","1_157","d4","1_105","d1","1_28","d2","1_155")),new HashMap<>(Map.of("host",host,"other","1_194","armor","5_109")),16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("host"),s.GetDSCard("other"),s.GetLSCard("hero"));s.MoveCardsToDSHand(s.GetDSCard("armor"));return s;}
 Map<String,Object> values(VirtualTableScenario s,PhysicalCard h){var q=s.game().getModifiersQuerying();return Map.of("armor",q.getArmor(s.gameState(),h),"defense",q.getDefenseValue(s.gameState(),h),"power",q.getPower(s.gameState(),h),"immunity",q.getImmunityToAttritionLessThan(s.gameState(),h));}
 void deploy(VirtualTableScenario s){s.SkipToPhase(Phase.DEPLOY);var armor=s.GetDSCard("armor");var host=s.GetDSCard("host");s.DSDeployCard(armor);s.DSChooseCard(host);for(int i=0;i<60&&armor.getAttachedTo()!=host;i++)pass(s);assertEquals(host,armor.getAttachedTo());}
 @Test public void deploymentAndTransfer(){var s=fixture("1_194");s.SkipToPhase(Phase.DEPLOY);int before=s.GetDSForcePileCount();deploy(s);var armor=s.GetDSCard("armor");var host=s.GetDSCard("host");rows.add(Map.of("name","deployment","spent",before-s.GetDSForcePileCount(),"values",values(s,host)));
  for(int i=0;i<60&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSTransferAvailable(armor));i++)pass(s);
  var other=s.GetDSCard("other");before=s.GetDSForcePileCount();s.DSTransferCard(armor);s.DSChooseCard(other);for(int i=0;i<60&&armor.getAttachedTo()!=other;i++)pass(s);assertEquals(other,armor.getAttachedTo());rows.add(Map.of("name","transfer","spent",before-s.GetDSForcePileCount(),"old",values(s,host),"new",values(s,other)));
  s.MoveCardsToDSHand(armor);rows.add(Map.of("name","departure","values",values(s,other)));
 }
 @Test public void modifierOrdering(){for(boolean existing:new boolean[]{false,true})for(int add:new int[]{0,2,-2}){var s=fixture("1_194");var h=s.GetDSCard("host");if(existing)s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new DefinedByGameTextArmorModifier(h,4));deploy(s);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ArmorModifier(s.GetDSStartingLocation(),h,add));rows.add(Map.of("name","query-"+existing+"-"+add,"values",values(s,h)));}}
 @Test public void excludedVaders(){for(String bp:new String[]{"101_5","1_168"}){var s=fixture(bp);s.MoveCardsToDSHand(s.GetDSCard("other"));s.SkipToPhase(Phase.DEPLOY);rows.add(Map.of("name","excluded-"+bp,"available",s.DSDeployAvailable(s.GetDSCard("armor"))));}}
 @Test public void lightsaberDefense(){for(int total:new int[]{5,6}){var s=fixture("1_194");deploy(s);var h=s.GetDSCard("host");var saber=s.GetLSCard("saber");s.AttachCardsTo(s.GetLSCard("hero"),saber);s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(saber,"Fire"));i++)pass(s);s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard(total==5?"d1":"d2"),s.GetLSCard("d4"));s.LSUseCardAction(saber,"Fire");s.LSChooseCard(h);for(int i=0;i<100&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);assertNull(s.gameState().getWeaponFiringState());rows.add(Map.of("name","hit-"+total,"hit",h.isHit(),"forfeit",s.game().getModifiersQuerying().getForfeit(s.gameState(),h)));}}
}
