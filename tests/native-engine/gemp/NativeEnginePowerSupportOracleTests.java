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
public class NativeEnginePowerSupportOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/power-support-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){
  var ls=new HashMap<String,String>(Map.of("power","3_8","second","3_8","fusion","4_13","target","1_18","warrior","1_28","luke","101_2","gun","1_153","die","1_115"));
  var ds=new HashMap<String,String>(Map.of("power","1_175","second","1_175","fusion","3_96","target","1_186","warrior","1_194","vader","1_168","gun","1_312","die","1_262"));
  for(int i=0;i<6;i++){ls.put("extra"+i,"1_28");ds.put("extra"+i,"1_194");}
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(20);s.LSActivateForceCheat(20);return s;
 }
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetCurrentDecision().getText(),e);}}
 @Test public void droidPower(){for(boolean dark:List.of(false,true)){
  var s=fixture();var site=s.GetLSStartingLocation();var p=dark?s.GetDSCard("power"):s.GetLSCard("power");var second=dark?s.GetDSCard("second"):s.GetLSCard("second");var target=dark?s.GetDSCard("target"):s.GetLSCard("target");s.MoveCardsToLocation(site,target);int base=s.GetPower(target);s.MoveCardsToLocation(site,p);int one=s.GetPower(target);s.MoveCardsToLocation(site,second);int two=s.GetPower(target);p.setGameTextCanceled(true);second.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,p));s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,second));rows.add(Map.of("kind","droid","side",dark?"dark":"light","base",base,"one",one,"two",two,"canceled",s.GetPower(target),"self",s.GetPower(p)));
 }}
 @Test public void fusion(){for(boolean dark:List.of(false,true)){
  var s=fixture();var site=s.GetLSStartingLocation();var target=dark?s.GetDSCard("target"):s.GetLSCard("target");var warrior=dark?s.GetDSCard("warrior"):s.GetLSCard("warrior");var fusion=dark?s.GetDSCard("fusion"):s.GetLSCard("fusion");s.MoveCardsToLocation(site,target,warrior);s.AttachCardsTo(warrior,fusion);int base=s.GetPower(target);
  if(dark){s.SkipToDSTurn(Phase.CONTROL);s.DSUseCardAction(fusion,"Add 1");s.DSChooseCard(target);}else{s.SkipToLSTurn(Phase.CONTROL);s.LSUseCardAction(fusion,"Add 1");s.LSChooseCard(target);}
  int enhanced=s.GetPower(target);assertNotNull(fusion.getWhileInPlayData());
  for(int i=0;i<40&&!s.GetDecidingPlayer().equals(dark?s.DS:s.LS);i++)pass(s);
  if(dark)s.DSUseCardAction(fusion,"Stop adding");else s.LSUseCardAction(fusion,"Stop adding");
  for(int i=0;i<40&&fusion.getWhileInPlayData()!=null;i++)pass(s);
  rows.add(Map.of("kind","fusion","side",dark?"dark":"light","base",base,"on",enhanced,"off",s.GetPower(target)));
 }}
 @Test public void rifle(){for(boolean dark:List.of(false,true)){
  var s=fixture();var site=s.GetLSStartingLocation();var own=dark?s.GetDSCard("warrior"):s.GetLSCard("warrior");var target=dark?s.GetLSCard("warrior"):s.GetDSCard("warrior");var fusion=dark?s.GetDSCard("fusion"):s.GetLSCard("fusion");var gun=dark?s.GetDSCard("gun"):s.GetLSCard("gun");s.MoveCardsToLocation(site,own,target);s.AttachCardsTo(own,fusion,gun);
  if(dark){s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(site);}else{s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(site);}
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(dark?s.DS:s.LS)&&(dark?s.DSCardActionAvailable(gun,"Fire"):s.LSCardActionAvailable(gun,"Fire")));i++)pass(s);
  if(dark){s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);}else{s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die"));s.LSUseCardAction(gun,"Fire");s.LSChooseCard(target);}
  for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE");i++)pass(s);
  assertTrue(s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE"));float total=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect().getTotalDestiny(s.game());
  for(int i=0;i<100&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);
  rows.add(Map.of("kind","rifle","side",dark?"dark":"light","total",total,"hit",target.isHit()));
 }}
 @Test public void drawn(){for(boolean dark:List.of(false,true))for(boolean behind:List.of(false,true)){
  var s=fixture();var site=s.GetLSStartingLocation();var own=dark?s.GetDSCard("vader"):s.GetLSCard("luke");var enemy=dark?s.GetLSCard("luke"):s.GetDSCard("vader");var power=dark?s.GetDSCard("power"):s.GetLSCard("power");s.MoveCardsToLocation(site,own,enemy,dark?s.GetDSCard("warrior"):s.GetLSCard("warrior"));
  if(behind)for(int i=0;i<6;i++)s.MoveCardsToLocation(site,dark?s.GetLSCard("extra"+i):s.GetDSCard("extra"+i));
  if(dark){s.SkipToDSTurn(Phase.BATTLE);s.MoveCardsToTopOfDSReserveDeck(power);s.DSInitiateBattle(site);}else{s.SkipToLSTurn(Phase.BATTLE);s.MoveCardsToTopOfLSReserveDeck(power);s.LSInitiateBattle(site);}
  s.SkipToPowerSegment();int before=dark?s.GetDSTotalPower():s.GetLSTotalPower();
  for(int i=0;i<100&&!s.gameState().findCardByPermanentId(power.getPermanentCardId()).getZone().name().contains("USED_PILE");i++){
   String t=s.GetCurrentDecision().getText();
   if(t.toLowerCase().contains("required")&&(dark?s.DSHasCardChoiceAvailable(power):s.LSHasCardChoiceAvailable(power))){if(dark)s.DSChooseCard(power);else s.LSChooseCard(power);continue;}
   if(t.contains("battle destiny?")){if(s.GetDecidingPlayer().equals(dark?s.DS:s.LS)){if(dark)s.DSChooseYes();else s.LSChooseYes();}else s.PlayerChooseNo(s.GetDecidingPlayer());}else pass(s);
  }
  assertTrue(s.gameState().findCardByPermanentId(power.getPermanentCardId()).getZone().name().contains("USED_PILE"));rows.add(Map.of("kind","drawn","side",dark?"dark":"light","behind",behind,"before",before,"after",dark?s.GetDSTotalPower():s.GetLSTotalPower()));
 }}
}
