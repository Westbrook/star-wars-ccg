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

/** Headless client of the unmodified engine, using the recorded paired-battle custom
 * lists. No VirtualTableScenario instance, filler, destiny pack or state cheats.
 * Client policy: start on Tatooine, concentrate deployments, retain response cards
 * and two Force, and choose offered recovery/redraw/switch/return actions. No board/pile intervention. */
public class NativeEnginePairedBattleMatchOracleTests {
    final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    DefaultSwccgGame game;
    PhysicalCard deploying;
    final Map<PhysicalCard,Map<String,Object>> observingMoves = new LinkedHashMap<>();
    DefaultUserFeedback feedback;
    final Set<Integer> canceledTurns=new HashSet<>();
    final Map<Integer,String> identities = new HashMap<>();
    final List<Map<String,Object>> trace = new ArrayList<>();
    Map<String,Object> setup;
    final Map<Action,Map<String,Object>> observingTargets = new LinkedHashMap<>();

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
    // Read-only observation handles both explicit targeting and GEMP's single-target shortcut.
    void observeSelectedTarget(AwaitingDecision decision, String answer) {
        try {
            var method=(decision instanceof CardActionSelectionDecision?CardActionSelectionDecision.class:ActionSelectionDecision.class).getDeclaredMethod("getSelectedAction",String.class);
            method.setAccessible(true);observingTargets.put((Action)method.invoke(decision,answer),trace.getLast());
        } catch(ReflectiveOperationException e){throw new AssertionError(e);}
    }
    void recordTargets() {
        for(var it=observingMoves.entrySet().iterator();it.hasNext();){
            var e=it.next();var row=e.getValue();var semantic=(Map<String,Object>)row.get("semantic");
            String to=identity(e.getKey().getAtLocation());
            if(to!=null&&!to.equals(semantic.get("from"))){row.put("movementObservation",Map.of("card",identity(e.getKey()),"from",semantic.get("from"),"to",to,"afterDecision",trace.size()-1,"referenceCardId",row.get("answer"),"blueprint",e.getKey().getBlueprintId(true)));it.remove();}
        }
        for(var iterator=observingTargets.entrySet().iterator();iterator.hasNext();){
            var entry=iterator.next();var cards=entry.getKey().getAllPrimaryTargetCards().values().stream().flatMap(v->v.keySet().stream()).distinct().toList();
            if(cards.isEmpty())continue;
            var row=entry.getValue();var sem=(Map<String,Object>)row.get("semantic");
            if("battle-add".equals(sem.get("kind"))){
                var observations=(List<Map<String,Object>>)row.computeIfAbsent("targetObservations",k->new ArrayList<Map<String,Object>>());
                for(var group:entry.getKey().getAllPrimaryTargetCards().entrySet())for(var c:group.getValue().keySet())if(observations.stream().noneMatch(o->identity(c).equals(o.get("card"))))
                    observations.add(Map.of("card",identity(c),"blueprint",c.getBlueprintId(true),"referenceCardId",Integer.toString(c.getCardId()),"afterDecision",trace.size()-1,"group",group.getKey()));
                if(cards.size()<2)continue;
                assertEquals("Paired addition has two primary targets",2,cards.size());
                sem.put("targets",observations.stream().map(o->o.get("card")).toList());iterator.remove();
            }else{
                assertEquals("Expected exactly one actual primary target",1,cards.size());
                var c=cards.getFirst();sem.put("target",identity(c));
                row.put("targetObservation",Map.of("card",identity(c),"blueprint",c.getBlueprintId(true),"referenceCardId",Integer.toString(c.getCardId()),"afterDecision",trace.size()-1));iterator.remove();
            }
        }
    }
    boolean pairedHeroesReady(){
        var chars=state().getAllPermanentCards().stream().filter(c->c.getZone()==Zone.AT_LOCATION&&c.getOwner().equals("light")).toList();
        return chars.stream().anyMatch(luke->luke.getBlueprintId(true).equals("101_2")&&chars.stream().anyMatch(partner->List.of("1_17","1_11").contains(partner.getBlueprintId(true))&&partner.getAtLocation()==luke.getAtLocation()));
    }
    String choose(String side, AwaitingDecision decision) {
        String text=decision.getText().toLowerCase(); var p=decision.getDecisionParameters();
        if (text.contains("select ok to start")) return "0";
        if (text.contains("starting location")) {
            String bp=side.equals("dark")?"1_291":"1_132";
            for(int i=0;i<p.get("blueprintId").length;i++) if(p.get("blueprintId")[i].equals(bp)) return p.get("cardId")[i];
        }
        if (decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE && text.startsWith("on which side of ")){semantic("site-placement",side,null);return "0";}
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("next to (or convert)")){semantic("site-placement",side,card(p.get("cardId")[0]));return p.get("cardId")[0];}
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.equals("choose next card to move away")) {
            var c=card(p.get("cardId")[0]);semantic("escape-card",side,c);((Map<String,Object>)trace.getLast().get("semantic")).put("from",identity(c.getAtLocation()));observingMoves.put(c,trace.getLast());return p.get("cardId")[0];
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("where to move")){semantic(observingMoves.isEmpty()?"move-target":"escape-destination",side,card(p.get("cardId")[0]));return p.get("cardId")[0];}
        if (decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS && text.startsWith("top card") && text.contains("reserve")){semantic("inspection",side,null);return "";}
        if (decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE && text.startsWith("do you want to put ") && text.endsWith(" on your force pile?")){semantic("inspection-force",side,null);return "0";}
        if (decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS && text.equals("verify lost pile after unsuccessful attempt to 'choose card to retrieve'")) {
            assertEquals("0",p.get("min")[0]);assertEquals("0",p.get("max")[0]);semantic("recovery-verify",side,null);return "";
        }
        if (decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS && (text.equals("choose card from lost pile")||text.equals("choose card to retrieve"))) {
            assertEquals("Recovery chooses exactly one card", "1", p.get("min")[0]);
            assertEquals("Recovery chooses exactly one card", "1", p.get("max")[0]);
            var selectable=new ArrayList<Integer>();
            for(int i=0;i<p.get("cardId").length;i++)if("true".equals(p.get("selectable")[i]))selectable.add(i);
            assertEquals("Recovery's forced card must be unambiguous",1,selectable.size());
            semantic("recovery-selection",side,null);return p.get("cardId")[selectable.getFirst()];
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("choose where to place")) {
            assertEquals("Old Ben's original site is the only placement",1,p.get("cardId").length);
            semantic("recovery-placement",side,card(p.get("cardId")[0]));return p.get("cardId")[0];
        }
        if(decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && (text.startsWith("choose character")||text.startsWith("choose luke")||text.startsWith("choose leia")||text.startsWith("choose han")||text.startsWith("choose an imperial")||text.startsWith("choose a rebel"))) {
            int selected=0;while(p.containsKey("selectable")&&!"true".equals(p.get("selectable")[selected]))selected++;
            // Prefer the legal target carrying the most publicly visible equipment.
            if(side.equals("dark"))for(int i=0;i<p.get("cardId").length;i++){
                final var candidate=card(p.get("cardId")[i]);final var current=card(p.get("cardId")[selected]);
                if(state().getAllPermanentCards().stream().filter(c->c.getAttachedTo()==candidate).count()>state().getAllPermanentCards().stream().filter(c->c.getAttachedTo()==current).count())selected=i;
            }
            semantic("interrupt-target",side,card(p.get("cardId")[selected]));return p.get("cardId")[selected];
        }
        if (text.contains("starting interrupt")) return "";
        if (decision.getDecisionType()==AwaitingDecisionType.ARBITRARY_CARDS && text.equals("choose card to put on lost pile")){semantic("loss-order",side,null);return p.get("cardId")[0];}
        if (decision.getDecisionType()==AwaitingDecisionType.MULTIPLE_CHOICE && text.matches("do you want to draw [0-9]+ battle destiny.*")) return "0";
        if (decision.getDecisionType()==AwaitingDecisionType.INTEGER && text.equals("choose amount of force to use")){semantic("reduce-amount",side,null);int amount=Math.min(Integer.parseInt(p.get("defaultValue")[0]),Math.max(0,state().getForcePile(side).size()-2));trace.getLast().put("count",amount);return Integer.toString(amount);}
        if (decision.getDecisionType()==AwaitingDecisionType.INTEGER && text.contains("activate")) {semantic("activate-count",side,null);trace.getLast().put("count",Integer.parseInt(p.get("max")[0]));return p.get("max")[0];}
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("target")) {String chosen=p.get("cardId")[0];semantic("fire-target",side,card(chosen));return chosen;}
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && text.contains("where to deploy")) {
            String selected=p.get("cardId")[0];
            for(String candidate:p.get("cardId")) if(List.of("1_291","1_129").contains(card(candidate).getBlueprintId(true))) selected=candidate;
            // Spread equipment onto the lowest-ability legal carrier, using public values.
            for(String candidate:p.get("cardId"))if(card(candidate).getBlueprint().getCardCategory()==CardCategory.CHARACTER&&card(selected).getBlueprint().getCardCategory()==CardCategory.CHARACTER
                    && game.getModifiersQuerying().getAbility(state(),card(candidate))<game.getModifiersQuerying().getAbility(state(),card(selected)))selected=candidate;

            semantic("deploy-target",side,card(selected));return selected;
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_SELECTION && (text.contains("to lose") || text.contains("to be lost") || text.contains("to forfeit"))) {
            var options=Arrays.stream(p.get("cardId")).map(this::card).filter(Objects::nonNull).sorted(Comparator.comparingInt((PhysicalCard c)->(c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)?0:c.getZone()==Zone.RESERVE_DECK?1:c.getZone()==Zone.USED_PILE?2:c.getZone()==Zone.FORCE_PILE?3:4).thenComparingDouble(c->c.getZone()==Zone.AT_LOCATION?game.getModifiersQuerying().getAbility(state(),c):0).thenComparing(this::identity)).toList();
            if((text.contains("to lose")||text.contains("to be lost")) && !options.isEmpty() && options.stream().allMatch(c->c.getZone()==Zone.AT_LOCATION||c.getZone()==Zone.ATTACHED)) {
                int count=Integer.parseInt(p.get("min")[0]);var selected=options.subList(0,count);semantic("mine-victims",side,null);
                ((Map<String,Object>)trace.getLast().get("semantic")).put("cards",ids(selected));return String.join(",",selected.stream().map(c->Integer.toString(c.getCardId())).toList());
            }
            var selected=options.getFirst();semantic((selected.getZone()==Zone.AT_LOCATION||selected.getZone()==Zone.ATTACHED)?"forfeit":"lose",side,selected);trace.getLast().put("lossZone",selected.getZone().name());return Integer.toString(selected.getCardId());
        }
        if(decision instanceof ActionSelectionDecision && text.contains("required responses")) {
            if(!p.get("actionText")[0].equals("'Explode'"))throw new AssertionError("Unmapped required action: "+gson.toJson(p));
            // Observe the selected action's source identity; never mutate reference state.
            try {var method=ActionSelectionDecision.class.getDeclaredMethod("getSelectedAction",String.class);method.setAccessible(true);
                var selected=(Action)method.invoke(decision,p.get("actionId")[0]);semantic("explode",side,selected.getActionSource());return p.get("actionId")[0];
            }catch(ReflectiveOperationException e){throw new AssertionError(e);}
        }
        if (decision.getDecisionType()==AwaitingDecisionType.CARD_ACTION_CHOICE || decision.getDecisionType()==AwaitingDecisionType.ACTION_CHOICE) {

            String[] actions=p.get("actionText"), actionIds=p.get("actionId"), cards=p.get("cardId");
            var ordered=new ArrayList<Integer>();if(actions!=null)for(int i=0;i<actions.length;i++)ordered.add(i);
            ordered.sort(Comparator.comparingInt(i -> {var c=cards==null?null:card(cards[i]);return c!=null&&c.getBlueprintId(true).equals("101_2")?-1:c==null?3:List.of("1_162","1_322").contains(c.getBlueprintId(true))?0:c.getBlueprint().getCardCategory()==CardCategory.WEAPON?1:2;}));
            for(int i:ordered) {
                String action=actions[i].toLowerCase(); PhysicalCard c=cards==null?null:card(cards[i]);
                if(c!=null&&List.of("1_110","1_76","1_116").contains(c.getBlueprintId(true))&&List.of("add two battle destiny","add battle destiny").contains(action)){semantic("battle-add",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                int turn=state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light");
                if(c!=null&&c.getBlueprintId(true).equals("1_235")&&action.startsWith("cancel ")&&!canceledTurns.contains(turn)){canceledTurns.add(turn);semantic("named-cancel",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("101_3")&&action.equals("move luke to battle")){semantic("run-luke",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("1_98")&&action.equals("move cards with ability away")){semantic("escape",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                if(false&&c!=null&&c.getBlueprintId(true).equals("1_268")&&action.equals("return character to hand")&&state().getAllPermanentCards().stream().anyMatch(v->v.getAttachedTo()!=null&&!v.getAttachedTo().getOwner().equals(side)&&v.getAttachedTo().getBlueprint().getCardCategory()==CardCategory.CHARACTER)){semantic("stun",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("1_84")&&action.equals("cancel and re-draw battle destiny")){semantic("dice",side,c);observeSelectedTarget(decision,actionIds[i]);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("1_269")&&action.equals("switch battle destiny numbers")){semantic("takeel",side,c);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("1_254")&&action.equals("regenerate top-most character")){semantic("kintan",side,c);return actionIds[i];}
                if(c!=null&&c.getBlueprintId(true).equals("1_100")&&action.startsWith("revive ")){
                    String target=null;for(int j=trace.size()-2;j>=0;j--){var sem=trace.get(j).get("semantic");if(sem instanceof Map<?,?> map&&"forfeit".equals(map.get("kind"))&&side.equals(map.get("side"))){target=(String)map.get("card");break;}}
                    assertNotNull("Old Ben has no preceding forfeiture",target);semantic("old-ben",side,c);((Map<String,Object>)trace.getLast().get("semantic")).put("target",target);return actionIds[i];
                }
                if(c!=null&&c.getBlueprintId(true).equals("1_90")&&action.equals("reduce force loss")&&state().getForcePile(side).size()>2){semantic("reduce",side,c);return actionIds[i];}
                if(c!=null&&List.of("1_105","1_249").contains(c.getBlueprintId(true))&&action.startsWith("prevent ")){
                    String target=null;for(int j=trace.size()-2;j>=0;j--){var sem=trace.get(j).get("semantic");if(sem instanceof Map<?,?> map&&"deploy".equals(map.get("kind"))){target=(String)map.get("card");break;}}
                    assertNotNull("Barrier has no preceding deployment",target);semantic("barrier",side,c);((Map<String,Object>)trace.getLast().get("semantic")).put("target",target);return actionIds[i];
                }
                if(action.startsWith("deploy")&&c!=null&&c.getBlueprint().getCardCategory()!=CardCategory.LOCATION&&!List.of("1_162","1_322","101_2","1_17","1_11","1_179").contains(c.getBlueprintId(true))&&state().getForcePile(side).size()<6)continue;
                if(action.startsWith("deploy")&&c!=null&&List.of("1_162","1_322").contains(c.getBlueprintId(true)))continue;
                if(action.startsWith("deploy")&&c!=null&&c.getZone()==Zone.HAND&&c.getBlueprintId(true).equals("1_224")){semantic("macroscan",side,c);return actionIds[i];}
                if(action.startsWith("fire ") && c!=null&&state().getForcePile(side).size()>5){semantic("fire",side,c);return actionIds[i];}
                if(text.contains("optional") || text.contains("response")) continue;
                if((action.startsWith("force drain")||action.startsWith("initiate battle"))&&(state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light")<12||!pairedHeroesReady()&&state().getPlayersLatestTurnNumber("dark")+state().getPlayersLatestTurnNumber("light")<30))continue;
                // Remain at the contested site to create further battle/recovery decisions.
                if(action.startsWith("deploy") && c!=null && c.getZone()==Zone.HAND && c.getBlueprint().getCardCategory()==CardCategory.LOCATION){semantic("site",side,c);return actionIds[i];}
                if(action.equals("activate force") || action.startsWith("force drain") || action.startsWith("initiate battle")) {semantic(action.equals("activate force")?"activate":action.startsWith("force drain")?"drain":"battle",side,c);return actionIds[i];}
                if(action.startsWith("deploy") && c!=null && c.getZone()==Zone.HAND && (c.getBlueprint().getCardCategory()==CardCategory.CHARACTER||c.getBlueprint().getCardCategory()==CardCategory.WEAPON||c.getBlueprint().getCardCategory()==CardCategory.DEVICE)) {deploying=c;semantic(c.getBlueprint().getCardCategory()==CardCategory.CHARACTER?"deploy":"equip",side,c);return actionIds[i];}
                if(action.equals("draw card into hand from force pile") && state().getHand(side).size()<35 && state().getForcePile(side).size()>2) {semantic("draw",side,c);return actionIds[i];}
            }
            semantic("pass",side,null);return "";
        }
        throw new AssertionError("Unmapped decision: "+side+" "+decision.getDecisionType()+" "+decision.getText()+" "+gson.toJson(p));
    }
    @Test public void completeIntroductoryMatch() throws Exception {
        var manifest=JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/paired-battle-manifest.json"))).getAsJsonObject();
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
                feedback.participantDecided(side);d.decisionMade(answer);game.carryOutPendingActionsUntilDecisionNeeded();recordTargets();
                if(row.get("semantic") instanceof Map<?,?> sem && "loss-order".equals(sem.get("kind"))){
                    var added=new ArrayList<>(ids(state().getLostPile(side)));added.removeAll(priorLost);assertFalse(added.isEmpty());
                    var selected=state().getAllPermanentCards().stream().filter(c->identity(c).equals(added.getLast())).findFirst().orElseThrow();
                    assertEquals(d.getDecisionParameters().get("blueprintId")[0],selected.getBlueprintId(true));semantic("loss-order",side,selected);
                }
            }
            assertTrue("Command budget exhausted",game.isFinished());
            assertTrue("Unobserved action target",observingTargets.isEmpty());
            assertTrue("Unobserved movement",observingMoves.isEmpty());
        } finally {
            var result=new LinkedHashMap<String,Object>();result.put("schema",1);result.put("snapshotVersion",5);result.put("deckProfile","paired-battle-v1");result.put("decks",lists);result.put("setup",setup);result.put("trace",trace);result.put("winner",game.getWinner());result.put("finished",game.isFinished());result.put("final",snapshot());
            Files.writeString(Path.of("/opt/gemp-swccg/paired-battle-match-results.json"),gson.toJson(result));
        }
    }
}
