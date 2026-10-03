package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.ResetAbilityModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual Han's Dice, with controlled response-time target changes. */
public class NativeEngineDiceIdentityOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/dice-identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 @Test public void target(){for(String mode:List.of("stay","depart","return","ability-two","destiny-depart")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","trooper","1_28","dice","1_84","one","1_28","five","1_115")),new HashMap<>(Map.of("vader","101_5")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(3);var luke=s.GetLSCard("luke");var dice=s.GetLSCard("dice");var one=s.GetLSCard("one");var five=s.GetLSCard("five");s.MoveCardsToLocation(s.GetLSStartingLocation(),luke,s.GetLSCard("trooper"),s.GetDSCard("vader"));s.MoveCardsToLSHand(dice);s.MoveCardsToTopOfLSReserveDeck(five);s.MoveCardsToTopOfLSReserveDeck(one);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());s.SkipToPowerSegment();
  for(int i=0;i<50&&!s.LSDecisionAvailable("battle destiny?");i++){if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseNo();else s.PlayerPass(s.GetDecidingPlayer());}s.LSChooseYes();
  for(int i=0;i<30&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(dice));i++)s.PlayerPass(s.GetDecidingPlayer());int force=s.GetLSForcePileCount();s.LSPlayCard(dice);if(s.LSDecisionAvailable("Choose character"))s.LSChooseCard(luke);
  if(mode.equals("depart")||mode.equals("return"))s.MoveCardsToLSHand(luke);if(mode.equals("return"))s.MoveCardsToLocation(s.GetLSStartingLocation(),luke);if(mode.equals("ability-two"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(luke,Filters.sameCardId(luke),2));
  if(mode.equals("destiny-depart"))s.MoveCardsToLSHand(one);
  // Original cleanup is followed by the replacement draw without another choice.
  for(int i=0;i<100&&!s.GetLSUsedPile().contains(five)&&!s.IsReachedDamageSegment();i++)s.PlayerPass(s.GetDecidingPlayer());
  assertTrue(mode,s.GetLSUsedPile().contains(five));assertEquals(!mode.equals("destiny-depart"),s.GetLSUsedPile().contains(one));assertTrue(s.GetLSUsedPile().contains(dice));assertEquals(1,force-s.GetLSForcePileCount());
  rows.add(Map.of("mode",mode,"redrawn",s.GetLSUsedPile().contains(five),"diceUsed",s.GetLSUsedPile().contains(dice),"diceLost",s.GetLSLostPile().contains(dice),"paid",force-s.GetLSForcePileCount(),"originalUsed",s.GetLSUsedPile().contains(one)));
 }}
}
