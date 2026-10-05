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
public class NativeEngineDisarmMatchOracleTests {
 final Gson gson=new GsonBuilder().setPrettyPrinting().create();
 DefaultSwccgGame game; DefaultUserFeedback feedback;
 final Map<Integer,String> identities=new HashMap<>();
 final List<Map<String,Object>> trace=new ArrayList<>();
 final Map<Action,Map<String,Object>> targets=new LinkedHashMap<>();
 final Map<PhysicalCard,Map<String,Object>> outcomes=new LinkedHashMap<>();
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
            var entry=new LinkedHashMap<String,Object>();entry.put("id",identity(c));entry.put("location",identity(game.getModifiersQuerying().getLocationThatCardIsAt(state(),c)));entry.put("attachedTo",identity(c.getAttachedTo()));entry.put("hit",c.isHit());
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
 void observe(AwaitingDecision d,String answer){targets.put(selected(d,answer),trace.getLast());}
 void recordTargets(){for(var it=targets.entrySet().iterator();it.hasNext();){var e=it.next();var list=e.getKey().getAllPrimaryTargetCards().values().stream().flatMap(v->v.keySet().stream()).distinct().toList();if(list.isEmpty())continue;assertEquals(1,list.size());var c=list.getFirst();var row=e.getValue();var sem=(Map<String,Object>)row.get("semantic");sem.put("target",identity(c));row.put("targetObservation",Map.of("card",identity(c),"blueprint",c.getBlueprintId(true),"referenceCardId",Integer.toString(c.getCardId()),"afterDecision",trace.size()-1));outcomes.put(c,row);it.remove();}}
 void recordOutcomes(){for(var it=outcomes.entrySet().iterator();it.hasNext();){var e=it.next();var c=e.getKey();var row=e.getValue();var sem=(Map<String,Object>)row.get("semantic");var initial=(List<Map<String,Object>>)((Map<String,Object>)row.get("state")).get("table");var attached=initial.stream().filter(v->identity(c).equals(v.get("attachedTo"))).map(v->(String)v.get("id")).toList();boolean operate="evazan".equals(sem.get("kind"));
  boolean lost=state().getLostPile(c.getOwner()).contains(c);boolean weaponsGone=state().getAllPermanentCards().stream().noneMatch(v->v.getAttachedTo()==c&&v.getBlueprint().getCardCategory()==CardCategory.WEAPON);
  boolean attachmentsLost=attached.stream().allMatch(id->state().getLostPile(id.startsWith("dark-")?"dark":"light").stream().anyMatch(v->id.equals(identity(v))));
  if(operate?lost&&attachmentsLost:c.isDisarmed()&&weaponsGone&&attached.stream().filter(id->state().getAllPermanentCards().stream().anyMatch(v->id.equals(identity(v))&&v.getBlueprint().getCardCategory()==CardCategory.WEAPON)).allMatch(id->state().getAllPermanentCards().stream().anyMatch(v->id.equals(identity(v))&&state().getLostPile(v.getOwner()).contains(v)))){var result=new LinkedHashMap<String,Object>();result.put("card",identity(c));result.put("source",sem.get("card"));result.put("afterDecision",trace.size()-1);result.put("lost",lost);result.put("disarmed",c.isDisarmed());result.put("attachedBefore",attached);result.put("state",snapshot());row.put("disarmOutcome",result);it.remove();}
 }}
 String choose(String side,AwaitingDecision decision){String text=decision.getText().toLowerCase();var p=decision.getDecisionParameters();
  if(text.contains("select ok to start"))return "0";
  if(text.contains("starting location")){String bp=side.equals("dark")?"1_291":"1_132";for(int i=0;i<p.get("blueprintId").length;i++)if(p.get("blueprintId")[i].equals(bp))return p.get("cardId")[i];}
  if(text.contains("starting interrupt"))return "";
  if(decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE&&text.startsWith("on which side of ")){semantic("site-placement",side,null);return "0";}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("next to (or convert)")){semantic("site-placement",side,card(p.get("cardId")[0]));return p.get("cardId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS&&text.equals("choose card to put on lost pile")){semantic("loss-order",side,null);return p.get("cardId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE&&text.matches("do you want to draw [0-9]+ battle destiny.*"))return "0";
  if(decision.getDecisionType()==AwaitingDecisionType.INTEGER&&text.contains("activate")){semantic("activate-count",side,null);trace.getLast().put("count",Integer.parseInt(p.get("max")[0]));return p.get("max")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&(text.contains("choose character")||text.contains("choose opponent"))){int i=0;while(p.containsKey("selectable")&&!"true".equals(p.get("selectable")[i]))i++;semantic("interrupt-target",side,card(p.get("cardId")[i]));return p.get("cardId")[i];}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("target")){semantic("fire-target",side,card(p.get("cardId")[0]));return p.get("cardId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&text.contains("where to deploy")){
   int selected=0;for(int i=0;i<p.get("cardId").length;i++)if(List.of("1_291","1_129").contains(card(p.get("cardId")[i]).getBlueprintId(true)))selected=i;
   // Stack ordinary blasters to exercise the legal simultaneous weapon-loss ordering.
   semantic(targets.isEmpty()?"deploy-target":"interrupt-target",side,card(p.get("cardId")[selected]));return p.get("cardId")[selected];
  }
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION&&(text.contains("to lose")||text.contains("to be lost")||text.contains("to forfeit"))){var options=Arrays.stream(p.get("cardId")).map(this::card).filter(Objects::nonNull).sorted(Comparator.comparingInt((PhysicalCard c)->(c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)?0:c.getZone()==Zone.RESERVE_DECK?1:c.getZone()==Zone.USED_PILE?2:c.getZone()==Zone.FORCE_PILE?3:4).thenComparingDouble(c->c.getZone()==Zone.AT_LOCATION?game.getModifiersQuerying().getAbility(state(),c):0).thenComparing(this::identity)).toList();var c=options.getFirst();semantic((c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)?"forfeit":"lose",side,c);trace.getLast().put("lossZone",c.getZone().name());return Integer.toString(c.getCardId());}
  if(decision instanceof ActionSelectionDecision&&text.contains("required responses")){var a=selected(decision,p.get("actionId")[0]);assertTrue(p.get("actionText")[0].toLowerCase().startsWith("disarm "));semantic("disarm-trigger",side,a.getActionSource());((Map<String,Object>)trace.getLast().get("semantic")).put("target",identity(a.getActionSource().getAttachedTo()));return p.get("actionId")[0];}
  if(decision.getDecisionType()==AwaitingDecisionType.CARD_ACTION_CHOICE||decision.getDecisionType()==AwaitingDecisionType.ACTION_CHOICE){String[] actions=p.get("actionText"),ids=p.get("actionId"),cards=p.get("cardId");var order=new ArrayList<Integer>();if(actions!=null)for(int i=0;i<actions.length;i++)order.add(i);order.sort(Comparator.comparingInt(i->{var c=cards==null?null:card(cards[i]);return c!=null&&c.getBlueprintId(true).equals("1_172")?-1:c!=null&&c.getBlueprint().getCardCategory()==CardCategory.WEAPON?0:1;}));
   for(int i:order){String action=actions[i].toLowerCase();var c=cards==null?null:card(cards[i]);
    if(c!=null&&List.of("1_48","1_214").contains(c.getBlueprintId(true))&&c.getZone()==Zone.HAND&&action.startsWith("deploy")){semantic("disarm-deploy",side,c);observe(decision,ids[i]);return ids[i];}
    if(c!=null&&c.getBlueprintId(true).equals("1_172")&&action.startsWith("'operate'")){semantic("evazan",side,c);observe(decision,ids[i]);return ids[i];}
    if(action.startsWith("fire ")&&c!=null&&state().getForcePile(side).size()>2){semantic("fire",side,c);return ids[i];}
    if(text.contains("optional")||text.contains("response"))continue;
    int turn=state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light");if((action.startsWith("force drain")||action.startsWith("initiate battle"))&&turn<30&&!List.of("light","dark").stream().allMatch(seat->trace.stream().anyMatch(r->r.get("semantic") instanceof Map<?,?> s&&"disarm-deploy".equals(s.get("kind"))&&seat.equals(s.get("side")))))continue;
    if(action.equals("activate force")||action.startsWith("force drain")||action.startsWith("initiate battle")){semantic(action.equals("activate force")?"activate":action.startsWith("force drain")?"drain":"battle",side,c);return ids[i];}
    if(action.startsWith("deploy")&&c!=null&&c.getZone()==Zone.HAND){var type=c.getBlueprint().getCardCategory();if(type==CardCategory.CHARACTER&&!c.getBlueprintId(true).equals("1_172")&&state().getAllPermanentCards().stream().filter(v->v.getOwner().equals(side)&&v.getZone()==Zone.AT_LOCATION&&v.getBlueprint().getCardCategory()==CardCategory.CHARACTER).count()>=6)continue;if(List.of(CardCategory.CHARACTER,CardCategory.WEAPON,CardCategory.LOCATION).contains(type)){semantic(type==CardCategory.LOCATION?"site":type==CardCategory.CHARACTER?"deploy":"equip",side,c);return ids[i];}}
    if(action.equals("draw card into hand from force pile")&&state().getHand(side).size()<35&&state().getForcePile(side).size()>2){semantic("draw",side,c);return ids[i];}
   }semantic("pass",side,null);return "";
  }
  throw new AssertionError("Unmapped decision: "+side+" "+decision.getDecisionType()+" "+decision.getText()+" "+gson.toJson(p));
 }
    @Test public void completeDisarmMatch() throws Exception {
        var manifest=JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/disarm-battle-manifest.json"))).getAsJsonObject();
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
                var row=new LinkedHashMap<String,Object>();row.put("side",side);row.put("type",d.getDecisionType());row.put("text",d.getText());row.put("parameters",d.getDecisionParameters());row.put("state",snapshot());trace.add(row);
                String answer=choose(side,d);row.put("answer",answer);
                var priorLost=ids(state().getLostPile(side));
                feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();recordTargets();recordOutcomes();
                if(row.get("semantic") instanceof Map<?,?> sem && "loss-order".equals(sem.get("kind"))){
                    var added=new ArrayList<>(ids(state().getLostPile(side)));added.removeAll(priorLost);assertFalse(added.isEmpty());
                    var selected=state().getAllPermanentCards().stream().filter(c->identity(c).equals(added.getLast())).findFirst().orElseThrow();
                    assertEquals(d.getDecisionParameters().get("blueprintId")[0],selected.getBlueprintId(true));semantic("loss-order",side,selected);
                }
            }
            assertTrue("Command budget exhausted",game.isFinished());
            assertTrue("Unobserved action target",targets.isEmpty());
            assertTrue("Unobserved outcome",outcomes.isEmpty());
            assertTrue("Actual Disarmed plays required",trace.stream().filter(r->r.get("semantic") instanceof Map<?,?> s&&"disarm-deploy".equals(s.get("kind"))).count()>=2);
            for(String side:List.of("light","dark"))assertTrue("Both Disarmed cards must be played",trace.stream().anyMatch(r->r.get("semantic") instanceof Map<?,?> s&&"disarm-deploy".equals(s.get("kind"))&&side.equals(s.get("side"))));
            assertTrue("Actual Evazan operation required",trace.stream().anyMatch(r->r.get("semantic") instanceof Map<?,?> s&&"evazan".equals(s.get("kind"))));
        } finally {
            var result=new LinkedHashMap<String,Object>();result.put("schema",1);result.put("snapshotVersion",5);result.put("deckProfile","disarm-battle-v1");result.put("decks",lists);result.put("setup",setup);result.put("trace",trace);result.put("winner",game.getWinner());result.put("finished",game.isFinished());result.put("final",snapshot());
            Files.writeString(Path.of("/opt/gemp-swccg/disarm-match-results.json"),gson.toJson(result));
        }
    }
}
