package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.Phase;
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

/** Executes real Interrupt actions on isolated component boards. */
public class NativeEngineInterruptOracleTests {
    private static final List<Map<String,Object>> results=new ArrayList<>();
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/interrupt-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    private VirtualTableScenario fixture() {
        return new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","a","1_28","b","1_28","other","1_6","reinforce","1_106","dice","1_84","one","1_28","five","1_115")),new HashMap<>(Map.of("vader","101_5","a","1_194","b","1_194","other","1_186","reinforce","1_251")),10,10,
            StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
    }
    private void progress(VirtualTableScenario s, String owner, PhysicalCardImpl... choices) {
        String text=s.GetCurrentDecision().getText().toLowerCase();
        if(s.GetDecidingPlayer().equals(owner) && (text.contains("retrieve") || text.contains("choose character"))) {
            for(var c:choices) {
                if(owner.equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)) {s.LSChooseCard(c);return;}
                if(owner.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)) {s.DSChooseCard(c);return;}
            }
        }
        if(text.contains("optional") || text.contains("response") || text.startsWith("verify lost pile")) {s.PlayerPass(s.GetDecidingPlayer());return;}
        throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());
    }
    @Test public void mirroredReinforcements() {
        for(boolean light:new boolean[]{true,false}) for(int destiny:new int[]{0,2,5}) {
            var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(3);String owner=light?VirtualTableScenario.LS:VirtualTableScenario.DS;
            var card=light?s.GetLSCard("reinforce"):s.GetDSCard("reinforce");
            var a=light?s.GetLSCard("a"):s.GetDSCard("a");var b=light?s.GetLSCard("b"):s.GetDSCard("b");var other=light?s.GetLSCard("other"):s.GetDSCard("other");
            s.MoveCardsToLocation(s.GetLSStartingLocation(),light?s.GetDSCard("vader"):s.GetLSCard("luke"));
            if(light){s.MoveCardsToTopOfLSLostPile(a);s.MoveCardsToTopOfLSLostPile(b);s.MoveCardsToTopOfLSLostPile(other);s.MoveCardsToLSHand(card);s.PrepareLSDestiny(destiny);s.DSPass();s.LSPlayCard(card);}
            else {s.MoveCardsToTopOfDSLostPile(a);s.MoveCardsToTopOfDSLostPile(b);s.MoveCardsToTopOfDSLostPile(other);s.MoveCardsToDSHand(card);s.DSActivateForceCheat(3);s.PrepareDSDestiny(destiny);s.SkipToPhase(Phase.DEPLOY);s.DSPlayCard(card);}
            for(int i=0;i<80&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(card);i++)progress(s,owner,b,a);
            var lost=light?s.GetLSLostPile():s.GetDSLostPile();var used=light?s.GetLSUsedPile():s.GetDSUsedPile();
            assertTrue(lost.contains(card));assertTrue(lost.contains(other));assertEquals(destiny==0?0:2,(used.contains(a)?1:0)+(used.contains(b)?1:0));
            if(destiny>0)assertTrue(used.indexOf(a)<used.indexOf(b));
            results.add(Map.of("name",(light?"light":"dark")+"-reinforce-"+destiny,"retrieved",(used.contains(a)?1:0)+(used.contains(b)?1:0),"unmatchedLost",lost.contains(other),"interruptLost",lost.contains(card),"selectedOrder",destiny==0?List.of():List.of("a","b")));
        }
    }
    @Test public void diceReplacementOrder() {
        var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(3);
        var luke=s.GetLSCard("luke");var dice=s.GetLSCard("dice");var one=s.GetLSCard("one");var five=s.GetLSCard("five");
        s.MoveCardsToLocation(s.GetLSStartingLocation(),luke,s.GetLSCard("a"),s.GetDSCard("vader"));s.MoveCardsToLSHand(dice);
        s.MoveCardsToTopOfLSReserveDeck(five);s.MoveCardsToTopOfLSReserveDeck(one);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());s.SkipToPowerSegment();
        for(int i=0;i<50&&!s.LSDecisionAvailable("battle destiny?");i++) {
            if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseNo();else s.PlayerPass(s.GetDecidingPlayer());
        }
        s.LSChooseYes();
        for(int i=0;i<30&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(dice));i++)s.PlayerPass(s.GetDecidingPlayer());
        s.LSPlayCard(dice);
        for(int i=0;i<60&&!s.GetLSUsedPile().contains(five);i++)progress(s,VirtualTableScenario.LS,luke);
        var used=s.GetLSUsedPile();assertTrue(used.contains(dice));assertTrue(used.contains(one));assertTrue(used.contains(five));assertTrue(used.indexOf(five)<used.indexOf(one));assertTrue(used.indexOf(one)<used.indexOf(dice));
        results.add(Map.of("name","dice-redraw","usedOrder",List.of("replacement","original","dice"),"replacementValue",5,"originalValue",1));
    }
}
