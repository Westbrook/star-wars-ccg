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
public class NativeProofIntegrationOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/integration-branches.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(RESULTS)); }


    private PhysicalCardImpl physical(VirtualTableScenario s,String id){int index=Integer.parseInt(id.substring(1))-1;try{return id.startsWith("l")?s.GetLSCard("card-"+index):s.GetDSCard("card-"+index);}catch(IllegalArgumentException e){return id.startsWith("l")?s.GetLSStartingLocation():s.GetDSStartingLocation();}}
    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();s.SkipToPhase(!scenario.equals("react-barrier")?Phase.ACTIVATE:Phase.CONTROL);
      var json=com.google.gson.JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/integration-fixtures.json"))).getAsJsonObject().getAsJsonObject(scenario);
      var cards=json.getAsJsonObject("cards");
      for(var e:cards.entrySet()){var c=physical(s,e.getKey());assertEquals(e.getValue().getAsJsonObject().get("blueprint").getAsString(),c.getBlueprintId(true));s.MoveCardsToTopOfOwnReserveDeck(c);}
      for(var id:json.getAsJsonArray("locations"))s.MoveLocationToTable(physical(s,id.getAsString()));
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("location")&&!c.has("attachedTo"))s.MoveCardsToLocation(physical(s,c.get("location").getAsString()),physical(s,e.getKey()));}
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("attachedTo"))s.AttachCardsTo(physical(s,c.get("attachedTo").getAsString()),physical(s,e.getKey()));}
      for(String side:List.of("light","dark"))for(String zone:List.of("reserve","force","used","hand","lost")){
        var ids=json.getAsJsonObject("players").getAsJsonObject(side).getAsJsonArray(zone);
        for(int i=ids.size()-1;i>=0;i--){var c=physical(s,ids.get(i).getAsString());switch(zone){case "lost":s.MoveCardsToTopOfOwnLostPile(c);break;case "reserve":s.MoveCardsToTopOfOwnReserveDeck(c);break;case "force":s.MoveCardsToTopOfOwnForcePile(c);break;case "used":s.MoveCardsToTopOfOwnUsedPile(c);break;case "hand":if(side.equals("light"))s.MoveCardsToLSHand(c);else s.MoveCardsToDSHand(c);}}
      }
      if(!scenario.equals("react-barrier")){for(int i=0;i<20&&s.GetCurrentPhase()!=Phase.CONTROL;i++){if(s.GetCurrentDecision().getText().contains("You have not activated Force"))s.DSChooseYes();else s.PlayerPass(s.GetDecidingPlayer());}assertEquals(Phase.CONTROL,s.GetCurrentPhase());}else s.SkipToPhase(Phase.BATTLE);return s;
    }

    private PhysicalCardImpl destination(VirtualTableScenario s,String path){return path.contains("adjacent")?card(s,false,"1_284",1):s.GetLSStartingLocation();}
    private void untilAction(VirtualTableScenario s,PhysicalCardImpl c,String text){
      for(int i=0;i<100&&!available(s,true,c,text);i++){assertTrue("Lost react window: "+s.GetCurrentDecision().getText(),(s.GetCurrentDecision().getText().contains("action")||s.GetCurrentDecision().getText().contains("Optional responses")));s.PlayerPass(s.GetDecidingPlayer());}
      assertTrue(available(s,true,c,text));
    }
    private void moveReact(VirtualTableScenario s,int nth,PhysicalCardImpl dest){
      var c=card(s,true,"1_30",nth);untilAction(s,c,"Move");int before=force(s,true);s.LSUseCardAction(c,"Move");
      if(s.GetCurrentDecision().getText().contains("Choose where"))s.LSChooseCard(dest);
      s.PassForceUseResponses();assertNotEquals(dest,c.getAtLocation());assertEquals(before-1,force(s,true));
      for(int i=0;i<50&&c.getAtLocation()!=dest;i++){s.PlayerPass(s.GetDecidingPlayer());}
      assertEquals(dest,c.getAtLocation());assertEquals(before-1,force(s,true));
    }
    private void deployReact(VirtualTableScenario s,String bp,int nth,PhysicalCardImpl dest){
      var cz=card(s,true,"1_6",1);untilAction(s,cz,"Deploy");var c=card(s,true,bp,nth);int before=force(s,true);
      s.LSUseCardAction(cz,"Deploy");assertFalse("Jawa cannot deploy on Death Star",s.LSHasCardChoiceAvailable(card(s,true,"1_12",1)));s.LSChooseCard(c);
      s.PassForceUseResponses();assertEquals(Zone.VOID,c.getZone());assertEquals(before-(bp.equals("1_30")?3:1),force(s,true));
      for(int i=0;i<50&&c.getAtLocation()!=dest;i++){String t=s.GetCurrentDecision().getText();if(t.contains("Choose where"))s.LSChooseCard(dest);else s.PlayerPass(s.GetDecidingPlayer());}
      assertEquals(dest,c.getAtLocation());assertEquals(before-(bp.equals("1_30")?3:1),force(s,true));
    }

    private void barrierResponse(VirtualTableScenario s,boolean play){
      var c=card(s,false,"1_249",1);for(int i=0;i<100&&!available(s,false,c,"Prevent");i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(available(s,false,c,"Prevent"));
      if(play){int before=force(s,false);s.DSPlayCard(c);s.PassForceUseResponses();s.PassCardPlayResponses();assertEquals(before-1,force(s,false));}else s.DSPass();
    }
    @Test public void continuousDrains() throws Exception {
      var results=new ArrayList<Map<String,Object>>();
      for(String path:List.of("bay-pass","bay-trooper","bay-wolfman","corridor-pass","corridor-trooper","corridor-wolfman")){
        System.out.println("CONTROL PATH "+path);var s=fixture("react-drain-deploy");var bay=s.GetLSStartingLocation();var corridor=card(s,false,"1_284",1);
        var order=path.startsWith("bay")?List.of(bay,corridor):List.of(corridor,bay);
        for(var dest:order){
          giveActiveOpportunity(s,false);assertEquals(Phase.CONTROL,s.GetCurrentPhase());assertTrue(s.DSForceDrainAvailable(dest));s.DSForceDrainAt(dest);
          if(dest==bay&&!path.endsWith("pass"))deployReact(s,path.endsWith("wolfman")?"1_30":"1_28",1,dest);
          if(dest==corridor){for(int i=0;i<30&&s.IsActiveForceDrain();i++){
            assertFalse(available(s,true,card(s,true,"1_6",1),"Deploy"));
            // Pinned GEMP offers a second react after a deploy-react. Record the
            // divergence; the native runner follows AR p170's per-card turn limit.
            if(available(s,true,card(s,true,"1_30",1),"Move")){
              assertEquals("bay-wolfman",path);System.out.println("DIVERGENCE: GEMP offers previously deployed Wolfman a second react");
            }
            s.PlayerPass(s.GetDecidingPlayer());
          }}
          s.PassAllResponses();while(s.IsActiveForceDrain()){s.LSChooseCard((PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));s.PassAllResponses();}
          giveActiveOpportunity(s,false);assertFalse("Cannot retry an attempted drain",s.DSForceDrainAvailable(dest));
        }
        assertFalse(s.DSForceDrainAvailable(bay));assertFalse(s.DSForceDrainAvailable(corridor));
        var r=new LinkedHashMap<String,Object>();r.put("path",path);
        for(boolean ls:List.of(true,false)){
          String side=ls?"light":"dark",player=player(ls);var piles=new LinkedHashMap<String,Object>();
          piles.put("reserve",s.gameState().getReserveDeck(player).stream().map(c->c.getBlueprintId(true)).toList());
          piles.put("force",s.gameState().getForcePile(player).stream().map(c->c.getBlueprintId(true)).toList());
          piles.put("used",s.gameState().getUsedPile(player).stream().map(c->c.getBlueprintId(true)).toList());
          piles.put("lost",s.gameState().getLostPile(player).stream().map(c->c.getBlueprintId(true)).toList());
          piles.put("hand",s.gameState().getHand(player).stream().map(c->c.getBlueprintId(true)).sorted().toList());r.put(side,piles);
        }
        s.DSPass();s.LSPass();assertEquals(Phase.DEPLOY,s.GetCurrentPhase());results.add(r);
      }
      Files.writeString(Path.of("/opt/gemp-swccg/signal-control-branches.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));
    }
    @Test public void interactions() throws Exception {
      for(String path:List.of("signal-bay-pass","signal-bay-trooper","signal-bay-wolfman","signal-corridor","barrier-no-react","barrier-pass","barrier-first","barrier-second","barrier-reinforce","barrier-wolfman","last-hand","last-reserve")){
       System.out.println("PATH "+path);boolean battle=path.startsWith("barrier"),last=path.startsWith("last");String scenario=battle?"react-barrier":last?"last-force":"react-drain-deploy";
       var s=fixture(scenario);var dest=path.equals("signal-corridor")?card(s,false,"1_284",1):s.GetLSStartingLocation();
       if(battle)s.DSInitiateBattle(dest);else s.DSForceDrainAt(dest);
       if(path.equals("signal-bay-trooper"))deployReact(s,"1_28",1,dest);
       if(path.equals("signal-bay-wolfman"))deployReact(s,"1_30",1,dest);
       if(path.equals("signal-corridor")){for(int i=0;i<30&&s.IsActiveForceDrain();i++){assertFalse("No Light icon or presence at Corridor",available(s,true,card(s,true,"1_6",1),"Deploy"));s.PlayerPass(s.GetDecidingPlayer());}}
       if(battle&&!path.equals("barrier-no-react")){
        deployReact(s,path.equals("barrier-wolfman")?"1_30":"1_28",path.equals("barrier-wolfman")?1:4,dest);
        barrierResponse(s,path.equals("barrier-first")||path.equals("barrier-reinforce")||path.equals("barrier-wolfman"));
        if(path.equals("barrier-second")||path.equals("barrier-reinforce")){deployReact(s,"1_28",5,dest);if(path.equals("barrier-second"))barrierResponse(s,true);}
       }
       s.PassAllResponses();int power=0,damage=0,attrition=0;
       if(battle){s.SkipToEndOfPowerSegment(true);power=s.GetLSTotalPower();s.PassResponses("INITIAL_ATTRITION_CALCULATED");if(s.gameState().getBattleState()!=null){damage=(int)Math.max(0,s.GetUnpaidLSBattleDamage());attrition=(int)Math.max(0,s.GetUnpaidLSAttrition());}}
       else {while(!s.GameIsFinished()&&s.IsActiveForceDrain()){s.LSChooseCard(last&&path.equals("last-hand")?card(s,true,"1_28",1):(PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));if(!s.GameIsFinished())s.PassAllResponses();}}
       var r=new LinkedHashMap<String,Object>();r.put("name",path);var force=new LinkedHashMap<String,Object>();var used=new LinkedHashMap<String,Object>();var lost=new LinkedHashMap<String,Object>();
       for(boolean ls:List.of(true,false)){String side=ls?"light":"dark",p=player(ls);force.put(side,force(s,ls));used.put(side,s.gameState().getUsedPile(p).stream().map(c->c.getBlueprintId(true)).toList());lost.put(side,s.gameState().getLostPile(p).stream().map(c->c.getBlueprintId(true)).toList());}
       r.put("force",force);r.put("used",used);r.put("lost",lost);var light=new ArrayList<String>();var excluded=new ArrayList<String>();int ability=0;
       for(int i=0;i<60;i++){PhysicalCardImpl c;try{c=s.GetLSCard("card-"+i);}catch(IllegalArgumentException e){continue;}if(c.getAtLocation()==dest){light.add(c.getBlueprintId(true));boolean ex=battle&&!com.gempukku.swccgo.filters.Filters.participatingInBattle.accepts(s.game(),c);if(ex)excluded.add(c.getBlueprintId(true));else ability+=(int)s.game().getModifiersQuerying().getAbility(s.gameState(),c);}}
       Collections.sort(light);Collections.sort(excluded);r.put("light",light);r.put("excluded",excluded);r.put("ability",ability);r.put("power",power);r.put("damage",damage);r.put("attrition",attrition);r.put("life",s.gameState().getReserveDeck(LS).size()+s.gameState().getForcePile(LS).size()+s.gameState().getUsedPile(LS).size());r.put("hand",s.gameState().getHand(LS).size());r.put("winner",s.game().getWinner()==null?null:s.game().getWinner().equals(DS)?"dark":"light");RESULTS.add(r);
      }
    }
}
