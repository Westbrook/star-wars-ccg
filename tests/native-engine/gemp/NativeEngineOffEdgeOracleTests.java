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
/** Real Off The Edge; all direct response/modifier interventions are fixtures. */
public class NativeEngineOffEdgeOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/off-edge-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().contains("Draw destiny?"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void plays(){for(String mode:List.of("retrieve","lose","equal","failed","plans","plans-decline","fenson","fenson-plans","r2-two","r2-five","r2-failed","target-blocked","source-blocked","late-blocked","target-modifier","modifier-after","leave-before","return-before")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("edge","5_59","target",mode.startsWith("r2")?"2_14":"1_31","a","1_28","b","1_115","c","1_28","d","1_115","e","1_28")),new HashMap<>(Map.of("plans","13_86","fenson","8_108")),40,40,StartingSetup.LSStartingLocation("5_79"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);var edge=s.GetLSCard("edge");var target=s.GetLSCard("target");s.MoveCardsToLSHand(edge);s.MoveCardsToLocation(s.GetLSStartingLocation(),target);var cards=List.of(s.GetLSCard("a"),s.GetLSCard("b"),s.GetLSCard("c"),s.GetLSCard("d"),s.GetLSCard("e"));for(var c:cards)s.MoveCardsToLSHand(c);for(var c:cards.reversed())s.MoveCardsToTopOfLSLostPile(c);
  while(s.GetLSForcePileCount()<8)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>8)s.LSUseForceCheat(1);
  if(mode.contains("plans"))s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));if(mode.contains("fenson"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("fenson"));
  if(mode.equals("target-modifier"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new DestinyModifier(s.GetDSStartingLocation(),target,2));
  if(mode.equals("target-blocked"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotContributeToForceRetrievalModifier(s.GetDSStartingLocation(),target));
  int value=mode.equals("lose")?1:mode.equals("equal")?3:mode.startsWith("r2")?3:7;s.PrepareLSDestiny(value);if(mode.endsWith("failed"))s.MoveCardsToLSHand(s.GetLSReserveDeck().toArray(new PhysicalCardImpl[0]));s.SkipToPhase(Phase.DEPLOY);s.DSPass();assertTrue(mode,s.LSCardActionAvailable(edge));s.LSPlayCard(edge);
  boolean changed=false;int choices=0,payment=0;int life=s.GetLSReserveDeckCount()+s.GetLSForcePileCount()+s.GetLSUsedPileCount();
  for(int i=0;i<220&&!s.GetLSLostPile().contains(edge);i++){
   String text=s.GetCurrentDecision().getText();System.out.println("OFFEDGE "+mode+" "+s.GetDecidingPlayer()+" "+text);
   if(text.startsWith("Choose character"))s.LSChooseCard(target);
   else if(text.startsWith("Choose destiny value")){choices++;s.LSDecided(mode.equals("r2-five")?"1":"0");}
   else if(text.contains("proceed with Force retrieval")){payment++;if(mode.equals("plans-decline"))s.LSChooseNo();else s.LSChooseYes();}
   else if(s.AwaitingLSForceLossPayment()){s.LSChooseCard(s.GetTopOfLSReserveDeck());}
   else{
    if(!changed&&((mode.endsWith("before")&&text.contains("Playing"))||(mode.equals("source-blocked")&&text.contains("Playing"))||((mode.equals("modifier-after")||mode.equals("late-blocked"))&&text.contains(mode.equals("late-blocked")?"FORCE_RETRIEVAL_INITIATED":"DESTINY_DRAWN")))){
      if(mode.equals("source-blocked")||mode.equals("late-blocked"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotContributeToForceRetrievalModifier(s.GetDSStartingLocation(),mode.equals("source-blocked")?edge:target));
      else if(mode.equals("modifier-after"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new DestinyModifier(s.GetDSStartingLocation(),target,2));
      else {s.MoveCardsToLSHand(target);if(mode.equals("return-before"))s.MoveCardsToLocation(s.GetLSStartingLocation(),target);}changed=true;
    }pass(s);
   }
  }
  assertTrue(mode,s.GetLSLostPile().contains(edge));if(mode.endsWith("before")||mode.equals("source-blocked")||mode.equals("modifier-after")||mode.equals("late-blocked"))assertTrue(mode,changed);
  int retrieved=(int)cards.stream().filter(c->s.GetLSUsedPile().contains(c)).count();
  results.add(Map.of("name",mode,"retrieved",retrieved,"lostTarget",s.GetLSLostPile().contains(target),"spent",8-s.GetLSForcePileCount(),"valueChoices",choices,"payment",payment,"lostForce",life+retrieved-s.GetLSReserveDeckCount()-s.GetLSForcePileCount()-s.GetLSUsedPileCount()));
 }}
 @Test public void onEdgeRestrictions(){for(String mode:List.of("on-target-blocked","on-source-blocked")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("edge","1_101","target","101_2","lost","1_28")),new HashMap<>(),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);var edge=s.GetLSCard("edge");var target=s.GetLSCard("target");var lost=s.GetLSCard("lost");s.MoveCardsToLSHand(edge,lost);s.MoveCardsToTopOfLSLostPile(lost);s.MoveCardsToLocation(s.GetLSStartingLocation(),target);while(s.GetLSForcePileCount()<2)s.LSActivateForceCheat(1);int force=s.GetLSForcePileCount();
  if(mode.equals("on-target-blocked"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotContributeToForceRetrievalModifier(s.GetDSStartingLocation(),target));
  s.PrepareLSDestiny(3);s.SkipToPhase(Phase.DEPLOY);s.DSPass();s.LSPlayCard(edge);int optional=0;boolean changed=false;
  for(int i=0;i<140&&!s.GetLSLostPile().contains(edge);i++){
   String text=s.GetCurrentDecision().getText();
   if(text.contains("Choose a number"))s.LSDecided(1);
   else if(text.contains("Choose Rebel"))s.LSChooseCard(target);
   else if(text.contains("Do you want to retrieve")){optional++;s.LSChooseYes();}
   else{if(mode.equals("on-source-blocked")&&!changed&&text.contains("Playing")){s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotContributeToForceRetrievalModifier(s.GetDSStartingLocation(),edge));changed=true;}pass(s);}
  }
  assertTrue(s.GetLSLostPile().contains(edge));results.add(Map.of("name",mode,"optional",optional,"retrieved",s.GetLSUsedPile().contains(lost)?1:0,"spent",force-s.GetLSForcePileCount()));
 }}
}
