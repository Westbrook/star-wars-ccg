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
public class NativeProofWeaponOracleTests {
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
        Files.writeString(Path.of("/opt/gemp-swccg/weapon-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS));
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
        for(int i=1;i<=4;i++)scn.MoveCardsToLocation(scn.GetLSStartingLocation(),trooper(scn,true,i),trooper(scn,false,i));
        if(light)scn.MoveCardsToLSHand(weapon(scn,true,false),weapon(scn,true,true));else scn.MoveCardsToDSHand(weapon(scn,false,false),weapon(scn,false,true));
        scn.AttachCardsTo(trooper(scn,!light,1),weapon(scn,!light,false));
        scn.AttachCardsTo(trooper(scn,!light,2),weapon(scn,!light,true));
        for(boolean side:new boolean[]{false,true}) {
            scn.MoveCardsToTopOfOwnReserveDeck(zero(scn,side));
            scn.MoveCardsToTopOfOwnReserveDeck(jawa(scn,side));
            scn.MoveCardsToTopOfOwnReserveDeck(trooper(scn,side,5));
            for(int i=0;i<(side==light?8:4);i++) {
                var next=(PhysicalCardImpl)new ArrayList<>(scn.gameState().getReserveDeck(player(side))).get(3);
                scn.MoveCardsToTopOfOwnForcePile(next);
            }
            assertEquals(trooper(scn,side,5),new ArrayList<>(scn.gameState().getReserveDeck(player(side))).get(0));
            assertEquals(jawa(scn,side),new ArrayList<>(scn.gameState().getReserveDeck(player(side))).get(1));
            assertEquals(zero(scn,side),new ArrayList<>(scn.gameState().getReserveDeck(player(side))).get(2));
            assertEquals(side==light?8:4,force(scn,side));
            assertEquals(side==light?2:0,scn.gameState().getHand(player(side)).size());
            assertEquals(60,(side?1:0)+4+2+force(scn,side)+scn.gameState().getReserveDeck(player(side)).size());
        }
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
    @Test public void mirroredDeployAndBasicMiss() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,2);
            assertEquals(5,force(scn,light));begin(scn,light);assertEquals(4,force(scn,light));
            fire(scn,light,false,1,false);
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-basic-equality-miss","forceAfterDeploy",5,"forceAfterBattle",4,"forceAfterFire",force(scn,light),"usedAfterFire",used(scn,light),"hit",false)));
        }
    }

    private void transfer(VirtualTableScenario scn, boolean light, boolean rifle, int host) {
        opportunity(scn,light);var w=weapon(scn,light,rifle);int before=force(scn,light);
        assertTrue(available(scn,light,w,"Transfer"));action(scn,light,w,"Transfer");
        System.out.println("TRANSFER_TARGET "+scn.GetCurrentDecision().getText());
        choose(scn,light,trooper(scn,light,host));scn.PassForceUseResponses();scn.PassAllResponses();
        assertEquals(trooper(scn,light,host),w.getAttachedTo());assertEquals(before-(rifle?2:1),force(scn,light));
    }
    private void power(VirtualTableScenario scn, boolean light, boolean activeDraw, boolean opponentDraw) {
        scn.SkipToPowerSegment();
        assertEquals(1,scn.GetBattleDestinyCount(player(light)));assertEquals(1,scn.GetBattleDestinyCount(player(!light)));
        assertTrue(scn.DecisionAvailable(player(light),"battle destiny?"));
        if(activeDraw)scn.PlayerChooseYes(player(light));else scn.PlayerChooseNo(player(light));
        scn.PassDestinyDrawResponses();scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_PLAYER");
        assertTrue(scn.DecisionAvailable(player(!light),"battle destiny?"));
        if(opponentDraw)scn.PlayerChooseYes(player(!light));else scn.PlayerChooseNo(player(!light));
        scn.PassDestinyDrawResponses();scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_PLAYER");scn.PassResponses("BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS");
    }
    private List<String> lostBlueprints(VirtualTableScenario scn, boolean light) {
        var ids=new ArrayList<String>();for(var c:scn.gameState().getLostPile(player(light)))ids.add(c.getBlueprintId(true));return ids;
    }
    private void forfeit(VirtualTableScenario scn, boolean light, int host, boolean weaponFirst) {
        var c=trooper(scn,light,host);assertEquals(player(light),scn.GetDecidingPlayer());
        assertTrue(scn.GetCurrentDecision().getText().contains("forfeit"));
        choose(scn,light,c);scn.PassAllResponses();
        if(scn.GetCurrentDecision().getText().contains("Choose card to put on Lost Pile")) {
            System.out.println("LOST_ORDER_PENDING "+scn.GetCurrentDecision().getText()+" "+Arrays.toString(scn.GetCurrentDecision().getDecisionParameters().get("cardId")));
            assertEquals(Zone.VOID,c.getZone());
            var w=weapon(scn,light,host==2);assertEquals(Zone.VOID,w.getZone());
            assertEquals(player(light),scn.GetDecidingPlayer());
            choose(scn,light,weaponFirst?w:c);scn.PassAllResponses();
            assertTrue(scn.gameState().getLostPile(player(light)).contains(c));assertTrue(scn.gameState().getLostPile(player(light)).contains(w));
            var pile=scn.gameState().getLostPile(player(light));assertEquals(weaponFirst?c:w,pile.get(0));
            System.out.println("LOST_ORDER_RESULT "+lostBlueprints(scn,light));
        }
    }
    @Test public void mirroredHitReturnFireCountsAbilityPowerAndMandatoryLossesAtZero() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,2);begin(scn,light);
            fire(scn,light,true,1,true); // rifle: 1+1 > ability1
            assertTrue(trooper(scn,!light,1).isHit());
            fire(scn,!light,false,1,false); // hit bearer still fires; basic1 = defense1 misses
            fire(scn,light,false,2,true); // basic3 > 1
            fire(scn,!light,true,2,true); // rifle3+1 > 1
            opportunity(scn,light);assertFalse(available(scn,light,weapon(scn,light,false),"Fire"));assertFalse(available(scn,light,weapon(scn,light,true),"Fire"));
            assertEquals(1,force(scn,light));assertEquals(1,force(scn,!light));
            power(scn,light,true,true); // next Reserve card is 0 on each side
            assertEquals(4,scn.GetDSTotalPower());assertEquals(4,scn.GetLSTotalPower());assertEquals(0,scn.GetDSTotalDestiny());assertEquals(0,scn.GetLSTotalDestiny());
            scn.PassResponses("INITIAL_ATTRITION_CALCULATED");scn.PassAllResponses();
            assertEquals(0,scn.GetUnpaidDSBattleDamage());assertEquals(0,scn.GetUnpaidLSBattleDamage());assertEquals(0,scn.GetUnpaidDSAttrition());assertEquals(0,scn.GetUnpaidLSAttrition());
            System.out.println("ZERO_LOSSES_REQUIRED "+scn.GetCurrentDecision().getText()+" "+Arrays.toString(scn.GetCurrentDecision().getDecisionParameters().get("cardId")));
            assertEquals(player(light),scn.GetDecidingPlayer());
            assertTrue(Arrays.asList(scn.GetCurrentDecision().getDecisionParameters().get("cardId")).contains(String.valueOf(trooper(scn,light,2).getCardId())));
            assertFalse(Arrays.asList(scn.GetCurrentDecision().getDecisionParameters().get("cardId")).contains(String.valueOf(trooper(scn,light,1).getCardId())));
            forfeit(scn,light,2,true);forfeit(scn,!light,1,false);forfeit(scn,!light,2,true);
            assertEquals(2,lost(scn,light));assertEquals(4,lost(scn,!light));
            assertFalse(trooper(scn,light,2).isHit());assertFalse(trooper(scn,!light,1).isHit());
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-crossfire-zero-losses","activeForce",force(scn,light),"opponentForce",force(scn,!light),"powerBoth",4,"battleDestinyBoth",0,"mandatoryHitForfeits",3,"activeLost",lostBlueprints(scn,light),"opponentLost",lostBlueprints(scn,!light))));
        }
    }
    @Test public void mirroredTransferCostsRepeatAndTwoWeaponsOneWarriorUseLimit() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,1); // carrying two is legal
            transfer(scn,light,false,2);transfer(scn,light,false,1);assertEquals(3,force(scn,light));
            transfer(scn,light,true,2);assertEquals(1,force(scn,light));transfer(scn,light,false,2);assertEquals(0,force(scn,light));
            opportunity(scn,light);assertFalse(available(scn,light,weapon(scn,light,false),"Transfer"));assertFalse(available(scn,light,weapon(scn,light,true),"Transfer"));
            // Independent exact fixture verifies the per-warrior use limit with sufficient Force for both weapons.
            var same=fixture(light);deploy(same,light,false,1);deploy(same,light,true,1);begin(same,light);
            fire(same,light,false,1,false);assertEquals(3,force(same,light));opportunity(same,light);
            assertTrue(same.GetCurrentDecision().getText().contains("weapons segment"));
            assertFalse(available(same,light,weapon(same,light,true),"Fire"));assertFalse(available(same,light,weapon(same,light,false),"Fire"));
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-transfer-same-bearer","deployCost",3,"threeBasicTransfersCost",3,"rifleTransferCost",2,"forceAfterTransfers",force(scn,light),"sameBearerDifferentWeaponAvailable",false,"repeatFireAvailable",false,"forceWhenUseLimitChecked",force(same,light))));
        }
    }
    @Test public void mirroredRifleEqualityMiss() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,true,2);scn.MoveCardsToTopOfOwnReserveDeck(zero(scn,light));begin(scn,light);
            fire(scn,light,true,1,false);
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-rifle-equality-miss","weaponDestiny",0,"modifier",1,"defense",1,"hit",false,"forceAfterFire",force(scn,light))));
        }
    }

    @Test public void mirroredHitAndHealthyForfeitOrderAndAttachmentNoExtraCredit() throws Exception {
        for(boolean light:new boolean[]{false,true})for(boolean hitFirst:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,2);begin(scn,light);
            fire(scn,light,true,1,true);power(scn,light,true,true);
            assertEquals(light?7:5,scn.GetLSTotalPower());assertEquals(light?5:7,scn.GetDSTotalPower());
            scn.PassResponses("INITIAL_ATTRITION_CALCULATED");scn.PassAllResponses();
            assertEquals(1,light?scn.GetUnpaidLSAttrition():scn.GetUnpaidDSAttrition());
            assertEquals(3,light?scn.GetUnpaidDSAttrition():scn.GetUnpaidLSAttrition());
            assertEquals(2,light?scn.GetUnpaidDSBattleDamage():scn.GetUnpaidLSBattleDamage());
            forfeit(scn,light,3,false);
            var decision=scn.GetCurrentDecision();assertEquals(player(!light),scn.GetDecidingPlayer());
            var eligible=Arrays.asList(decision.getDecisionParameters().get("cardId"));
            assertTrue(eligible.contains(String.valueOf(trooper(scn,!light,1).getCardId())));assertTrue(eligible.contains(String.valueOf(trooper(scn,!light,3).getCardId())));
            forfeit(scn,!light,hitFirst?1:3,false);
            assertEquals(1,light?scn.GetUnpaidDSAttrition():scn.GetUnpaidLSAttrition());
            assertEquals(0,light?scn.GetUnpaidDSBattleDamage():scn.GetUnpaidLSBattleDamage());
            assertEquals(hitFirst?2:1,lost(scn,!light));
            assertEquals(!hitFirst,trooper(scn,!light,1).isHit());
            forfeit(scn,!light,hitFirst?3:1,false);
            assertEquals(3,lost(scn,!light));
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-"+(hitFirst?"hit-first":"healthy-first"),"activePower",7,"opponentPower",5,"opponentInitialAttrition",3,"opponentInitialDamage",2,"afterFirstForfeitAttrition",1,"afterFirstForfeitDamage",0,"afterFirstForfeitLost",hitFirst?2:1,"finalOpponentLost",lostBlueprints(scn,!light))));
        }
    }
    @Test public void mirroredRifleMayNotFireTwiceWhenAffordable() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,true,2);begin(scn,light);fire(scn,light,true,1,true);opportunity(scn,light);
            assertEquals(3,force(scn,light));assertTrue(scn.GetCurrentDecision().getText().contains("weapons segment"));
            assertFalse(available(scn,light,weapon(scn,light,true),"Fire"));
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-rifle-once","force",force(scn,light),"repeatAvailable",false)));
        }
    }

    @Test public void mirroredInsufficientForceAndAlreadyHitTarget() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,2);
            transfer(scn,light,false,3);transfer(scn,light,false,1);transfer(scn,light,false,3);assertEquals(2,force(scn,light));
            begin(scn,light);assertEquals(1,force(scn,light));
            assertTrue(available(scn,light,weapon(scn,light,false),"Fire"));assertFalse(available(scn,light,weapon(scn,light,true),"Fire"));
            fire(scn,light,false,1,false);assertEquals(0,force(scn,light));
            var repeat=fixture(light);deploy(repeat,light,false,1);deploy(repeat,light,true,2);begin(repeat,light);
            fire(repeat,light,true,1,true);opportunity(repeat,light);fire(repeat,light,false,1,true);
            assertTrue(trooper(repeat,!light,1).isHit());
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-affordability-and-hit-target","forceAtFireChoice",1,"basicAvailable",true,"rifleAvailable",false,"forceAfterBasic",force(scn,light),"alreadyHitTargetLegal",true,"secondHitChangedObligation",false)));
        }
    }
    @Test public void mirroredTwoAttachedWeaponsLostOrderingAndOnlyHostForfeitCredit() throws Exception {
        for(boolean light:new boolean[]{false,true}) {
            var scn=fixture(light);deploy(scn,light,false,1);deploy(scn,light,true,1);begin(scn,light);
            fire(scn,!light,true,1,true);power(scn,light,true,true);
            assertEquals(light?5:7,scn.GetLSTotalPower());assertEquals(light?7:5,scn.GetDSTotalPower());
            scn.PassResponses("INITIAL_ATTRITION_CALCULATED");scn.PassAllResponses();
            assertEquals(player(light),scn.GetDecidingPlayer());
            choose(scn,light,trooper(scn,light,1));scn.PassAllResponses();
            assertTrue(scn.GetCurrentDecision().getText().contains("Choose card to put on Lost Pile"));
            for(var c:new PhysicalCardImpl[]{trooper(scn,light,1),weapon(scn,light,false),weapon(scn,light,true)})assertEquals(Zone.VOID,c.getZone());
            choose(scn,light,weapon(scn,light,false));
            assertTrue(scn.GetCurrentDecision().getText().contains("Choose card to put on Lost Pile"));
            choose(scn,light,trooper(scn,light,1));scn.PassAllResponses();
            assertEquals(3,lost(scn,light));
            assertEquals(Arrays.asList(weapon(scn,light,true).getBlueprintId(true),trooper(scn,light,1).getBlueprintId(true),weapon(scn,light,false).getBlueprintId(true)),lostBlueprints(scn,light));
            assertEquals(1,light?scn.GetUnpaidLSAttrition():scn.GetUnpaidDSAttrition());assertEquals(0,light?scn.GetUnpaidLSBattleDamage():scn.GetUnpaidDSBattleDamage());
            RESULTS.add(new LinkedHashMap<>(Map.of("name",(light?"light":"dark")+"-two-attachments-loss-order","lostOrder",lostBlueprints(scn,light),"initialAttrition",3,"initialDamage",2,"afterHostForfeitAttrition",1,"afterHostForfeitDamage",0,"hostCredit",2,"physicalCardsLost",3)));
        }
    }
}
