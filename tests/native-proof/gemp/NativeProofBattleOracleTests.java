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

/** Closed Sites proof oracle. Only this test is added to the pinned engine. */
public class NativeProofBattleOracleTests {
    private HashMap<String,String> deck(String side, String starting) throws Exception {
        String line=Files.readAllLines(Path.of("/opt/gemp-swccg/src/db-scripts/sample_decks.sql")).stream()
            .filter(s->s.contains("'Precon Premiere Intro 2PG ("+side+")'")).findFirst().orElseThrow();
        String[] ids=line.substring(line.lastIndexOf("','")+3, line.indexOf('|')).split(",");
        assertEquals(60,ids.length);
        HashMap<String,String> cards=new HashMap<>(); boolean skipped=false;
        for(int i=0;i<ids.length;i++) { if(!skipped&&ids[i].equals(starting)){skipped=true;continue;} cards.put("card-"+i,ids[i]); }
        assertTrue(skipped); return cards;
    }
    private VirtualTableScenario fixture() throws Exception {
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
    @Test public void bothDrawForfeitFirstMatchesNativeProof() throws Exception {
        var scn=fixture(); var d1=card(scn,false,"1_194",1);var d2=card(scn,false,"1_194",2);var l1=card(scn,true,"1_28",1);
        assertEquals(1,scn.GetDSForcePileCount());
        scn.DSInitiateBattle(scn.GetLSStartingLocation());
        assertEquals(0,scn.GetDSForcePileCount());assertEquals(1,scn.GetDSUsedPileCount());
        assertEquals(1,scn.GetLSBattleDestinyCount());assertEquals(1,scn.GetDSBattleDestinyCount());
        scn.SkipToEndOfPowerSegment(true);
        assertEquals(3,scn.GetLSTotalDestiny());assertEquals(1,scn.GetDSTotalDestiny());
        assertEquals(7,scn.GetLSTotalPower());assertEquals(5,scn.GetDSTotalPower());
        assertTrue(scn.gameState().getUsedPile(VirtualTableScenario.LS).contains(card(scn,true,"1_12",1)));
        assertTrue(scn.gameState().getUsedPile(VirtualTableScenario.DS).contains(card(scn,false,"1_194",6)));
        scn.PassResponses("INITIAL_ATTRITION_CALCULATED");
        assertTrue(scn.LSWonBattle());assertTrue(scn.AwaitingDSAttritionPayment());
        assertEquals(1,scn.GetUnpaidLSAttrition());assertEquals(3,scn.GetUnpaidDSAttrition());
        assertEquals(0,scn.GetUnpaidLSBattleDamage());assertEquals(2,scn.GetUnpaidDSBattleDamage());
        scn.DSPayAttritionFromCardInPlay(d1);
        assertEquals(1,scn.GetUnpaidDSAttrition());assertEquals(0,scn.GetUnpaidDSBattleDamage());assertTrue(scn.AwaitingLSAttritionPayment());
        scn.LSPayAttritionFromCardInPlay(l1);
        assertTrue(scn.AwaitingDSAttritionPayment());assertEquals(0,scn.GetUnpaidLSAttrition());
        scn.DSPayAttritionFromCardInPlay(d2);
        assertTrue(scn.gameState().getLostPile(VirtualTableScenario.DS).contains(d1));assertTrue(scn.gameState().getLostPile(VirtualTableScenario.DS).contains(d2));assertTrue(scn.gameState().getLostPile(VirtualTableScenario.LS).contains(l1));
        assertEquals(2,scn.GetDSLostPileCount());assertEquals(1,scn.GetLSLostPileCount());
        System.out.println("NATIVE_PROOF_ORACLE: Light power=7 Dark power=5; attrition Light=1 Dark=3; damage Dark=2; alternating forfeits Dark/Light/Dark; Lost Dark=2 Light=1; both destiny cards Used; initiation Force=1.");
    }
}
