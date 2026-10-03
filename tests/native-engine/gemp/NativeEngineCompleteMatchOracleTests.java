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

/** Headless client of the unmodified engine, using exactly the introductory
 * lists. No VirtualTableScenario instance, filler, destiny pack or state cheats. */
public class NativeEngineCompleteMatchOracleTests {
    final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    DefaultSwccgGame game;
    DefaultUserFeedback feedback;
    final Map<Integer,String> identities = new HashMap<>();
    final List<Map<String,Object>> trace = new ArrayList<>();
    Map<String,Object> setup;
    GameState state() { return game.getGameState(); }
    String identity(PhysicalCard c) { return c == null ? null : identities.get(c.getPermanentCardId()); }
    List<String> ids(Collection<PhysicalCard> cards) { return cards.stream().map(this::identity).toList(); }
    PhysicalCard card(String id) { return state().getAllPermanentCards().stream().filter(c -> Integer.toString(c.getCardId()).equals(id)).findFirst().orElse(null); }
    Map<String,Object> snapshot() {
        var players = new LinkedHashMap<String,Object>();
        for (var side : List.of("dark","light")) players.put(side, Map.of("reserve",ids(state().getReserveDeck(side)),"force",ids(state().getForcePile(side)),"used",ids(state().getUsedPile(side)),"lost",ids(state().getLostPile(side)),"hand",ids(state().getHand(side))));
        var table = new ArrayList<Map<String,Object>>();
        for (var c : state().getAllPermanentCards()) if (c.getZone()==Zone.AT_LOCATION) {
            var entry=new LinkedHashMap<String,Object>();entry.put("id",identity(c));entry.put("location",identity(c.getAtLocation()));
            if(c.getBlueprint().getCardCategory()==CardCategory.CHARACTER)entry.put("stats",Map.of("power",game.getModifiersQuerying().getPower(state(),c),"ability",game.getModifiersQuerying().getAbility(state(),c),"forfeit",game.getModifiersQuerying().getForfeit(state(),c)));
            table.add(entry);
        }
        table.sort(Comparator.comparing(c -> (String)c.get("id")));
        var result=new LinkedHashMap<String,Object>(Map.of("turn",state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light"),"side",state().getCurrentPlayerId(),"phase",state().getCurrentPhase().name().toLowerCase(),"players",players,"table",table,"locations",ids(state().getLocationsInOrder())));
        var battle=state().getBattleState();
        if(battle!=null&&battle.isReachedDamageSegment()) {
            var losses=new LinkedHashMap<String,Object>();
            for(var side:List.of("dark","light"))losses.put(side,Map.of("damage",battle.getBattleDamageRemaining(game,side),"totalDamage",battle.getBattleDamageTotal(game,side),"totalAttrition",battle.getAttritionTotal(game,side)));
            result.put("battleLosses",losses);
        }
        return result;
    }
    void semantic(String kind, String side, PhysicalCard source) {
        var value=new LinkedHashMap<String,Object>();value.put("kind",kind);value.put("side",side);if(source!=null)value.put("card",identity(source));trace.getLast().put("semantic",value);
    }
    String choose(String side, AwaitingDecision decision) {
        String text=decision.getText().toLowerCase(); var p=decision.getDecisionParameters();
        if (text.contains("select ok to start")) return "0";
        if (text.contains("starting location")) {
            String bp=side.equals("dark")?"1_291":"101_1";
            for(int i=0;i<p.get("blueprintId").length;i++) if(p.get("blueprintId")[i].equals(bp)) return p.get("cardId")[i];
        }
        if (text.contains("starting interrupt")) return "";
        if (decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE && text.matches("do you want to draw [0-9]+ battle destiny.*")) return "0";
        if (decision.getDecisionType()==AwaitingDecisionType.INTEGER && text.contains("activate")) {semantic("activate-count",side,null);trace.getLast().put("count",Integer.parseInt(p.get("max")[0]));return p.get("max")[0];}
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("where to deploy")) {
            String selected=p.get("cardId")[0];
            for(String candidate:p.get("cardId")) if(card(candidate).getBlueprintId(true).equals("1_291")) selected=candidate;
            semantic("deploy-target",side,card(selected));return selected;
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && (text.contains("to lose") || text.contains("to forfeit"))) {
            var options=Arrays.stream(p.get("cardId")).map(this::card).filter(Objects::nonNull).sorted(Comparator.comparingInt((PhysicalCard c)->c.getZone()==Zone.AT_LOCATION?0:c.getZone()==Zone.HAND?1:2).thenComparing(this::identity)).toList();
            var selected=options.getFirst();semantic(selected.getZone()==Zone.AT_LOCATION?"forfeit":"lose",side,selected);trace.getLast().put("lossZone",selected.getZone().name());return Integer.toString(selected.getCardId());
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_ACTION_CHOICE || decision.getDecisionType()==AwaitingDecisionType.ACTION_CHOICE) {
            if (text.contains("optional") || text.contains("response")) return "";
            String[] actions=p.get("actionText"), actionIds=p.get("actionId"), cards=p.get("cardId");
            if(actions!=null) for(int i=0;i<actions.length;i++) {
                String action=actions[i].toLowerCase(); PhysicalCard c=cards==null?null:card(cards[i]);
                if(action.equals("activate force") || action.startsWith("force drain") || action.startsWith("initiate battle")) {semantic(action.equals("activate force")?"activate":action.startsWith("force drain")?"drain":"battle",side,c);return actionIds[i];}
                if(action.startsWith("deploy") && c!=null && c.getZone()==Zone.HAND && c.getBlueprint().getCardCategory()==CardCategory.CHARACTER) {semantic("deploy",side,c);return actionIds[i];}
                if(action.equals("draw card into hand from force pile") && state().getHand(side).size()<10) {semantic("draw",side,c);return actionIds[i];}
            }
            semantic("pass",side,null);return "";
        }
        throw new AssertionError("Unmapped decision: "+side+" "+decision.getDecisionType()+" "+decision.getText()+" "+gson.toJson(p));
    }
    @Test public void completeIntroductoryMatch() throws Exception {
        var manifest=JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/match-manifest.json"))).getAsJsonObject();
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
                feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();
            }
            assertTrue("Command budget exhausted",game.isFinished());
        } finally {
            var result=new LinkedHashMap<String,Object>();result.put("schema",1);result.put("snapshotVersion",2);result.put("decks",lists);result.put("setup",setup);result.put("trace",trace);result.put("winner",game.getWinner());result.put("finished",game.isFinished());result.put("final",snapshot());
            Files.writeString(Path.of("/opt/gemp-swccg/complete-match-results.json"),gson.toJson(result));
        }
    }
}
