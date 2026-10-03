package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual Dark Path/Macroscan actions. Controlled insertion/depth/nighttime are explicit fixtures. */
public class NativeEngineReservePeekOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/reserve-peek-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("insert","1_42")),new HashMap<>(Map.of("path","4_133","macro","1_224","insert","1_208")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(5);s.MoveCardsToDSSideOfTable(s.GetDSCard("path"),s.GetDSCard("macro"));return s;}
 void insert(VirtualTableScenario s,PhysicalCard card,String target,int depth){s.gameState().removeCardsFromZone(List.of(card));card.setInserted(true);s.gameState().addCardToZone(card,Zone.RESERVE_DECK,target);new NativeEngineInsertTimingOracleTests().position(s,target,depth);}
 void ready(VirtualTableScenario s,PhysicalCardImpl c){for(int i=0;i<80;i++){if(s.GetDecidingPlayer().equals(DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.DSCardActionAvailable(c))return;pass(s);}fail("No action available");}
 @Test public void darkPath(){for(int count:List.of(1,2,3,6))for(int depth:List.of(-1,1,2))for(int keep:List.of(0,1,2)){
  if(depth>count||count<3&&keep>0)continue;
  var s=fixture();var path=s.GetDSCard("path");var ins=s.GetLSCard("insert");var deck=new ArrayList<>(s.GetDSReserveDeck());for(var c:deck.subList(count,deck.size()))s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)c);if(depth>=0)insert(s,ins,DS,depth);var before=new ArrayList<>(s.GetDSReserveDeck());ready(s,path);s.DSUseCardAction(path);boolean selected=false;
  for(int i=0;i<120;i++){String text=s.GetCurrentDecision().getText();if(text.startsWith("Top card")){assertFalse(selected);selected=true;if(count<3)s.PlayerDecided(DS,"");else{var ids=new ArrayList<String>();for(int n=0;n<3;n++)if(n!=keep)ids.add(s.GetCurrentDecision().getDecisionParameters().get("cardId")[n]);s.PlayerDecided(DS,String.join(",",ids));}}
   else if(text.startsWith("Choose card to put on Lost Pile")){var id=s.GetCurrentDecision().getDecisionParameters().get("cardId")[0];s.PlayerDecided(DS,id);}
   else if(selected&&s.GetDSLostPile().size()==(count<3?0:2)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId"))break;
   else pass(s);
  }
  assertTrue(selected);assertEquals(count<3?0:2,s.GetDSLostPile().size());for(int i=0;i<12;i++)pass(s);
  int remainingDepth=-1;if(ins.isInserted())remainingDepth=s.gameState().getReserveDeck(DS,false).indexOf(ins);
  var row=new LinkedHashMap<String,Object>();row.put("kind","dark-path");row.put("count",count);row.put("depth",depth);row.put("keep",keep);row.put("lost",s.GetDSLostPile().size());row.put("keptOnTop",count<3||s.GetDSReserveDeck().getFirst()==before.get(keep));row.put("insertDepth",remainingDepth);row.put("insertLost",s.GetLSLostPile().contains(ins));row.put("revealed",ins.isInsertCardRevealed());rows.add(row);
 }}
 @Test public void macroscan(){for(int depth:List.of(1,2,3)){
  var s=fixture();var macro=s.GetDSCard("macro");var ins=s.GetDSCard("insert");insert(s,ins,LS,depth);s.game().getModifiersEnvironment().addUntilEndOfGameModifier(new NighttimeConditionsModifier(macro,s.GetLSStartingLocation()));var before=new ArrayList<>(s.GetLSReserveDeck());ready(s,macro);s.DSUseCardAction(macro);for(int i=0;i<80&&!s.GetCurrentDecision().getText().startsWith("Top card");i++)pass(s);assertTrue(s.GetCurrentDecision().getText().startsWith("Top card"));int shown=s.GetCurrentDecision().getDecisionParameters().get("cardId").length;s.PlayerDecided(DS,"");assertEquals(before,s.GetLSReserveDeck());rows.add(Map.of("kind","macroscan","depth",depth,"shown",shown,"insertDepth",s.gameState().getReserveDeck(LS,false).indexOf(ins),"revealed",ins.isInsertCardRevealed()));
 }}
}
