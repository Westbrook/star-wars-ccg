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

/** Real losing-battle triggers; does not call or replace the card implementation. */
public class NativeEngineChokeOracleTests {
    private static final List<Map<String,Object>> results=new ArrayList<>();
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/choke-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    private VirtualTableScenario fixture() {
        return new VirtualTableScenario(new HashMap<>(Map.of("a","1_28","b","1_28","c","1_28","d","1_28","e","1_28","f","1_28")),new HashMap<>(Map.of("vader","101_5","trooper","1_194")),10,10,
            StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
    }
    @Test public void chokeDestinyAndDamage() {
        for(int destiny:new int[]{0,4,5,-1})for(boolean alone:new boolean[]{false,true}) {
            var s=fixture();s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(5);
            var vader=s.GetDSCard("vader");var trooper=s.GetDSCard("trooper");var site=s.GetLSStartingLocation();
            s.MoveCardsToLocation(site,vader);if(!alone)s.MoveCardsToLocation(site,trooper);
            for(String key:List.of("a","b","c","d","e","f"))s.MoveCardsToLocation(site,s.GetLSCard(key));
            s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToPowerSegment();
            if(destiny<0)for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((com.gempukku.swccgo.game.PhysicalCardImpl)c);else s.PrepareDSDestiny(destiny);
            for(int i=0;i<100&&s.gameState().getBattleState()!=null&&!s.IsReachedDamageSegment();i++) {
                var text=s.GetCurrentDecision().getText().toLowerCase();
                if(s.DSDecisionAvailable("battle destiny?")){s.DSChooseNo();continue;}
                if(s.LSDecisionAvailable("battle destiny?")){s.LSChooseNo();continue;}
                if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(alone?vader:trooper)&&text.contains("lost")) {s.DSChooseCard(alone?vader:trooper);continue;}
                if(text.contains("optional")||text.contains("response")){s.PlayerPass(s.GetDecidingPlayer());continue;}
                throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
            }
            boolean ended=s.gameState().getBattleState()==null;boolean lost=s.GetDSLostPile().contains(alone?vader:trooper);assertEquals(destiny==5||destiny<0,lost);
            int owed=ended?0:s.GetUnpaidDSBattleDamage();assertEquals(alone&&(destiny==5||destiny<0),ended);assertEquals(ended?0:alone?2:1,owed);
            results.add(Map.of("name","choke-"+destiny+"-"+(alone?"alone":"trooper"),"lost",lost,"ended",ended,"damage",owed,"vaderLost",s.GetDSLostPile().contains(vader)));
        }
    }
}
