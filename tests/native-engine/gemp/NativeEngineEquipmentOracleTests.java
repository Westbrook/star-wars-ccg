package com.gempukku.swccgo.rules.devices;

import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;

/** Component conformance boards, not full-deck or complete timing coverage. */
public class NativeEngineEquipmentOracleTests {
    private static final List<Map<String,Object>> results = new ArrayList<>();
    private VirtualTableScenario fixture() {
        return new VirtualTableScenario(new HashMap<>(Map.of("belt1","1_40","belt2","1_40","trooper","1_28","electro","1_35")),
            new HashMap<>(Map.of("belt1","1_207","belt2","1_207","trooper","1_194","mine","1_322","droid","1_186","zero","1_285")),10,10,
            StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
            StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
    }
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/equipment-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    @Test public void beltsFollowWorldAndDoNotStack() {
        var s=fixture(); s.StartGame(); s.SkipToPhase(Phase.CONTROL);
        var l=s.GetLSCard("trooper");var d=s.GetDSCard("trooper");
        s.MoveCardsToLocation(s.GetLSStartingLocation(),l,d);
        s.AttachCardsTo(l,s.GetLSCard("belt1"),s.GetLSCard("belt2"));
        s.AttachCardsTo(d,s.GetDSCard("belt1"),s.GetDSCard("belt2"));
        assertEquals(1,s.GetPower(l));assertEquals(2,s.GetForfeit(l));
        assertEquals(3,s.GetPower(d));assertEquals(4,s.GetForfeit(d));
        results.add(Map.of("branch","death-star-belts","lightPower",s.GetPower(l),"lightForfeit",s.GetForfeit(l),"darkPower",s.GetPower(d),"darkForfeit",s.GetForfeit(d)));
        s.MoveCardsToLocation(s.GetDSStartingLocation(),l,d);
        assertEquals(3,s.GetPower(l));assertEquals(4,s.GetForfeit(l));
        assertEquals(2,s.GetPower(d));assertEquals(3,s.GetForfeit(d));
        results.add(Map.of("branch","tatooine-belts","lightPower",s.GetPower(l),"lightForfeit",s.GetForfeit(l),"darkPower",s.GetPower(d),"darkForfeit",s.GetForfeit(d)));
    }
    @Test public void zeroMineIsLostWithoutVictims() {
        var s=fixture();s.StartGame();s.SkipToLSTurn(Phase.DRAW);
        var mine=s.GetDSCard("mine"); var victim=s.GetLSCard("trooper"); var zero=s.GetDSCard("zero");
        s.MoveCardsToLocation(s.GetLSStartingLocation(),mine,victim);
        s.MoveCardsToTopOfOwnReserveDeck(zero);
        s.SkipToDSTurn();s.PassAllResponses();
        assertTrue(s.GetDSLostPile().contains(mine));assertFalse(s.GetLSLostPile().contains(victim));
        results.add(Map.of("branch","zero-mine","mineLost",true,"victimLost",false));
    }
}
