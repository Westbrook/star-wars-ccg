package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.decisions.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.vo.SwccgDeck;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Ordinary setup and exact decks; no board, hand, Force or shuffle interventions. */
public class NativeEngineBattlePlanStartingOracleTests {
 @Test public void starts() throws Exception {
  var results=new ArrayList<Map<String,Object>>();
  for(String first:List.of("dark","light"))for(int stopAfter:List.of(1,2,3))for(boolean reverse:List.of(false,true)){
   boolean effects=true,dark=true,light=true;
   var decks=new LinkedHashMap<String,SwccgDeck>();
   for(String side:List.of("dark","light")){var d=new SwccgDeck(side);d.addCard(side.equals("dark")?(first.equals("light")?"2_143":"1_291"):"1_132");d.addCard(side.equals("dark")?"9_139":"9_51");for(int n=0;n<2;n++)d.addCard(side.equals("dark")?"4_134":"4_21");for(int n=0;n<2;n++)d.addCard(side.equals("dark")?"6_147":"6_58");for(int n=0;n<2;n++)d.addCard(side.equals("dark")?"8_118":"8_35");for(int n=0;n<52;n++)d.addCard(side.equals("dark")?"1_194":"1_28");decks.put(side,d);}
   var feedback=new DefaultUserFeedback();var game=new DefaultSwccgGame(VirtualTableScenario._formatLibrary.getFormat("open"),decks,feedback,VirtualTableScenario._cardLibrary,Map.of("dark",0,"light",0),false);feedback.setGame(game);game.startGame();game.setTestEnvironment(true);
   var trace=new ArrayList<Map<String,Object>>();var lostOrder=new ArrayList<String>();
   for(int n=0;n<200&&game.getGameState().getCurrentPhase()!=Phase.ACTIVATE;n++){
    String side=feedback.getAwaitingDecision("light")!=null?"light":"dark";var d=feedback.getAwaitingDecision(side);assertNotNull(d);String text=d.getText().toLowerCase();var p=d.getDecisionParameters();String answer="";
    if(text.contains("select ok to start"))answer="0";
    else if(text.contains("starting location"))answer=p.get("cardId")[0];
    else if(text.contains("starting interrupt"))answer=(side.equals("dark")?dark:light)?p.get("cardId")[0]:"";
    else if(text.contains("choose card")&&text.contains("deploy from")){long count=game.getGameState().getAllPermanentCards().stream().filter(c->c.getZone()==Zone.SIDE_OF_TABLE&&c.getOwner().equals(side)).count();var ids=p.get("selectableCardId")==null?p.get("cardId"):p.get("selectableCardId");answer=count>=stopAfter?"":ids[reverse?ids.length-1:0];}
    else if(d.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE)answer="0";
    else if(d instanceof ActionSelectionDecision&&text.contains("required responses"))answer=p.get("actionId")[0];
    else if(!text.contains("optional")&&!text.contains("response")&&!text.contains("verify"))throw new AssertionError("Unexpected choice: "+d.getText());
    var revealed=new LinkedHashMap<String,Object>();for(String owner:List.of("dark","light")){var c=game.getGameState().getStartingInterruptPlayed(owner);revealed.put(owner,c==null?"none":c.getBlueprintId(true));}
    trace.add(Map.of("side",side,"text",d.getText(),"type",d.getDecisionType(),"parameters",p,"answer",answer,"revealed",revealed));
    feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();
    var newlyLost=new ArrayList<String>();for(String owner:List.of("dark","light"))if(!lostOrder.contains(owner)&&game.getGameState().getLostPile(owner).stream().anyMatch(c->c.getBlueprintId(true).equals(owner.equals("dark")?"9_139":"9_51")))newlyLost.add(owner);assertTrue("Need independently observed resolution boundaries",newlyLost.size()<=1);lostOrder.addAll(newlyLost);
   }
   assertEquals(Phase.ACTIVATE,game.getGameState().getCurrentPhase());assertEquals(first,game.getGameState().getCurrentPlayerId());
   var piles=new LinkedHashMap<String,Object>();for(String side:List.of("dark","light"))piles.put(side,Map.of("reserve",game.getGameState().getReserveDeck(side).size(),"hand",game.getGameState().getHand(side).size(),"lost",game.getGameState().getLostPile(side).stream().map(c->c.getBlueprintId(true)).toList()));
   var expected=new ArrayList<String>();for(String owner:List.of(first,first.equals("dark")?"light":"dark"))if(owner.equals("dark")?dark:light)expected.add(owner);assertEquals(expected,lostOrder);
   results.add(Map.of("first",first,"dark",dark,"light",light,"trace",trace,"lostOrder",lostOrder,"piles",piles,"stopAfter",stopAfter,"reverse",reverse,"table",game.getGameState().getAllPermanentCards().stream().filter(c->c.getZone()==Zone.SIDE_OF_TABLE).map(c->c.getBlueprintId(true)).sorted().toList()));
  }
  Files.writeString(Path.of("/opt/gemp-swccg/battle-plan-starting-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
 }
}
