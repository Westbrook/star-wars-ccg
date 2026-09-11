package com.gempukku.swccgo.rules.battle;

import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.common.Zone;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import org.junit.Test;
import org.junit.AfterClass;
import com.gempukku.swccgo.game.AbstractActionProxy;
import com.gempukku.swccgo.game.SwccgGame;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import java.util.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Arrays;
import static org.junit.Assert.*;

/** Closed Sites-native turn-boundary oracle. Observer returns no actions and changes no game rules. */
public class NativeProofTurnOracleTests {
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








    private static final List<Map<String,Object>> RESULTS=new ArrayList<>();
    @AfterClass public static void writeResults() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/turn-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS));
    }
    private PhysicalCardImpl corridor(VirtualTableScenario scn) { return card(scn,false,"1_284",1); }
    private List<Integer> pileIds(VirtualTableScenario scn, String side, boolean used) {
        var ids=new ArrayList<Integer>();for(var c:used?scn.gameState().getUsedPile(side):scn.gameState().getReserveDeck(side))ids.add(c.getCardId());return ids;
    }
    private VirtualTableScenario nextFixture() throws Exception {
        var scn=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,
            StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
            StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
        scn.StartGame();scn.SkipToLSTurn(Phase.DRAW);
        scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());
        // Arrange during prior Draw, so incoming Dark generation is calculated by the actual start-turn process.
        for(boolean side:new boolean[]{false,true}) {
            for(int i=59;i>=0;i--) {
                PhysicalCardImpl c;
                try{c=side?scn.GetLSCard("card-"+i):scn.GetDSCard("card-"+i);}catch(IllegalArgumentException e){
                    if(!side&&i==49)c=scn.GetDSStartingLocation();else continue;
                }
                scn.MoveCardsToTopOfOwnReserveDeck(c);
            }
        }
        scn.MoveLocationToTable(corridor(scn));
        for(boolean side:new boolean[]{false,true}) {
            scn.MoveCardsToLocation(side?corridor(scn):scn.GetLSStartingLocation(),trooper(scn,side,1));
            if(side)scn.MoveCardsToLSHand(trooper(scn,true,2),card(scn,true,"1_105",1));
            else scn.MoveCardsToDSHand(trooper(scn,false,2),card(scn,false,"1_249",1));
            scn.MoveCardsToTopOfOwnForcePile(trooper(scn,side,3));
            scn.MoveCardsToTopOfOwnReserveDeck(card(scn,side,side?"1_12":"1_182",2));
            scn.MoveCardsToTopOfOwnReserveDeck(card(scn,side,side?"1_12":"1_182",1));
            for(int i=7;i>=4;i--)scn.MoveCardsToTopOfOwnReserveDeck(trooper(scn,side,i));
            assertEquals(55,scn.gameState().getReserveDeck(player(side)).size());assertEquals(1,force(scn,side));assertEquals(2,scn.gameState().getHand(player(side)).size());
        }
        while(scn.GetCurrentPlayer().equals(LS))scn.PlayerPass(scn.GetDecidingPlayer());
        assertEquals(Phase.ACTIVATE,scn.GetCurrentPhase());assertEquals(DS,scn.GetCurrentPlayer());
        assertEquals(3,(int)scn.gameState().getPlayersTotalForceGeneration(DS));assertEquals(2,(int)scn.gameState().getPlayersTotalForceGeneration(LS));
        return scn;
    }
    private final class BoundaryObserver extends AbstractActionProxy {
        final VirtualTableScenario scn;final PhysicalCardImpl target,moved;final boolean outgoing;
        final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());
        final List<Map<String,Object>> events=new ArrayList<>();final List<String> phases=new ArrayList<>();
        BoundaryObserver(VirtualTableScenario scn,PhysicalCardImpl target,PhysicalCardImpl moved,boolean outgoing) {this.scn=scn;this.target=target;this.moved=moved;this.outgoing=outgoing;scn.ApplyAdHocAction(this);}
        @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult result) {
            if(!seen.add(result))return null;
            if(result instanceof StartOfPhaseResult)phases.add(game.getGameState().getCurrentPlayerId()+":"+game.getGameState().getCurrentPhase().name());
            if(result instanceof RecirculateResult||result instanceof EndOfTurnResult||result instanceof StartOfTurnResult) {
                var e=new LinkedHashMap<String,Object>();e.put("event",result.getClass().getSimpleName());e.put("active",game.getGameState().getCurrentPlayerId());e.put("phase",game.getGameState().getCurrentPhase().name());
                e.put("lightUsed",used(scn,true));e.put("darkUsed",used(scn,false));e.put("lightForce",force(scn,true));e.put("darkForce",force(scn,false));
                e.put("barred",target!=null&&barred(scn,target));e.put("moved",moved!=null&&game.getModifiersQuerying().hasPerformedRegularMoveThisTurn(moved));
                e.put("outgoingBattles",game.getModifiersQuerying().getNumBattlesInitiatedThisTurn(player(outgoing)));
                e.put("bayBattled",game.getModifiersQuerying().isBattleOccurredAtLocationThisTurn(scn.GetLSStartingLocation()));
                e.put("corridorBattled",game.getModifiersQuerying().isBattleOccurredAtLocationThisTurn(corridor(scn)));
                events.add(e);System.out.println("TURN_EVENT "+e);
            }
            return null; // Read-only instrumentation: no game effect or trigger added.
        }
    }
    private void endTurn(VirtualTableScenario scn, boolean light) {
        scn.SkipToPhase(Phase.DRAW);
        for(int n=0;n<40&&scn.GetCurrentPlayer().equals(player(light));n++)scn.PlayerPass(scn.GetDecidingPlayer());
        assertEquals(player(!light),scn.GetCurrentPlayer());assertEquals(Phase.ACTIVATE,scn.GetCurrentPhase());
    }
    private void activate(VirtualTableScenario scn, boolean light, int expected) {
        int before=force(scn,light);int amount=light?scn.LSActivateMaxForceAndPass():scn.DSActivateMaxForceAndPass();assertEquals(expected,amount);assertEquals(before+expected,force(scn,light));assertEquals(Phase.CONTROL,scn.GetCurrentPhase());
    }
    private void deployNext(VirtualTableScenario scn, boolean light, PhysicalCardImpl site, boolean useBarrier) {
        giveActiveOpportunity(scn,light);var c=trooper(scn,light,2);int before=force(scn,light);
        if(light)scn.LSDeployCard(c);else scn.DSDeployCard(c);choose(scn,light,site);scn.PassForceUseResponses();
        if(scn.GetDecidingPlayer().equals(player(light)))scn.PlayerPass(player(light));
        assertTrue(available(scn,!light,barrier(scn,light),null));
        if(useBarrier)playBarrier(scn,light,2);else scn.PassAllResponses();
        assertEquals(before-1,force(scn,light));assertEquals(site,c.getAtLocation());
    }
    private void equalBattle(VirtualTableScenario scn, boolean light, PhysicalCardImpl site,int expectedParticipants) {
        scn.SkipToPhase(Phase.BATTLE);giveActiveOpportunity(scn,light);assertTrue(available(scn,light,site,"Initiate battle"));
        if(light)scn.LSInitiateBattle(site);else scn.DSInitiateBattle(site);
        for(String s:new String[]{LS,DS})assertEquals(expectedParticipants,scn.gameState().getBattleState().getCardsParticipating(s).size());
        scn.SkipToEndOfPowerSegment(false);assertEquals(expectedParticipants,scn.GetLSTotalPower());assertEquals(expectedParticipants,scn.GetDSTotalPower());
        scn.PassResponses("INITIAL_ATTRITION_CALCULATED");scn.PassAllResponses();giveActiveOpportunity(scn,light);
        assertFalse(available(scn,light,site,"Initiate battle"));assertTrue(scn.game().getModifiersQuerying().isBattleOccurredAtLocationThisTurn(site));
    }
    @Test public void exactTwoTurnsBothBarriersExpireBeforeOpposingStarts() throws Exception {
        var scn=nextFixture();var obs=new BoundaryObserver(scn,trooper(scn,false,2),trooper(scn,false,1),false);obs.phases.add(DS+":ACTIVATE");
        activate(scn,false,3);scn.SkipToPhase(Phase.DEPLOY);deployNext(scn,false,scn.GetLSStartingLocation(),true);
        scn.SkipToPhase(Phase.MOVE);giveActiveOpportunity(scn,false);moveToCorridor(scn,false,trooper(scn,false,1),3);
        assertTrue(barred(scn,trooper(scn,false,2)));assertEquals(2,force(scn,false));assertEquals(0,force(scn,true));
        var expected=new HashMap<String,List<Integer>>();for(String side:new String[]{LS,DS}){var ids=pileIds(scn,side,false);ids.addAll(pileIds(scn,side,true));expected.put(side,ids);}
        endTurn(scn,false);
        for(String side:new String[]{LS,DS})assertEquals(expected.get(side),pileIds(scn,side,false));
        assertEquals(4,obs.events.size());assertEquals(Arrays.asList("RecirculateResult","RecirculateResult","EndOfTurnResult","StartOfTurnResult"),obs.events.stream().map(x->(String)x.get("event")).toList());
        assertEquals(true,obs.events.get(0).get("barred"));assertEquals(true,obs.events.get(1).get("barred"));assertEquals(false,obs.events.get(2).get("barred"));assertEquals(false,obs.events.get(3).get("barred"));
        assertEquals(DS,obs.events.get(2).get("active"));assertEquals(LS,obs.events.get(3).get("active"));
        assertEquals(true,obs.events.get(2).get("moved"));assertEquals(false,obs.events.get(3).get("moved"));
        assertEquals(0,used(scn,true));assertEquals(0,used(scn,false));assertEquals(2,force(scn,false));
        activate(scn,true,2);scn.SkipToPhase(Phase.DEPLOY);
        // Dark still has2 Force: Imperial Barrier costs1 and leaves1.
        giveActiveOpportunity(scn,true);var target=trooper(scn,true,2);scn.LSDeployCard(target);scn.LSChooseCard(corridor(scn));scn.PassForceUseResponses();
        if(scn.GetDecidingPlayer().equals(LS))scn.LSPass();assertTrue(available(scn,false,barrier(scn,true),null));
        scn.DSPlayCard(barrier(scn,true));scn.PassForceUseResponses();scn.PassCardPlayResponses();scn.PassAllResponses();assertTrue(barred(scn,target));assertEquals(1,force(scn,false));
        equalBattle(scn,true,corridor(scn),1);assertEquals(0,force(scn,true));
        var lightObserver=new BoundaryObserver(scn,target,null,true);
        expected.clear();for(String side:new String[]{LS,DS}){var ids=pileIds(scn,side,false);ids.addAll(pileIds(scn,side,true));expected.put(side,ids);}
        endTurn(scn,true);for(String side:new String[]{LS,DS})assertEquals(expected.get(side),pileIds(scn,side,false));assertFalse(barred(scn,target));assertEquals(1,force(scn,false));assertEquals(0,force(scn,true));
        assertEquals(3,(int)scn.gameState().getPlayersTotalForceGeneration(DS));assertEquals(2,(int)scn.gameState().getPlayersTotalForceGeneration(LS));
        assertEquals(0,scn.game().getModifiersQuerying().getNumBattlesInitiatedThisTurn(LS));assertFalse(scn.game().getModifiersQuerying().isBattleOccurredAtLocationThisTurn(corridor(scn)));
        assertEquals(Arrays.asList(DS+":ACTIVATE",DS+":CONTROL",DS+":DEPLOY",DS+":BATTLE",DS+":MOVE",DS+":DRAW",LS+":ACTIVATE",LS+":CONTROL",LS+":DEPLOY",LS+":BATTLE",LS+":MOVE",LS+":DRAW",DS+":ACTIVATE"),obs.phases);
        RESULTS.add(new LinkedHashMap<>(Map.of("name","exact-two-turns-both-barriers","phases",obs.phases,"darkBoundary",obs.events.subList(0,4),"lightBoundary",lightObserver.events,"darkForceAtTurn3",force(scn,false),"lightForceAtTurn3",force(scn,true),"generationDark",3,"generationLight",2,"reserveAppendOrder",true)));
    }

    @Test public void exactSameSiteBattlesOnOpposingTurnsResetLimitsAndRetainForce() throws Exception {
        var scn=nextFixture();activate(scn,false,3);scn.SkipToPhase(Phase.DEPLOY);deployNext(scn,false,corridor(scn),false);
        equalBattle(scn,false,corridor(scn),1);scn.SkipToPhase(Phase.MOVE);giveActiveOpportunity(scn,false);moveToCorridor(scn,false,trooper(scn,false,1),2);
        var obs=new BoundaryObserver(scn,null,trooper(scn,false,1),false);endTurn(scn,false);
        assertFalse(scn.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(trooper(scn,false,1)));
        assertFalse(scn.game().getModifiersQuerying().isBattleOccurredAtLocationThisTurn(corridor(scn)));
        assertEquals(1,force(scn,false));assertEquals(1,force(scn,true));
        activate(scn,true,2);assertEquals(3,force(scn,true));scn.SkipToPhase(Phase.DEPLOY);deployNext(scn,true,corridor(scn),false);
        equalBattle(scn,true,corridor(scn),2);assertEquals(1,force(scn,true));
        scn.SkipToPhase(Phase.MOVE);giveActiveOpportunity(scn,true);
        scn.LSMoveCard(trooper(scn,true,1),scn.GetLSStartingLocation());scn.PassForceUseResponses();scn.PassAllResponses();
        assertTrue(scn.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(trooper(scn,true,1)));assertEquals(0,force(scn,true));
        endTurn(scn,true);assertEquals(1,force(scn,false));assertFalse(scn.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(trooper(scn,true,1)));
        assertFalse(scn.game().getModifiersQuerying().isBattleOccurredAtLocationThisTurn(corridor(scn)));
        RESULTS.add(new LinkedHashMap<>(Map.of("name","same-corridor-battle-on-both-turns","firstBattleParticipantsEach",1,"secondBattleParticipantsEach",2,"repeatBattleSameTurn",false,"battleNextOpposingTurn",true,"movementCounterReset",true,"darkRetainedForceTurn3",force(scn,false),"lightRetainedForceTurn3",force(scn,true),"events",obs.events)));
        // Diagnostic continuation only: a retained1 Force does not replace generation; Dark adds3, reaching4.
        activate(scn,false,3);assertEquals(4,force(scn,false));scn.SkipToPhase(Phase.MOVE);giveActiveOpportunity(scn,false);
        assertTrue(available(scn,false,trooper(scn,false,1),"Move"));
        RESULTS.add(new LinkedHashMap<>(Map.of("name","diagnostic-next-own-turn-activation-and-move","retainedForce",1,"generation",3,"forceAfterActivation",4,"previouslyMovedTrooperCanMove",true)));
    }
    @Test public void exactDrainValuesAndNoDrainCostAcrossTwoTurns() throws Exception {
        var scn=nextFixture();activate(scn,false,3);
        assertEquals(1,(int)scn.game().getModifiersQuerying().getForceDrainAmount(scn.gameState(),scn.GetLSStartingLocation(),DS));
        scn.DSForceDrainAt(scn.GetLSStartingLocation());scn.PassAllResponses();assertEquals(1,scn.GetForceDrainRemaining());
        scn.LSPayForceLossFromReserveDeck();scn.PassAllResponses();giveActiveOpportunity(scn,false);
        assertFalse(scn.DSForceDrainAvailable(scn.GetLSStartingLocation()));assertEquals(1,scn.gameState().getLostPile(LS).size());assertEquals(4,force(scn,false));assertEquals(1,force(scn,true));
        endTurn(scn,false);activate(scn,true,2);
        assertEquals(2,(int)scn.game().getModifiersQuerying().getForceDrainAmount(scn.gameState(),corridor(scn),LS));
        assertEquals(0,(int)scn.game().getModifiersQuerying().getForceDrainAmount(scn.gameState(),corridor(scn),DS));
        scn.LSForceDrainAt(corridor(scn));scn.PassAllResponses();assertEquals(2,scn.GetForceDrainRemaining());
        scn.DSPayForceLossFromReserveDeck();scn.PassAllResponses();assertEquals(1,scn.GetForceDrainRemaining());
        scn.DSPayForceLossFromReserveDeck();scn.PassAllResponses();giveActiveOpportunity(scn,true);
        assertFalse(scn.LSForceDrainAvailable(corridor(scn)));assertEquals(2,scn.gameState().getLostPile(DS).size());assertEquals(4,force(scn,false));assertEquals(3,force(scn,true));
        RESULTS.add(new LinkedHashMap<>(Map.of("name","exact-force-drains","darkBayDrain",1,"lightCorridorDrain",2,"darkCorridorDrain",0,"drainCost",0,"lightLost",1,"darkLost",2,"darkForce",4,"lightForce",3,"repeatSameTurnDrain",false)));
        endTurn(scn,true);assertFalse(scn.game().getModifiersQuerying().isForceDrainAttemptedThisTurn(scn.GetLSStartingLocation()));assertFalse(scn.game().getModifiersQuerying().isForceDrainAttemptedThisTurn(corridor(scn)));
    }
    @Test public void controlledZeroDrainIsStillLegalOnce() throws Exception {
        var scn=nextFixture();
        // Boundary-specific location variant: swap only the two existing troopers, preserving all120cards and piles.
        scn.MoveCardsToLocation(corridor(scn),trooper(scn,false,1));scn.MoveCardsToLocation(scn.GetLSStartingLocation(),trooper(scn,true,1));
        activate(scn,false,3);assertEquals(0,(int)scn.game().getModifiersQuerying().getForceDrainAmount(scn.gameState(),corridor(scn),DS));
        boolean offered=scn.DSForceDrainAvailable(corridor(scn));System.out.println("ZERO_DRAIN_AVAILABLE "+offered);assertTrue(offered);
        scn.DSForceDrainAt(corridor(scn));scn.PassAllResponses();giveActiveOpportunity(scn,false);
        assertEquals(0,scn.gameState().getLostPile(LS).size());assertFalse(scn.DSForceDrainAvailable(corridor(scn)));assertEquals(4,force(scn,false));
        RESULTS.add(new LinkedHashMap<>(Map.of("name","controlled-zero-drain","amount",0,"offered",offered,"repeatOffered",false,"lightLost",0,"darkForce",4)));
    }
}
