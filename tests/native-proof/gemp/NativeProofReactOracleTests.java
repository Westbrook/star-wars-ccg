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
public class NativeProofReactOracleTests {
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
    @AfterClass public static void writeResults() throws Exception { Files.writeString(Path.of("/opt/gemp-swccg/react-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(RESULTS)); }


    private PhysicalCardImpl physical(VirtualTableScenario s,String id){int index=Integer.parseInt(id.substring(1))-1;try{return id.startsWith("l")?s.GetLSCard("card-"+index):s.GetDSCard("card-"+index);}catch(IllegalArgumentException e){return id.startsWith("l")?s.GetLSStartingLocation():s.GetDSStartingLocation();}}
    private VirtualTableScenario fixture(String scenario) throws Exception {
      var s=new VirtualTableScenario(deck("Light","1_124"),deck("Dark","1_291"),0,0,StartingSetup.LSStartingLocation("1_124"),StartingSetup.DSStartingLocation("1_291"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
      s.StartGame();s.SkipToPhase(scenario.equals("react-drain")?Phase.ACTIVATE:Phase.CONTROL);
      var json=com.google.gson.JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/react-fixtures.json"))).getAsJsonObject().getAsJsonObject(scenario);
      var cards=json.getAsJsonObject("cards");
      for(var e:cards.entrySet()){var c=physical(s,e.getKey());assertEquals(e.getValue().getAsJsonObject().get("blueprint").getAsString(),c.getBlueprintId(true));s.MoveCardsToTopOfOwnReserveDeck(c);}
      for(var id:json.getAsJsonArray("locations"))s.MoveLocationToTable(physical(s,id.getAsString()));
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("location")&&!c.has("attachedTo"))s.MoveCardsToLocation(physical(s,c.get("location").getAsString()),physical(s,e.getKey()));}
      for(var e:cards.entrySet()){var c=e.getValue().getAsJsonObject();if(c.has("attachedTo"))s.AttachCardsTo(physical(s,c.get("attachedTo").getAsString()),physical(s,e.getKey()));}
      for(String side:List.of("light","dark"))for(String zone:List.of("reserve","force","used","hand")){
        var ids=json.getAsJsonObject("players").getAsJsonObject(side).getAsJsonArray(zone);
        for(int i=ids.size()-1;i>=0;i--){var c=physical(s,ids.get(i).getAsString());switch(zone){case "reserve":s.MoveCardsToTopOfOwnReserveDeck(c);break;case "force":s.MoveCardsToTopOfOwnForcePile(c);break;case "used":s.MoveCardsToTopOfOwnUsedPile(c);break;case "hand":if(side.equals("light"))s.MoveCardsToLSHand(c);else s.MoveCardsToDSHand(c);}}
      }
      s.SkipToPhase(scenario.equals("react-drain")?Phase.CONTROL:Phase.BATTLE);return s;
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
    @Test public void groundReacts() throws Exception {
      for(String path:List.of("battle-pass","battle-one","battle-two","drain-pass","drain-first","drain-second","deploy-same-pass","deploy-same-troopers","deploy-same-wolfman","deploy-adjacent-pass","deploy-adjacent-troopers","deploy-adjacent-wolfman")){
       System.out.println("PATH "+path);String scenario=path.startsWith("drain")?"react-drain":path.startsWith("battle")?"react-battle":"react-deploy";
       var s=fixture(scenario);var dest=destination(s,path);boolean drain=path.startsWith("drain");
       if(drain)s.DSForceDrainAt(dest);else s.DSInitiateBattle(dest);
       if(path.equals("battle-one")||path.equals("battle-two")||path.equals("drain-first"))moveReact(s,1,dest);
       if(path.equals("battle-two")||path.equals("drain-second"))moveReact(s,2,dest);
       if(path.endsWith("troopers")){deployReact(s,"1_28",5,dest);deployReact(s,"1_28",6,dest);}
       if(path.endsWith("wolfman")){deployReact(s,"1_30",1,dest);deployReact(s,"1_28",5,dest);}
       s.PassAllResponses();
       int power=0,damage=0,attrition=0;
       if(drain){while(s.IsActiveForceDrain()){s.LSChooseCard((PhysicalCardImpl)s.gameState().getTopOfReserveDeck(LS));s.PassAllResponses();}}
       else {s.SkipToEndOfPowerSegment(true);power=s.GetLSTotalPower();s.PassResponses("INITIAL_ATTRITION_CALCULATED");if(s.gameState().getBattleState()!=null){damage=(int)Math.max(0,s.GetUnpaidLSBattleDamage());attrition=(int)Math.max(0,s.GetUnpaidLSAttrition());}}
       var r=new LinkedHashMap<String,Object>();r.put("name",path);r.put("force",force(s,true));r.put("used",s.gameState().getUsedPile(LS).stream().map(c->c.getBlueprintId(true)).toList());r.put("lost",s.gameState().getLostPile(LS).stream().map(c->c.getBlueprintId(true)).toList());
       var light=new ArrayList<String>();var dark=new ArrayList<String>();int ability=0;
       for(int i=0;i<60;i++)for(boolean ls:List.of(true,false)){PhysicalCardImpl c;try{c=ls?s.GetLSCard("card-"+i):s.GetDSCard("card-"+i);}catch(IllegalArgumentException e){continue;}if(c.getAtLocation()==dest){(ls?light:dark).add(c.getBlueprintId(true));if(ls)ability+=(int)s.game().getModifiersQuerying().getAbility(s.gameState(),c);}}
       Collections.sort(light);Collections.sort(dark);r.put("light",light);r.put("dark",dark);r.put("ability",ability);r.put("cancelled",drain&&ability>0&&s.gameState().getLostPile(LS).isEmpty());r.put("power",power);r.put("damage",damage);r.put("attrition",attrition);RESULTS.add(r);
      }
    }
}
