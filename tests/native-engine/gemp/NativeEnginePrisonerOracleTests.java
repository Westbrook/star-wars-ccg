package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.decisions.CardActionSelectionDecision;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real battle forfeiture and real We Have A Prisoner card action. Starting
 * placement and temporary reductions are controlled component fixture inputs. */
public class NativeEnginePrisonerOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/prisoner-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{String t=s.GetCurrentDecision().getText();if(t.toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else if(t.contains("Choose card to put on Lost Pile"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetDecidingPlayer().equals(VirtualTableScenario.LS)?s.LSGetCardChoices().getFirst():s.DSGetCardChoices().getFirst());else s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void captureBattleForfeiture(){for(String mode:List.of("Seize","Imprisonment","Escape","loss","cancel")){
  var ds=new HashMap<>(Map.of("card","2_142"));for(int i=0;i<10;i++)ds.put("enemy"+i,"1_194");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("target","1_19","second","1_28","gun","1_152","device","1_40","sense","1_109")),ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(10);s.DSActivateForceCheat(10);var site=mode.equals("Imprisonment")?s.GetDSStartingLocation():s.GetLSStartingLocation();var target=s.GetLSCard("target");var gun=s.GetLSCard("gun");var device=s.GetLSCard("device");var card=s.GetDSCard("card");
  s.MoveCardsToLocation(site,target,s.GetLSCard("second"));s.AttachCardsTo(target,gun,device);for(int i=0;i<10;i++)s.MoveCardsToLocation(site,s.GetDSCard("enemy"+i));s.MoveCardsToDSHand(card);if(mode.equals("cancel"))s.MoveCardsToLSHand(s.GetLSCard("sense"));
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);if(mode.equals("loss")){for(int i=0;i<80&&!s.AwaitingDSWeaponsSegmentActions();i++)pass(s);}else{s.SkipToDamageSegment();for(int i=0;i<80&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);}
  target.setHit(true);int normalForfeit=s.GetForfeit(target),normalPower=s.GetPower(target);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetForfeitModifier(site,target,2));s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new PowerModifier(site,target,-2));
  int damage=mode.equals("loss")?0:s.GetUnpaidLSBattleDamage(),force=s.GetDSForcePileCount();
  if(mode.equals("loss")){var source=s.GetDSCard("enemy0");var a=new TopLevelGameTextAction(source,VirtualTableScenario.DS,source.getCardId());a.setText("Controlled battle loss");a.appendEffect(new LoseCardFromTableEffect(a,target));var d=(CardActionSelectionDecision)s.GetCurrentDecision();int index=d.getDecisionParameters().get("actionId").length;d.addAction(a);s.PlayerDecided(VirtualTableScenario.DS,String.valueOf(index));}else s.LSChooseCard(target);
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(card,"Capture"));i++)pass(s);
  if(!mode.equals("loss"))assertEquals(Math.min(2,damage),damage-s.GetUnpaidLSBattleDamage());s.DSPlayCard(card);s.DSChooseCard(target);
  if(mode.equals("cancel")){
   var sense=s.GetLSCard("sense");s.PrepareLSDestiny(0);for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(sense));i++)pass(s);
   s.LSPlayCard(sense);s.LSChooseCard(target);for(int i=0;i<100&&!(s.GetLSLostPile().contains(target)&&s.GetLSLostPile().contains(gun)&&s.GetLSLostPile().contains(device));i++)pass(s);
   rows.add(Map.of("name","cancel","paid",damage-s.GetUnpaidLSBattleDamage(),"cost",force-s.GetDSForcePileCount(),"lost",s.GetLSLostPile().contains(target),"interruptLost",s.GetDSLostPile().contains(card),"weaponLost",s.GetLSLostPile().contains(gun),"deviceLost",s.GetLSLostPile().contains(device)));continue;
  }
  for(int i=0;i<80&&!s.GetCurrentDecision().getText().contains("Choose option for capturing");i++)pass(s);
  assertFalse(target.isHit());assertEquals(normalForfeit,s.GetForfeit(target));assertEquals(normalPower,s.GetPower(target));assertEquals(1,force-s.GetDSForcePileCount());
  s.DSChoose(mode.equals("loss")?"Seize":mode);
  for(int i=0;i<150&&!(s.GetDSLostPile().contains(card)&&(mode.equals("Escape")?s.GetLSUsedPile().contains(target)&&s.GetLSLostPile().contains(gun)&&s.GetLSLostPile().contains(device):target.isCaptive()));i++){
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getText().contains("escort"))s.DSChooseCard(s.GetDSCard("enemy0"));else pass(s);
  }
  assertTrue(s.GetDSLostPile().contains(card));var r=new LinkedHashMap<String,Object>();r.put("name",mode.toLowerCase());r.put("paid",mode.equals("loss")?0:damage-s.GetUnpaidLSBattleDamage());r.put("cost",force-s.GetDSForcePileCount());r.put("restoredForfeit",normalForfeit);r.put("restoredPower",normalPower);r.put("hit",target.isHit());r.put("captive",target.isCaptive());r.put("imprisoned",target.isImprisoned());r.put("used",s.GetLSUsedPile().contains(target));r.put("weaponLost",s.GetLSLostPile().contains(gun));r.put("deviceLost",s.GetLSLostPile().contains(device));r.put("weaponAttached",gun.getAttachedTo()==target);r.put("deviceAttached",device.getAttachedTo()==target);rows.add(r);
 }}
}
