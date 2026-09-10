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
import java.util.Arrays;
import static org.junit.Assert.*;

/** Closed Sites-native deployment/Barrier proof oracle. No upstream production rules changed. */
public class NativeProofBarrierOracleTests {
    private static final String LS=VirtualTableScenario.LS, DS=VirtualTableScenario.DS;
    private String player(boolean light) { return light?LS:DS; }
    private HashMap<String,String> deck(String side, String starting) throws Exception {
        String line=Files.readAllLines(Path.of("/opt/gemp-swccg/src/db-scripts/sample_decks.sql")).stream()
            .filter(s->s.contains("'Precon Premiere Intro 2PG ("+side+")'")).findFirst().orElseThrow();
        String[] ids=line.substring(line.lastIndexOf("','")+3, line.indexOf('|')).split(",");
        assertEquals(60,ids.length);
        HashMap<String,String> cards=new HashMap<>(); boolean skipped=false;
        for(int i=0;i<ids.length;i++) { if(!skipped&&ids[i].equals(starting)){skipped=true;continue;} cards.put("card-"+i,ids[i]); }
        assertTrue(skipped); return cards;
    }
    private PhysicalCardImpl card(VirtualTableScenario scn, boolean light, String blueprint, int nth) {
        for(int i=0;i<60;i++) {
            PhysicalCardImpl c;
            try {c=light?scn.GetLSCard("card-"+i):scn.GetDSCard("card-"+i);}catch(IllegalArgumentException e){continue;}
            if(c.getBlueprintId(true).equals(blueprint)&&--nth==0)return c;
        }
        throw new AssertionError("Missing fixture card "+blueprint);
    }
    private PhysicalCardImpl trooper(VirtualTableScenario scn, boolean light, int nth) { return card(scn,light,light?"1_28":"1_194",nth); }
    private PhysicalCardImpl barrier(VirtualTableScenario scn, boolean activeLight) { return card(scn,!activeLight,activeLight?"1_249":"1_105",1); }
    private int force(VirtualTableScenario scn, boolean light) { return scn.gameState().getForcePile(player(light)).size(); }
    private int used(VirtualTableScenario scn, boolean light) { return scn.gameState().getUsedPile(player(light)).size(); }
    private VirtualTableScenario fixture(boolean activeLight, boolean opponentForce) throws Exception {
        var scn=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,
            StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
            StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
        scn.StartGame();
        if(activeLight)scn.SkipToLSTurn(Phase.CONTROL);else scn.SkipToPhase(Phase.CONTROL);
        for(String s:new String[]{LS,DS}) {
            var reset=new ArrayList<PhysicalCardImpl>();
            for(var c:scn.gameState().getHand(s))reset.add((PhysicalCardImpl)c);
            for(var c:scn.gameState().getForcePile(s))reset.add((PhysicalCardImpl)c);
            for(var c:scn.gameState().getUsedPile(s))reset.add((PhysicalCardImpl)c);
            scn.MoveCardsToTopOfOwnReserveDeck(reset);
        }
        // Framework starts at the deck's legal fixed starter. Restore it, then arrange the two-site study.
        scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());
        scn.MoveLocationToTable(card(scn,false,"1_284",1));
        if(activeLight)scn.MoveCardsToLSHand(trooper(scn,true,1),trooper(scn,true,2));
        else scn.MoveCardsToDSHand(trooper(scn,false,1),trooper(scn,false,2));
        for(int i=3;i<=7;i++)scn.MoveCardsToTopOfOwnForcePile(trooper(scn,activeLight,i));
        scn.MoveCardsToLocation(scn.GetLSStartingLocation(),trooper(scn,!activeLight,1));
        if(opponentForce)scn.MoveCardsToTopOfOwnForcePile(trooper(scn,!activeLight,2));
        if(activeLight)scn.MoveCardsToDSHand(barrier(scn,true));else scn.MoveCardsToLSHand(barrier(scn,false));
        scn.SkipToPhase(Phase.DEPLOY);
        assertEquals(player(activeLight),scn.GetCurrentPlayer());
        assertEquals(5,force(scn,activeLight));assertEquals(opponentForce?1:0,force(scn,!activeLight));
        assertEquals(52,scn.gameState().getReserveDeck(player(activeLight)).size());
        assertEquals(opponentForce?56:57,scn.gameState().getReserveDeck(player(!activeLight)).size());
        assertEquals(2,scn.gameState().getHand(player(activeLight)).size());assertEquals(1,scn.gameState().getHand(player(!activeLight)).size());
        assertFalse(available(scn,!activeLight,barrier(scn,activeLight),null));
        return scn;
    }
    private boolean available(VirtualTableScenario scn, boolean light, PhysicalCardImpl c, String text) {
        var d=scn.GetAwaitingDecision(player(light));
        return d!=null && d.getDecisionParameters().get("cardId")!=null && scn.ActionAvailable(player(light),c,text);
    }
    private void choose(VirtualTableScenario scn, boolean light, PhysicalCardImpl c) { if(light)scn.LSChooseCard(c);else scn.DSChooseCard(c); }
    private void giveActiveOpportunity(VirtualTableScenario scn, boolean light) {
        if(!scn.GetDecidingPlayer().equals(player(light))) {
            assertTrue(scn.GetCurrentDecision().getText().contains("action or Pass"));
            assertFalse(scn.AnyActionsAvailable(player(!light)));
            scn.PlayerPass(player(!light));
        }
        assertEquals(player(light),scn.GetDecidingPlayer());
    }
    private void deployToResponse(VirtualTableScenario scn, boolean activeLight, int n, PhysicalCardImpl site) {
        giveActiveOpportunity(scn,activeLight);
        var target=trooper(scn,activeLight,n);
        assertTrue(available(scn,activeLight,target,"Deploy"));
        if(activeLight)scn.LSDeployCard(target);else scn.DSDeployCard(target);
        System.out.println("DEPLOY_CHOICES "+player(activeLight)+" "+scn.GetCurrentDecision().getText()+" "+Arrays.toString(scn.GetCurrentDecision().getDecisionParameters().get("cardId")));
        var choices=Arrays.asList(scn.GetCurrentDecision().getDecisionParameters().get("cardId"));
        assertTrue(choices.contains(String.valueOf(scn.GetLSStartingLocation().getCardId())));
        assertEquals(!activeLight,choices.contains(String.valueOf(card(scn,false,"1_284",1).getCardId())));
        choose(scn,activeLight,site);
        System.out.println("DEPLOY_COST_PENDING "+scn.GetCurrentDecision().getText()+"; zone="+target.getZone());
        assertFalse(available(scn,!activeLight,barrier(scn,activeLight),null));
        scn.PassForceUseResponses();
        System.out.println("DEPLOY_AFTER "+scn.GetCurrentDecision().getText()+"; zone="+target.getZone()+"; decider="+scn.GetDecidingPlayer());
        if(scn.GetDecidingPlayer().equals(player(activeLight)))scn.PlayerPass(player(activeLight));
        assertEquals(site,target.getAtLocation());
    }
    private boolean barred(VirtualTableScenario scn, PhysicalCardImpl c) { return scn.game().getModifiersQuerying().mayNotMove(scn.gameState(),c); }
    private void playBarrier(VirtualTableScenario scn, boolean activeLight) { playBarrier(scn,activeLight,1); }
    private void playBarrier(VirtualTableScenario scn, boolean activeLight, int targetNumber) {
        var b=barrier(scn,activeLight);var target=trooper(scn,activeLight,targetNumber);
        assertTrue("Barrier should be available after deployment",available(scn,!activeLight,b,null));
        assertFalse(barred(scn,target));assertEquals(1,force(scn,!activeLight));
        if(activeLight)scn.DSPlayCard(b);else scn.LSPlayCard(b);
        System.out.println("BARRIER_SELECT "+scn.GetCurrentDecision().getText()+"; zone="+b.getZone());
        assertEquals(Zone.HAND,b.getZone());assertEquals(1,force(scn,!activeLight));assertFalse(barred(scn,target));
        scn.PassForceUseResponses();
        System.out.println("BARRIER_PENDING "+scn.GetCurrentDecision().getText()+"; zone="+b.getZone());
        assertEquals(0,force(scn,!activeLight));assertEquals(1,used(scn,!activeLight));assertEquals(Zone.VOID,b.getZone());assertFalse(barred(scn,target));
        scn.PassCardPlayResponses();
        scn.PassAllResponses();
        assertTrue(barred(scn,target));
        assertTrue(scn.game().getModifiersQuerying().isProhibitedFromParticipatingInBattle(scn.gameState(),target,player(activeLight)));
        assertTrue(scn.gameState().getUsedPile(player(!activeLight)).contains(b));assertEquals(2,used(scn,!activeLight));
        assertTrue(scn.game().getModifiersQuerying().hasPresenceAt(scn.gameState(),player(activeLight),target.getAtLocation(),false,null,null));
        System.out.println("BARRIER_RESOLVED "+player(activeLight)+" target barred, still presence; opponent Force=0 Used=2; target="+target.getZone()+" Barrier="+b.getZone());
    }
    @Test public void mirroredBarrierStopsSoleTrooperUntilTurnEnds() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light,true);var target=trooper(scn,light,1);var bay=scn.GetLSStartingLocation();
            deployToResponse(scn,light,1,bay);assertEquals(4,force(scn,light));
            playBarrier(scn,light);
            scn.SkipToPhase(Phase.BATTLE);assertFalse(available(scn,light,bay,"Initiate battle"));
            scn.SkipToPhase(Phase.MOVE);assertFalse(available(scn,light,target,"Move"));
            var expectedReserve=new HashMap<String,ArrayList<Integer>>();
            for(String side:new String[]{LS,DS}) {
                var ids=new ArrayList<Integer>();
                for(var c:scn.gameState().getReserveDeck(side))ids.add(c.getCardId());
                for(var c:scn.gameState().getUsedPile(side))ids.add(c.getCardId());
                expectedReserve.put(side,ids);
            }
            scn.SkipToPhase(Phase.DRAW);
            for(int step=0;step<40&&scn.GetCurrentPlayer().equals(player(light));step++) {
                System.out.println("END_TURN "+scn.GetCurrentPhase()+" "+scn.GetDecidingPlayer()+" "+scn.GetCurrentDecision().getText());
                assertTrue("Barrier still applies through recirculation responses",barred(scn,target));
                scn.PlayerPass(scn.GetDecidingPlayer());
            }
            assertEquals(player(!light),scn.GetCurrentPlayer());assertEquals(Phase.ACTIVATE,scn.GetCurrentPhase());
            assertFalse(barred(scn,target));assertFalse(scn.game().getModifiersQuerying().isProhibitedFromParticipatingInBattle(scn.gameState(),target,player(light)));
            assertEquals(bay,target.getAtLocation());assertEquals(0,used(scn,false));assertEquals(0,used(scn,true));
            assertEquals(4,force(scn,light));assertEquals(0,force(scn,!light));
            assertTrue(scn.gameState().getReserveDeck(player(!light)).contains(barrier(scn,light)));
            for(String side:new String[]{LS,DS}) {
                var actual=new ArrayList<Integer>();
                for(var c:scn.gameState().getReserveDeck(side))actual.add(c.getCardId());
                assertEquals(expectedReserve.get(side),actual);
            }
            System.out.println("BARRIER_ORACLE_SOLE active="+player(light)+" deployForce=4; sole battle=false move=false; next turn barred=false target remains Bay; both Used=0; Force active=4 opponent=0; Barrier in Reserve.");
        }
    }
    private void declineBarrier(VirtualTableScenario scn, boolean activeLight, boolean expectedAvailable) {
        assertEquals(expectedAvailable,available(scn,!activeLight,barrier(scn,activeLight),null));
        scn.PassAllResponses();
        assertEquals(Zone.HAND,barrier(scn,activeLight).getZone());
        assertEquals(expectedAvailable?1:0,force(scn,!activeLight));
        assertFalse(available(scn,!activeLight,barrier(scn,activeLight),null));
    }
    private void moveToCorridor(VirtualTableScenario scn, boolean light, PhysicalCardImpl moving, int forceBefore) {
        var bay=scn.GetLSStartingLocation();var corridor=card(scn,false,"1_284",1);
        assertEquals(bay,moving.getAtLocation());assertTrue(available(scn,light,moving,"Move"));
        if(light)scn.LSMoveCard(moving,corridor);else scn.DSMoveCard(moving,corridor);
        System.out.println("MOVE_COST_PENDING "+scn.GetCurrentDecision().getText()+"; location="+moving.getAtLocation().getBlueprintId(true));
        assertEquals(forceBefore,force(scn,light));assertEquals(bay,moving.getAtLocation());
        assertFalse(available(scn,!light,barrier(scn,light),null));
        scn.PassForceUseResponses();
        System.out.println("MOVE_AFTER "+scn.GetCurrentDecision().getText()+"; location="+moving.getAtLocation().getBlueprintId(true));
        // Follow the real optional move response windows, all empty in this closed fixture.
        scn.PassAllResponses();
        giveActiveOpportunity(scn,light);
        assertEquals(corridor,moving.getAtLocation());assertEquals(forceBefore-1,force(scn,light));
        assertFalse("One regular move per turn",available(scn,light,moving,"Move"));
        assertFalse("Barrier cannot be played after moving",available(scn,!light,barrier(scn,light),null));
    }
    @Test public void mirroredDeclinePreservesBarrierAndAllowsOneRegularMove() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light,true);var target=trooper(scn,light,1);var bay=scn.GetLSStartingLocation();
            deployToResponse(scn,light,1,bay);declineBarrier(scn,light,true);
            assertFalse(barred(scn,target));assertEquals(4,force(scn,light));
            scn.SkipToPhase(Phase.BATTLE);assertTrue(available(scn,light,bay,"Initiate battle"));
            scn.SkipToPhase(Phase.MOVE);moveToCorridor(scn,light,target,4);
            assertEquals(2,used(scn,light));assertEquals(0,used(scn,!light));assertEquals(Zone.HAND,barrier(scn,light).getZone());
            System.out.println("BARRIER_ORACLE_DECLINE_MOVE active="+player(light)+" deployForce=4 moveForce=3; battle initially legal; moved Bay->Corridor; repeatMove=false; Barrier Hand and opponent Force=1 unchanged.");
        }
    }
    @Test public void mirroredBarrierExcludesOnlyItsTargetFromTwoTrooperBattle() throws Exception {
        for(boolean light:new boolean[]{false,true})for(int barredNumber:new int[]{1,2}) {
            var scn=fixture(light,true);var bay=scn.GetLSStartingLocation();
            deployToResponse(scn,light,1,bay);
            if(barredNumber==1)playBarrier(scn,light,1);else declineBarrier(scn,light,true);
            deployToResponse(scn,light,2,bay);
            if(barredNumber==2)playBarrier(scn,light,2);else scn.PassAllResponses();
            assertEquals(3,force(scn,light));assertTrue(barred(scn,trooper(scn,light,barredNumber)));
            assertFalse(barred(scn,trooper(scn,light,3-barredNumber)));
            scn.SkipToPhase(Phase.BATTLE);assertTrue(available(scn,light,bay,"Initiate battle"));
            if(light)scn.LSInitiateBattle(bay);else scn.DSInitiateBattle(bay);
            assertEquals(2,force(scn,light));
            var participants=scn.gameState().getBattleState().getCardsParticipating(player(light));
            assertEquals(1,participants.size());assertTrue(participants.contains(trooper(scn,light,3-barredNumber)));
            assertFalse(participants.contains(trooper(scn,light,barredNumber)));
            assertEquals(1,scn.gameState().getBattleState().getCardsParticipating(player(!light)).size());
            scn.SkipToPowerSegment();
            assertFalse(scn.DSDecisionAvailable("battle destiny?"));assertFalse(scn.LSDecisionAvailable("battle destiny?"));
            scn.SkipBattleDestinyDraws(false);
            assertEquals(1,scn.GetDSTotalPower());assertEquals(1,scn.GetLSTotalPower());
            assertEquals(0,scn.GetDSTotalDestiny());assertEquals(0,scn.GetLSTotalDestiny());
            scn.PassResponses("INITIAL_ATTRITION_CALCULATED");
            assertEquals(0,scn.GetUnpaidDSAttrition());assertEquals(0,scn.GetUnpaidLSAttrition());
            assertEquals(0,scn.GetUnpaidDSBattleDamage());assertEquals(0,scn.GetUnpaidLSBattleDamage());
            scn.SkipToPhase(Phase.MOVE);
            assertFalse(available(scn,light,trooper(scn,light,barredNumber),"Move"));
            moveToCorridor(scn,light,trooper(scn,light,3-barredNumber),2);
            assertEquals(bay,trooper(scn,light,barredNumber).getAtLocation());
            System.out.println("BARRIER_ORACLE_TWO_TROOPERS active="+player(light)+" target="+barredNumber+" deployedForce=3 battleForce=2 moveForce=1; participants 1vs1; power=1vs1 destiny=0vs0 attrition=0vs0 damage=0vs0; target stays Bay, other moves Corridor once.");
        }
    }
    @Test public void mirroredInsufficientForceOffersNoBarrier() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light,false);var bay=scn.GetLSStartingLocation();var target=trooper(scn,light,1);
            deployToResponse(scn,light,1,bay);declineBarrier(scn,light,false);
            assertFalse(barred(scn,target));scn.SkipToPhase(Phase.BATTLE);assertTrue(available(scn,light,bay,"Initiate battle"));
            scn.SkipToPhase(Phase.MOVE);moveToCorridor(scn,light,target,4);
            System.out.println("BARRIER_ORACLE_NO_FORCE active="+player(light)+" opponentForce=0; no Barrier; remains Hand; battle legal; move costs1 and allowed once.");
        }
    }
    @Test public void darkCanDeployToCorridorAndBeBarredThere() throws Exception {
        var scn=fixture(false,true);var corridor=card(scn,false,"1_284",1);var target=trooper(scn,false,1);
        deployToResponse(scn,false,1,corridor);playBarrier(scn,false);
        assertEquals(corridor,target.getAtLocation());assertEquals(4,force(scn,false));
        scn.SkipToPhase(Phase.MOVE);assertFalse(available(scn,false,target,"Move"));
        System.out.println("BARRIER_ORACLE_CORRIDOR Dark may deploy to Corridor for1Force; Rebel Barrier valid there; target remains Corridor and cannot move.");
    }

    @Test public void mirroredDeclineTwoTroopersDealOneDamageWithoutDestiny() throws Exception {
        for(boolean light:new boolean[]{false,true})for(boolean forfeit:new boolean[]{false,true}) {
            var scn=fixture(light,true);var bay=scn.GetLSStartingLocation();
            deployToResponse(scn,light,1,bay);declineBarrier(scn,light,true);
            deployToResponse(scn,light,2,bay);declineBarrier(scn,light,true);
            assertEquals(3,force(scn,light));
            scn.SkipToPhase(Phase.BATTLE);
            if(light)scn.LSInitiateBattle(bay);else scn.DSInitiateBattle(bay);
            assertEquals(2,force(scn,light));
            assertEquals(2,scn.gameState().getBattleState().getCardsParticipating(player(light)).size());
            assertEquals(1,scn.gameState().getBattleState().getCardsParticipating(player(!light)).size());
            scn.SkipToPowerSegment();
            assertFalse(scn.DSDecisionAvailable("battle destiny?"));assertFalse(scn.LSDecisionAvailable("battle destiny?"));
            scn.SkipBattleDestinyDraws(false);
            assertEquals(light?1:2,scn.GetDSTotalPower());assertEquals(light?2:1,scn.GetLSTotalPower());
            assertEquals(0,scn.GetDSTotalDestiny());assertEquals(0,scn.GetLSTotalDestiny());
            scn.PassResponses("INITIAL_ATTRITION_CALCULATED");
            assertEquals(0,scn.GetUnpaidDSAttrition());assertEquals(0,scn.GetUnpaidLSAttrition());
            assertEquals(light?1:0,scn.GetUnpaidDSBattleDamage());assertEquals(light?0:1,scn.GetUnpaidLSBattleDamage());
            // Advance past the active player's optional zero-loss forfeiture choice.
            scn.PassAllResponses();
            if(scn.GetDecidingPlayer().equals(player(light)))scn.PlayerPass(player(light));
            scn.PassAllResponses();
            var defender=trooper(scn,!light,1);
            if(forfeit) {
                if(light)scn.DSPayBattleDamageFromCardInPlay(defender);else scn.LSPayBattleDamageFromCardInPlay(defender);
            } else {
                if(light)scn.DSPayBattleDamageFromReserveDeck();else scn.LSPayBattleDamageFromReserveDeck();
            }
            assertFalse("Payment completed the battle",scn.IsActiveBattle());
            assertEquals(1,scn.gameState().getLostPile(player(!light)).size());
            if(forfeit)assertTrue(scn.gameState().getLostPile(player(!light)).contains(defender));else assertEquals(bay,defender.getAtLocation());
            assertEquals(Zone.HAND,barrier(scn,light).getZone());assertEquals(1,force(scn,!light));
            System.out.println("BARRIER_ORACLE_NO_BARRIER_BATTLE active="+player(light)+" payment="+(forfeit?"forfeit":"reserve")+" power active=2 opponent=1; destiny=0vs0 attrition=0vs0 damage opponent=1->0; opponent Lost=1; defender="+(forfeit?"Lost":"Bay")+"; Barrier Hand, opponentForce1; activeForce2.");
        }
    }

}
