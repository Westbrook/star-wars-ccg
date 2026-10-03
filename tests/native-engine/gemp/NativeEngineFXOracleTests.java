package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineFXOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/fx-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void replacement(){for(boolean light:new boolean[]{true,false})for(String mode:new String[]{"same","adjacent","skip","source-leaves"}){
  var ls=new HashMap<>(Map.of("fx","3_9","target","1_28","second","1_28","gun","1_152","adjacent","1_132"));var ds=new HashMap<>(Map.of("fx","3_86","target","1_194","second","1_194","gun","1_317"));for(int i=0;i<10;i++)(light?ds:ls).put("enemy"+i,light?"1_194":"1_28");
  var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(10);s.DSActivateForceCheat(10);var site=s.GetLSStartingLocation();var target=light?s.GetLSCard("target"):s.GetDSCard("target");var second=light?s.GetLSCard("second"):s.GetDSCard("second");var fx=light?s.GetLSCard("fx"):s.GetDSCard("fx");s.MoveCardsToLocation(site,target,second);if(mode.equals("adjacent")){s.MoveLocationToTable(s.GetLSCard("adjacent"));s.MoveCardsToLocation(s.GetLSCard("adjacent"),fx);}else s.MoveCardsToLocation(site,fx);
  for(int i=0;i<10;i++)s.MoveCardsToLocation(site,light?s.GetDSCard("enemy"+i):s.GetLSCard("enemy"+i));var gun=light?s.GetDSCard("gun"):s.GetLSCard("gun");s.AttachCardsTo(light?s.GetDSCard("enemy0"):s.GetLSCard("enemy0"),gun);
  if(light){s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);}else{s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(site);}String firing=light?VirtualTableScenario.DS:VirtualTableScenario.LS;for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(firing)&&(light?s.DSCardActionAvailable(gun,"Fire"):s.LSCardActionAvailable(gun,"Fire")));i++)pass(s);
  if(light){s.PrepareDSDestiny(3);s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);}else{s.PrepareLSDestiny(3);s.LSUseCardAction(gun,"Fire");s.LSChooseCard(target);}for(int i=0;i<100&&!target.isHit();i++)pass(s);assertTrue(target.isHit());s.SkipToDamageSegment();for(int i=0;i<80&&!(light?s.AwaitingLSBattleDamagePayment():s.AwaitingDSBattleDamagePayment());i++)pass(s);int before=light?s.GetUnpaidLSBattleDamage():s.GetUnpaidDSBattleDamage();if(light)s.LSChooseCard(target);else s.DSChooseCard(target);
  String saving=light?VirtualTableScenario.LS:VirtualTableScenario.DS;boolean offered=false;for(int i=0;i<80;i++){if(s.GetDecidingPlayer().equals(saving)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&(light?s.LSCardActionAvailable(fx,"Place"):s.DSCardActionAvailable(fx,"Place"))){offered=true;break;}pass(s);}assertTrue(offered);
  assertEquals(2,before-(light?s.GetUnpaidLSBattleDamage():s.GetUnpaidDSBattleDamage()));assertEquals(Zone.AT_LOCATION,target.getZone());
  if(!mode.equals("skip")){if(light)s.LSUseCardAction(fx,"Place");else s.DSUseCardAction(fx,"Place");if(mode.equals("source-leaves")){if(light)s.MoveCardsToLSHand(fx);else s.MoveCardsToDSHand(fx);}}
  for(int i=0;i<100&&!((light?s.GetLSLostPile():s.GetDSLostPile()).contains(target)||(light?s.GetLSUsedPile():s.GetDSUsedPile()).contains(target));i++)pass(s);
  rows.add(Map.of("name",(light?"light":"dark")+"-"+mode,"used",(light?s.GetLSUsedPile():s.GetDSUsedPile()).contains(target),"lost",(light?s.GetLSLostPile():s.GetDSLostPile()).contains(target),"paid",before-(light?s.GetUnpaidLSBattleDamage():s.GetUnpaidDSBattleDamage())));
 }}
}
