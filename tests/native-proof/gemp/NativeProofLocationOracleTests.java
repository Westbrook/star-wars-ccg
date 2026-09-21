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

/** Closed ground-react oracle. Full authored decks and ordered piles are imported only for setup; every action uses unmodified GEMP rules. */
public class NativeProofLocationOracleTests {
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
        var starting=light?scn.GetLSStartingLocation():scn.GetDSStartingLocation();if(starting.getBlueprintId(true).equals(blueprint)&&nth==1)return starting;
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/location-branches.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(RESULTS)); }


    private PhysicalCardImpl physical(VirtualTableScenario s,String id){int index=Integer.parseInt(id.substring(1))-1;try{return id.startsWith("l")?s.GetLSCard("card-"+index):s.GetDSCard("card-"+index);}catch(IllegalArgumentException e){return id.startsWith("l")?s.GetLSStartingLocation():s.GetDSStartingLocation();}}
    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();s.SkipToPhase(Phase.CONTROL);
      var json=com.google.gson.JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/location-fixtures.json"))).getAsJsonObject().getAsJsonObject(scenario);
      var cards=json.getAsJsonObject("cards");
      for(var e:cards.entrySet()){var c=physical(s,e.getKey());assertEquals(e.getValue().getAsJsonObject().get("blueprint").getAsString(),c.getBlueprintId(true));s.MoveCardsToTopOfOwnReserveDeck(c);}
      for(var e:cards.entrySet())if(e.getValue().getAsJsonObject().has("coveredBy"))s.MoveCardsToTopOfOwnLostPile(physical(s,e.getKey()));
      for(var id:json.getAsJsonArray("locations"))s.MoveLocationToTable(physical(s,id.getAsString()));
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("location")&&!c.has("attachedTo"))s.MoveCardsToLocation(physical(s,c.get("location").getAsString()),physical(s,e.getKey()));}
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("attachedTo"))s.AttachCardsTo(physical(s,c.get("attachedTo").getAsString()),physical(s,e.getKey()));}
      for(String side:List.of("light","dark"))for(String zone:List.of("reserve","force","used","hand","lost")){
        var ids=json.getAsJsonObject("players").getAsJsonObject(side).getAsJsonArray(zone);
        for(int i=ids.size()-1;i>=0;i--){var c=physical(s,ids.get(i).getAsString());switch(zone){case "lost":s.MoveCardsToTopOfOwnLostPile(c);break;case "reserve":s.MoveCardsToTopOfOwnReserveDeck(c);break;case "force":s.MoveCardsToTopOfOwnForcePile(c);break;case "used":s.MoveCardsToTopOfOwnUsedPile(c);break;case "hand":if(side.equals("light"))s.MoveCardsToLSHand(c);else s.MoveCardsToDSHand(c);}}
      }
      s.SkipToPhase(Phase.DEPLOY);return s;
    }



    private void record(String name, Map<String,Object> facts){var r=new LinkedHashMap<String,Object>();r.put("name",name);r.putAll(facts);RESULTS.add(r);}
    private void deployLocation(VirtualTableScenario s, boolean light, PhysicalCardImpl c){giveActiveOpportunity(s,light);if(light)s.LSDeployLocation(c);else s.DSDeployLocation(c);s.PassAllResponses();assertEquals(Zone.LOCATIONS,c.getZone());}
    @Test public void conversionAndNextGeneration() throws Exception {
      var s=fixture("changing-front");PhysicalCardImpl old=card(s,true,"1_124",1),bay=card(s,false,"1_285",1),tat=card(s,false,"1_291",1);int force=force(s,false);
      var troops=List.of(trooper(s,false,1),trooper(s,true,1));deployLocation(s,false,bay);assertEquals(force,force(s,false));
      for(var c:troops)assertEquals(bay,c.getAtLocation());assertEquals(Zone.CONVERTED_LOCATIONS,old.getZone());
      deployLocation(s,false,tat);endTurn(s,false);int generation=(int)s.game().getModifiersQuerying().getTotalForceGeneration(s.gameState(),LS);assertEquals(3,generation);assertEquals(2,s.LSActivateMaxForceAndPass());
      record("convert",Map.of("cost",0,"charactersStay",true,"lightGeneration",generation));
    }
    @Test public void dockingTransitGroups() throws Exception {
      for(boolean light:List.of(false,true)){
       var s=fixture("docking-transit");if(light)s.SkipToLSTurn(Phase.MOVE);else s.SkipToPhase(Phase.MOVE);
       PhysicalCardImpl from=card(s,light,light?"1_129":"1_285",1),to=card(s,!light,light?"1_285":"1_129",1),one=trooper(s,light,1),two=trooper(s,light,2),guard=card(s,light,light?"1_26":"1_181",1);
       giveActiveOpportunity(s,light);int before=force(s,light);if(light)s.LSUseCardAction(from,"transit");else s.DSUseCardAction(from,"transit");choose(s,light,to);
       assertFalse(light?s.LSHasCardChoiceAvailable(guard):s.DSHasCardChoiceAvailable(guard));if(light)s.LSChooseCards(one,two);else s.DSChooseCards(one,two);
       s.PassAllResponses();assertEquals(to,one.getAtLocation());assertEquals(to,two.getAtLocation());assertEquals(from,guard.getAtLocation());assertEquals(light?1:0,before-force(s,light));
       giveActiveOpportunity(s,light);assertFalse(light?s.LSCardActionAvailable(to,"transit"):s.DSCardActionAvailable(to,"transit"));
       record(light?"paid-group":"free-group",Map.of("cost",before-force(s,light),"moved",2,"guardsStayed",true));
      }
    }
    private void search(VirtualTableScenario s, PhysicalCardImpl room, PhysicalCardImpl target){
      giveActiveOpportunity(s,false);s.DSUseCardAction(room,"Deploy a docking bay");s.PassAllResponses();s.DSChooseCard(target);if(s.DSDecisionAvailable("On which side"))s.DSChoose("Left");s.PassAllResponses();assertEquals(Zone.LOCATIONS,target.getZone());
    }
    @Test public void searchDeploymentAndRepeat() throws Exception {
      for(String blueprint:List.of("1_285","1_291")){
       var s=fixture("control-room");var room=card(s,false,"101_4",1);int before=s.GetDSReserveDeckCount();search(s,room,card(s,false,blueprint,1));assertEquals(before-1,s.GetDSReserveDeckCount());giveActiveOpportunity(s,false);assertTrue(s.DSCardActionAvailable(room,"Deploy a docking bay"));
       record(blueprint.equals("1_285")?"search-convert":"search-new",Map.of("removedFromReserve",1,"repeatAllowed",true));
      }
    }
    @Test public void failedSearchVerification() throws Exception {
      var s=fixture("control-room");var room=card(s,false,"101_4",1);search(s,room,card(s,false,"1_285",1));search(s,room,card(s,false,"1_291",1));giveActiveOpportunity(s,false);s.DSUseCardAction(room,"Deploy a docking bay");s.PassAllResponses();
      assertTrue(s.DSDecisionAvailable("Verify"));assertTrue(s.LSDecisionAvailable("Verify"));s.DSChooseCards();s.LSChooseCards();s.PassAllResponses();giveActiveOpportunity(s,false);assertFalse(s.DSCardActionAvailable(room,"Deploy a docking bay"));
      record("search-failed",Map.of("verifiedByBoth",true,"repeatAllowed",false));
    }
}
