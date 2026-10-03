package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real normal-generation actions, insert resolution and Telepathy; only initial insert depth is controlled. */
public class NativeEngineDeclaredActivationOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/declared-activation-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 @Test public void normalActivation(){for(String mode:List.of("anger","cancel","tremor"))for(int depth:List.of(1,8))for(int count:List.of(1,2)){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("insert",mode.equals("tremor")?"1_42":"4_16")),new HashMap<>(Map.of("telepathy","5_149")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();while(!s.AwaitingDSActivatePhaseActions())s.PlayerPass(s.GetDecidingPlayer());
  var insert=s.GetLSCard("insert");var telepathy=s.GetDSCard("telepathy");s.MoveCardsToDSHand(telepathy);s.gameState().removeCardsFromZone(List.of(insert));insert.setInserted(true);s.gameState().addCardToZone(insert,Zone.RESERVE_DECK,DS);new NativeEngineInsertTimingOracleTests().position(s,DS,depth);
  int before=s.GetDSForcePileCount();s.DSChooseAction("Activate Force");int maximum=s.DSGetChoiceMax();s.DSDecided(count);boolean played=false,revealed=false;int atReveal=-1;String firstPhaseSide="none";var trace=new ArrayList<String>();
  for(int i=0;i<150;i++){
   var d=s.GetCurrentDecision();trace.add(s.GetDecidingPlayer()+":"+d.getText());
   if(insert.isInsertCardRevealed()&&!revealed){revealed=true;atReveal=s.GetDSForcePileCount()-before;}
   if(firstPhaseSide.equals("none")&&d.getText().equals("Choose Activate action or Pass"))firstPhaseSide=s.GetDecidingPlayer().equals(LS)?"light":"dark";
   if(s.AwaitingDSActivatePhaseActions())break;
   if(mode.equals("cancel")&&!played&&s.GetDecidingPlayer().equals(DS)&&d.getDecisionParameters().containsKey("cardId")&&s.DSCardPlayAvailable(telepathy)){s.DSPlayCard(telepathy);played=true;}
   else if(d.getText().contains("Choose amount of Force to allow"))s.PlayerDecided(s.GetDecidingPlayer(),Integer.toString(count));
   else s.PlayerPass(s.GetDecidingPlayer());
  }
  assertTrue(trace.toString(),s.AwaitingDSActivatePhaseActions());int activated=s.GetDSForcePileCount()-before;boolean more=s.DSActionAvailable("Activate Force");int extraMaximum=-1;
  if(more){s.DSChooseAction("Activate Force");extraMaximum=s.DSGetChoiceMax();}
  rows.add(Map.ofEntries(Map.entry("firstPhaseSide",firstPhaseSide),Map.entry("mode",mode),Map.entry("depth",depth),Map.entry("count",count),Map.entry("maximum",maximum),Map.entry("activated",activated),Map.entry("revealedAt",atReveal),Map.entry("more",more),Map.entry("extraMaximum",extraMaximum),Map.entry("insertLost",s.GetLSLostPile().contains(insert)),Map.entry("telepathyUsed",s.GetDSUsedPile().contains(telepathy))));
 }}
}
