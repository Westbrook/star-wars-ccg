package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import com.gempukku.swccgo.logic.modifiers.ResetAbilityModifier;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual On The Edge plays; response interventions are explicitly controlled. */
public class NativeEngineEdgeOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/edge-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().contains("Draw destiny?"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void plays(){for(String mode:List.of("one","three","six","equal","low","failed","decline","plans","plans-decline","fenson","depart-before","return-before","depart-after","return-after","low-depart-before","low-return-before","low-return-after","ability-before","fenson-six","plans-fenson-six")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("edge","1_101","target","101_2","a","1_28","b","1_115","c","1_28","d","1_115","e","1_28","f","1_115")),new HashMap<>(Map.of("plans","13_86","fenson","8_108")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);var edge=s.GetLSCard("edge");var target=s.GetLSCard("target");s.MoveCardsToLSHand(edge);s.MoveCardsToLocation(s.GetLSStartingLocation(),target);
  var cards=List.of(s.GetLSCard("a"),s.GetLSCard("b"),s.GetLSCard("c"),s.GetLSCard("d"),s.GetLSCard("e"),s.GetLSCard("f"));for(var c:cards)s.MoveCardsToLSHand(c);for(var c:cards.reversed())s.MoveCardsToTopOfLSLostPile(c);
  while(s.GetLSForcePileCount()<8)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>8)s.LSUseForceCheat(1);
  if(mode.startsWith("plans"))s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));if(mode.contains("fenson"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("fenson"));
  int chosen=mode.equals("one")?1:mode.endsWith("six")?6:3;s.PrepareLSDestiny(mode.equals("equal")?3:mode.startsWith("low")?2:7);if(mode.equals("failed"))s.MoveCardsToLSHand(s.GetLSReserveDeck().toArray(new PhysicalCardImpl[0]));s.SkipToPhase(Phase.DEPLOY);s.DSPass();assertTrue(mode,s.LSCardActionAvailable(edge));s.LSPlayCard(edge);
  boolean changed=false;int number=0,optional=0,payment=0;
  for(int i=0;i<160&&!s.GetLSLostPile().contains(edge);i++){
   String text=s.GetCurrentDecision().getText();System.out.println("EDGE "+mode+" "+s.GetDecidingPlayer()+" "+text);
   if(text.contains("Choose a number")){number++;s.LSDecided(chosen);}
   else if(text.contains("Choose Rebel")){s.LSChooseCard(target);}
   else if(text.contains("Do you want to retrieve")){optional++;if(mode.equals("decline"))s.LSChooseNo();else s.LSChooseYes();}
   else if(text.contains("proceed with Force retrieval")){payment++;if(mode.equals("plans-decline"))s.LSChooseNo();else s.LSChooseYes();}
   else {if(!changed&&((mode.endsWith("before")&&text.contains("Playing"))||(mode.endsWith("after")&&text.contains("DESTINY_DRAWN")))){if(mode.equals("ability-before"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetDSStartingLocation(),target,1));else {s.MoveCardsToLSHand(target);if(mode.contains("return"))s.MoveCardsToLocation(s.GetLSStartingLocation(),target);}changed=true;}pass(s);}
  }
  assertTrue(mode,s.GetLSLostPile().contains(edge));assertEquals(1,number);if(mode.contains("before")||mode.contains("after"))assertTrue(mode,changed);
  results.add(Map.of("name",mode,"chosen",chosen,"retrieved",cards.stream().filter(c->s.GetLSUsedPile().contains(c)).count(),"lostTarget",s.GetLSLostPile().contains(target),"spent",8-s.GetLSForcePileCount(),"optional",optional,"payment",payment,"used",s.GetLSUsedPileCount()));
 }}
}
