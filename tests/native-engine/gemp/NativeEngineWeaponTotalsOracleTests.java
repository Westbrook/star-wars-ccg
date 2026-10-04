package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.CancelsGameTextModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineWeaponTotalsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/weapon-total-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("gen","3_61","trench","3_63","warrior","1_28","support","1_28","rifle","1_153","vehicle","1_149","fighter","1_147","gun","3_75","droid","3_8","die","1_115"));var ds=new HashMap<String,String>(Map.of("walker","3_155","gun","3_158","second","3_158","trooper","1_194","ridge","3_149","die","1_262"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("3_59"),StartingSetup.DSStartingLocation("3_144"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");for(String k:List.of("gen","trench"))s.MoveLocationToTable(s.GetLSCard(k));s.MoveLocationToTable(s.GetDSCard("ridge"));s.DSActivateForceCheat(20);s.LSActivateForceCheat(20);return s;}

 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 void run(boolean artillery,String mode){
  var s=fixture();var site=s.GetLSCard("gen");var warrior=s.GetLSCard("warrior");var walker=s.GetDSCard("walker");var gun=artillery?s.GetLSCard("gun"):s.GetDSCard("gun");var victim=artillery?s.GetDSCard("trooper"):warrior;var host=artillery?site:walker;String player=artillery?s.LS:s.DS;
  s.MoveCardsToLocation(site,warrior,walker,s.GetDSCard("trooper"));s.AttachCardsTo(host,gun);
  if(artillery){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(site);}else{s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(site);}
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(player)&&(artillery?s.LSCardActionAvailable(gun,"Fire"):s.DSCardActionAvailable(gun,"Fire")));i++)pass(s);
  if(artillery){s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die"));s.LSUseCardAction(gun,"Fire");}else{s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));s.DSUseCardAction(gun,"Fire");}
  for(int i=0;i<150&&!s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE");i++){
   String t=s.GetCurrentDecision().getText();
   if(t.startsWith("Choose character"))s.LSChooseCard(warrior);else if(t.startsWith("Choose target")){if(artillery)s.LSChooseCard(victim);else s.DSChooseCard(victim);}else pass(s);
  }
  assertTrue(s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE"));var effect=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect();float before=effect.getTotalDestiny(s.game());
  if(mode.equals("leave")||mode.equals("return")){s.MoveCardsToHand(gun);if(mode.equals("return"))s.AttachCardsTo(host,gun);}
  if(mode.equals("cancel")){gun.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,gun));}
  float after=effect.getTotalDestiny(s.game());
  for(int i=0;i<100&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);
  assertNull(s.gameState().getWeaponFiringState());rows.add(Map.of("weapon",artillery?"golan":"cannon","mode",mode,"before",before,"after",after,"hit",victim.isHit()));
 }
 @Test public void cannon(){for(String mode:List.of("stay","leave","cancel","return"))run(false,mode);}
 @Test public void artillery(){for(String mode:List.of("stay","leave","cancel","return"))run(true,mode);}

 @Test public void ships(){for(String bp:List.of("1_159","1_323","1_318"))for(String mode:List.of("stay","leave","cancel","return")){
  boolean dark=!bp.equals("1_159");String player=dark?VirtualTableScenario.DS:VirtualTableScenario.LS;
  var ls=new HashMap<String,String>(Map.of("host",dark?"1_147":"1_140","d1","1_109","d2","1_109"));var ds=new HashMap<String,String>(Map.of("host",dark?"1_302":"1_305","d1","1_317","d2","1_317"));(dark?ds:ls).put("gun",bp);
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var site=s.GetLSStartingLocation();var host=dark?s.GetDSCard("host"):s.GetLSCard("host");var target=dark?s.GetLSCard("host"):s.GetDSCard("host");var gun=dark?s.GetDSCard("gun"):s.GetLSCard("gun");s.MoveCardsToLocation(site,host,target);s.AttachCardsTo(host,gun);s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);
  if(dark){s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(site);}else{s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(site);}
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(player)&&(dark?s.DSCardActionAvailable(gun,"Fire"):s.LSCardActionAvailable(gun,"Fire")));i++)pass(s);
  if(dark){s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);}else{s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("d1"));s.LSUseCardAction(gun,"Fire");s.LSChooseCard(target);}
  for(int i=0;i<150&&!s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE");i++)pass(s);
  assertTrue(s.GetCurrentDecision().getText().contains("DRAWING_DESTINY_COMPLETE"));var effect=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect();float before=effect.getTotalDestiny(s.game());
  if(mode.equals("leave")||mode.equals("return")){s.MoveCardsToHand(gun);if(mode.equals("return"))s.AttachCardsTo(host,gun);}
  if(mode.equals("cancel")){gun.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,gun));}
  float after=effect.getTotalDestiny(s.game());for(int i=0;i<100&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);assertNull(s.gameState().getWeaponFiringState());var row=new LinkedHashMap<String,Object>(Map.of("weapon",bp,"mode",mode,"before",before,"after",after,"hit",target.isHit()));if(bp.equals("1_318"))row.put("ionized",s.game().getModifiersQuerying().getManeuver(s.gameState(),target)==0);rows.add(row);
 }}
}
