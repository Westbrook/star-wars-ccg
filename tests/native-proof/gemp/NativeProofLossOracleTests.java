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
public class NativeProofLossOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/loss-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS)); }


    private PhysicalCardImpl physical(VirtualTableScenario s,String id){int index=Integer.parseInt(id.substring(1))-1;try{return id.startsWith("l")?s.GetLSCard("card-"+index):s.GetDSCard("card-"+index);}catch(IllegalArgumentException e){return id.startsWith("l")?s.GetLSStartingLocation():s.GetDSStartingLocation();}}
    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();s.SkipToPhase(scenario.equals("reduce-drain")?Phase.ACTIVATE:Phase.CONTROL);
      var json=com.google.gson.JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/loss-fixtures.json"))).getAsJsonObject().getAsJsonObject(scenario);
      var cards=json.getAsJsonObject("cards");
      for(var e:cards.entrySet()){var c=physical(s,e.getKey());assertEquals(e.getValue().getAsJsonObject().get("blueprint").getAsString(),c.getBlueprintId(true));s.MoveCardsToTopOfOwnReserveDeck(c);}
      for(var id:json.getAsJsonArray("locations"))s.MoveLocationToTable(physical(s,id.getAsString()));
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("location")&&!c.has("attachedTo"))s.MoveCardsToLocation(physical(s,c.get("location").getAsString()),physical(s,e.getKey()));}
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("attachedTo"))s.AttachCardsTo(physical(s,c.get("attachedTo").getAsString()),physical(s,e.getKey()));}
      for(String side:List.of("light","dark"))for(String zone:List.of("reserve","force","used","hand")){
        var ids=json.getAsJsonObject("players").getAsJsonObject(side).getAsJsonArray(zone);
        for(int i=ids.size()-1;i>=0;i--){var c=physical(s,ids.get(i).getAsString());switch(zone){case "reserve":s.MoveCardsToTopOfOwnReserveDeck(c);break;case "force":s.MoveCardsToTopOfOwnForcePile(c);break;case "used":s.MoveCardsToTopOfOwnUsedPile(c);break;case "hand":if(side.equals("light"))s.MoveCardsToLSHand(c);else s.MoveCardsToDSHand(c);}}
      }
      s.SkipToPhase(scenario.equals("reduce-drain")?Phase.CONTROL:Phase.BATTLE);return s;
    }
    private PhysicalCardImpl at(VirtualTableScenario s,String scenario){return scenario.equals("reduce-drain")?card(s,true,"1_132",1):s.GetLSStartingLocation();}
    private void begin(VirtualTableScenario s,String scenario){if(scenario.equals("reduce-drain"))s.DSForceDrainAt(at(s,scenario));else s.DSInitiateBattle(at(s,scenario));}
    private boolean reduction(VirtualTableScenario s){return available(s,true,card(s,true,"1_90",1),"Reduce Force loss")||available(s,true,card(s,true,"1_90",2),"Reduce Force loss");}
    private boolean rescue(VirtualTableScenario s){return available(s,true,card(s,true,"1_31",1),"Forfeit to restore");}
    private void untilReduction(VirtualTableScenario s){for(int i=0;i<100&&!reduction(s);i++){String t=s.GetCurrentDecision().getText();assertFalse("Passed loss selection: "+t,t.contains("Choose a card to lose"));s.PlayerPass(s.GetDecidingPlayer());}assertTrue("Reduction missing: "+s.GetCurrentDecision().getText(),reduction(s));}
    private void play(VirtualTableScenario s,int copy,int amount){s.LSPlayCard(card(s,true,"1_90",copy));assertTrue(s.GetCurrentDecision().getText().contains("Choose amount"));s.LSDecided(amount);s.PassForceUseResponses();s.PassCardPlayResponses();}
    private void totals(VirtualTableScenario s,boolean destiny){s.SkipToEndOfPowerSegment(destiny);s.PassResponses("INITIAL_ATTRITION_CALCULATED");}
    private void record(String name,VirtualTableScenario s,boolean battle){
      var r=new LinkedHashMap<String,Object>();r.put("name",name);r.put("force",force(s,true));r.put("used",s.gameState().getUsedPile(LS).stream().map(c->c.getBlueprintId(true)).toList());r.put("lost",s.gameState().getLostPile(LS).stream().map(c->c.getBlueprintId(true)).toList());
      battle=battle&&s.gameState().getBattleState()!=null;int damage=battle?(int)Math.max(0,s.GetUnpaidLSBattleDamage()):0,attrition=battle?(int)Math.max(0,s.GetUnpaidLSAttrition()):0;
      r.put("damage",damage);r.put("attrition",attrition);r.put("remaining",damage);r.put("talzLost",s.gameState().getLostPile(LS).contains(card(s,true,"1_31",1)));
      int hits=0;for(int i=1;i<=7;i++)if(trooper(s,true,i).isHit())hits++;if(card(s,true,"1_31",1).isHit())hits++;r.put("hits",hits);r.put("armedTrooperAlive",card(s,true,"1_152",1).getZone()==Zone.ATTACHED);RESULTS.add(r);
    }
    @Test public void drains() throws Exception {
      for(String path:List.of("drain-pass","drain-one","drain-two","drain-overpay","drain-after-loss","drain-two-copies")){
        var s=fixture("reduce-drain");begin(s,"reduce-drain");untilReduction(s);
        if(path.equals("drain-after-loss")){s.PassAllResponses();s.LSChooseCard((PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));untilReduction(s);}
        if(!path.equals("drain-pass")){play(s,1,path.equals("drain-two")?2:path.equals("drain-overpay")?3:1);if(path.equals("drain-two-copies")){untilReduction(s);play(s,2,1);}}
        s.PassAllResponses();while(s.IsActiveForceDrain()){s.LSChooseCard((PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));s.PassAllResponses();}s.PassAllResponses();assertFalse(s.IsActiveForceDrain());record(path,s,false);
      }
    }
    @Test public void battleDamage() throws Exception {
      for(String path:List.of("damage-pass","damage-one","damage-four","damage-after-forfeit")){
        var s=fixture("reduce-damage");begin(s,"reduce-damage");totals(s,true);
        // Dark pays its one attrition before Light receives the loss response.
        s.PassAllResponses();s.DSChooseCard(trooper(s,false,1));untilReduction(s);
        if(path.equals("damage-after-forfeit")){s.PassAllResponses();s.LSChooseCard(trooper(s,true,1));untilReduction(s);}
        if(!path.equals("damage-pass"))play(s,1,path.equals("damage-four")?4:1);
        s.PassAllResponses();record(path,s,true);
      }
    }
    private void fire(VirtualTableScenario s,boolean rifle,PhysicalCardImpl target){
      if(!s.GetDecidingPlayer().equals(DS))s.LSPass();var weapon=card(s,false,rifle?"1_312":"1_317",1);s.DSUseCardAction(weapon,"Fire");s.DSChooseCard(target);s.PassForceUseResponses();s.PassResponses("Fire ");s.PassResponses("COST_TO_DRAW_DESTINY_CARD");s.PassResponses("ABOUT_TO_DRAW_DESTINY_CARD");s.PassDestinyDrawResponses();s.PassResponses("ABOUT_TO_BE_HIT");s.PassResponses("HIT -");s.PassResponses("FIRED_WEAPON");s.PassAllResponses();assertTrue(target.isHit());
    }
    @Test public void hitReplacement() throws Exception {
      for(String path:List.of("rescue-healthy","rescue-hit","rescue-ordinary","rescue-zero")){
        var s=fixture("talz-rescue");begin(s,"talz-rescue");s.PassAllResponses();fire(s,false,trooper(s,true,1));if(path.equals("rescue-hit"))fire(s,true,card(s,true,"1_31",1));totals(s,!path.equals("rescue-zero"));
        // Pay Dark's attrition if destiny was drawn, retaining weapons on other cards.
        if(!path.equals("rescue-zero")){s.PassAllResponses();s.DSChooseCard(trooper(s,false,3));}
        for(int i=0;i<50&&!rescue(s);i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(rescue(s));
        if(path.equals("rescue-ordinary")){s.PassAllResponses();s.LSChooseCard(card(s,true,"1_31",1));}
        else{s.LSUseCardAction(card(s,true,"1_31",1),"Forfeit to restore");if(s.GetCurrentDecision().getText().contains("Choose 'hit' character"))s.LSChooseCard(trooper(s,true,1));}
        s.PassAllResponses();record(path,s,true);
      }
    }
}
