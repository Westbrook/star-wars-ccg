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
public class NativeEngineImmunityOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/immunity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var ls=new HashMap<>(Map.of("hero","101_2","sense","1_109","troop","1_28","yoda","4_2"));var ds=new HashMap<>(Map.of("troop","1_194","second","1_194","other","101_5","card","5_159","copy","5_159"));var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("troop"),s.GetLSCard("hero"));return s;}
 @Test public void queries(){for(String mode:new String[]{"none-add","less-add","less-subtract","less-zero","exact","exact-add","exact-negative","less-higher","exact-higher","equal","both-change","cap","cap-zero","exact-cap","both-cap","full-cap","cancel","uncancelable","no-immunity-uncancelable","yoda"}){
  var s=fixture();var h=mode.equals("yoda")?s.GetLSCard("yoda"):s.GetDSCard("troop");if(mode.equals("yoda"))s.MoveCardsToLocation(s.GetLSStartingLocation(),h);var src=s.GetDSStartingLocation();var env=s.game().getModifiersEnvironment();var q=s.game().getModifiersQuerying();
  if(Set.of("less-add","less-subtract","less-zero","less-higher","exact-higher","equal","both-change","cap","cap-zero","both-cap","cancel","uncancelable").contains(mode))env.addUntilEndOfTurnModifier(new ImmuneToAttritionLessThanModifier(src,h,mode.equals("less-higher")?5:3));
  if(Set.of("exact","exact-add","exact-negative","less-higher","exact-higher","equal","both-change","exact-cap","both-cap").contains(mode))env.addUntilEndOfTurnModifier(new ImmuneToAttritionOfExactlyModifier(src,h,mode.equals("exact-higher")||mode.equals("both-change")?4:3));
  if(Set.of("none-add","less-add","exact-add","both-change").contains(mode))env.addUntilEndOfTurnModifier(new ImmunityToAttritionChangeModifier(src,h,2));
  if(mode.equals("less-subtract"))env.addUntilEndOfTurnModifier(new ImmunityToAttritionChangeModifier(src,h,-1));
  if(mode.equals("less-zero")||mode.equals("exact-negative"))env.addUntilEndOfTurnModifier(new ImmunityToAttritionChangeModifier(src,h,-5));
  if(mode.equals("full-cap"))env.addUntilEndOfTurnModifier(new ImmuneToAttritionModifier(src,h));
  if(Set.of("cap","cap-zero","exact-cap","both-cap","full-cap").contains(mode))env.addUntilEndOfTurnModifier(new ImmunityToAttritionLimitedToModifier(src,h,mode.equals("cap-zero")?0:2));
  if(mode.equals("cancel")||mode.equals("uncancelable"))env.addUntilEndOfTurnModifier(new CancelImmunityToAttritionModifier(src,h));
  if(mode.contains("uncancelable"))env.addUntilEndOfTurnModifier(new ImmunityToAttritionMayNotBeCanceledModifier(h,null));
  float less=q.getImmunityToAttritionLessThan(s.gameState(),h),exact=q.getImmunityToAttritionOfExactly(s.gameState(),h);results.add(Map.of("name",mode,"lessThan",less>999?"all":less,"exact",exact,"hasAny",q.hasAnyImmunityToAttrition(s.gameState(),h)));
 }}
 @Test public void completeAssaultBattle(){
  var s=fixture();var c=s.GetDSCard("card");var t=s.GetDSCard("troop");var vader=s.GetDSCard("other");s.MoveCardsToLocation(s.GetLSStartingLocation(),vader,s.GetLSCard("troop"));s.MoveCardsToDSHand(c);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<20&&!available(s,c);i++)pass(s);assertTrue(available(s,c));s.DSPlayCard(c);for(int i=0;i<80&&!s.GetDSUsedPile().contains(c);i++)pass(s);assertTrue(s.GetDSUsedPile().contains(c));s.PrepareDSDestiny(0);s.PrepareLSDestiny(7);
  for(int i=0;i<100&&!s.AwaitingDSAttritionPayment();i++){if(s.GetCurrentDecision().getText().contains("battle destiny?"))s.PlayerChooseYes(s.GetDecidingPlayer());else pass(s);}int initial=s.GetUnpaidDSAttrition();s.DSPayAttritionFromCardInPlay(vader);
  for(int i=0;i<80&&s.gameState().getBattleState()!=null;i++)pass(s);assertNull(s.gameState().getBattleState());
  results.add(Map.of("name","assault-complete-battle","initialAttrition",initial,"vaderLost",s.GetDSLostPile().contains(vader),"trooperOnTable",t.getZone()==Zone.AT_LOCATION,"lukeOnTable",s.GetLSCard("hero").getZone()==Zone.AT_LOCATION,"sourceUsed",s.GetDSUsedPile().contains(c)));
 }
 private void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText(),e);}}
 private boolean available(VirtualTableScenario s,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(c);}
 @Test public void assault(){for(String mode:new String[]{"normal","cancel-immunity","second","sense","arrival"}){
  var s=fixture();var c=s.GetDSCard("card");var t=s.GetDSCard("troop");s.MoveCardsToDSHand(c,s.GetDSCard("copy"));s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("other"));s.MoveCardsToLSHand(s.GetLSCard("sense"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<20&&!available(s,c);i++)pass(s);assertTrue(available(s,c));s.DSPlayCard(c);
  if(mode.equals("arrival")){var added=s.GetDSCard("second");s.MoveCardsToLocation(s.GetLSStartingLocation(),added);s.gameState().getBattleState().addParticipant(s.gameState(),added);s.MoveCardsToDSHand(t);s.gameState().getBattleState().removeParticipant(s.gameState(),t);}
  if(mode.equals("cancel-immunity"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelImmunityToAttritionModifier(s.GetDSStartingLocation(),t));
  if(mode.equals("sense")){s.PrepareLSDestiny(0);assertTrue(s.LSCardPlayAvailable(s.GetLSCard("sense")));s.LSPlayCard(s.GetLSCard("sense"));if(s.GetCurrentDecision().getText().contains("highest-ability"))s.LSChooseCard(s.GetLSCard("hero"));}
  for(int i=0;i<80&&!s.GetDSUsedPile().contains(c)&&!s.GetDSLostPile().contains(c);i++)pass(s);
  assertTrue(s.GetDSUsedPile().contains(c)||s.GetDSLostPile().contains(c));
  if(mode.equals("second")){var copy=s.GetDSCard("copy");for(int i=0;i<20&&!available(s,copy);i++)pass(s);assertTrue(available(s,copy));s.DSPlayCard(copy);for(int i=0;i<80&&!s.GetDSUsedPile().contains(copy);i++)pass(s);assertTrue(s.GetDSUsedPile().contains(copy));}
  var q=s.game().getModifiersQuerying();float value=q.getImmunityToAttritionLessThan(s.gameState(),t);var record=new LinkedHashMap<String,Object>(Map.of("name","assault-"+mode,"power",q.getPower(s.gameState(),t),"immune",value>999,"sourceUsed",s.GetDSUsedPile().contains(c),"sourceLost",s.GetDSLostPile().contains(c),"otherPower",q.getPower(s.gameState(),s.GetDSCard("other"))));if(mode.equals("arrival"))record.put("secondPower",q.getPower(s.gameState(),s.GetDSCard("second")));results.add(record);
 }}
}
