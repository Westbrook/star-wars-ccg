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
/** Controlled component boards, actual Disarmed deployment and optional Evazan
 * triggers. No production engine modifications. */
public class NativeEngineDisarmOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/disarm-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));String text=s.GetCurrentDecision().getText().toLowerCase();if(text.equals("choose card to put on lost pile")){s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);}else s.PlayerPass(s.GetDecidingPlayer());}
 boolean lost(PhysicalCardImpl c){return c.getZone()==Zone.LOST_PILE||c.getZone()==Zone.TOP_OF_LOST_PILE;}
 boolean deployable(VirtualTableScenario s,String side,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(side.equals("dark")?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&(side.equals("dark")?s.DSCardActionAvailable(c,"Deploy"):s.LSCardActionAvailable(c,"Deploy"));}
 boolean offered(VirtualTableScenario s,PhysicalCardImpl doctor){return s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(doctor,"'Operate'");}
 VirtualTableScenario fixture(String side,String turn,String mode){
  var ls=new HashMap<String,String>(Map.of("effect","1_48","target","1_28","gun","1_152","spare","1_152","device","1_35","planet","1_127"));var ds=new HashMap<String,String>(Map.of("effect","1_214","target","1_194","gun","1_317","spare","1_317","doctor","1_172","ship","1_302"));
  var s=new VirtualTableScenario(ls,ds,40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetLSCard("target"),s.GetDSCard("target"),s.GetDSCard("doctor"));s.AttachCardsTo(s.GetLSCard("target"),s.GetLSCard("gun"),s.GetLSCard("device"));s.AttachCardsTo(s.GetDSCard("target"),s.GetDSCard("gun"));
  if(mode.equals("two-weapons"))s.AttachCardsTo(side.equals("dark")?s.GetLSCard("target"):s.GetDSCard("target"),side.equals("dark")?s.GetLSCard("spare"):s.GetDSCard("spare"));
  if(side.equals("dark"))s.MoveCardsToDSHand(s.GetDSCard("effect"));else s.MoveCardsToLSHand(s.GetLSCard("effect"));
  if(mode.equals("no-target-gun")){if(side.equals("dark"))s.MoveCardsToLSHand(s.GetLSCard("gun"));else s.MoveCardsToDSHand(s.GetDSCard("gun"));}
  if(turn.equals("dark"))s.SkipToDSTurn(Phase.CONTROL);else s.SkipToLSTurn(Phase.CONTROL);return s;
 }
 @Test public void deploymentAndOperation(){for(String side:List.of("light","dark"))for(String turn:List.of("light","dark"))for(String mode:List.of("normal","two-weapons")){
  var s=fixture(side,turn,mode);var effect=side.equals("dark")?s.GetDSCard("effect"):s.GetLSCard("effect");var target=side.equals("dark")?s.GetLSCard("target"):s.GetDSCard("target");var gun=side.equals("dark")?s.GetLSCard("gun"):s.GetDSCard("gun");var spare=side.equals("dark")?s.GetLSCard("spare"):s.GetDSCard("spare");var doctor=s.GetDSCard("doctor");
  for(int i=0;i<80&&!deployable(s,side,effect);i++)pass(s);assertTrue("Disarmed not offered: "+s.GetCurrentDecision().getText(),deployable(s,side,effect));
  int before=side.equals("dark")?s.GetDSForcePileCount():s.GetLSForcePileCount();if(side.equals("dark")){s.DSDeployCard(effect);s.DSChooseCard(target);}else{s.LSDeployCard(effect);s.LSChooseCard(target);}
  for(int i=0;i<150&&!offered(s,doctor);i++)pass(s);assertTrue("Evazan must see actual Disarmed result",offered(s,doctor));
  var row=new LinkedHashMap<String,Object>();row.put("side",side);row.put("turn",turn);row.put("mode",mode);row.put("cost",before-(side.equals("dark")?s.GetDSForcePileCount():s.GetLSForcePileCount()));row.put("power",s.game().getModifiersQuerying().getPower(s.gameState(),target));row.put("gunLost",gun.getZone()==Zone.LOST_PILE||gun.getZone()==Zone.TOP_OF_LOST_PILE);row.put("spareLost",spare.getZone()==Zone.LOST_PILE||spare.getZone()==Zone.TOP_OF_LOST_PILE);row.put("deviceRetained",s.GetLSCard("device").getAttachedTo()==s.GetLSCard("target"));row.put("operable",true);
  s.DSUseCardAction(doctor,"'Operate'");s.DSChooseCard(target);
  for(int i=0;i<150&&((target.getZone()!=Zone.LOST_PILE&&target.getZone()!=Zone.TOP_OF_LOST_PILE)||(effect.getZone()!=Zone.LOST_PILE&&effect.getZone()!=Zone.TOP_OF_LOST_PILE));i++)pass(s);
  assertTrue(target.getZone()==Zone.LOST_PILE||target.getZone()==Zone.TOP_OF_LOST_PILE);row.put("patientLost",true);row.put("effectLost",effect.getZone()==Zone.LOST_PILE||effect.getZone()==Zone.TOP_OF_LOST_PILE);rows.add(row);
 }}
 @Test public void weaponHit(){for(String mode:List.of("hit","source-left","decline")){
  var s=fixture("dark","dark","normal");var target=s.GetLSCard("target");var gun=s.GetDSCard("gun");var doctor=s.GetDSCard("doctor");s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.DSCardActionAvailable(gun,"Fire"));i++)pass(s);
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("effect"));s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);
  for(int i=0;i<100&&!offered(s,doctor);i++)pass(s);assertTrue(offered(s,doctor));assertTrue(target.isHit());
  if(!mode.equals("decline")){s.DSUseCardAction(doctor,"'Operate'");s.DSChooseCard(target);if(mode.equals("source-left"))s.MoveCardsToDSHand(doctor);for(int i=0;i<100&&!(lost(target)&&lost(s.GetLSCard("gun"))&&lost(s.GetLSCard("device")));i++)pass(s);assertTrue(target.getZone()==Zone.LOST_PILE||target.getZone()==Zone.TOP_OF_LOST_PILE);}
  else {pass(s);for(int i=0;i<100&&!s.AwaitingDSWeaponsSegmentActions()&&!s.AwaitingLSWeaponsSegmentActions();i++)pass(s);assertTrue(target.isHit());assertEquals(Zone.AT_LOCATION,target.getZone());}
  rows.add(Map.of("mode",mode,"operable",true,"patientLost",!mode.equals("decline"),"gunLost",s.GetLSCard("gun").getZone()==Zone.LOST_PILE||s.GetLSCard("gun").getZone()==Zone.TOP_OF_LOST_PILE));
 }}
 @Test public void eligibility(){for(String side:List.of("light","dark")){
 var s=fixture(side,"dark","no-target-gun");var effect=side.equals("dark")?s.GetDSCard("effect"):s.GetLSCard("effect");for(int i=0;i<50&&!(s.GetDecidingPlayer().equals(side.equals("dark")?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose Control action"));i++)pass(s);assertFalse(deployable(s,side,effect));rows.add(Map.of("mode","no-target-gun","side",side,"offered",false));
 }}
 @Test public void pilot(){var s=fixture("dark","dark","normal");var doctor=s.GetDSCard("doctor");var ship=s.GetDSCard("ship");var planet=s.GetLSCard("planet");s.MoveLocationToTable(planet);s.MoveCardsToLocation(planet,ship);s.MoveCardsToDSHand(doctor);s.SkipToDSTurn(Phase.DEPLOY);float before=s.GetPower(ship);int force=s.GetDSForcePileCount();s.DSDeployCard(doctor);
 for(int i=0;i<100&&!(doctor.getAttachedTo()==ship&&s.GetCurrentDecision().getText().contains("Choose Deploy action"));i++){String t=s.GetCurrentDecision().getText();if(t.contains("Choose capacity"))s.DSChoose("Pilot");else if(t.contains("Choose where")||t.contains("Choose target"))s.DSChooseCard(ship);else pass(s);}
 assertEquals(ship,doctor.getAttachedTo());assertEquals(2,s.GetPower(ship)-before,0.01);rows.add(Map.of("mode","pilot","cost",force-s.GetDSForcePileCount(),"bonus",s.GetPower(ship)-before));}
}
