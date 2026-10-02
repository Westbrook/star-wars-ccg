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

public class NativeEngineTravelOracleTests {
    private static final List<Map<String,Object>> results=new ArrayList<>();
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/travel-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    private VirtualTableScenario fixture() {
        return new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","rebel","1_28","run","101_3","escape","1_98")),new HashMap<>(Map.of("storm","1_194","vader","101_5","near","1_293")),10,10,
            StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
    }
    private void progress(VirtualTableScenario s, PhysicalCardImpl... targets) {
        var decision=s.GetCurrentDecision();
        if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)) {
            for(var target:targets) if(s.LSHasCardChoiceAvailable(target)) {s.LSChooseCard(target);return;}
        }
        String text=decision.getText().toLowerCase();
        if(text.contains("optional") || text.contains("response")) {s.PlayerPass(s.GetDecidingPlayer());return;}
        throw new AssertionError(decision.getText()+" "+decision.getDecisionParameters());
    }
    @Test public void runLukeWithAndWithoutVader() {
        for(boolean vader:new boolean[]{false,true}) {
            var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveLocationToTable(s.GetDSCard("near"));
            var bay=s.GetLSStartingLocation();var near=s.GetDSCard("near");var luke=s.GetLSCard("luke");var run=s.GetLSCard("run");
            s.MoveCardsToLocation(bay,s.GetLSCard("rebel"),s.GetDSCard("storm"));s.MoveCardsToLocation(near,luke);
            if(vader)s.MoveCardsToLocation(near,s.GetDSCard("vader"));s.MoveCardsToLSHand(run);s.SkipToPhase(Phase.BATTLE);
            int base=s.GetPower(luke),before=s.GetLSForcePileCount();s.DSInitiateBattle(bay);s.LSPlayCard(run);
            for(int i=0;i<40&&!s.GetLSLostPile().contains(run);i++)progress(s,luke,bay);
            assertTrue(s.GetLSLostPile().contains(run));assertEquals(bay,luke.getAtLocation());assertEquals(base+(vader?0:2),s.GetPower(luke));assertEquals(before,s.GetLSForcePileCount());
            results.add(Map.of("name",vader?"run-vader":"run-clear","bonus",s.GetPower(luke)-base,"cost",before-s.GetLSForcePileCount(),"moved",luke.getAtLocation()==bay,"interruptLost",s.GetLSLostPile().contains(run)));
        }
    }
    @Test public void narrowEscapeLimitedForce() {
        for(int force:new int[]{0,1,2}) {
            var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveLocationToTable(s.GetDSCard("near"));
            var bay=s.GetLSStartingLocation();var near=s.GetDSCard("near");var luke=s.GetLSCard("luke");var rebel=s.GetLSCard("rebel");var escape=s.GetLSCard("escape");
            s.MoveCardsToLocation(bay,luke,rebel,s.GetDSCard("storm"));s.MoveCardsToLSHand(escape);s.SkipToPhase(Phase.BATTLE);
            while(s.GetLSForcePileCount()<force)s.LSActivateForceCheat(1);
            while(s.GetLSForcePileCount()>force)s.LSUseForceCheat(1);
            s.DSInitiateBattle(bay);s.LSPlayCard(escape);
            for(int i=0;i<70&&!s.GetLSUsedPile().contains(escape);i++)progress(s,rebel,luke,near);
            assertTrue(s.GetLSUsedPile().contains(escape));int moved=(luke.getAtLocation()==near?1:0)+(rebel.getAtLocation()==near?1:0);assertEquals(force,moved);assertEquals(0,s.GetLSForcePileCount());
            results.add(Map.of("name","escape-"+force,"moved",moved,"remainingForce",s.GetLSForcePileCount(),"interruptUsed",true));
        }
    }
}
