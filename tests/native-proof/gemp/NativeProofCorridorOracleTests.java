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
public class NativeProofCorridorOracleTests {
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
        Files.writeString(Path.of("/opt/gemp-swccg/corridor-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS));
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
                    if(!side&&i==49)c=scn.GetDSStartingLocation();else if(side&&i==45)c=scn.GetLSStartingLocation();else continue;
                }
                scn.MoveCardsToTopOfOwnReserveDeck(c);
            }
        }
        scn.MoveLocationToTable(card(scn,false,"1_284",1));
        for(int i=1;i<=4;i++)scn.MoveCardsToLocation(card(scn,false,"1_284",1),trooper(scn,true,i),trooper(scn,false,i));
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
            assertEquals(60,(side?0:1)+4+2+force(scn,side)+scn.gameState().getReserveDeck(player(side)).size());
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
        if(light)scn.LSInitiateBattle(card(scn,false,"1_284",1));else scn.DSInitiateBattle(card(scn,false,"1_284",1));
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
    @Test public void corridorBonusAndLightReturnFire() throws Exception {
        for(boolean rifle:new boolean[]{false,true}) {
            var scn=fixture(false);deploy(scn,false,rifle,1);begin(scn,false);
            fire(scn,false,rifle,1,true);
            assertEquals(1,scn.game().getModifiersQuerying().getDestiny(scn.gameState(),trooper(scn,false,5)),0.01);
            fire(scn,true,false,1,false);
            RESULTS.add(new LinkedHashMap<>(Map.of("name",rifle?"corridor-rifle":"corridor-basic","darkForce",force(scn,false),"lightForce",force(scn,true),"darkUsed",used(scn,false),"lightUsed",used(scn,true),"darkHit",trooper(scn,false,1).isHit(),"lightHit",trooper(scn,true,1).isHit(),"printedDestiny",1)));
        }
    }
    @Test public void corridorRifleHitsWithZeroDestiny() throws Exception {
        var scn=fixture(false);deploy(scn,false,true,1);scn.MoveCardsToTopOfOwnReserveDeck(zero(scn,false));begin(scn,false);fire(scn,false,true,1,true);
        RESULTS.add(new LinkedHashMap<>(Map.of("name","corridor-rifle-zero","destiny",0,"modifier",2,"hit",true)));
    }
}
