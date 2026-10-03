package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
/** Production card identities, Mos Eisley modifiers and explicitly synthetic
 * keyword modifiers. No rule changes or standalone scenario admission. */
public class NativeEngineCharacteristicsOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/characteristics-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void traits(){
  var ls=new HashMap<String,String>();for(String bp:new String[]{"1_11","5_5","1_4","3_16","3_6","1_147","1_28"})ls.put(bp,bp);
  var ds=new HashMap<String,String>();for(String bp:new String[]{"1_195","1_184","1_171","1_172","3_91","1_194","8_108","8_114","2_108","1_196","1_304"})ds.put(bp,bp);ds.put("mos","1_295");
  var lsKeys=List.copyOf(ls.keySet());var dsKeys=List.copyOf(ds.keySet());
  var s=new VirtualTableScenario(ls,ds,20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("8_161"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);var mos=s.GetDSCard("mos");s.MoveLocationToTable(mos);var q=s.game().getModifiersQuerying();
  for(String side:new String[]{"light","dark"})for(String bp:(side.equals("light")?lsKeys:dsKeys)){
   if(bp.equals("mos"))continue;var c=side.equals("light")?s.GetLSCard(bp):s.GetDSCard(bp);boolean ship=bp.equals("1_147")||bp.equals("1_304");
   if(!ship)s.MoveCardsToLocation(mos,c);
   var row=new TreeMap<String,Object>();row.put("name",bp);row.put("side",side);row.put("spy",Filters.spy.accepts(s.gameState(),q,c));row.put("thief",Filters.thief.accepts(s.gameState(),q,c));row.put("smuggler",Filters.smuggler.accepts(s.gameState(),q,c));row.put("bountyHunter",Filters.bounty_hunter.accepts(s.gameState(),q,c));row.put("gambler",Filters.gambler.accepts(s.gameState(),q,c));row.put("trooper",Filters.trooper.accepts(s.gameState(),q,c));row.put("stormtrooper",Filters.stormtrooper.accepts(s.gameState(),q,c));row.put("raider",Filters.Tusken_Raider.accepts(s.gameState(),q,c));row.put("nonUnique",Filters.non_unique.accepts(s.gameState(),q,c));row.put("reinforcement",(side.equals("light")?Filters.or(Filters.and(Filters.Rebel,Filters.trooper),Filters.Y_wing):Filters.or(Filters.stormtrooper,Filters.TIE_ln)).accepts(s.gameState(),q,c));
   // Dark Forest has the same Dark Force icons, isolating Mos Eisley from Djas's own icon-based power. None of these fixtures is a Yuzzum.
   if(!ship){float power=q.getPower(s.gameState(),c),forfeit=q.getForfeit(s.gameState(),c);s.MoveCardsToLocation(s.GetDSStartingLocation(),c);row.put("powerBonus",power-q.getPower(s.gameState(),c));row.put("forfeitBonus",forfeit-q.getForfeit(s.gameState(),c));}
   results.add(row);
  }
  var target=s.GetDSCard("1_194");s.MoveCardsToLocation(mos,target);var env=s.game().getModifiersEnvironment();
  env.addUntilEndOfTurnModifier(new KeywordModifier(mos,Filters.sameCardId(target),Keyword.SPY));
  results.add(Map.of("name","granted","spy",Filters.spy.accepts(s.gameState(),q,target),"power",q.getPower(s.gameState(),target),"forfeit",q.getForfeit(s.gameState(),target)));
  env.addUntilEndOfTurnModifier(new RemoveKeywordModifier(mos,Filters.sameCardId(target),Keyword.SPY));
  env.addUntilEndOfTurnModifier(new KeywordModifier(mos,Filters.sameCardId(target),Keyword.SPY));
  results.add(Map.of("name","removed-over-grants","spy",Filters.spy.accepts(s.gameState(),q,target),"power",q.getPower(s.gameState(),target),"forfeit",q.getForfeit(s.gameState(),target)));
 }
    private void progress(VirtualTableScenario s, String owner, PhysicalCardImpl... choices) {
        String text=s.GetCurrentDecision().getText().toLowerCase();
        if(s.GetDecidingPlayer().equals(owner) && (text.contains("retrieve") || text.contains("choose character"))) {
            for(var c:choices) {
                if(owner.equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)) {s.LSChooseCard(c);return;}
                if(owner.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)) {s.DSChooseCard(c);return;}
            }
        }
        if(text.contains("optional") || text.contains("response") || text.startsWith("verify lost pile")) {s.PlayerPass(s.GetDecidingPlayer());return;}
        throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());
    }

 @Test public void reinforcementVariants(){for(boolean light:new boolean[]{true,false}){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","a","3_6","b","1_147","other","3_16","reinforce","1_106")),new HashMap<>(Map.of("vader","101_5","a","3_91","b","1_304","other","8_108","reinforce","1_251")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(3);String owner=light?VirtualTableScenario.LS:VirtualTableScenario.DS;
  var card=light?s.GetLSCard("reinforce"):s.GetDSCard("reinforce");var a=light?s.GetLSCard("a"):s.GetDSCard("a");var b=light?s.GetLSCard("b"):s.GetDSCard("b");var otherCard=light?s.GetLSCard("other"):s.GetDSCard("other");
  s.MoveCardsToLocation(s.GetLSStartingLocation(),light?s.GetDSCard("vader"):s.GetLSCard("luke"));
  if(light){s.MoveCardsToTopOfLSLostPile(a);s.MoveCardsToTopOfLSLostPile(b);s.MoveCardsToTopOfLSLostPile(otherCard);s.MoveCardsToLSHand(card);s.PrepareLSDestiny(3);s.DSPass();s.LSPlayCard(card);}
  else{s.MoveCardsToTopOfDSLostPile(a);s.MoveCardsToTopOfDSLostPile(b);s.MoveCardsToTopOfDSLostPile(otherCard);s.MoveCardsToDSHand(card);s.DSActivateForceCheat(3);s.PrepareDSDestiny(3);s.SkipToPhase(Phase.DEPLOY);s.DSPlayCard(card);}
  for(int i=0;i<100&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(card);i++)progress(s,owner,b,a);
  var lost=light?s.GetLSLostPile():s.GetDSLostPile();var used=light?s.GetLSUsedPile():s.GetDSUsedPile();
  org.junit.Assert.assertTrue(lost.contains(card));org.junit.Assert.assertTrue(lost.contains(otherCard));org.junit.Assert.assertTrue(used.contains(a)&&used.contains(b));
  results.add(Map.of("name",light?"light-reinforcements":"dark-reinforcements","retrieved",2,"unmatchedLost",lost.contains(otherCard),"interruptLost",lost.contains(card),"usedOrder",used.stream().filter(c->c==a||c==b).map(c->c==a?"trooper":"ship").toList()));
 }}
}
