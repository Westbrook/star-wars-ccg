package com.gempukku.swccgo.rules.devices;

import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.game.state.GameState;
import com.gempukku.swccgo.logic.decisions.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.vo.SwccgDeck;
import com.google.gson.*;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Ordinary shuffled 60-card match. Only legal client decisions; no board,
 * Force, destiny or pile interventions after normal setup. */
public class NativeEnginePhaseEffectsMatchOracleTests {
 final Gson gson=new GsonBuilder().setPrettyPrinting().create();
 DefaultSwccgGame game; DefaultUserFeedback feedback;
 final Map<Integer,String> identities=new HashMap<>();
 final List<Map<String,Object>> trace=new ArrayList<>();
 Map<String,Object> setup;
    GameState state() { return game.getGameState(); }
    String identity(PhysicalCard c) { return c == null ? null : identities.get(c.getPermanentCardId()); }
    List<String> ids(Collection<PhysicalCard> cards) { return cards.stream().map(this::identity).toList(); }
    PhysicalCard card(String id) { return state().getAllPermanentCards().stream().filter(c -> Integer.toString(c.getCardId()).equals(id)).findFirst().orElse(null); }
    Map<String,Object> snapshot() {
        var players = new LinkedHashMap<String,Object>();
        for (var side : List.of("dark","light")) players.put(side, Map.of("reserve",ids(state().getReserveDeck(side)),"force",ids(state().getForcePile(side)),"used",ids(state().getUsedPile(side)),"lost",ids(state().getLostPile(side)),"hand",ids(state().getHand(side))));
        var table = new ArrayList<Map<String,Object>>();
        for (var c : state().getAllPermanentCards()) if (c.getZone()==Zone.AT_LOCATION || c.getZone()==Zone.ATTACHED || c.getZone()==Zone.SIDE_OF_TABLE) {
            var entry=new LinkedHashMap<String,Object>();entry.put("id",identity(c));entry.put("location",identity(game.getModifiersQuerying().getLocationThatCardIsAt(state(),c)));entry.put("attachedTo",identity(c.getAttachedTo()));entry.put("hit",c.isHit());if(c.getBlueprint().getCardCategory()==CardCategory.CHARACTER)entry.put("disarmed",c.isDisarmed());
            if(c.getBlueprint().getCardCategory()==CardCategory.CHARACTER)entry.put("stats",Map.of("power",game.getModifiersQuerying().getPower(state(),c),"ability",game.getModifiersQuerying().getAbility(state(),c),"forfeit",game.getModifiersQuerying().getForfeit(state(),c)));
            table.add(entry);
        }
        table.sort(Comparator.comparing(c -> (String)c.get("id")));
        var result=new LinkedHashMap<String,Object>(Map.of("turn",state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light"),"side",state().getCurrentPlayerId(),"phase",state().getCurrentPhase().name().toLowerCase(),"players",players,"table",table,"locations",ids(state().getLocationsInOrder())));
        var battle=state().getBattleState();
        if(battle!=null&&battle.isReachedDamageSegment()) {
            var losses=new LinkedHashMap<String,Object>();
            for(var side:List.of("dark","light"))losses.put(side,Map.of("damage",battle.getBattleDamageRemaining(game,side),"totalDamage",battle.getBattleDamageTotal(game,side),"totalAttrition",battle.getAttritionTotal(game,side),"attrition",battle.getAttritionRemaining(game,side)));
            result.put("battleLosses",losses);
            var destinies=new LinkedHashMap<String,Object>();
            for(var side:List.of("dark","light"))destinies.put(side,Map.of("total",battle.getTotalBattleDestiny(game,side),"cards",battle.getBattleDestinyDraws(side)==null?List.of():ids(battle.getBattleDestinyDraws(side)),"values",battle.getBattleDestinyDrawsValues(side)==null?List.of():battle.getBattleDestinyDrawsValues(side)));
            result.put("battleDestinies",destinies);
        }
        return result;
    }
    void semantic(String kind, String side, PhysicalCard source) {
        var value=new LinkedHashMap<String,Object>();value.put("kind",kind);value.put("side",side);if(source!=null)value.put("card",identity(source));trace.getLast().put("semantic",value);
    }
 Action selected(AwaitingDecision d,String answer){try{var method=(d instanceof CardActionSelectionDecision?CardActionSelectionDecision.class:ActionSelectionDecision.class).getDeclaredMethod("getSelectedAction",String.class);method.setAccessible(true);return (Action)method.invoke(d,answer);}catch(ReflectiveOperationException e){throw new AssertionError(e);}}
 String setupChoice(AwaitingDecision decision,String side,String kind){var p=decision.getDecisionParameters();try{var method=ArbitraryCardsSelectionDecision.class.getDeclaredMethod("getPhysicalCardByIndex",int.class);method.setAccessible(true);var offered=new ArrayList<String>();for(int i=0;i<p.get("cardId").length;i++)offered.add(identity((PhysicalCard)method.invoke(decision,i)));int index=0;while(!"true".equals(p.get("selectable")[index]))index++;var c=(PhysicalCard)method.invoke(decision,index);semantic(kind,side,c);trace.getLast().put("setupOffered",offered);return p.get("cardId")[index];}catch(ReflectiveOperationException e){throw new AssertionError(e);}}
 PhysicalCard front(){return state().getLocationsInOrder().stream().filter(c->List.of("1_129","1_291").contains(c.getBlueprintId(true))).findFirst().orElse(null);}
 void observePhaseLoss(Map<String,Object> row) throws Exception {
  row.put("phaseEffects",state().getAllPermanentCards().stream().filter(c->c.getBlueprintId(true).equals("5_110")&&c.getZone()==Zone.SIDE_OF_TABLE).map(c->Map.of("source",identity(c),"deployedAbilityObserved",c.getWhileInPlayData()!=null)).toList());
  var top=state().getTopForceLossState();if(top==null)return;var effect=top.getLoseForceEffect();var source=effect.getAction().getActionSource();
  if(source!=null&&source.getBlueprintId(true).equals("5_110"))row.put("phaseLoss",Map.of("source",identity(source),"blueprint",source.getBlueprintId(true),"remaining",effect.getForceLossRemaining(game),"id",top.getId()));
 }
 String choose(String side,AwaitingDecision decision){
  String text=decision.getText().toLowerCase();var p=decision.getDecisionParameters();
  if(text.contains("select ok to start"))return "0";
  if(text.contains("starting location")){String bp=side.equals("dark")?"1_291":"1_132";for(int i=0;i<p.get("blueprintId").length;i++)if(p.get("blueprintId")[i].equals(bp))return p.get("cardId")[i];}
  if(text.contains("starting interrupt"))return setupChoice(decision,side,"setup-interrupt");
  if(text.contains("choose card")&&text.contains("deploy from reserve"))return setupChoice(decision,side,"setup-effect");
  if(decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE&&text.startsWith("on which side of ")){semantic("site-placement",side,null);return "0";}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("next to (or convert)")){semantic("site-placement",side,card(p.get("cardId")[0]));return p.get("cardId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS&&text.equals("choose card to put on lost pile")){semantic("loss-order",side,null);return p.get("cardId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE&&text.matches("do you want to draw [0-9]+ battle destiny.*"))return "0";
  if(decision.getDecisionType()==AwaitingDecisionType.INTEGER&&text.contains("activate")){semantic("activate-count",side,null);trace.getLast().put("count",Integer.parseInt(p.get("max")[0]));return p.get("max")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("where to move")){var locations=new ArrayList<>(state().getLocationsInOrder());int goal=locations.indexOf(front());var target=Arrays.stream(p.get("cardId")).map(this::card).min(Comparator.comparingInt(c->Math.abs(locations.indexOf(c)-goal))).orElseThrow();semantic("move-target",side,target);return Integer.toString(target.getCardId());}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("where to deploy")){
   var options=Arrays.stream(p.get("cardId")).filter(id->!p.containsKey("selectable")||"true".equals(p.get("selectable")[Arrays.asList(p.get("cardId")).indexOf(id)])).map(this::card).toList();
   var target=options.stream().min(Comparator.comparingInt((PhysicalCard c)->(int)state().getAllPermanentCards().stream().filter(v->v.getOwner().equals(side)&&v.getAtLocation()==c).count())).orElseThrow();
   semantic("deploy-target",side,target);return Integer.toString(target.getCardId());
  }
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&(text.contains("to lose")||text.contains("to be lost")||text.contains("to forfeit"))){var options=Arrays.stream(p.get("cardId")).map(this::card).filter(Objects::nonNull).sorted(Comparator.comparingInt((PhysicalCard c)->(c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)?0:c.getZone()==Zone.RESERVE_DECK?1:c.getZone()==Zone.USED_PILE?2:c.getZone()==Zone.FORCE_PILE?3:4).thenComparingDouble(c->c.getZone()==Zone.AT_LOCATION?game.getModifiersQuerying().getAbility(state(),c):0).thenComparing(this::identity)).toList();var c=options.getFirst();semantic((c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)?"forfeit":"lose",side,c);trace.getLast().put("lossZone",c.getZone().name());return Integer.toString(c.getCardId());}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_ACTION_CHOICE||decision.getDecisionType()==AwaitingDecisionType.ACTION_CHOICE){String[] actions=p.get("actionText"),ids=p.get("actionId"),cards=p.get("cardId");
   if(text.contains("required")&&actions!=null&&actions.length>0){var a=selected(decision,ids[0]);semantic("phase-required",side,a.getActionSource());trace.getLast().put("requiredText",actions[0]);return ids[0];}
   if(!text.contains("optional")&&!text.contains("response")&&actions!=null)for(int i=0;i<actions.length;i++){String action=actions[i].toLowerCase();var c=cards==null?null:card(cards[i]);
    if(action.startsWith("initiate battle")&&state().getPlayersLatestTurnNumber("light")>=4){long previous=trace.stream().filter(r->r.get("semantic") instanceof Map<?,?> v&&"battle".equals(v.get("kind"))).count();boolean wantFree=previous%3!=0;boolean free=action.contains("for free");boolean hasFree=Arrays.stream(actions).anyMatch(a->a.equalsIgnoreCase("Initiate battle for free"));if(hasFree&&free!=wantFree&&state().getForcePile(side).size()>0)continue;semantic("battle",side,c);trace.getLast().put("free",free);trace.getLast().put("initiationCost",game.getModifiersQuerying().getInitiateBattleCost(state(),c,side,free));return ids[i];}
    if(action.equals("activate force")||action.startsWith("force drain")){semantic(action.equals("activate force")?"activate":"drain",side,c);if(action.startsWith("force drain"))trace.getLast().put("initiationCost",game.getModifiersQuerying().getInitiateForceDrainCost(state(),c,side));return ids[i];}
    if(action.equals("move using landspeed")&&front()!=null&&game.getModifiersQuerying().getLocationThatCardIsAt(state(),c)!=front()){semantic("move",side,c);return ids[i];}
    if(action.startsWith("deploy")&&c!=null&&c.getZone()==Zone.HAND){var type=c.getBlueprint().getCardCategory();if(type==CardCategory.CHARACTER){long count=state().getAllPermanentCards().stream().filter(v->v.getOwner().equals(side)&&v.getZone()==Zone.AT_LOCATION).count();int turn=state().getPlayersLatestTurnNumber(side);if(side.equals("dark")&&count>=3||side.equals("light")&&(turn<=2||turn==3&&count>=1))continue;}if(type==CardCategory.CHARACTER||type==CardCategory.LOCATION||type==CardCategory.EFFECT){semantic(type==CardCategory.LOCATION?"site":type==CardCategory.EFFECT?"table-effect":"deploy",side,c);return ids[i];}}
    if(action.equals("draw card into hand from force pile")&&state().getHand(side).size()<20&&state().getForcePile(side).size()>3){semantic("draw",side,c);return ids[i];}
   }
   semantic("pass",side,null);return "";
  }
  throw new AssertionError("Unmapped decision: "+side+" "+decision.getDecisionType()+" "+decision.getText()+" "+gson.toJson(p));
 }
    @Test public void completePhaseEffectsMatch() throws Exception {
        var manifest=JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/phase-effects-battle-manifest.json"))).getAsJsonObject();
        var decks=new LinkedHashMap<String,SwccgDeck>();var lists=new LinkedHashMap<String,List<String>>();
        for(var entry:manifest.getAsJsonArray("decks")) {
            var object=entry.getAsJsonObject();String side=object.get("side").getAsString();
            var deck=new SwccgDeck(side);var list=new ArrayList<String>();
            for(var bp:object.getAsJsonArray("main")){deck.addCard(bp.getAsString());list.add(bp.getAsString());}
            assertEquals(60,list.size());decks.put(side,deck);lists.put(side,list);
        }
        feedback=new DefaultUserFeedback();
        game=new DefaultSwccgGame(VirtualTableScenario._formatLibrary.getFormat("open"),decks,feedback,VirtualTableScenario._cardLibrary,Map.of("dark",0,"light",0),false);
        feedback.setGame(game);game.startGame();game.setTestEnvironment(true);
        for(var side:List.of("dark","light")){
            var remaining=new ArrayList<>(state().getAllPermanentCards().stream().filter(c->c.getOwner().equals(side)).sorted(Comparator.comparingInt(PhysicalCard::getPermanentCardId)).toList());
            assertEquals(60,remaining.size());
            for(int i=0;i<60;i++){String bp=lists.get(side).get(i);var c=remaining.stream().filter(v->v.getBlueprintId(true).equals(bp)).findFirst().orElseThrow();identities.put(c.getPermanentCardId(),side+"-"+(i+1));remaining.remove(c);}
        }
        try {
            for(int i=0;i<10000&&!game.isFinished();i++){
                String side=feedback.getAwaitingDecision("dark")!=null?"dark":"light";
                var d=feedback.getAwaitingDecision(side);assertNotNull("No live decision",d);
                if(setup==null&&state().getCurrentPhase()==Phase.ACTIVATE)setup=snapshot();
                var row=new LinkedHashMap<String,Object>();row.put("side",side);row.put("type",d.getDecisionType());row.put("text",d.getText());row.put("parameters",d.getDecisionParameters());row.put("state",snapshot());trace.add(row);observePhaseLoss(row);
                String answer=choose(side,d);row.put("answer",answer);
                var priorLost=ids(state().getLostPile(side));
                feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();
                if(row.get("semantic") instanceof Map<?,?> sem && "loss-order".equals(sem.get("kind"))){
                    var added=new ArrayList<>(ids(state().getLostPile(side)));added.removeAll(priorLost);assertFalse(added.isEmpty());
                    var selected=state().getAllPermanentCards().stream().filter(c->identity(c).equals(added.getLast())).findFirst().orElseThrow();
                    assertEquals(d.getDecisionParameters().get("blueprintId")[0],selected.getBlueprintId(true));semantic("loss-order",side,selected);
                }
            }
            assertTrue("Command budget exhausted",game.isFinished());
            assertEquals(2,trace.stream().filter(r->r.get("semantic") instanceof Map<?,?> v&&"setup-effect".equals(v.get("kind"))).count());
            assertTrue("Actual phase-end Force loss required",trace.stream().anyMatch(r->r.containsKey("phaseLoss")));
            assertTrue("Ability Effect must actually leave table",state().getLostPile("dark").stream().anyMatch(c->c.getBlueprintId(true).equals("5_110")));
            assertTrue(trace.stream().anyMatch(r->r.get("semantic") instanceof Map<?,?> v&&"drain".equals(v.get("kind"))));
        } finally {
            var result=new LinkedHashMap<String,Object>();result.put("schema",1);result.put("snapshotVersion",9);result.put("deckProfile","phase-effects-battle-v1");result.put("decks",lists);result.put("setup",setup);result.put("trace",trace);result.put("winner",game.getWinner());result.put("finished",game.isFinished());result.put("final",snapshot());
            Files.writeString(Path.of("/opt/gemp-swccg/phase-effects-match-results.json"),gson.toJson(result));
        }
    }
}
