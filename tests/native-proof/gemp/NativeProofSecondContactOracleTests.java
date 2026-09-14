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
public class NativeProofSecondContactOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/second-contact-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS)); }
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
          var hand=new ArrayList<PhysicalCardImpl>();for(int i=1;i<=(light?4:2);i++)hand.add(trooper(scn,light,i));
          if(!light){hand.add(card(scn,false,"1_170",1));hand.add(card(scn,false,"1_170",2));}hand.add(card(scn,light,light?"1_26":"1_181",1));
          hand.add(card(scn,light,light?"1_105":"1_249",1));hand.add(blaster(scn,light));hand.add(card(scn,light,light?"1_153":"1_312",1));
          for(var c:hand) {if(light)scn.MoveCardsToLSHand(c);else scn.MoveCardsToDSHand(c);}
          var front=new ArrayList<PhysicalCardImpl>();for(int i=light?5:3;i<=7;i++)front.add(trooper(scn,light,i));
          front.add(card(scn,light,light?"1_26":"1_181",2));
          front.add(card(scn,light,light?"1_152":"1_317",2));for(int i=1;i<=2;i++)front.add(card(scn,light,light?"1_12":"1_182",i));
          for(int i=1;i<=(light?3:5);i++)front.add(card(scn,light,light?"101_2":"1_196",i));
          Collections.reverse(front);for(var c:front)scn.MoveCardsToTopOfOwnReserveDeck(c);
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

    private void record(String name,VirtualTableScenario scn){
      var result=new LinkedHashMap<String,Object>();result.put("name",name);result.put("active",scn.GetCurrentPlayer());result.put("phase",scn.GetCurrentPhase().name());
      for(boolean light:new boolean[]{false,true})for(String zone:new String[]{"Force","Reserve","Hand","Used","Lost"}){
        var cards=switch(zone){case "Force"->scn.gameState().getForcePile(player(light));case "Reserve"->scn.gameState().getReserveDeck(player(light));case "Hand"->scn.gameState().getHand(player(light));case "Used"->scn.gameState().getUsedPile(player(light));default->scn.gameState().getLostPile(player(light));};
        String key=(light?"light":"dark")+zone;result.put(key,cards.size());var ids=new ArrayList<String>();for(var c:cards)ids.add(c.getBlueprintId(true));if(zone.equals("Hand"))Collections.sort(ids);result.put(key+"Cards",ids);
      }RESULTS.add(result);
    }
    private void finish(String path,int turn,VirtualTableScenario s){endTurn(s,turn%2==0);record(path+"-end-"+turn,s);}
    private PhysicalCardImpl corridor(VirtualTableScenario s){return card(s,false,"1_284",1);}
    private void deploy(VirtualTableScenario s,boolean light,PhysicalCardImpl c,PhysicalCardImpl at){
      s.SkipToPhase(Phase.DEPLOY);giveActiveOpportunity(s,light);if(light)s.LSDeployCard(c);else s.DSDeployCard(c);choose(s,light,at);s.PassForceUseResponses();s.PassAllResponses();assertEquals(at,c.getAtLocation());
    }
    private void arm(VirtualTableScenario s,boolean light,PhysicalCardImpl w,PhysicalCardImpl host){giveActiveOpportunity(s,light);if(light)s.LSDeployCard(w);else s.DSDeployCard(w);choose(s,light,host);s.PassForceUseResponses();s.PassAllResponses();assertEquals(host,w.getAttachedTo());}
    private void move(VirtualTableScenario s,boolean light,PhysicalCardImpl c){s.SkipToPhase(Phase.MOVE);giveActiveOpportunity(s,light);if(light)s.LSMoveCard(c,corridor(s));else s.DSMoveCard(c,corridor(s));s.PassForceUseResponses();s.PassAllResponses();}
    private void begin(VirtualTableScenario s,boolean light,PhysicalCardImpl at){s.SkipToPhase(Phase.BATTLE);if(light)s.LSInitiateBattle(at);else s.DSInitiateBattle(at);}
    private void power(VirtualTableScenario s){s.SkipToEndOfPowerSegment(false);s.PassResponses("INITIAL_ATTRITION_CALCULATED");s.PassAllResponses();}
    private void fire(VirtualTableScenario s,PhysicalCardImpl w,PhysicalCardImpl target,boolean hit){
      if(s.GetDecidingPlayer().equals(LS))s.LSPass();assertTrue(available(s,false,w,"Fire"));s.DSUseCardAction(w,"Fire");choose(s,false,target);s.PassForceUseResponses();s.PassResponses("Fire ");s.PassResponses("COST_TO_DRAW_DESTINY_CARD");s.PassResponses("ABOUT_TO_DRAW_DESTINY_CARD");s.PassDestinyDrawResponses();s.PassResponses("ABOUT_TO_BE_HIT");s.PassResponses("HIT -");s.PassResponses("FIRED_WEAPON");s.PassAllResponses();assertEquals(hit,target.isHit());
    }
    @Test public void passFourTurns() throws Exception {
      var s=fixture();record("pass-opening",s);for(int turn=1;turn<=4;turn++){
        var side=player(turn%2==0);while(s.GetCurrentPlayer().equals(side)){if(s.GetCurrentDecision().getText().contains("You have not activated Force"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}record("pass-end-"+turn,s);
      }
    }
    @Test public void sameWeaponFiresInThreeBattles() throws Exception {
      String path="reengage";var s=fixture();record(path+"-opening",s);activate(s,false,3);deploy(s,false,trooper(s,false,1),s.GetLSStartingLocation());arm(s,false,blaster(s,false),trooper(s,false,1));finish(path,1,s);
      for(int turn=2;turn<=4;turn++){
        boolean light=turn%2==0;activate(s,light,light?2:3);var target=trooper(s,true,turn==4?2:1);if(light)deploy(s,true,target,s.GetLSStartingLocation());begin(s,light,s.GetLSStartingLocation());fire(s,blaster(s,false),target,turn!=2);power(s);
        if(turn!=2){choose(s,true,target);s.PassAllResponses();}finish(path,turn,s);
      }
    }
    @Test public void guardsSwitchRolesAfterBarrier() throws Exception {
      String path="guards";var s=fixture();record(path+"-opening",s);var dg=card(s,false,"1_181",1);var lg=card(s,true,"1_26",1);activate(s,false,3);deploy(s,false,dg,s.GetLSStartingLocation());finish(path,1,s);
      activate(s,true,2);s.SkipToPhase(Phase.DEPLOY);giveActiveOpportunity(s,true);s.LSDeployCard(lg);choose(s,true,s.GetLSStartingLocation());s.PassForceUseResponses();if(s.GetDecidingPlayer().equals(LS))s.LSPass();s.DSPlayCard(card(s,false,"1_249",1));s.PassForceUseResponses();s.PassCardPlayResponses();s.PassAllResponses();finish(path,2,s);
      assertFalse(s.game().getModifiersQuerying().isProhibitedFromParticipatingInBattle(s.gameState(),lg,LS));
      activate(s,false,3);deploy(s,false,card(s,false,"1_170",1),s.GetLSStartingLocation());begin(s,false,s.GetLSStartingLocation());power(s);assertEquals(2,s.GetUnpaidDSBattleDamage());choose(s,false,dg);s.PassAllResponses();s.DSPayBattleDamageFromReserveDeck();s.PassAllResponses();finish(path,3,s);
      activate(s,true,2);begin(s,true,s.GetLSStartingLocation());power(s);assertEquals(2,s.GetUnpaidLSBattleDamage());choose(s,true,lg);s.PassAllResponses();s.LSPayBattleDamageFromReserveDeck();s.PassAllResponses();finish(path,4,s);
    }
    @Test public void rifleAtCorridorOnSecondTurn() throws Exception {
      String path="rifle";var s=fixture();record(path+"-opening",s);activate(s,false,3);deploy(s,false,trooper(s,false,1),corridor(s));var w=card(s,false,"1_312",1);arm(s,false,w,trooper(s,false,1));finish(path,1,s);
      activate(s,true,2);deploy(s,true,trooper(s,true,1),s.GetLSStartingLocation());move(s,true,trooper(s,true,1));finish(path,2,s);
      activate(s,false,3);begin(s,false,corridor(s));fire(s,w,trooper(s,true,1),true);power(s);choose(s,true,trooper(s,true,1));s.PassAllResponses();finish(path,3,s);
      activate(s,true,2);deploy(s,true,trooper(s,true,2),s.GetLSStartingLocation());move(s,true,trooper(s,true,2));finish(path,4,s);
    }
    @Test public void secondTurnDrainsUseEstablishedBoard() throws Exception {
      String path="drains";var s=fixture();record(path+"-opening",s);activate(s,false,3);deploy(s,false,card(s,false,"1_170",1),s.GetLSStartingLocation());finish(path,1,s);
      activate(s,true,2);deploy(s,true,trooper(s,true,1),s.GetLSStartingLocation());move(s,true,trooper(s,true,1));finish(path,2,s);
      activate(s,false,3);s.DSForceDrainAt(s.GetLSStartingLocation());s.PassAllResponses();s.LSPayForceLossFromReserveDeck();s.PassAllResponses();finish(path,3,s);
      activate(s,true,2);s.LSForceDrainAt(corridor(s));s.PassAllResponses();s.DSPayForceLossFromReserveDeck();s.PassAllResponses();s.DSPayForceLossFromReserveDeck();s.PassAllResponses();finish(path,4,s);
    }
    @Test public void earlyBattleLossesPrecedeNextActivation() throws Exception {
      String path="pressure";var s=fixture();record(path+"-opening",s);activate(s,false,3);deploy(s,false,card(s,false,"1_181",1),s.GetLSStartingLocation());deploy(s,false,trooper(s,false,1),s.GetLSStartingLocation());finish(path,1,s);
      activate(s,true,2);deploy(s,true,trooper(s,true,1),s.GetLSStartingLocation());begin(s,true,s.GetLSStartingLocation());power(s);assertEquals(4,s.GetUnpaidLSBattleDamage());s.LSPayBattleDamageFromReserveDeck(4);s.PassAllResponses();finish(path,2,s);
      activate(s,false,3);finish(path,3,s);activate(s,true,2);finish(path,4,s);
    }

    @Test public void combinedBattleLossesBeforeSecondActivation() throws Exception {
      String path="maximum-loss";var s=fixture();record(path+"-opening",s);activate(s,false,3);deploy(s,false,trooper(s,false,1),s.GetLSStartingLocation());deploy(s,false,card(s,false,"1_170",1),s.GetLSStartingLocation());finish(path,1,s);
      activate(s,true,2);deploy(s,true,trooper(s,true,1),s.GetLSStartingLocation());begin(s,true,s.GetLSStartingLocation());power(s);assertEquals(2,s.GetUnpaidLSBattleDamage());s.LSPayBattleDamageFromReserveDeck(2);s.PassAllResponses();finish(path,2,s);
      activate(s,false,3);deploy(s,false,card(s,false,"1_170",2),s.GetLSStartingLocation());begin(s,false,s.GetLSStartingLocation());power(s);assertEquals(4,s.GetUnpaidLSBattleDamage());s.LSPayBattleDamageFromReserveDeck(4);s.PassAllResponses();finish(path,3,s);activate(s,true,2);finish(path,4,s);
    }
}
