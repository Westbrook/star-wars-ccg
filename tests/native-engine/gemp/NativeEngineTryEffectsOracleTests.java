package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.CancelsGameTextModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Prepared component board, Force and destiny. Sense/Alter, Effect deployment
 * and forced losses use actual actions. Source changes are named interventions. */
public class NativeEngineTryEffectsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/try-effects-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 boolean can(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&(light?s.LSCardPlayAvailable(c):s.DSCardPlayAvailable(c));}
 void pass(VirtualTableScenario s){try{if(s.AwaitingLSForceLossPayment())s.LSPayForceLossFromReserveDeck();else if(s.AwaitingDSForceLossPayment())s.DSPayForceLossFromReserveDeck();else if(s.GetCurrentDecision().getText().toLowerCase().contains("required responses")){var p=s.GetCurrentDecision().getDecisionParameters();s.PlayerDecided(s.GetDecidingPlayer(),p.get("actionId")[0]);}else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()),e);}}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","trooper","1_28","prep","9_51","sense","1_109","alter","1_71","effect","4_21","other","102_1","die","1_28")),new HashMap<>(Map.of("vader","101_5","prep","9_139","sense","1_267","alter","1_234","effect","4_134","other","102_6","die","1_194")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("luke"),s.GetLSCard("trooper"),s.GetDSCard("vader"));s.MoveCardsToHand(s.GetLSCard("sense"),s.GetDSCard("sense"),s.GetLSCard("alter"),s.GetDSCard("alter"),s.GetLSCard("prep"),s.GetDSCard("prep"),s.GetLSCard("effect"),s.GetDSCard("effect"));return s;}
 @Test public void consequences(){for(boolean light:new boolean[]{false,true})for(String kind:List.of("sense","alter"))for(String effects:List.of("dark","light","both"))for(boolean failure:new boolean[]{false,true}){
  var s=fixture();if(!effects.equals("dark"))s.MoveCardsToSideOfTable(s.GetLSCard("effect"));if(!effects.equals("light"))s.MoveCardsToSideOfTable(s.GetDSCard("effect"));var card=light?s.GetLSCard(kind):s.GetDSCard(kind);var character=light?s.GetLSCard("luke"):s.GetDSCard("vader");int before=light?s.GetLSLostPile().size():s.GetDSLostPile().size();
  if(kind.equals("sense")){
   boolean prepLight=!light;var prep=prepLight?s.GetLSCard("prep"):s.GetDSCard("prep");s.SkipToPhase(Phase.BATTLE);if(prepLight)s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die"));else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));s.DSInitiateBattle(s.GetLSStartingLocation());s.SkipToPowerSegment();
   for(int i=0;i<150&&!can(s,prepLight,prep);i++){if(s.DSDecisionAvailable("battle destiny?")){if(prepLight)s.DSChooseNo();else s.DSChooseYes();}else if(s.LSDecisionAvailable("battle destiny?")){if(prepLight)s.LSChooseYes();else s.LSChooseNo();}else pass(s);}assertTrue(can(s,prepLight,prep));if(prepLight)s.LSPlayCard(prep);else s.DSPlayCard(prep);
  }else{s.MoveCardsToSideOfTable(light?s.GetDSCard("other"):s.GetLSCard("other"));s.SkipToPhase(Phase.CONTROL);}
  for(int i=0;i<100&&!can(s,light,card);i++)pass(s);assertTrue(can(s,light,card));if(light){s.PrepareLSDestiny(failure?6:0);s.LSPlayCard(card);if(kind.equals("alter")&&s.LSHasCardChoiceAvailable(s.GetDSCard("other")))s.LSChooseCard(s.GetDSCard("other"));if(s.LSHasCardChoiceAvailable(character))s.LSChooseCard(character);}else{s.PrepareDSDestiny(failure?6:0);s.DSPlayCard(card);if(kind.equals("alter")&&s.DSHasCardChoiceAvailable(s.GetLSCard("other")))s.DSChooseCard(s.GetLSCard("other"));if(s.DSHasCardChoiceAvailable(character))s.DSChooseCard(character);}
  var losses=new ArrayList<Float>();for(int i=0;i<200&&card.getZone()!=Zone.TOP_OF_LOST_PILE&&card.getZone()!=Zone.LOST_PILE;i++){if(s.AwaitingLSForceLossPayment()||s.AwaitingDSForceLossPayment())losses.add(s.gameState().getTopForceLossState().getLoseForceEffect().getForceLossRemaining(s.game()));pass(s);}assertTrue(card.getZone()==Zone.TOP_OF_LOST_PILE||card.getZone()==Zone.LOST_PILE);
  int delta=(light?s.GetLSLostPile().size():s.GetDSLostPile().size())-before;assertEquals(1+(failure?0:effects.equals("both")?4:2),delta);
  rows.add(Map.of("side",light?"light":"dark","kind",kind,"effects",effects,"failure",failure,"lost",delta,"lossChoices",losses,"interruptZone","lost"));
 }}
 @Test public void deployAndImmunity(){for(boolean light:new boolean[]{false,true}){var s=fixture();var effect=light?s.GetLSCard("effect"):s.GetDSCard("effect");if(light)s.SkipToLSTurn(Phase.DEPLOY);else s.SkipToPhase(Phase.DEPLOY);int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSPlayCard(effect);else s.DSPlayCard(effect);boolean offered=false;for(int i=0;i<80&&effect.getZone()!=Zone.SIDE_OF_TABLE;i++){if(can(s,!light,light?s.GetDSCard("alter"):s.GetLSCard("alter")))offered=true;pass(s);}assertEquals(Zone.SIDE_OF_TABLE,effect.getZone());assertFalse(offered);assertEquals(before,light?s.GetLSForcePileCount():s.GetDSForcePileCount());rows.add(Map.of("side",light?"light":"dark","kind","deployment","cost",0,"alterOffered",offered));}}
 @Test public void subtypeLifetime(){for(boolean light:new boolean[]{false,true})for(String mode:List.of("depart","arrive","suppressed")){
  var s=fixture();var effect=s.GetLSCard("effect");var target=light?s.GetDSCard("other"):s.GetLSCard("other");var card=light?s.GetLSCard("alter"):s.GetDSCard("alter");var character=light?s.GetLSCard("luke"):s.GetDSCard("vader");
  s.MoveCardsToSideOfTable(target);if(!mode.equals("arrive"))s.MoveCardsToSideOfTable(effect);
  s.SkipToPhase(Phase.CONTROL);if(mode.equals("suppressed")){effect.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(s.GetLSStartingLocation(),effect));pass(s);pass(s);}for(int n=0;n<50&&!can(s,light,card);n++)pass(s);assertTrue(can(s,light,card));int before=light?s.GetLSLostPile().size():s.GetDSLostPile().size();
  if(light){s.PrepareLSDestiny(0);s.LSPlayCard(card);if(s.LSHasCardChoiceAvailable(target))s.LSChooseCard(target);if(s.LSHasCardChoiceAvailable(character))s.LSChooseCard(character);}else{s.PrepareDSDestiny(0);s.DSPlayCard(card);if(s.DSHasCardChoiceAvailable(target))s.DSChooseCard(target);if(s.DSHasCardChoiceAvailable(character))s.DSChooseCard(character);}
  assertEquals(Zone.VOID,card.getZone());
  if(mode.equals("depart"))s.MoveCardsToHand(effect);if(mode.equals("arrive"))s.MoveCardsToSideOfTable(effect);
  for(int n=0;n<100&&card.getZone()==Zone.VOID;n++)pass(s);
  var zone=card.getZone();boolean lost=zone==Zone.TOP_OF_LOST_PILE||zone==Zone.LOST_PILE;assertTrue(lost||zone==Zone.TOP_OF_USED_PILE||zone==Zone.USED_PILE);assertEquals("mode="+mode+" side="+light+" canceled="+effect.isGameTextCanceled(),mode.equals("depart"),lost);
  int delta=(light?s.GetLSLostPile().size():s.GetDSLostPile().size())-before;assertEquals(mode.equals("depart")?1:mode.equals("arrive")?2:0,delta);
  rows.add(Map.of("side",light?"light":"dark","kind","lifetime","mode",mode,"lost",delta,"interruptZone",lost?"lost":"used"));
 }}

}
