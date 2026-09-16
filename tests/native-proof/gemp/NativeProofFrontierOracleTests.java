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
public class NativeProofFrontierOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/frontier-branches.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(RESULTS)); }


    private PhysicalCardImpl physical(VirtualTableScenario s,String id){int index=Integer.parseInt(id.substring(1))-1;try{return id.startsWith("l")?s.GetLSCard("card-"+index):s.GetDSCard("card-"+index);}catch(IllegalArgumentException e){return id.startsWith("l")?s.GetLSStartingLocation():s.GetDSStartingLocation();}}
    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();if(scenario.equals("desert-patrol"))s.SkipToLSTurn(Phase.DRAW);else if(scenario.equals("jawa-bargain"))s.SkipToLSTurn(Phase.CONTROL);else s.SkipToPhase(Phase.CONTROL);
      var json=com.google.gson.JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/frontier-fixtures.json"))).getAsJsonObject().getAsJsonObject(scenario);
      var cards=json.getAsJsonObject("cards");
      for(var e:cards.entrySet()){var c=physical(s,e.getKey());assertEquals(e.getValue().getAsJsonObject().get("blueprint").getAsString(),c.getBlueprintId(true));s.MoveCardsToTopOfOwnReserveDeck(c);}
      for(var id:json.getAsJsonArray("locations"))s.MoveLocationToTable(physical(s,id.getAsString()));
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("location")&&!c.has("attachedTo"))s.MoveCardsToLocation(physical(s,c.get("location").getAsString()),physical(s,e.getKey()));}
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("attachedTo"))s.AttachCardsTo(physical(s,c.get("attachedTo").getAsString()),physical(s,e.getKey()));}
      for(String side:List.of("light","dark"))for(String zone:List.of("reserve","force","used","hand","lost")){
        var ids=json.getAsJsonObject("players").getAsJsonObject(side).getAsJsonArray(zone);
        for(int i=ids.size()-1;i>=0;i--){var c=physical(s,ids.get(i).getAsString());switch(zone){case "lost":s.MoveCardsToTopOfOwnLostPile(c);break;case "reserve":s.MoveCardsToTopOfOwnReserveDeck(c);break;case "force":s.MoveCardsToTopOfOwnForcePile(c);break;case "used":s.MoveCardsToTopOfOwnUsedPile(c);break;case "hand":if(side.equals("light"))s.MoveCardsToLSHand(c);else s.MoveCardsToDSHand(c);}}
      }
      if(!scenario.equals("desert-patrol"))s.SkipToPhase(Phase.DEPLOY);else {while(s.GetCurrentPlayer().equals(LS))s.PlayerPass(s.GetDecidingPlayer());assertEquals(Phase.ACTIVATE,s.GetCurrentPhase());}return s;
    }


    private PhysicalCardImpl camp(VirtualTableScenario s){return card(s,true,"1_131",1);}
    private PhysicalCardImpl dune(VirtualTableScenario s){return card(s,true,"1_130",1);}
    private void deploy(VirtualTableScenario s,boolean light,PhysicalCardImpl c,PhysicalCardImpl at,boolean responses){giveActiveOpportunity(s,light);if(light)s.LSDeployCard(c);else s.DSDeployCard(c);choose(s,light,at);s.PassForceUseResponses();for(int i=0;i<40&&c.getAtLocation()!=at;i++)s.PlayerPass(s.GetDecidingPlayer());assertEquals(at,c.getAtLocation());if(responses)s.PassAllResponses();}
    private Map<String,Object> balances(VirtualTableScenario s){var r=new LinkedHashMap<String,Object>();r.put("lightForce",force(s,true));r.put("darkForce",force(s,false));r.put("lightUsed",used(s,true));r.put("darkUsed",used(s,false));return r;}
    private void record(String name,Map<String,Object> facts){var r=new LinkedHashMap<String,Object>();r.put("name",name);r.putAll(facts);RESULTS.add(r);}
    private void barrierResponse(VirtualTableScenario s,boolean light){
      var c=card(s,light,light?"1_105":"1_249",1);if(!s.GetDecidingPlayer().equals(player(light)))s.PlayerPass(s.GetDecidingPlayer());
      assertTrue(available(s,light,c,"Prevent"));if(light)s.LSPlayCard(c);else s.DSPlayCard(c);s.PassForceUseResponses();s.PassCardPlayResponses();s.PassAllResponses();
    }
    @Test public void bilateralCostsAndCampException() throws Exception {
      for(String path:List.of("light-camp","light-dune","camp-barrier","dark-camp","dark-dune")){
        System.out.println("FRONTIER "+path);boolean light=path.startsWith("light")||path.equals("camp-barrier");var s=fixture(light?"jawa-bargain":"dune-sea");
        deploy(s,light,card(s,light,light?"1_12":"1_182",1),path.endsWith("dune")?dune(s):camp(s),!path.equals("camp-barrier"));
        if(path.equals("camp-barrier"))barrierResponse(s,false);
        var facts=balances(s);
        if(light){giveActiveOpportunity(s,true);s.LSDeployCard(card(s,true,"1_12",2));facts.put("campAvailable",s.LSHasCardChoiceAvailable(camp(s)));facts.put("duneAvailable",s.LSHasCardChoiceAvailable(dune(s)));facts.put("barred",path.equals("camp-barrier")?1:0);}
        record(path,facts);
      }
    }
    @Test public void battleDestinyThresholds() throws Exception {
      for(String path:List.of("ability-4","ability-5","ability-6","ability-barrier")){
        System.out.println("FRONTIER "+path);var s=fixture("dune-sea");int count=path.equals("ability-4")?0:path.equals("ability-5")?1:2;
        for(int i=1;i<=count;i++){var c=path.equals("ability-barrier")&&i==2?trooper(s,false,5):card(s,false,"1_182",i);deploy(s,false,c,dune(s),!path.equals("ability-barrier")||i!=1);if(path.equals("ability-barrier")&&i==1)barrierResponse(s,true);}
        s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(dune(s));s.PassAllResponses();s.SkipToEndOfPowerSegment(true);
        var facts=balances(s);facts.put("darkParticipants",s.gameState().getBattleState().getCardsParticipating(DS).size());facts.put("darkPower",s.GetDSTotalPower());facts.put("lightPower",s.GetLSTotalPower());facts.put("darkDestiny",s.GetDSTotalDestiny()==0?null:s.GetDSTotalDestiny());facts.put("lightDestiny",s.GetLSTotalDestiny());assertEquals(path.equals("ability-6")?9:count==0?4:5,s.GetDSTotalPower());assertEquals(7,s.GetLSTotalPower());record(path,facts);
      }
    }

    @Test public void continuousPatrol() throws Exception {
      var s=fixture("desert-patrol");activate(s,false,3);giveActiveOpportunity(s,false);s.DSForceDrainAt(dune(s));s.PassAllResponses();s.LSChooseCard((PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));s.PassAllResponses();
      s.SkipToPhase(Phase.DEPLOY);var darkJawa=card(s,false,"1_182",1);deploy(s,false,darkJawa,dune(s),true);
      s.SkipToPhase(Phase.MOVE);giveActiveOpportunity(s,false);s.DSMoveCard(darkJawa,camp(s));s.PassForceUseResponses();s.PassAllResponses();assertEquals(camp(s),darkJawa.getAtLocation());
      endTurn(s,false);activate(s,true,3);s.SkipToPhase(Phase.DEPLOY);deploy(s,true,card(s,true,"1_12",1),camp(s),false);barrierResponse(s,false);
      var facts=balances(s);facts.put("turn",2);facts.put("generation",(int)s.gameState().getPlayersTotalForceGeneration(LS));facts.put("barred",1);facts.put("darkJawaAtCamp",darkJawa.getAtLocation()==camp(s));record("patrol",facts);
      endTurn(s,true);assertEquals(3,(int)s.gameState().getPlayersTotalForceGeneration(DS));assertEquals(0,used(s,true));assertEquals(0,used(s,false));
      var ids=new HashMap<Integer,String>();for(boolean light:new boolean[]{false,true})for(int i=1;i<=60;i++){String id=(light?"l":"d")+String.format("%03d",i);ids.put(physical(s,id).getCardId(),id);}
      var piles=new LinkedHashMap<String,Object>();for(boolean light:new boolean[]{false,true}){var own=new LinkedHashMap<String,Object>();for(String zone:List.of("reserve","force","used","lost","hand")){var cards=switch(zone){case "reserve"->s.gameState().getReserveDeck(player(light));case "force"->s.gameState().getForcePile(player(light));case "used"->s.gameState().getUsedPile(player(light));case "lost"->s.gameState().getLostPile(player(light));default->s.gameState().getHand(player(light));};var list=new ArrayList<String>();for(var c:cards)list.add(ids.get(c.getCardId()));own.put(zone,list);}piles.put(light?"light":"dark",own);}record("patrol-finish",piles);
    }
}
