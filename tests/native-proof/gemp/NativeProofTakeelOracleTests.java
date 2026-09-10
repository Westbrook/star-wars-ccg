package com.gempukku.swccgo.rules.battle;

import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.common.Zone;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.ArrayList;
import static org.junit.Assert.*;

/** Closed Sites-native Takeel proof oracle. No upstream production rules are changed. */
public class NativeProofTakeelOracleTests {
    private HashMap<String,String> deck(String side, String starting) throws Exception {
        String line=Files.readAllLines(Path.of("/opt/gemp-swccg/src/db-scripts/sample_decks.sql")).stream()
            .filter(s->s.contains("'Precon Premiere Intro 2PG ("+side+")'")).findFirst().orElseThrow();
        String[] ids=line.substring(line.lastIndexOf("','")+3, line.indexOf('|')).split(",");
        assertEquals(60,ids.length);
        HashMap<String,String> cards=new HashMap<>(); boolean skipped=false;
        for(int i=0;i<ids.length;i++) { if(!skipped&&ids[i].equals(starting)){skipped=true;continue;} cards.put("card-"+i,ids[i]); }
        assertTrue(skipped); return cards;
    }
    private VirtualTableScenario fixture(boolean extraForce) throws Exception {
        var scn=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,
            StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
            StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
        scn.StartGame(); scn.SkipToPhase(Phase.DEPLOY);
        for(String s:new String[]{VirtualTableScenario.LS,VirtualTableScenario.DS}) {
            var reset=new ArrayList<PhysicalCardImpl>();
            for(var c:scn.gameState().getHand(s))reset.add((PhysicalCardImpl)c);
            for(var c:scn.gameState().getForcePile(s))reset.add((PhysicalCardImpl)c);
            for(var c:scn.gameState().getUsedPile(s))reset.add((PhysicalCardImpl)c);
            scn.MoveCardsToTopOfOwnReserveDeck(reset);
        }
        scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());
        var site=scn.GetLSStartingLocation();
        for(int i=1;i<=4;i++)scn.MoveCardsToLocation(site,card(scn,true,"1_28",i),card(scn,false,"1_194",i));
        scn.MoveCardsToTopOfOwnForcePile(card(scn,true,"1_28",5),card(scn,false,"1_194",5));
        // Keep the sixth Stormtrooper reserved as the controlled destiny draw.
        if(extraForce)scn.MoveCardsToTopOfOwnForcePile(card(scn,false,"1_194",7));
        scn.MoveCardsToDSHand(card(scn,false,"1_269",1));
        scn.MoveCardsToTopOfLSReserveDeck(card(scn,true,"1_12",1));
        scn.MoveCardsToTopOfDSReserveDeck(card(scn,false,"1_194",6));
        scn.SkipToPhase(Phase.BATTLE);
        return scn;
    }
    private PhysicalCardImpl card(VirtualTableScenario scn, boolean light, String blueprint, int nth) {
        for(int i=0;i<60;i++) {
            PhysicalCardImpl c;
            try {c=light?scn.GetLSCard("card-"+i):scn.GetDSCard("card-"+i);}catch(IllegalArgumentException e){continue;}
            if(c.getBlueprintId(true).equals(blueprint)&&--nth==0)return c;
        }
        throw new AssertionError("Missing fixture card "+blueprint);
    }
    private boolean takeelAvailable(VirtualTableScenario scn) {
        // Yes/no destiny prompts have no card-action parameters.
        var decision=scn.DSGetDecision();
        return decision!=null && decision.getDecisionParameters().get("cardId")!=null
            && scn.DSCardPlayAvailable(card(scn,false,"1_269",1));
    }
    private void noTakeel(VirtualTableScenario scn) {
        assertFalse("Takeel must not be available before both destiny draws complete",takeelAvailable(scn));
    }
    private void drawToResponse(VirtualTableScenario scn, boolean darkDraw, boolean lightDraw) {
        noTakeel(scn);
        scn.DSInitiateBattle(scn.GetLSStartingLocation());
        noTakeel(scn);
        scn.SkipToPowerSegment();
        noTakeel(scn);
        assertTrue(scn.DSDecisionAvailable("battle destiny?"));
        if(darkDraw)scn.DSChooseYes();else scn.DSChooseNo();
        noTakeel(scn);
        scn.PassDestinyDrawResponses();
        noTakeel(scn);
        scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_PLAYER");
        assertTrue(scn.LSDecisionAvailable("battle destiny?"));
        if(lightDraw)scn.LSChooseYes();else scn.LSChooseNo();
        noTakeel(scn);
        scn.PassDestinyDrawResponses();
        noTakeel(scn);
        scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_PLAYER");
        // GEMP gives the non-initiating player the first response.
        assertTrue(scn.LSDecisionAvailable("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS"));
        assertFalse(scn.LSAnyActionsAvailable());
        scn.LSPass();
        System.out.println("TAKEEL_OPPORTUNITY DS="+(scn.DSGetDecision()==null?"none":scn.DSGetDecision().getText())+"; available="+takeelAvailable(scn));
    }
    private void physicalDestiniesStayOwned(VirtualTableScenario scn) {
        var jawa=card(scn,true,"1_12",1);var trooper=card(scn,false,"1_194",6);
        assertEquals(VirtualTableScenario.LS,jawa.getOwner());assertEquals(VirtualTableScenario.DS,trooper.getOwner());
        assertTrue(scn.gameState().getUsedPile(VirtualTableScenario.LS).contains(jawa));
        assertTrue(scn.gameState().getUsedPile(VirtualTableScenario.DS).contains(trooper));
    }
    @Test public void playSwitchesNumbersAfterBothDrawsAndPaysLostInterruptCost() throws Exception {
        var scn=fixture(true);var takeel=card(scn,false,"1_269",1);
        assertEquals(2,scn.GetDSForcePileCount());
        drawToResponse(scn,true,true);
        assertTrue(scn.DSDecisionAvailable("Battle destiny draws complete"));
        assertTrue(takeelAvailable(scn));
        assertEquals(1,scn.GetDSForcePileCount());
        assertEquals(3,scn.GetLSTotalDestiny());assertEquals(1,scn.GetDSTotalDestiny());
        physicalDestiniesStayOwned(scn);
        int usedBefore=scn.GetDSUsedPileCount();
        scn.DSPlayCard(takeel);
        assertEquals(Zone.HAND,takeel.getZone());assertEquals(1,scn.GetDSForcePileCount());
        assertTrue(scn.GetCurrentDecision().getText().contains("Use 1 Force"));
        System.out.println("TAKEEL_AFTER_SELECT_ZONE="+takeel.getZone()+"; decision="+scn.GetCurrentDecision().getText());
        scn.PassForceUseResponses();
        assertEquals(0,scn.GetDSForcePileCount());assertEquals(usedBefore+1,scn.GetDSUsedPileCount());
        System.out.println("TAKEEL_PENDING_ZONE="+takeel.getZone()+"; decision="+scn.GetCurrentDecision().getText());
        assertEquals(Zone.VOID,takeel.getZone());
        assertEquals(3,scn.GetLSTotalDestiny());assertEquals(1,scn.GetDSTotalDestiny());
        scn.PassCardPlayResponses();
        scn.PassResponses("PUT_IN_CARD_PILE_FROM_OFF_TABLE");
        System.out.println("TAKEEL_AFTER_PLAY_ZONE="+takeel.getZone()+"; decision="+scn.GetCurrentDecision().getText());
        scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS");
        assertTrue(scn.gameState().getLostPile(VirtualTableScenario.DS).contains(takeel));
        assertEquals(1,scn.GetLSTotalDestiny());assertEquals(3,scn.GetDSTotalDestiny());
        assertEquals(5,scn.GetLSTotalPower());assertEquals(7,scn.GetDSTotalPower());
        physicalDestiniesStayOwned(scn);
        scn.PassResponses("INITIAL_ATTRITION_CALCULATED");
        assertTrue(scn.DSWonBattle());
        assertEquals(3,scn.GetUnpaidLSAttrition());assertEquals(1,scn.GetUnpaidDSAttrition());
        assertEquals(2,scn.GetUnpaidLSBattleDamage());assertEquals(0,scn.GetUnpaidDSBattleDamage());
        assertTrue(scn.AwaitingDSAttritionPayment());
        scn.DSPayAttritionFromCardInPlay(card(scn,false,"1_194",1));
        assertEquals(0,scn.GetUnpaidDSAttrition());assertTrue(scn.AwaitingLSAttritionPayment());
        scn.LSPayAttritionFromCardInPlay(card(scn,true,"1_28",1));
        assertEquals(1,scn.GetUnpaidLSAttrition());assertEquals(0,scn.GetUnpaidLSBattleDamage());
        assertTrue(scn.AwaitingLSAttritionPayment());
        scn.LSPayAttritionFromCardInPlay(card(scn,true,"1_28",2));
        assertEquals(2,scn.GetDSLostPileCount());assertEquals(2,scn.GetLSLostPileCount());
        System.out.println("TAKEEL_ORACLE_PLAY: after both draw, Force 1->0, cost to Used, pending VOID then Lost; numbers Light=1 Dark=3, power Light=5 Dark=7, attrition Light=3 Dark=1, damage Light=2; physical destiny cards remain owners' Used; forfeits Dark/Light/Light; first Light forfeit leaves attrition=1 damage=0.");
    }
    @Test public void declinePreservesNumbersHandAndForce() throws Exception {
        var scn=fixture(true);var takeel=card(scn,false,"1_269",1);
        drawToResponse(scn,true,true);
        assertTrue(takeelAvailable(scn));
        scn.DSDecline();
        scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS");
        assertEquals(Zone.HAND,takeel.getZone());assertEquals(1,scn.GetDSForcePileCount());
        assertEquals(3,scn.GetLSTotalDestiny());assertEquals(1,scn.GetDSTotalDestiny());
        assertEquals(7,scn.GetLSTotalPower());assertEquals(5,scn.GetDSTotalPower());
        physicalDestiniesStayOwned(scn);
        scn.PassResponses("INITIAL_ATTRITION_CALCULATED");
        assertEquals(1,scn.GetUnpaidLSAttrition());assertEquals(3,scn.GetUnpaidDSAttrition());
        assertEquals(0,scn.GetUnpaidLSBattleDamage());assertEquals(2,scn.GetUnpaidDSBattleDamage());
        System.out.println("TAKEEL_ORACLE_DECLINE: card remains Hand; Force remains 1; numbers Light=3 Dark=1; power Light=7 Dark=5; attrition Light=1 Dark=3; damage Dark=2.");
    }
    @Test public void noOpportunityIfEitherPlayerDoesNotDraw() throws Exception {
        for(boolean[] draws:new boolean[][]{{false,true},{true,false},{false,false}}) {
            var scn=fixture(true);var takeel=card(scn,false,"1_269",1);
            drawToResponse(scn,draws[0],draws[1]);
            assertFalse(takeelAvailable(scn));
            scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS");
            assertFalse(takeelAvailable(scn));
            assertEquals(Zone.HAND,takeel.getZone());assertEquals(1,scn.GetDSForcePileCount());
            assertEquals(draws[1]?7:4,scn.GetLSTotalPower());assertEquals(draws[0]?5:4,scn.GetDSTotalPower());
            System.out.println("TAKEEL_ORACLE_MISSING_DRAW: Dark="+draws[0]+" Light="+draws[1]+"; no Takeel action; Hand unchanged; Force=1.");
        }
    }
    @Test public void noOpportunityWithoutOneForceAfterBattleInitiation() throws Exception {
        var scn=fixture(false);var takeel=card(scn,false,"1_269",1);
        drawToResponse(scn,true,true);
        assertEquals(0,scn.GetDSForcePileCount());assertFalse(takeelAvailable(scn));
        scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS");
        assertEquals(Zone.HAND,takeel.getZone());assertEquals(7,scn.GetLSTotalPower());assertEquals(5,scn.GetDSTotalPower());
        System.out.println("TAKEEL_ORACLE_NO_FORCE: both drew, but initiation exhausts Force; no Takeel action; card remains Hand.");
    }
}
