package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.cards.GameConditions;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineDelevarOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/delevar-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var ls=new HashMap<>(Map.of("medic","8_5","fx","3_9","trooper","1_28","second","1_28","luke","1_19","lab","3_60","hoth","3_59","saber","1_157"));var ds=new HashMap<String,String>();for(int i=0;i<10;i++)ds.put("trooper"+i,"1_194");ds.put("vader","1_168");ds.put("saber","1_324");var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(10);s.LSActivateForceCheat(10);return s;}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 boolean available(VirtualTableScenario s){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(s.GetLSCard("medic"),"Place");}
 @Test public void recovery(){for(String mode:new String[]{"use","skip","self","no-fx","fx-lost","source-leaves","target-leaves"}){
  var s=fixture();var medic=s.GetLSCard("medic");var troop=s.GetLSCard("trooper");var fx=s.GetLSCard("fx");var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,medic,troop,s.GetLSCard("second"));if(!mode.equals("no-fx"))s.MoveCardsToLocation(site,fx);for(int i=0;i<10;i++)s.MoveCardsToLocation(site,s.GetDSCard("trooper"+i));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToDamageSegment();for(int i=0;i<80&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);assertTrue(s.AwaitingLSBattleDamagePayment());
  var target=mode.equals("self")?medic:mode.equals("fx-lost")?fx:troop;int before=s.GetUnpaidLSBattleDamage();int fv=s.GetForfeit(target);s.LSChooseCard(target);boolean offered=false;
  for(int i=0;i<80;i++){if(available(s)){offered=true;break;}if(s.AwaitingLSBattleDamagePayment())break;pass(s);}
  int force=s.GetLSForcePileCount();if(offered&&!mode.equals("skip")){s.LSUseCardAction(medic,"Place");if(mode.equals("source-leaves"))s.MoveCardsToLSHand(medic);if(mode.equals("target-leaves"))s.MoveCardsToLSHand(target);for(int i=0;i<80&&!s.GetLSUsedPile().contains(target)&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);}
  rows.add(Map.of("name","recovery-"+mode,"offered",offered,"used",s.GetLSUsedPile().contains(target),"lost",s.GetLSLostPile().contains(target),"paid",before-s.GetUnpaidLSBattleDamage(),"forfeit",fv,"forceSpent",force-s.GetLSForcePileCount()));
  if(mode.equals("use")){boolean again=GameConditions.isOncePerTurn(s.game(),medic,VirtualTableScenario.LS,medic.getCardId());s.MoveCardsToLSHand(medic);s.MoveCardsToLocation(site,medic);boolean returned=GameConditions.isOncePerTurn(s.game(),medic,VirtualTableScenario.LS,medic.getCardId());s.game().getModifiersEnvironment().removeEndOfTurnModifiers();rows.add(Map.of("name","usage","again",again,"returned",returned,"nextTurn",GameConditions.isOncePerTurn(s.game(),medic,VirtualTableScenario.LS,medic.getCardId())));}

 }}
 @Test public void protection(){for(String mode:new String[]{"same","other","opponent","lab-hoth","lab-tatooine","away-hoth"}){
  var s=fixture();var medic=s.GetLSCard("medic");var target=mode.equals("opponent")?s.GetDSCard("trooper0"):s.GetLSCard("trooper");s.MoveCardsToLocation(s.GetLSStartingLocation(),medic,target);
  if(mode.equals("other"))s.MoveCardsToLocation(s.GetDSStartingLocation(),medic);
  if(mode.contains("hoth")||mode.startsWith("lab")){s.MoveLocationToTable(s.GetLSCard("lab"));s.MoveLocationToTable(s.GetLSCard("hoth"));if(!mode.equals("away-hoth"))s.MoveCardsToLocation(s.GetLSCard("lab"),medic);if(!mode.equals("lab-tatooine"))s.MoveCardsToLocation(s.GetLSCard("hoth"),target);}
  s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ForfeitModifier(s.GetDSStartingLocation(),target,-1));rows.add(Map.of("name","protection-"+mode,"forfeit",s.GetForfeit(target)));
 }}

 @Test public void lightsaberProtection(){for(boolean late:new boolean[]{false,true}){
  var s=fixture();var medic=s.GetLSCard("medic");var h=s.GetLSCard("trooper");var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,h,s.GetDSCard("vader"));if(!late)s.MoveCardsToLocation(site,medic);var saber=s.GetDSCard("saber");s.AttachCardsTo(s.GetDSCard("vader"),saber);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(saber,"Fire"));i++)pass(s);s.PrepareDSDestiny(3);s.DSUseCardAction(saber,"Fire");s.DSChooseCard(h);for(int i=0;i<100&&!h.isHit();i++)pass(s);assertTrue(h.isHit());if(late)s.MoveCardsToLocation(site,medic);int protectedValue=s.GetForfeit(h);s.MoveCardsToLSHand(medic);rows.add(Map.of("name","saber-"+late,"hit",h.isHit(),"protected",protectedValue,"after",s.GetForfeit(h)));
 }}
}
