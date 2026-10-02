package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.ForceDrainModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineDoomedOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/doomed-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void pass(VirtualTableScenario s){String t=s.GetCurrentDecision().getText().toLowerCase();if(t.contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else {try{s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(t+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}}
 private VirtualTableScenario fixture(String droid,boolean battle){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("card","1_120","reduce","1_90","droid",droid.equals("r2")?"2_14":"1_5","trooper","1_28")),new HashMap<>(Map.of("a","1_194","b","1_194","c","1_194","d","1_194","worse","1_252")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoDSShields,StartingSetup.NoLSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(5);s.MoveCardsToLSHand(s.GetLSCard("card"),s.GetLSCard("reduce"));s.MoveCardsToDSHand(s.GetDSCard("worse"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("a"));if(!droid.equals("none"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("droid"));else s.MoveCardsToLSHand(s.GetLSCard("droid"));if(battle)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("b"),s.GetDSCard("c"),s.GetDSCard("d"),s.GetLSCard("trooper"));
  while(s.GetLSLifeForceRemaining()>14)s.MoveCardsToLSHand(s.GetTopOfLSReserveDeck());s.SkipToPhase(Phase.CONTROL);var card=s.GetLSCard("card");for(int i=0;i<30&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(card));i++)pass(s);s.LSPlayCard(card);for(int i=0;i<30&&!s.GetLSUsedPile().contains(card);i++)pass(s);assertTrue(s.GetLSUsedPile().contains(card));return s;
 }
 private float remaining(VirtualTableScenario s){var f=s.gameState().getTopForceLossState();return f==null?0:f.getLoseForceEffect().getForceLossRemaining(s.game());}
 private boolean ordinary(VirtualTableScenario s){return s.GetCurrentDecision().getText().toLowerCase().equals("choose control action or pass");}
 private void startDrain(VirtualTableScenario s,int base){s.ApplyAdHocModifier(new ForceDrainModifier(s.GetDSCard("a"),s.GetLSStartingLocation(),base-1,VirtualTableScenario.DS));for(int i=0;i<30&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSForceDrainAvailable(s.GetLSStartingLocation()));i++)pass(s);s.DSForceDrainAt(s.GetLSStartingLocation());}
 private void drainFinish(VirtualTableScenario s){for(int i=0;i<120&&!ordinary(s);i++){
  String text=s.GetCurrentDecision().getText().toLowerCase();if(text.startsWith("choose")&&text.contains("lose")&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS))s.LSChooseCard(s.GetTopOfLSReserveDeck());else pass(s);
 }assertTrue("not finished: "+s.GetCurrentDecision().getText(),ordinary(s));}
 @Test public void drainAmounts(){for(String droid:new String[]{"none","c3po","r2"})for(int base:new int[]{1,2,5}){
  var s=fixture(droid,false);startDrain(s,base);int before=s.GetLSLostPileCount();drainFinish(s);results.add(Map.of("name","drain-"+base+"-"+droid,"lost",s.GetLSLostPileCount()-before,"interruptUsed",s.GetLSUsedPile().contains(s.GetLSCard("card"))));
 }}
 @Test public void drainIncrease(){for(String droid:new String[]{"none","c3po"}){
  var s=fixture(droid,false);startDrain(s,3);var reduce=s.GetLSCard("reduce");for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(reduce));i++)pass(s);s.LSPlayCard(reduce);s.LSDecided(1);var worse=s.GetDSCard("worse");for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(worse));i++)pass(s);s.DSPlayCard(worse);s.DSDecided(2);for(int i=0;i<80&&!s.GetDSLostPile().contains(worse);i++)pass(s);results.add(Map.of("name","increase-drain-"+droid,"remaining",remaining(s),"reduceLost",s.GetLSLostPile().contains(reduce),"worseLost",s.GetDSLostPile().contains(worse)));
 }}
 @Test public void battleAmounts(){for(String droid:new String[]{"none","c3po"}){
  var s=fixture(droid,true);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<180&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);int initial=s.GetUnpaidLSBattleDamage();s.LSChooseCard(s.GetTopOfLSReserveDeck());var worse=s.GetDSCard("worse");for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(worse));i++)pass(s);int afterPayment=s.GetUnpaidLSBattleDamage();s.DSPlayCard(worse);for(int i=0;i<80&&!s.GetDSLostPile().contains(worse);i++)pass(s);results.add(Map.of("name","battle-"+droid,"initial",initial,"afterPayment",afterPayment,"afterIncrease",s.GetUnpaidLSBattleDamage()));
 }}
 @Test public void changingRounding(){for(boolean arrival:new boolean[]{false,true})for(int base:new int[]{3,5}){
  var s=fixture(arrival?"none":"c3po",false);startDrain(s,base);
  for(int i=0;i<100&&s.GetLSLostPileCount()==0;i++){String t=s.GetCurrentDecision().getText().toLowerCase();if(t.startsWith("choose")&&t.contains("lose")&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS))s.LSChooseCard(s.GetTopOfLSReserveDeck());else pass(s);}
  assertEquals(1,s.GetLSLostPileCount());if(arrival)s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("droid"));else s.MoveCardsToLSHand(s.GetLSCard("droid"));float pending=remaining(s);drainFinish(s);results.add(Map.of("name",(arrival?"arrive":"depart")+"-"+base,"pending",pending,"lost",s.GetLSLostPileCount()));
 }}
}
