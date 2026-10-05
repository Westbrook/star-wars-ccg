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
public class NativeEnginePhaseStartFlowOracleTests {
 @Test public void starts() throws Exception {
  var results=new ArrayList<Map<String,Object>>();
  for(String first:List.of("dark","light"))for(boolean three:List.of(false))for(boolean immune:List.of(false))for(String mode:List.of("none","light","both")){
   boolean effects=true,dark=true,light=true;var decks=new LinkedHashMap<String,SwccgDeck>();
   for(String side:List.of("dark","light")){var d=new SwccgDeck(side);d.addCard(side.equals("dark")?(first.equals("light")?"2_143":"1_291"):"1_132");d.addCard(three?(side.equals("dark")?"9_139":"9_51"):(side.equals("dark")?"6_160":"6_77"));if(effects)for(int n=0;n<2;n++)d.addCard(side.equals("dark")?"5_110":"102_1");if(immune)d.addCard(side.equals("dark")?"4_134":"4_21");for(int n=0;n<56-(immune?1:0);n++)d.addCard(side.equals("dark")?"1_194":"1_28");decks.put(side,d);}
   var feedback=new DefaultUserFeedback();var game=new DefaultSwccgGame(VirtualTableScenario._formatLibrary.getFormat("open"),decks,feedback,VirtualTableScenario._cardLibrary,Map.of("dark",0,"light",0),false);feedback.setGame(game);game.startGame();game.setTestEnvironment(true);
   var trace=new ArrayList<Map<String,Object>>();var lostOrder=new ArrayList<String>();
   for(int n=0;n<200&&game.getGameState().getCurrentPhase()!=Phase.ACTIVATE;n++){
    String side=feedback.getAwaitingDecision("light")!=null?"light":"dark";var d=feedback.getAwaitingDecision(side);assertNotNull(d);String text=d.getText().toLowerCase();var p=d.getDecisionParameters();String answer="";
    if(text.contains("select ok to start"))answer="0";
    else if(text.contains("starting location"))answer=p.get("cardId")[0];
    else if(text.contains("starting interrupt"))answer=(side.equals("dark")?dark:light)?p.get("cardId")[0]:"";
    else if(text.contains("choose card")&&text.contains("deploy from"))answer=p.get("selectableCardId")==null?p.get("cardId")[0]:p.get("selectableCardId")[0];
    else if(d.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE)answer="0";
    else if(d instanceof ActionSelectionDecision&&text.contains("required responses"))answer=p.get("actionId")[0];
    else if(!text.contains("optional")&&!text.contains("response")&&!text.contains("verify"))throw new AssertionError("Unexpected choice: "+d.getText());
    var revealed=new LinkedHashMap<String,Object>();for(String owner:List.of("dark","light")){var c=game.getGameState().getStartingInterruptPlayed(owner);revealed.put(owner,c==null?"none":c.getBlueprintId(true));}
    if(text.contains("choose card")&&text.contains("deploy from")){var method=ArbitraryCardsSelectionDecision.class.getDeclaredMethod("getPhysicalCardByIndex",int.class);method.setAccessible(true);var offered=new ArrayList<String>();for(int i=0;i<p.get("cardId").length;i++)if(p.get("selectable")==null||"true".equals(p.get("selectable")[i]))offered.add(((PhysicalCard)method.invoke(d,i)).getBlueprintId(true));revealed.put("eligible",offered);assertFalse(three&&offered.stream().anyMatch(b->b.equals("102_1")||b.equals("5_110")));}
    trace.add(Map.of("side",side,"text",d.getText(),"type",d.getDecisionType(),"parameters",p,"answer",answer,"revealed",revealed));
    feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();
    var newlyLost=new ArrayList<String>();for(String owner:List.of("dark","light"))if(!lostOrder.contains(owner)&&game.getGameState().getLostPile(owner).stream().anyMatch(c->c.getBlueprintId(true).equals(three?(owner.equals("dark")?"9_139":"9_51"):(owner.equals("dark")?"6_160":"6_77"))))newlyLost.add(owner);lostOrder.addAll(newlyLost);
   }
   assertEquals(Phase.ACTIVATE,game.getGameState().getCurrentPhase());assertEquals(first,game.getGameState().getCurrentPlayerId());
   var piles=new LinkedHashMap<String,Object>();for(String side:List.of("dark","light"))piles.put(side,Map.of("reserve",game.getGameState().getReserveDeck(side).size(),"hand",game.getGameState().getHand(side).size(),"lost",game.getGameState().getLostPile(side).stream().map(c->c.getBlueprintId(true)).toList()));
   var expected=new ArrayList<String>();for(String owner:List.of(first,first.equals("dark")?"light":"dark"))if(owner.equals("dark")?dark:light)expected.add(owner);assertEquals(new HashSet<>(expected),new HashSet<>(lostOrder));
   var result=new LinkedHashMap<String,Object>(Map.of("first",first,"three",three,"immune",immune,"trace",trace,"lostObservedOrder",lostOrder,"piles",piles,"effects",effects,"table",game.getGameState().getAllPermanentCards().stream().filter(c->c.getZone()==Zone.SIDE_OF_TABLE).map(c->c.getBlueprintId(true)).sorted().toList()));
   result.put("mode",mode);var activated=new HashSet<String>();var deployed=new HashSet<String>();var flow=new ArrayList<Map<String,Object>>();
   int lostBefore=game.getGameState().getLostPile("light").size();
   for(int n=0;n<700&&!(game.getGameState().getCurrentPhase()==Phase.BATTLE&&game.getGameState().getCurrentPlayerId().equals("light"));n++){
    String side=feedback.getAwaitingDecision("light")!=null?"light":"dark";var d=feedback.getAwaitingDecision(side);assertNotNull(d);String text=d.getText().toLowerCase();var p=d.getDecisionParameters();String answer="";
    if(d.getDecisionType()==AwaitingDecisionType.INTEGER&&text.contains("activate"))answer="1";
    else if(d.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&(text.contains("where to deploy")||text.contains("to lose")))answer=p.get("cardId")[0];
    else if(d instanceof ActionSelectionDecision&&text.contains("required responses"))answer=p.get("actionId")[0];
    else if(!text.contains("optional")&&!text.contains("response")&&p.get("actionText")!=null){
     for(int j=0;j<p.get("actionText").length;j++){
      String a=p.get("actionText")[j].toLowerCase();
      if(a.equals("activate force")&&!activated.contains(side)){answer=p.get("actionId")[j];activated.add(side);break;}
      if(a.startsWith("deploy")&&!deployed.contains(side)&&(mode.equals("both")||mode.equals("light")&&side.equals("light"))){String id=p.get("cardId")[j];var c=game.getGameState().getAllPermanentCards().stream().filter(v->Integer.toString(v.getCardId()).equals(id)).findFirst().orElseThrow();if(c.getBlueprintId(true).equals(side.equals("light")?"1_28":"1_194")){answer=p.get("actionId")[j];deployed.add(side);break;}}
     }
    }
    flow.add(Map.of("side",side,"text",d.getText(),"parameters",p,"answer",answer));feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();
   }
   assertEquals(Phase.BATTLE,game.getGameState().getCurrentPhase());assertEquals("light",game.getGameState().getCurrentPlayerId());
   result.put("flow",Map.of("trace",flow,"lightLost",game.getGameState().getLostPile("light").size()-lostBefore,"effectLost",game.getGameState().getLostPile("dark").stream().anyMatch(c->c.getBlueprintId(true).equals("5_110")),"deployed",deployed));results.add(result);

  }
  Files.writeString(Path.of("/opt/gemp-swccg/phase-start-flow-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));
 }
}
