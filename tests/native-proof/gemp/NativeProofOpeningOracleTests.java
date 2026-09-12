package com.gempukku.swccgo.rules.battle;

import com.gempukku.swccgo.common.Phase;
import com.gempukku.swccgo.common.Zone;
import com.gempukku.swccgo.framework.StartingSetup;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.PhysicalCardImpl;
import org.junit.Test;
import org.junit.AfterClass;
import com.gempukku.swccgo.game.AbstractActionProxy;
import com.gempukku.swccgo.game.SwccgGame;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import java.util.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Arrays;
import static org.junit.Assert.*;

/** Closed Sites-native turn-boundary oracle. Observer returns no actions and changes no game rules. */
public class NativeProofOpeningOracleTests {
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
    private PhysicalCardImpl barrier(VirtualTableScenario scn, boolean activeLight) { return card(scn,!activeLight,activeLight?"1_249":"1_105",1); }
    private int force(VirtualTableScenario scn, boolean light) { return scn.gameState().getForcePile(player(light)).size(); }
    private int used(VirtualTableScenario scn, boolean light) { return scn.gameState().getUsedPile(player(light)).size(); }

    private boolean available(VirtualTableScenario scn, boolean light, PhysicalCardImpl c, String text) {
        var d=scn.GetAwaitingDecision(player(light));
        return d!=null && d.getDecisionParameters().get("cardId")!=null && scn.ActionAvailable(player(light),c,text);
    }
    private void choose(VirtualTableScenario scn, boolean light, PhysicalCardImpl c) { if(light)scn.LSChooseCard(c);else scn.DSChooseCard(c); }
    private void giveActiveOpportunity(VirtualTableScenario scn, boolean light) {
        if(!scn.GetDecidingPlayer().equals(player(light))) {
            assertTrue(scn.GetCurrentDecision().getText().contains("action or Pass"));
            assertFalse(scn.AnyActionsAvailable(player(!light)));
            scn.PlayerPass(player(!light));
        }
        assertEquals(player(light),scn.GetDecidingPlayer());
    }

    private void endTurn(VirtualTableScenario scn, boolean light) {
        scn.SkipToPhase(Phase.DRAW);
        for(int n=0;n<40&&scn.GetCurrentPlayer().equals(player(light));n++)scn.PlayerPass(scn.GetDecidingPlayer());
        assertEquals(player(!light),scn.GetCurrentPlayer());assertEquals(Phase.ACTIVATE,scn.GetCurrentPhase());
    }
    private void activate(VirtualTableScenario scn, boolean light, int expected) {
        int before=force(scn,light);int amount=light?scn.LSActivateMaxForceAndPass():scn.DSActivateMaxForceAndPass();assertEquals(expected,amount);assertEquals(before+expected,force(scn,light));assertEquals(Phase.CONTROL,scn.GetCurrentPhase());
    }

