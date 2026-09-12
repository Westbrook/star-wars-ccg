package com.gempukku.swccgo.rules.battle;

import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.communication.GameStateListener;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.game.formats.SwccgoFormatLibrary;
import com.gempukku.swccgo.game.state.GameState;
import com.gempukku.swccgo.logic.decisions.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.vo.SwccgDeck;
import com.google.gson.GsonBuilder;
import org.junit.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Raw authored 60+60 decks. Production setup, conversion, drawing and turn processes.
 * Test-only randomness fixture: seeded java.util.Collections RNG (requires --add-opens).
 * Observer is read-only. No production rule code or game state is patched.
 */
public class NativeProofSetupOracleTests {
    private static final String LS="light", DS="dark";
    private static final long SEED=2026091206L;
    private static final List<Map<String,Object>> RESULTS=new ArrayList<>();
    private static final List<Map<String,Object>> PAIR_RESULTS=new ArrayList<>();
    private static final SwccgCardBlueprintLibrary LIBRARY=new SwccgCardBlueprintLibrary();
    private static final SwccgoFormatLibrary FORMATS=new SwccgoFormatLibrary(LIBRARY);
    private static List<String> deck(String side) throws Exception {
        String line=Files.readAllLines(Path.of("/opt/gemp-swccg/src/db-scripts/sample_decks.sql")).stream()
            .filter(s->s.contains("'Precon Premiere Intro 2PG ("+side+")'")).findFirst().orElseThrow();
        List<String> ids=Arrays.asList(line.substring(line.lastIndexOf("','")+3,line.indexOf('|')).split(","));
        assertEquals(60,ids.size()); return ids;
    }
    @AfterClass public static void writeResults() throws Exception {
        RESULTS.sort(Comparator.comparing(x->(String)x.get("name")));
        Map<String,Object> root=new LinkedHashMap<>();
        root.put("engineCommit","bbd94d183b29c2e82458293df0327c3b946f3d85");
        root.put("testClass","NativeProofSetupOracleTests");
        root.put("randomSeed",SEED);
        root.put("randomFixture","java.util.Collections private Random seeded before DefaultSwccgGame.startGame; all production shuffle calls run unmodified. Observed opening draw is from bottom, followed by reshuffle.");
        root.put("idMapping","l/d + 1-based authored sample_decks.sql list index padded to 3; duplicates assigned in permanent physical-card-id order.");
        root.put("branches",RESULTS);
        PAIR_RESULTS.sort(Comparator.comparing(x->(String)x.get("name")));
        root.put("allInitialPairs",PAIR_RESULTS);
        Files.writeString(Path.of("/opt/gemp-swccg/setup-branches.json"),new GsonBuilder().setPrettyPrinting().create().toJson(root));
    }
    private static class Fixture implements AutoCloseable {
        final DefaultUserFeedback feedback=new DefaultUserFeedback();
        final DefaultSwccgGame game;
        final GameState state;
        final Map<Integer,String> canonical=new LinkedHashMap<>();
        final Map<String,PhysicalCard> physical=new LinkedHashMap<>();
        final List<Map<String,Object>> shuffles=new ArrayList<>();
        final List<Map<String,Object>> decisions=new ArrayList<>();
        final List<String> messages=new ArrayList<>();
        final Map<String,Object> result=new LinkedHashMap<>();
        final Field rng;
        final Object oldRandom;
        boolean observing;
        boolean compact;
        Fixture(String name) throws Exception {
            rng=Collections.class.getDeclaredField("r");rng.setAccessible(true);oldRandom=rng.get(null);rng.set(null,new Random(SEED));
            Map<String,SwccgDeck> decks=new LinkedHashMap<>();
            for(String side:List.of(DS,LS)) {
                var d=new SwccgDeck(side);for(String id:deck(side.equals(LS)?"Light":"Dark"))d.addCard(id);decks.put(side,d);
            }
            game=new DefaultSwccgGame(FORMATS.getFormat("open"),decks,feedback,LIBRARY,Map.of(DS,0,LS,0),false);
            feedback.setGame(game);game.setTestEnvironment(true);game.startGame();state=game.getGameState();
            for(String side:List.of(DS,LS)) {
                var all=new ArrayList<>(state.getAllPermanentCards().stream().filter(c->c.getOwner().equals(side)).toList());
                all.sort(Comparator.comparingInt(PhysicalCard::getPermanentCardId));
                assertEquals(60,all.size());
                var source=deck(side.equals(LS)?"Light":"Dark");
                for(int i=0;i<source.size();i++) {
                    String blueprint=source.get(i);
                    var c=all.stream().filter(x->x.getBlueprintId(true).equals(blueprint)&&!canonical.containsKey(x.getPermanentCardId())).findFirst().orElseThrow();
                    String id=side.charAt(0)+String.format("%03d",i+1);canonical.put(c.getPermanentCardId(),id);physical.put(id,c);
                }
            }
            result.put("name",name);result.put("initialReserve",Map.of(LS,ids(state.getReserveDeck(LS)),DS,ids(state.getReserveDeck(DS))));
            var listener=(GameStateListener)Proxy.newProxyInstance(GameStateListener.class.getClassLoader(),new Class[]{GameStateListener.class},(proxy,method,args)->{
                if(method.getName().equals("hashCode"))return System.identityHashCode(proxy);
                if(method.getName().equals("equals"))return proxy==args[0];
                if(method.getName().equals("toString"))return "ReadOnlySetupObserver";
                if(!observing)return null;
                if(method.getName().equals("sendMessage"))messages.add((String)args[0]);
                if(method.getName().equals("cardCreated")&&Arrays.stream(Thread.currentThread().getStackTrace()).anyMatch(f->f.getClassName().equals(GameState.class.getName())&&f.getMethodName().equals("shufflePile"))) {
                    PhysicalCard card=(PhysicalCard)args[0];String side=card.getOwner();
                    shuffles.add(new LinkedHashMap<>(Map.of("side",side,"reserve",ids(state.getReserveDeck(side)),"hand",ids(state.getHand(side)))));
                }
                return null;
            });
            game.addGameStateListener(DS,listener);observing=true;
            assertConserved();
            for(String side:List.of(DS,LS)) {
                assertTrue(Filters.filter(state.getReserveDeck(side),game,Filters.Objective).isEmpty());
                assertTrue(Filters.filter(state.getReserveDeck(side),game,Filters.Starting_Effect).isEmpty());
                assertTrue(Filters.filter(state.getReserveDeck(side),game,Filters.playableAsStartingInterrupt).isEmpty());
            }
            result.put("noObjectivesStartingEffectsOrStartingInterrupts",true);
            answer(DS,"0");answer(LS,"0");
            assertEquals("Choose starting location",decision(DS).getText());assertEquals("Choose starting location",decision(LS).getText());
            result.put("initialChoices",Map.of(LS,choiceInfo(LS),DS,choiceInfo(DS)));
            result.put("bothChoicesPendingBeforeSelection",true);
        }
        String id(PhysicalCard c){return canonical.get(c.getPermanentCardId());}
        List<String> ids(Collection<? extends PhysicalCard> cards){return cards.stream().map(this::id).toList();}
        AwaitingDecision decision(String side){return feedback.getAwaitingDecision(side);}
        void answer(String side,String response) throws Exception {
            AwaitingDecision d=decision(side);assertNotNull(side+" decision",d);
            var entry=new LinkedHashMap<String,Object>();entry.put("side",side);entry.put("text",d.getText());entry.put("response",response);decisions.add(entry);
            feedback.participantDecided(side);d.decisionMade(response);game.carryOutPendingActionsUntilDecisionNeeded();assertConserved();
        }
        List<PhysicalCard> choices(String side) throws Exception {
            Field field=ArbitraryCardsSelectionDecision.class.getDeclaredField("_physicalCards");field.setAccessible(true);
            return new ArrayList<>((Collection<PhysicalCard>)field.get(decision(side)));
        }
        List<Map<String,Object>> choiceInfo(String side) throws Exception {
            var out=new ArrayList<Map<String,Object>>();for(var c:choices(side))out.add(Map.of("id",id(c),"blueprint",c.getBlueprintId(true),"title",c.getTitle()));return out;
        }
        PhysicalCard choose(String side,String blueprint) throws Exception {
            var possible=choices(side);var c=possible.stream().filter(x->x.getBlueprintId(true).equals(blueprint)).min(Comparator.comparingInt(PhysicalCard::getPermanentCardId)).orElseThrow();
            answer(side,"temp"+possible.indexOf(c));return c;
        }
        PhysicalCard chooseId(String side,String canonicalId) throws Exception {
            var possible=choices(side);var c=physical.get(canonicalId);assertTrue("Requested physical location is offered: "+canonicalId,possible.contains(c));
            answer(side,"temp"+possible.indexOf(c));return c;
        }
        void selectPairIds(String ls,String ds) throws Exception {
            chooseId(DS,ds);
            assertNull(decision(DS));assertEquals("Choose starting location",decision(LS).getText());
            assertEquals(60,state.getReserveDeck(DS).size());assertEquals(60,state.getReserveDeck(LS).size());assertTrue(state.getLocationsInOrder().isEmpty());assertTrue(state.getHand(LS).isEmpty());assertTrue(state.getHand(DS).isEmpty());
            chooseId(LS,ls);
        }
        void selectPair(String ls,String ds) throws Exception {
            choose(DS,ds);
            assertNull(decision(DS));assertEquals("Choose starting location",decision(LS).getText());
            assertEquals(60,state.getReserveDeck(DS).size());assertEquals(60,state.getReserveDeck(LS).size());assertTrue(state.getLocationsInOrder().isEmpty());assertTrue(state.getHand(LS).isEmpty());assertTrue(state.getHand(DS).isEmpty());
            result.put("firstChoiceLeavesAllCardsInReserveAndNothingRevealedOnTable",true);choose(LS,ls);
        }
        void assertConserved() {
            assertEquals(120,state.getAllPermanentCards().size());
            for(String side:List.of(DS,LS)) {
                var cards=state.getAllPermanentCards().stream().filter(c->c.getOwner().equals(side)).toList();assertEquals(60,cards.size());
                assertEquals(60,new HashSet<>(cards.stream().map(PhysicalCard::getPermanentCardId).toList()).size());
                assertTrue(state.getForcePile(side).isEmpty());assertTrue(state.getUsedPile(side).isEmpty());assertTrue(state.getLostPile(side).isEmpty());assertTrue(state.getOutOfPlayPile(side).isEmpty());
            }
        }
        void finish() throws Exception {
            for(int i=0;i<20&&state.getCurrentPhase()!=Phase.ACTIVATE;i++) {
                var side=feedback.getUsersPendingDecision().stream().findFirst().orElseThrow();
                var d=decision(side);if(!compact)System.out.println("FINISH_DECISION "+side+" "+d.getText()+" "+d.getDecisionParameters());
                if(d.getText().startsWith("On which side")) answer(side,"0");
                else if(d.getText().startsWith("Choose a location")) answer(side,"0");
                else throw new AssertionError("Unexpected setup decision: "+d.getText());
            }
            assertEquals(Phase.ACTIVATE,state.getCurrentPhase());assertEquals(DS,state.getCurrentPlayerId());assertEquals(1,state.getPlayersLatestTurnNumber(DS));
            assertEquals(4,shuffles.size());
            for(String side:List.of(DS,LS)) {
                assertEquals(8,state.getHand(side).size());assertEquals(51,state.getReserveDeck(side).size());assertNull(state.getObjectivePlayed(side));assertNull(state.getStartingInterruptPlayed(side));
                var own=shuffles.stream().filter(x->x.get("side").equals(side)).toList();assertEquals(2,own.size());
                var before=(List<String>)own.get(0).get("reserve");assertEquals(59,before.size());
                var expected=new ArrayList<>(before.subList(51,59));Collections.reverse(expected);assertEquals(expected,ids(state.getHand(side)));
                assertEquals(8,((List<?>)own.get(1).get("hand")).size());assertEquals(51,((List<?>)own.get(1).get("reserve")).size());
                assertEquals(own.get(1).get("reserve"),ids(state.getReserveDeck(side)));
            }
            result.put("shuffles",shuffles);result.put("decisions",decisions);result.put("messages",messages);
            result.put("phase",state.getCurrentPhase().name());result.put("active",state.getCurrentPlayerId());result.put("darkTurnNumber",state.getPlayersLatestTurnNumber(DS));
            result.put("hands",Map.of(LS,ids(state.getHand(LS)),DS,ids(state.getHand(DS))));result.put("reserve",Map.of(LS,ids(state.getReserveDeck(LS)),DS,ids(state.getReserveDeck(DS))));
            result.put("generation",Map.of(LS,state.getPlayersTotalForceGeneration(LS),DS,state.getPlayersTotalForceGeneration(DS)));
            var table=new ArrayList<Map<String,Object>>();for(var c:state.getLocationsInOrder())table.add(Map.of("id",id(c),"blueprint",c.getBlueprintId(true),"under",ids(state.getConvertedLocationsUnderTopLocation(c))));result.put("table",table);
            var zones=new LinkedHashMap<String,String>();for(var e:physical.entrySet())zones.put(e.getKey(),e.getValue().getZone().name());result.put("zones",zones);result.put("all120Conserved",true);
            if(!compact){RESULTS.add(result);System.out.println("SETUP_RESULT "+result.get("name")+" "+table+" generation="+result.get("generation"));}
        }
        @Override public void close() throws Exception {rng.set(null,oldRandom);}
    }
    @Test public void allEightyOneInitialPhysicalLocationPairs() throws Exception {
        for(int lightIndex=46;lightIndex<=54;lightIndex++)for(int darkIndex=45;darkIndex<=53;darkIndex++) {
            String lightId="l"+String.format("%03d",lightIndex),darkId="d"+String.format("%03d",darkIndex);
            try(var f=new Fixture(lightId+"-"+darkId)) {
                f.compact=true;
                String lightBlueprint=f.physical.get(lightId).getBlueprintId(true),darkBlueprint=f.physical.get(darkId).getBlueprintId(true);
                boolean sameTitle=f.physical.get(lightId).getTitle().equals(f.physical.get(darkId).getTitle());
                f.selectPairIds(lightId,darkId);
                if(sameTitle){assertTrue(f.decision(DS).getText().startsWith("Both players"));f.answer(DS,"0");}
                f.finish();
                assertEquals(sameTitle?1:2,f.state.getLocationsInOrder().size());
                if(sameTitle){assertEquals(Zone.CONVERTED_LOCATIONS,f.physical.get(darkId).getZone());assertEquals(lightId,f.id(f.state.getLocationsInOrder().get(0)));}
                var compact=new LinkedHashMap<String,Object>();
                compact.put("name",lightId+"-"+darkId);compact.put("chosen",Map.of(LS,lightId,DS,darkId));compact.put("blueprints",Map.of(LS,lightBlueprint,DS,darkBlueprint));
                compact.put("darkAllowsConversion",sameTitle);compact.put("table",f.result.get("table"));compact.put("generation",f.result.get("generation"));
                compact.put("active",f.state.getCurrentPlayerId());compact.put("phase",f.state.getCurrentPhase().name());
                compact.put("counts",Map.of(LS,Map.of("hand",f.state.getHand(LS).size(),"reserve",f.state.getReserveDeck(LS).size()),DS,Map.of("hand",f.state.getHand(DS).size(),"reserve",f.state.getReserveDeck(DS).size())));
                compact.put("all120Conserved",true);PAIR_RESULTS.add(compact);
            }
        }
        assertEquals(81,PAIR_RESULTS.size());System.out.println("SETUP_ALL_PAIRS 81 physical pairs passed; Dark accepts shared-title conversion; first legal placement otherwise");
    }
    @Test public void differentStartingLocations() throws Exception {
        try(var f=new Fixture("distinct-locations")){f.selectPair("1_124","1_291");f.finish();assertEquals(2,f.state.getLocationsInOrder().size());}
    }
    @Test public void darkAllowsConversion() throws Exception {
        try(var f=new Fixture("dark-allows-conversion")){f.selectPair("1_124","1_285");assertTrue(f.decision(DS).getText().startsWith("Both players"));f.answer(DS,"0");f.finish();assertEquals(1,f.state.getLocationsInOrder().size());assertEquals("1_124",f.state.getLocationsInOrder().get(0).getBlueprintId(true));assertEquals(Zone.CONVERTED_LOCATIONS,f.physical.get("d046").getZone());}
    }
    @Test public void lightAllowsConversionAfterDarkDeclines() throws Exception {
        try(var f=new Fixture("light-allows-conversion")){f.selectPair("1_124","1_285");f.answer(DS,"1");assertTrue(f.decision(LS).getText().startsWith("Both players"));f.answer(LS,"0");f.finish();assertEquals(1,f.state.getLocationsInOrder().size());assertEquals("1_285",f.state.getLocationsInOrder().get(0).getBlueprintId(true));assertEquals(Zone.CONVERTED_LOCATIONS,f.physical.get("l046").getZone());}
    }
    @Test public void bothDeclineAndReselectOtherTitles() throws Exception {
        try(var f=new Fixture("both-decline-reselect")){
            f.selectPair("1_124","1_285");f.answer(DS,"1");f.answer(LS,"1");
            assertEquals("Choose starting location",f.decision(DS).getText());assertEquals("Choose starting location",f.decision(LS).getText());
            var choices=Map.of(DS,f.choiceInfo(DS),LS,f.choiceInfo(LS));f.result.put("choicesAfterBothDecline",choices);
            assertFalse(f.choices(DS).stream().anyMatch(c->c.getBlueprintId(true).equals("1_285")));assertFalse(f.choices(LS).stream().anyMatch(c->c.getBlueprintId(true).equals("1_124")));
            assertTrue(f.state.getReserveDeck(DS).contains(f.physical.get("d046")));assertTrue(f.state.getReserveDeck(DS).contains(f.physical.get("d047")));
            f.result.put("gempExcludesAllCopiesOfPreviouslyDeclinedTitle",true);f.selectPair("1_132","1_291");f.finish();assertEquals(2,f.state.getLocationsInOrder().size());
        }
    }
}
