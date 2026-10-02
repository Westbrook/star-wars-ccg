package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineWorseOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/worse-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(boolean battle){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("reduce","1_90","secondReduce","1_90","trooper","1_28")),new HashMap<>(Map.of("card","1_252","second","1_252","a","1_194","b","1_194","c","1_194")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoDSShields,StartingSetup.NoLSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);s.MoveCardsToLSHand(s.GetLSCard("reduce"),s.GetLSCard("secondReduce"));s.MoveCardsToDSHand(s.GetDSCard("card"),s.GetDSCard("second"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("a"));if(battle)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("b"),s.GetDSCard("c"),s.GetLSCard("trooper"));s.SkipToPhase(battle?Phase.BATTLE:Phase.CONTROL);if(battle)s.DSInitiateBattle(s.GetLSStartingLocation());else s.DSForceDrainAt(s.GetLSStartingLocation());return s;
 }
 private void pass(VirtualTableScenario s){String text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
 private void available(VirtualTableScenario s,String who,PhysicalCardImpl card){for(int i=0;i<150&&!(s.GetDecidingPlayer().equals(who)&&(who.equals(VirtualTableScenario.LS)?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card)));i++)pass(s);assertEquals(who,s.GetDecidingPlayer());assertTrue(who.equals(VirtualTableScenario.LS)?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card));}
 private void finish(VirtualTableScenario s,PhysicalCardImpl card){for(int i=0;i<100&&!s.GetDSLostPile().contains(card);i++)pass(s);assertTrue(s.GetDSLostPile().contains(card));}
 private void reduce(VirtualTableScenario s,PhysicalCardImpl card){available(s,VirtualTableScenario.LS,card);s.LSPlayCard(card);s.LSDecided(2);}
 private void cancel(VirtualTableScenario s,PhysicalCardImpl card,int amount){available(s,VirtualTableScenario.DS,card);s.DSPlayCard(card);s.DSDecided(amount);finish(s,card);}
 private float remaining(VirtualTableScenario s,boolean battle){return battle?s.GetUnpaidLSBattleDamage():s.gameState().getTopForceLossState().getLoseForceEffect().getForceLossRemaining(s.game());}
 @Test public void cancellation(){for(boolean battle:new boolean[]{false,true})for(int amount:new int[]{0,1,5}){
  var s=fixture(battle);var card=s.GetDSCard("card");reduce(s,s.GetLSCard("reduce"));int dark=s.GetDSForcePileCount();cancel(s,card,amount);results.add(Map.of("name",(battle?"battle":"drain")+"-cancel-"+amount,"remaining",remaining(s,battle),"darkCost",dark-s.GetDSForcePileCount(),"lightCost",2,"reduceLost",s.GetLSLostPile().contains(s.GetLSCard("reduce")),"sourceLost",true));
 }}
 @Test public void battleResponse(){for(int payments:new int[]{1,2}){
  var s=fixture(true);for(int i=0;i<200&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);for(int p=0;p<payments;p++){s.LSChooseCard(s.GetTopOfLSReserveDeck());if(p+1<payments)for(int i=0;i<100&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);}
  var card=s.GetDSCard("card");available(s,VirtualTableScenario.DS,card);s.DSPlayCard(card);finish(s,card);float first=remaining(s,true);var second=s.GetDSCard("second");available(s,VirtualTableScenario.DS,second);s.DSPlayCard(second);finish(s,second);results.add(Map.of("name","battle-after-"+payments,"remaining",first,"repeatedRemaining",remaining(s,true),"sourceLost",true,"secondLost",true));
 }}
 @Test public void repeatedCancellation(){var s=fixture(false);reduce(s,s.GetLSCard("reduce"));cancel(s,s.GetDSCard("card"),1);reduce(s,s.GetLSCard("secondReduce"));cancel(s,s.GetDSCard("second"),3);results.add(Map.of("name","drain-two-cancels","remaining",remaining(s,false),"lightLost",s.GetLSLostPileCount(),"darkLost",s.GetDSLostPileCount()));}
}