    private static final List<Map<String,Object>> RESULTS=new ArrayList<>();
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/opening-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS)); }
    private VirtualTableScenario fixture() throws Exception {
        var scn=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,
          StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),
          StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
        scn.StartGame();scn.SkipToLSTurn(Phase.DRAW);scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());
        // Arrange only the test checkpoint in the preceding Draw. The real incoming
        // turn calculates generation; all subsequent effects execute unmodified.
        for(boolean light:new boolean[]{false,true}) {
          for(int i=59;i>=0;i--) {try {scn.MoveCardsToTopOfOwnReserveDeck(light?scn.GetLSCard("card-"+i):scn.GetDSCard("card-"+i));}catch(IllegalArgumentException e){if(!light&&i==49)scn.MoveCardsToTopOfOwnReserveDeck(scn.GetDSStartingLocation());}}
          if(!light)scn.MoveLocationToTable(card(scn,false,"1_284",1));
          var hand=new ArrayList<PhysicalCardImpl>();for(int i=1;i<=4;i++)hand.add(trooper(scn,light,i));
          hand.add(card(scn,light,light?"1_12":"1_182",1));hand.add(card(scn,light,light?"1_12":"1_182",2));hand.add(card(scn,light,light?"1_105":"1_249",1));hand.add(blaster(scn,light));
          for(var c:hand) {if(light)scn.MoveCardsToLSHand(c);else scn.MoveCardsToDSHand(c);}
          scn.MoveCardsToTopOfOwnReserveDeck(card(scn,light,light?"1_153":"1_312",1));
          for(int i=7;i>=5;i--)scn.MoveCardsToTopOfOwnReserveDeck(trooper(scn,light,i));
          assertEquals(8,scn.gameState().getHand(player(light)).size());assertEquals(51,scn.gameState().getReserveDeck(player(light)).size());assertEquals(0,force(scn,light));
        }
        while(scn.GetCurrentPlayer().equals(LS))scn.PlayerPass(scn.GetDecidingPlayer());
        assertEquals(DS,scn.GetCurrentPlayer());assertEquals(Phase.ACTIVATE,scn.GetCurrentPhase());
        assertEquals(3,(int)scn.gameState().getPlayersTotalForceGeneration(DS));assertEquals(2,(int)scn.gameState().getPlayersTotalForceGeneration(LS));return scn;
    }
    private PhysicalCardImpl blaster(VirtualTableScenario scn,boolean light){return card(scn,light,light?"1_152":"1_317",1);}
    private void deployTrooper(VirtualTableScenario scn,boolean light) {
      scn.SkipToPhase(Phase.DEPLOY);giveActiveOpportunity(scn,light);var c=trooper(scn,light,1);if(light)scn.LSDeployCard(c);else scn.DSDeployCard(c);choose(scn,light,scn.GetLSStartingLocation());scn.PassForceUseResponses();scn.PassAllResponses();assertEquals(scn.GetLSStartingLocation(),c.getAtLocation());
    }
    private void equip(VirtualTableScenario scn,boolean light){giveActiveOpportunity(scn,light);var w=blaster(scn,light);if(light)scn.LSDeployCard(w);else scn.DSDeployCard(w);choose(scn,light,trooper(scn,light,1));scn.PassForceUseResponses();scn.PassAllResponses();assertEquals(trooper(scn,light,1),w.getAttachedTo());}
    private void record(String name,VirtualTableScenario scn){var result=new LinkedHashMap<String,Object>();result.put("name",name);result.put("active",scn.GetCurrentPlayer());result.put("phase",scn.GetCurrentPhase().name());for(boolean light:new boolean[]{false,true}){String prefix=light?"light":"dark";result.put(prefix+"Force",force(scn,light));result.put(prefix+"Reserve",scn.gameState().getReserveDeck(player(light)).size());result.put(prefix+"Hand",scn.gameState().getHand(player(light)).size());result.put(prefix+"Used",used(scn,light));result.put(prefix+"Lost",scn.gameState().getLostPile(player(light)).size());}RESULTS.add(result);}

    @Test public void passBothOpeningTurns() throws Exception {var scn=fixture();record("opening",scn);for(String side:new String[]{DS,LS})while(scn.GetCurrentPlayer().equals(side)){if(scn.GetCurrentDecision().getText().contains("You have not activated Force"))scn.PlayerChooseYes(scn.GetDecidingPlayer());else scn.PlayerPass(scn.GetDecidingPlayer());}record("pass-both",scn);}
    @Test public void armedTrooperMovesWithBlaster() throws Exception {
      var scn=fixture();activate(scn,false,3);deployTrooper(scn,false);equip(scn,false);assertEquals(1,force(scn,false));
      scn.SkipToPhase(Phase.MOVE);giveActiveOpportunity(scn,false);scn.DSMoveCard(trooper(scn,false,1),card(scn,false,"1_284",1));scn.PassForceUseResponses();scn.PassAllResponses();
      assertEquals(card(scn,false,"1_284",1),trooper(scn,false,1).getAtLocation());assertEquals(trooper(scn,false,1),blaster(scn,false).getAttachedTo());assertEquals(0,force(scn,false));
      endTurn(scn,false);activate(scn,true,2);deployTrooper(scn,true);equip(scn,true);endTurn(scn,true);record("armed-movement",scn);
    }
    @Test public void retainedForcePlaysImperialBarrier() throws Exception {
      var scn=fixture();activate(scn,false,3);endTurn(scn,false);activate(scn,true,2);scn.SkipToPhase(Phase.DEPLOY);giveActiveOpportunity(scn,true);
      var c=trooper(scn,true,1);scn.LSDeployCard(c);choose(scn,true,scn.GetLSStartingLocation());scn.PassForceUseResponses();if(scn.GetDecidingPlayer().equals(LS))scn.LSPass();
      var b=card(scn,false,"1_249",1);assertTrue(available(scn,false,b,null));scn.DSPlayCard(b);scn.PassForceUseResponses();scn.PassCardPlayResponses();scn.PassAllResponses();
      assertTrue(scn.game().getModifiersQuerying().mayNotMove(scn.gameState(),c));assertEquals(2,force(scn,false));endTurn(scn,true);assertFalse(scn.game().getModifiersQuerying().mayNotMove(scn.gameState(),c));record("opening-barrier",scn);
    }
    @Test public void defensiveBlasterFireCarriesIntoLightTurn() throws Exception {
      var scn=fixture();activate(scn,false,3);deployTrooper(scn,false);equip(scn,false);endTurn(scn,false);activate(scn,true,2);deployTrooper(scn,true);
      scn.SkipToPhase(Phase.BATTLE);scn.LSInitiateBattle(scn.GetLSStartingLocation());if(scn.GetDecidingPlayer().equals(LS))scn.LSPass();var w=blaster(scn,false);assertTrue(available(scn,false,w,"Fire"));scn.DSUseCardAction(w,"Fire");choose(scn,false,trooper(scn,true,1));scn.PassForceUseResponses();scn.PassResponses("Fire ");scn.PassResponses("COST_TO_DRAW_DESTINY_CARD");scn.PassResponses("ABOUT_TO_DRAW_DESTINY_CARD");scn.PassDestinyDrawResponses();scn.PassResponses("ABOUT_TO_BE_HIT");scn.PassResponses("HIT -");scn.PassResponses("FIRED_WEAPON");scn.PassAllResponses();
      assertTrue(trooper(scn,true,1).isHit());assertEquals(0,force(scn,false));scn.SkipToEndOfPowerSegment(false);assertEquals(1,scn.GetLSTotalPower());assertEquals(1,scn.GetDSTotalPower());scn.PassResponses("INITIAL_ATTRITION_CALCULATED");scn.PassAllResponses();assertEquals(LS,scn.GetDecidingPlayer());choose(scn,true,trooper(scn,true,1));scn.PassAllResponses();assertTrue(scn.gameState().getLostPile(LS).contains(trooper(scn,true,1)));endTurn(scn,true);record("defensive-hit",scn);
    }
}
