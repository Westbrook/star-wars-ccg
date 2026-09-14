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
public class NativeProofCharacterOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/character-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS)); }

    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();boolean light=!scenario.equals("tusken-band");if(light)s.SkipToLSTurn(Phase.CONTROL);else s.SkipToPhase(Phase.CONTROL);s.MoveCardsToTopOfOwnReserveDeck(s.GetDSStartingLocation());s.MoveCardsToTopOfOwnReserveDeck(s.GetLSStartingLocation());
      for(boolean side:new boolean[]{false,true})for(int i=59;i>=0;i--){try{s.MoveCardsToTopOfOwnReserveDeck(side?s.GetLSCard("card-"+i):s.GetDSCard("card-"+i));}catch(IllegalArgumentException e){if(!side&&i==49)s.MoveCardsToTopOfOwnReserveDeck(s.GetDSStartingLocation());}}
      s.MoveLocationToTable(bay(s));s.MoveLocationToTable(card(s,true,"1_132",1));
      if(scenario.equals("luke-arrives")){
        for(int i=1;i<=3;i++)s.MoveCardsToLSHand(card(s,true,"101_2",i));for(int i=1;i<=2;i++)s.MoveCardsToLSHand(trooper(s,true,i));for(int i=3;i<=7;i++)s.MoveCardsToTopOfOwnForcePile(trooper(s,true,i));
        for(int i=1;i<=4;i++)s.MoveCardsToLocation(bay(s),trooper(s,false,i));s.MoveCardsToTopOfOwnForcePile(trooper(s,false,5));s.MoveCardsToDSHand(card(s,false,"1_249",1));
      }else if(scenario.equals("luke-support")){
        s.MoveCardsToLocation(bay(s),card(s,true,"101_2",1),trooper(s,true,1),trooper(s,true,2),card(s,true,"1_26",1));s.MoveCardsToTopOfOwnForcePile(trooper(s,true,3));
        for(int i=1;i<=7;i++)s.MoveCardsToLocation(bay(s),trooper(s,false,i));for(int i=1;i<=2;i++)s.MoveCardsToLocation(bay(s),card(s,false,"1_170",i));
      }else{
        s.MoveCardsToLocation(bay(s),card(s,false,"1_196",1));for(int i=2;i<=5;i++)s.MoveCardsToDSHand(card(s,false,"1_196",i));for(int i=1;i<=7;i++)s.MoveCardsToTopOfOwnForcePile(trooper(s,false,i));for(int i=1;i<=2;i++)s.MoveCardsToTopOfOwnForcePile(card(s,false,"1_170",i));
        for(int i=1;i<=2;i++)s.MoveCardsToLocation(bay(s),card(s,true,"1_26",i),trooper(s,true,i));s.MoveCardsToTopOfOwnForcePile(trooper(s,true,3));s.MoveCardsToLSHand(card(s,true,"1_105",1));
      }
      s.MoveCardsToTopOfOwnReserveDeck(card(s,true,scenario.equals("luke-support")?"101_2":"1_12",scenario.equals("luke-support")?2:1));s.MoveCardsToTopOfOwnReserveDeck(card(s,false,"1_181",1));s.SkipToPhase(scenario.equals("luke-support")?Phase.BATTLE:Phase.DEPLOY);return s;
    }
    private PhysicalCardImpl bay(VirtualTableScenario s){return card(s,true,"1_129",1);}
    private PhysicalCardImpl luke(VirtualTableScenario s){return card(s,true,"101_2",1);}
    private PhysicalCardImpl farm(VirtualTableScenario s){return card(s,true,"1_132",1);}
    private int forfeit(VirtualTableScenario s,PhysicalCardImpl c){return (int)s.game().getModifiersQuerying().getForfeit(s.gameState(),c);}
    private int power(VirtualTableScenario s,PhysicalCardImpl c){return (int)s.game().getModifiersQuerying().getPower(s.gameState(),c);}
    private void deploy(VirtualTableScenario s,boolean light,PhysicalCardImpl c,PhysicalCardImpl at,boolean responses){giveActiveOpportunity(s,light);if(light)s.LSDeployCard(c);else s.DSDeployCard(c);choose(s,light,at);s.PassForceUseResponses();if(responses)s.PassAllResponses();}
    private void record(String name,Map<String,Object> values){var r=new LinkedHashMap<String,Object>();r.put("name",name);r.putAll(values);RESULTS.add(r);}
    private void battle(VirtualTableScenario s,boolean light){s.SkipToPhase(Phase.BATTLE);if(light)s.LSInitiateBattle(bay(s));else s.DSInitiateBattle(bay(s));s.PassAllResponses();assertTrue(s.GetCurrentDecision().getText().contains("weapons segment"));}
    private void totals(VirtualTableScenario s){s.SkipToEndOfPowerSegment(true);s.PassResponses("INITIAL_ATTRITION_CALCULATED");s.PassAllResponses();}
    @Test public void deploymentCostsAndZeroForceFreeTrooper() throws Exception {
      for(boolean atFarm:new boolean[]{false,true}){var s=fixture("luke-arrives");var at=atFarm?farm(s):bay(s);deploy(s,true,luke(s),at,true);int afterLuke=force(s,true);giveActiveOpportunity(s,true);assertFalse(available(s,true,card(s,true,"101_2",2),"Deploy"));
        deploy(s,true,trooper(s,true,1),atFarm?bay(s):farm(s),true);int beforeFree=force(s,true);deploy(s,true,trooper(s,true,2),at,true);assertEquals(beforeFree,force(s,true));
        record(atFarm?"farm-deploy":"bay-deploy",Map.of("lukeCost",5-afterLuke,"forceBeforeFree",beforeFree,"forceAfterFree",force(s,true),"lukeForfeit",forfeit(s,luke(s)),"sameForfeit",forfeit(s,trooper(s,true,2)),"adjacentForfeit",forfeit(s,trooper(s,true,1)),"duplicateAvailable",false));
      }
    }
    @Test public void barrierSuspendsLukeOnlyInHisBattle() throws Exception {
      var s=fixture("luke-arrives");deploy(s,true,luke(s),bay(s),false);if(s.GetDecidingPlayer().equals(LS))s.LSPass();s.DSPlayCard(card(s,false,"1_249",1));s.PassForceUseResponses();s.PassCardPlayResponses();s.PassAllResponses();deploy(s,true,trooper(s,true,1),bay(s),true);assertEquals(1,force(s,true));int before=forfeit(s,trooper(s,true,1));battle(s,true);int during=forfeit(s,trooper(s,true,1));totals(s);assertEquals(3,s.GetUnpaidLSAttrition());choose(s,true,trooper(s,true,1));s.PassAllResponses();s.LSPayBattleDamageFromReserveDeck(4);s.PassAllResponses();s.SkipToPhase(Phase.MOVE);
      record("barrier-luke",Map.of("beforeForfeit",before,"duringForfeit",during,"afterLukeForfeit",forfeit(s,luke(s)),"canMove",available(s,true,luke(s),"Move"),"lightLost",s.gameState().getLostPile(LS).size()));
    }
    @Test public void forfeitSourceLeavesBeforeFollowers() throws Exception {
      var s=fixture("luke-support");battle(s,true);totals(s);int damage=s.GetUnpaidLSBattleDamage(),attrition=s.GetUnpaidLSAttrition();assertEquals(7,damage);assertEquals(3,attrition);int boosted=forfeit(s,trooper(s,true,1)),self=forfeit(s,luke(s)),guard=forfeit(s,card(s,true,"1_26",1));choose(s,true,luke(s));s.PassAllResponses();
      record("luke-first",Map.of("damage",damage,"attrition",attrition,"trooperBefore",boosted,"lukeForfeit",self,"guardForfeit",guard,"trooperAfter",forfeit(s,trooper(s,true,1)),"damageAfter",s.GetUnpaidLSBattleDamage(),"attritionAfter",s.GetUnpaidLSAttrition()));
    }
    @Test public void forfeitFollowerPreservesSupport() throws Exception {
      var s=fixture("luke-support");battle(s,true);totals(s);choose(s,true,trooper(s,true,1));s.PassAllResponses();record("trooper-first",Map.of("damageAfter",s.GetUnpaidLSBattleDamage(),"attritionAfter",s.GetUnpaidLSAttrition(),"remainingForfeit",forfeit(s,trooper(s,true,2)),"lukeForfeit",forfeit(s,luke(s))));
    }
    @Test public void adjacentLukeSupportsBattleElsewhere() throws Exception {
      var s=fixture("luke-arrives");deploy(s,true,luke(s),farm(s),true);deploy(s,true,trooper(s,true,1),bay(s),true);deploy(s,true,trooper(s,true,2),farm(s),true);battle(s,true);record("adjacent-luke",Map.of("trooperForfeit",forfeit(s,trooper(s,true,1)),"force",force(s,true),"lukeParticipates",s.gameState().getBattleState().getCardsParticipating(LS).contains(luke(s))));
    }
    @Test public void raiderPowerThresholdsDoNotStack() throws Exception {
      for(int count=1;count<=5;count++){var s=fixture("tusken-band");for(int i=2;i<=count;i++)deploy(s,false,card(s,false,"1_196",i),bay(s),true);int individual=power(s,card(s,false,"1_196",1));battle(s,false);s.SkipToEndOfPowerSegment(false);record("raiders-"+count,Map.of("individualPower",individual,"totalPower",s.GetDSTotalPower(),"force",force(s,false)));}
    }
    @Test public void barrieredFourthRaiderDoesNotCount() throws Exception {
      var s=fixture("tusken-band");for(int i=2;i<=3;i++)deploy(s,false,card(s,false,"1_196",i),bay(s),true);deploy(s,false,card(s,false,"1_196",4),bay(s),false);if(s.GetDecidingPlayer().equals(DS))s.DSPass();s.LSPlayCard(card(s,true,"1_105",1));s.PassForceUseResponses();s.PassCardPlayResponses();s.PassAllResponses();int outside=power(s,card(s,false,"1_196",1));battle(s,false);s.SkipToEndOfPowerSegment(false);record("raider-barrier",Map.of("outsideIndividual",outside,"totalPower",s.GetDSTotalPower(),"participants",s.gameState().getBattleState().getCardsParticipating(DS).size()));
    }
}
