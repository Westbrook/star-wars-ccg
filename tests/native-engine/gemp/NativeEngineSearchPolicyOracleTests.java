package com.gempukku.swccgo.rules.devices;

import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.CantSearchCardPileModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Isolates the shared failed-search modifier. The revival harness
 * separately executes a real Kintan action that installs it. */
public class NativeEngineSearchPolicyOracleTests {
    static final List<Map<String, Object>> results = new ArrayList<>();
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/search-policy-results.json"), new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    private void observe(VirtualTableScenario s, String name, PhysicalCard card, String player,
                         Zone pile, String owner, GameTextActionId function) {
        boolean allowed = !s.game().getModifiersQuerying().isSearchingCardPileProhibited(s.gameState(), card, player, pile, owner, function);
        results.add(Map.of("name", name, "allowed", allowed));
    }
    @Test public void failedSearchIdentityAndExpiry() {
        var s = new VirtualTableScenario(new HashMap<>(),
            new HashMap<>(Map.of("source", "1_254", "copy", "1_254", "other", "1_275")), 20, 20,
            StartingSetup.LSStartingLocation("1_129"), StartingSetup.DSStartingLocation("1_284"),
            StartingSetup.NoLSStartingInterrupts, StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields, StartingSetup.NoDSShields, VirtualTableScenario.Open);
        s.StartGame(); s.SkipToPhase(Phase.CONTROL);
        var source = s.GetDSCard("source"); var copy = s.GetDSCard("copy"); var other = s.GetDSCard("other");
        var fn = GameTextActionId.KINTAN_STRIDER__RETRIEVE_TOPMOST_CHARACTER;
        s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CantSearchCardPileModifier(
            Filters.sameTitle(source), VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn));
        observe(s, "same-source", source, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
        observe(s, "same-title-copy", copy, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
        observe(s, "different-title", other, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
        observe(s, "different-player", copy, VirtualTableScenario.LS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
        observe(s, "different-owner", copy, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.LS, fn);
        observe(s, "different-pile", copy, VirtualTableScenario.DS, Zone.RESERVE_DECK, VirtualTableScenario.DS, fn);
        observe(s, "different-function", copy, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS,
            GameTextActionId.DOCKING_CONTROL_ROOM_327__DOWNLOAD_DOCKING_BAY);
        s.MoveCardsToDSHand(source);
        observe(s, "source-moved", copy, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
        s.SkipToLSTurn(Phase.CONTROL);
        observe(s, "next-turn", copy, VirtualTableScenario.DS, Zone.LOST_PILE, VirtualTableScenario.DS, fn);
    }
    @Test public void actualFailedDockingBaySearch() {
        var s = new VirtualTableScenario(new HashMap<>(), new HashMap<>(Map.of("trooper", "1_194", "bay", "1_285")), 20, 20,
            StartingSetup.LSStartingLocation("1_129"), StartingSetup.DSStartingLocation("101_4"),
            StartingSetup.NoLSStartingInterrupts, StartingSetup.NoDSStartingInterrupts,
            StartingSetup.NoLSShields, StartingSetup.NoDSShields, VirtualTableScenario.Open);
        s.StartGame(); s.SkipToPhase(Phase.CONTROL);
        var room = s.GetDSStartingLocation(); var bay = s.GetDSCard("bay");
        s.MoveCardsToLocation(room, s.GetDSCard("trooper")); s.MoveCardsToDSHand(bay);
        s.SkipToPhase(Phase.DEPLOY); s.DSUseCardAction(room, "Deploy a docking bay");
        var viewers = new HashSet<String>();
        for (int i = 0; i < 100 && viewers.size() < 2; i++) {
            if (s.GetCurrentDecision().getText().toLowerCase().contains("verify")) viewers.add(s.GetDecidingPlayer());
            s.PlayerPass(s.GetDecidingPlayer());
        }
        assertEquals(2, viewers.size()); s.PassAllResponses();
        var fn = GameTextActionId.DOCKING_CONTROL_ROOM_327__DOWNLOAD_DOCKING_BAY;
        observe(s, "room-failed", room, VirtualTableScenario.DS, Zone.RESERVE_DECK, VirtualTableScenario.DS, fn);
        s.MoveCardsToTopOfDSReserveDeck(bay);
        observe(s, "room-refilled", room, VirtualTableScenario.DS, Zone.RESERVE_DECK, VirtualTableScenario.DS, fn);
        s.SkipToLSTurn(Phase.CONTROL);
        observe(s, "room-next-turn", room, VirtualTableScenario.DS, Zone.RESERVE_DECK, VirtualTableScenario.DS, fn);
    }
}
