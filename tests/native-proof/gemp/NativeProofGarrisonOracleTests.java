package com.gempukku.swccgo.rules.battle;
import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.common.Zone;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import com.google.gson.GsonBuilder;
import static org.junit.Assert.*;

/** Exact authored 120-card closed Sites-native character-weapon oracle. No production rules altered. */
public class NativeProofGarrisonOracleTests {
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

    private static final List<Map<String,Object>> RESULTS=new ArrayList<>();
    @AfterClass public static void writeResults() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/garrison-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS));
    }
    private int force(VirtualTableScenario scn, boolean light) { return scn.gameState().getForcePile(player(light)).size(); }
    private int used(VirtualTableScenario scn, boolean light) { return scn.gameState().getUsedPile(player(light)).size(); }
    private int lost(VirtualTableScenario scn, boolean light) { return scn.gameState().getLostPile(player(light)).size(); }
    private PhysicalCardImpl weapon(VirtualTableScenario scn, boolean light, boolean rifle) { return card(scn,light,light?(rifle?"1_153":"1_152"):(rifle?"1_312":"1_317"),1); }
    private PhysicalCardImpl jawa(VirtualTableScenario scn, boolean light) { return card(scn,light,light?"1_12":"1_182",1); }
    private PhysicalCardImpl zero(VirtualTableScenario scn, boolean light) { return light?card(scn,true,"1_129",1):scn.GetDSStartingLocation(); }
    private boolean available(VirtualTableScenario scn, boolean light, PhysicalCardImpl c, String text) {
        var d=scn.GetAwaitingDecision(player(light));
        return d!=null&&d.getDecisionParameters().get("cardId")!=null&&scn.ActionAvailable(player(light),c,text);
    }
    private void choose(VirtualTableScenario scn, boolean light, PhysicalCardImpl c) { if(light)scn.LSChooseCard(c);else scn.DSChooseCard(c); }
    private void action(VirtualTableScenario scn, boolean light, PhysicalCardImpl c, String text) { if(light)scn.LSUseCardAction(c,text);else scn.DSUseCardAction(c,text); }
    private void opportunity(VirtualTableScenario scn, boolean light) {
        if(!scn.GetDecidingPlayer().equals(player(light)))scn.PlayerPass(scn.GetDecidingPlayer());
        assertEquals(player(light),scn.GetDecidingPlayer());
    }
    private VirtualTableScenario fixture(boolean light) throws Exception {
        var scn=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,
            StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
            StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
        scn.StartGame();
        if(light)scn.SkipToLSTurn(Phase.CONTROL);else scn.SkipToPhase(Phase.CONTROL);
        scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());
        // Reset every non-table authored card in authored order, undoing setup shuffles without adding fillers.
        for(boolean side:new boolean[]{false,true}) {
            for(int i=59;i>=0;i--) {
                PhysicalCardImpl c;
                try{c=side?scn.GetLSCard("card-"+i):scn.GetDSCard("card-"+i);}catch(IllegalArgumentException e){
                    if(!side&&i==49)c=scn.GetDSStartingLocation();else continue;
                }
                scn.MoveCardsToTopOfOwnReserveDeck(c);
            }
        }
        scn.MoveLocationToTable(card(scn,false,"1_284",1));
        var ownGuard=card(scn,light,light?"1_26":"1_181",1);
        if(light)scn.MoveCardsToLSHand(ownGuard,trooper(scn,true,1));else scn.MoveCardsToDSHand(ownGuard,trooper(scn,false,1),card(scn,false,"1_170",1));
        for(int i=2;i<=7;i++)scn.MoveCardsToTopOfOwnForcePile(trooper(scn,light,i));
        scn.MoveCardsToLocation(scn.GetLSStartingLocation(),card(scn,!light,light?"1_181":"1_26",1));
        scn.MoveCardsToTopOfOwnForcePile(trooper(scn,!light,1));
        if(light)scn.MoveCardsToDSHand(card(scn,false,"1_249",1));else scn.MoveCardsToLSHand(card(scn,true,"1_105",1));
        scn.SkipToPhase(Phase.DEPLOY);
        assertEquals(player(light),scn.GetCurrentPlayer());
        return scn;
    }
    private void deploy(VirtualTableScenario scn, boolean light, boolean rifle, int host) {
        opportunity(scn,light);var w=weapon(scn,light,rifle);int before=force(scn,light);
        assertTrue(available(scn,light,w,"Deploy"));
        if(light)scn.LSDeployCard(w);else scn.DSDeployCard(w);
        System.out.println("DEPLOY_TARGET "+scn.GetCurrentDecision().getText()+" "+Arrays.toString(scn.GetCurrentDecision().getDecisionParameters().get("cardId")));
        choose(scn,light,trooper(scn,light,host));
        assertEquals(Zone.HAND,w.getZone());assertEquals(before,force(scn,light));
        scn.PassForceUseResponses();scn.PassAllResponses();
        assertEquals(trooper(scn,light,host),w.getAttachedTo());assertEquals(before-(rifle?2:1),force(scn,light));
    }
    private void begin(VirtualTableScenario scn, boolean light) {
        scn.SkipToPhase(Phase.BATTLE);
        if(light)scn.LSInitiateBattle(scn.GetLSStartingLocation());else scn.DSInitiateBattle(scn.GetLSStartingLocation());
        assertEquals(player(light),scn.GetDecidingPlayer());
        assertTrue(scn.GetCurrentDecision().getText().contains("weapons segment"));
    }
    private void fire(VirtualTableScenario scn, boolean light, boolean rifle, int target, boolean hit) {
        opportunity(scn,light);var w=weapon(scn,light,rifle);var victim=trooper(scn,!light,target);boolean alreadyHit=victim.isHit();int before=force(scn,light),usedBefore=used(scn,light);
        assertTrue("Fire action available: "+scn.GetCurrentDecision().getText(),available(scn,light,w,"Fire"));
        action(scn,light,w,"Fire");
        System.out.println("FIRE_TARGET "+scn.GetCurrentDecision().getText()+" "+Arrays.toString(scn.GetCurrentDecision().getDecisionParameters().get("cardId")));
        choose(scn,light,victim);
        System.out.println("FIRE_COST "+scn.GetCurrentDecision().getText()+" Force="+force(scn,light));
        scn.PassForceUseResponses();
        System.out.println("FIRE_PENDING "+scn.GetCurrentDecision().getText()+" Force="+force(scn,light));
        assertEquals(before-(rifle?2:1),force(scn,light));assertEquals(usedBefore+(rifle?2:1),used(scn,light));
        scn.PassResponses("Fire ");
        scn.PassResponses("COST_TO_DRAW_DESTINY_CARD");scn.PassResponses("ABOUT_TO_DRAW_DESTINY_CARD");
        assertTrue(scn.GetCurrentDecision().getText().contains("DESTINY_DRAWN"));
        assertEquals("Hit status does not change while weapon destiny is only revealed",alreadyHit,victim.isHit());
        System.out.println("WEAPON_DESTINY_REVEALED "+scn.GetCurrentDecision().getText());
        scn.PassDestinyDrawResponses();
        if(hit)assertTrue(scn.GetCurrentDecision().getText().contains("ABOUT_TO_BE_HIT"));
        assertEquals(alreadyHit,victim.isHit());
        scn.PassResponses("ABOUT_TO_BE_HIT");scn.PassResponses("HIT -");scn.PassResponses("FIRED_WEAPON");scn.PassAllResponses();
        assertEquals(hit||alreadyHit,victim.isHit());assertEquals(usedBefore+(rifle?3:2),used(scn,light));
        assertEquals(Zone.AT_LOCATION,victim.getZone());
        assertTrue(scn.gameState().getBattleState().getCardsParticipating(player(!light)).contains(victim));
        System.out.println("FIRE_RESULT side="+player(light)+" rifle="+rifle+" hit="+hit+" Force="+force(scn,light)+" Used="+used(scn,light));
    }
    private PhysicalCardImpl guard(VirtualTableScenario s,boolean light){return card(s,light,light?"1_26":"1_181",1);}
    private float powerOf(VirtualTableScenario s,PhysicalCardImpl c){return s.game().getModifiersQuerying().getPower(s.gameState(),c);}
    private boolean immobile(VirtualTableScenario s,PhysicalCardImpl c){return s.game().getModifiersQuerying().mayNotMove(s.gameState(),c);}
    private void deployCharacter(VirtualTableScenario s,boolean light,PhysicalCardImpl c){
        opportunity(s,light);assertTrue(available(s,light,c,"Deploy"));if(light)s.LSDeployCard(c);else s.DSDeployCard(c);choose(s,light,s.GetLSStartingLocation());s.PassForceUseResponses();s.PassAllResponses();
    }
    @Test public void guardsAttackAtZeroAndDefendAtFour() throws Exception {
        for(boolean light:new boolean[]{false,true}){
            var s=fixture(light);var own=guard(s,light);var enemy=guard(s,!light);
            assertEquals(0,powerOf(s,enemy),0.01);deployCharacter(s,light,own);assertEquals(4,force(s,light));assertEquals(0,powerOf(s,own),0.01);assertTrue(immobile(s,own));
            begin(s,light);assertEquals(0,powerOf(s,own),0.01);assertEquals(4,powerOf(s,enemy),0.01);
            s.SkipToEndOfPowerSegment(false);s.PassResponses("INITIAL_ATTRITION_CALCULATED");s.PassAllResponses();
            assertEquals(4,light?s.GetUnpaidLSBattleDamage():s.GetUnpaidDSBattleDamage());
            assertEquals(0,light?s.GetUnpaidLSAttrition():s.GetUnpaidDSAttrition());
            choose(s,light,own);s.PassAllResponses();assertEquals(3,light?s.GetUnpaidLSBattleDamage():s.GetUnpaidDSBattleDamage());
            RESULTS.add(new LinkedHashMap<>(Map.of("name",light?"rebel-post":"guard-post","forceAfterDeploy",4,"forceAfterBattle",force(s,light),"attackingPower",0,"defendingPower",4,"damage",4,"afterGuardForfeitDamage",3,"guardMayMove",false)));
        }
    }
    @Test public void guardsCannotMoveAfterBarrierExpires() throws Exception {
        for(boolean light:new boolean[]{false,true}){
            var s=fixture(light);var c=guard(s,light);opportunity(s,light);if(light)s.LSDeployCard(c);else s.DSDeployCard(c);choose(s,light,s.GetLSStartingLocation());s.PassForceUseResponses();
            if(s.GetDecidingPlayer().equals(player(light)))s.PlayerPass(player(light));var b=card(s,!light,light?"1_249":"1_105",1);assertTrue(available(s,!light,b,null));if(light)s.DSPlayCard(b);else s.LSPlayCard(b);s.PassForceUseResponses();s.PassCardPlayResponses();s.PassAllResponses();
            assertTrue(s.game().getModifiersQuerying().isProhibitedFromParticipatingInBattle(s.gameState(),c,player(light)));
            s.SkipToPhase(Phase.MOVE);assertFalse(available(s,light,c,"Move"));s.SkipToPhase(Phase.DRAW);
            for(int i=0;i<40&&s.GetCurrentPlayer().equals(player(light));i++)s.PlayerPass(s.GetDecidingPlayer());
            assertTrue(immobile(s,c));assertFalse(s.game().getModifiersQuerying().isProhibitedFromParticipatingInBattle(s.gameState(),c,player(light)));
            RESULTS.add(new LinkedHashMap<>(Map.of("name",light?"rebel-barrier-expired":"imperial-barrier-expired","barrierExpired",true,"guardMayMove",false,"force",force(s,light))));
        }
    }
    @Test public void deathStarTrooperDeploymentPowerAndMovement() throws Exception {
        var s=fixture(false);var c=card(s,false,"1_170",1);deployCharacter(s,false,c);assertEquals(4,force(s,false));assertEquals(2,powerOf(s,c),0.01);
        begin(s,false);s.SkipToEndOfPowerSegment(false);s.PassResponses("INITIAL_ATTRITION_CALCULATED");s.PassAllResponses();assertEquals(2,s.GetUnpaidDSBattleDamage());choose(s,false,c);s.PassAllResponses();assertTrue(s.gameState().getLostPile(DS).contains(c));
        var move=fixture(false);var moving=card(move,false,"1_170",1);deployCharacter(move,false,moving);move.SkipToPhase(Phase.MOVE);opportunity(move,false);assertTrue(available(move,false,moving,"Move"));
        move.DSUseCardAction(moving,"Move");move.DSChooseCard(card(move,false,"1_284",1));move.PassForceUseResponses();move.PassAllResponses();assertEquals(3,force(move,false));assertEquals(2,powerOf(move,moving),0.01);
        // An independent legal checkpoint after arrival elsewhere verifies the printed off-station modifier.
        move.MoveLocationToTable(move.GetDSStartingLocation());move.MoveCardsToLocation(move.GetDSStartingLocation(),moving);assertEquals(1,powerOf(move,moving),0.01);
        RESULTS.add(new LinkedHashMap<>(Map.of("name","death-star-trooper","deployCost",2,"powerOnDeathStar",2,"powerElsewhere",1,"forfeit",3,"damageAgainstGuard",2,"regularMoveCost",1)));
    }
}
