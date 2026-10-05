package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineEffectSearchOracleTests {
 @Test public void searches() throws Exception {
  var rows=new ArrayList<Map<String,Object>>();
  for(boolean dark:List.of(false,true))for(boolean empty:List.of(false,true)){
   var s=new VirtualTableScenario(new HashMap<String,String>(Map.of("search","6_77","effect","4_21")),new HashMap<String,String>(Map.of("search","6_160","effect","4_134")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
   s.StartGame();for(int i=0;i<20&&s.gameState().getCurrentPhase()!=Phase.ACTIVATE;i++)s.PlayerPass(s.GetDecidingPlayer());assertEquals(Phase.ACTIVATE,s.gameState().getCurrentPhase());s.DSActivateForceCheat(6);s.LSActivateForceCheat(6);var card=dark?s.GetDSCard("search"):s.GetLSCard("search");var effect=dark?s.GetDSCard("effect"):s.GetLSCard("effect");s.MoveCardsToHand(card);s.SkipToPhase(Phase.CONTROL);if(empty)s.MoveCardsToHand(effect);else if(dark)s.MoveCardsToTopOfDSReserveDeck(effect);else s.MoveCardsToTopOfLSReserveDeck(effect);
   for(int n=0;n<10&&!s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS);n++)s.PlayerPass(s.GetDecidingPlayer());
   int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();if(dark)s.DSUseCardAction(card,"Take card into hand from Reserve Deck");else s.LSUseCardAction(card,"Take card into hand from Reserve Deck");
   var trace=new ArrayList<Map<String,Object>>();
   for(int n=0;n<100&&!(dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card);n++){
    var d=s.GetCurrentDecision();String text=d.getText().toLowerCase();trace.add(Map.of("side",s.GetDecidingPlayer(),"text",d.getText(),"parameters",d.getDecisionParameters()));
    if(!empty&&text.contains("choose")&&text.contains("into hand")){if(dark)s.DSChooseCard(effect);else s.LSChooseCard(effect);}else if(d.getDecisionType()==com.gempukku.swccgo.logic.decisions.AwaitingDecisionType.MULTIPLE_CHOICE)s.PlayerDecided(s.GetDecidingPlayer(),"0");else s.PlayerPass(s.GetDecidingPlayer());
   }
   assertTrue((dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card));assertTrue((dark?s.GetDSHand():s.GetLSHand()).contains(effect));
   rows.add(Map.of("side",dark?"dark":"light","empty",empty,"cost",before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount()),"used",true,"effectInHand",true,"trace",trace));
  }
  Files.writeString(Path.of("/opt/gemp-swccg/effect-search-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
 }
}
