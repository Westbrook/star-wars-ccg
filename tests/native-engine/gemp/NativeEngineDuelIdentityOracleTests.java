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

public class NativeEngineDuelIdentityOracleTests {
    private static final List<Map<String,Object>> results=new ArrayList<>();
    @AfterClass public static void output() throws Exception {
        Files.writeString(Path.of("/opt/gemp-swccg/duel-identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
    }
    private VirtualTableScenario fixture(int dark,int light) {
        var ds=new HashMap<>(Map.of("vader","101_5","obsession","101_6","near","1_293"));
        var ls=new HashMap<>(Map.of("luke","101_2","run","101_3"));
        for(int i=0;i<3;i++){ds.put("lost"+i,"1_194");ls.put("lost"+i,"1_28");}
        for(int i=0;i<2;i++){ds.put("draw"+i,dark==0?"1_285":"1_194");ls.put("draw"+i,light==0?"1_124":light==1?"1_28":"1_30");}
        return new VirtualTableScenario(ls,ds,10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
    }
    @Test public void continuousDuels() {
        for(String boundary:new String[]{"begin","draw","result"}) for(String side:new String[]{"dark","light"}) for(boolean returns:new boolean[]{false,true}) {
            int[] c={1,1};
            int dark=c[0],light=c[1];boolean cancel=c.length==3&&c[2]==1;boolean partial=c.length==3&&c[2]==2;
            var s=fixture(dark,light);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);
            var vader=s.GetDSCard("vader");var luke=s.GetLSCard("luke");var obsession=s.GetDSCard("obsession");var run=s.GetLSCard("run");var bay=s.GetLSStartingLocation();var near=s.GetDSCard("near");
            s.MoveLocationToTable(near);s.MoveCardsToLocation(near,vader);s.MoveCardsToLocation(bay,luke);s.MoveCardsToDSHand(obsession);if(cancel)s.MoveCardsToLSHand(run);
            for(int i=0;i<3;i++){s.MoveCardsToTopOfDSLostPile(s.GetDSCard("lost"+i));s.MoveCardsToTopOfLSLostPile(s.GetLSCard("lost"+i));}
            s.SkipToPhase(Phase.MOVE);s.DSMoveCard(vader,bay);
            for(int i=0;i<50&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(obsession));i++)s.PlayerPass(s.GetDecidingPlayer());
            assertEquals(bay,vader.getAtLocation());assertTrue(s.DSCardPlayAvailable(obsession));
            for(var card:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)card);
            for(var card:new ArrayList<>(s.GetLSReserveDeck()))s.MoveCardsToLSHand((PhysicalCardImpl)card);
            if(dark>=0)for(int i=partial?0:1;i>=0;i--)s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("draw"+i));
            if(light>=0)for(int i=1;i>=0;i--)s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("draw"+i));
            int darkForce=s.GetDSForcePileCount(),lightForce=s.GetLSForcePileCount();s.DSPlayCard(obsession);
            Map<String,Object> obs=new LinkedHashMap<>();obs.put("name",cancel?"cancel":partial?"partial":"duel-"+dark+"-"+light);boolean canceled=false,changed=false;
            obs.put("name",boundary+"-"+side+"-"+(returns?"return":"leave"));
            for(int i=0;i<220&&(!s.GetDSLostPile().contains(obsession)||cancel&&!s.GetLSLostPile().contains(run));i++) {
                var d=s.gameState().getDuelState();
                if(!changed&&d!=null&&(boundary.equals("begin")&&!d.isReachedResults()||boundary.equals("draw")&&s.GetDSReserveDeck().size()<2&&!d.isReachedResults()||boundary.equals("result")&&d.isReachedResults())) {
                    var target=side.equals("dark")?vader:luke;
                    if(side.equals("dark"))s.MoveCardsToDSHand(target);else s.MoveCardsToLSHand(target);
                    if(returns)s.MoveCardsToLocation(bay,target);
                    changed=true;
                }
                if(d!=null&&d.isReachedResults()){obs.put("darkTotal",d.getFinalDuelTotal(VirtualTableScenario.DS));obs.put("lightTotal",d.getFinalDuelTotal(VirtualTableScenario.LS));obs.put("winner",d.getWinner()==null?"none":d.getWinner().equals(VirtualTableScenario.DS)?"dark":"light");}
                var text=s.GetCurrentDecision().getText().toLowerCase();String who=s.GetDecidingPlayer();
                if(cancel&&!canceled&&who.equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(run)){s.LSPlayCard(run);canceled=true;continue;}
                if(text.contains("choose light side character")){s.DSChooseCard(luke);continue;}
                if(text.contains("choose dark side character")){s.DSChooseCard(vader);continue;}
                if(!text.contains("optional")&&!text.contains("response")&&text.contains("lose")&&text.contains("force")){if(who.equals(VirtualTableScenario.DS))s.DSPayForceLossFromForcePile();else s.LSPayForceLossFromForcePile();continue;}
                if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}
                throw new AssertionError(obs.get("name")+" "+who+" "+text+" "+s.GetCurrentDecision().getDecisionParameters());
            }
            assertTrue(s.GetDSLostPile().contains(obsession));assertTrue("intervention "+obs.get("name"),changed);
            obs.put("vaderLost",s.GetDSLostPile().contains(vader));obs.put("lukeLost",s.GetLSLostPile().contains(luke));obs.put("vaderZone",vader.getZone().toString());obs.put("lukeZone",luke.getZone().toString());obs.put("darkForceLost",darkForce-s.GetDSForcePileCount());obs.put("lightForceLost",lightForce-s.GetLSForcePileCount());
            int dr=0,lr=0;for(int i=0;i<3;i++){if(s.GetDSUsedPile().contains(s.GetDSCard("lost"+i)))dr++;if(s.GetLSUsedPile().contains(s.GetLSCard("lost"+i)))lr++;}obs.put("darkRetrieved",dr);obs.put("lightRetrieved",lr);results.add(obs);
        }
    }
}
