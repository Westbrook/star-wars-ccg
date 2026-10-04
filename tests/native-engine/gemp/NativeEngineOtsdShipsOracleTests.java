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
/** Real deployments and resulting modifiers. Setup locations and Force are fixture-controlled. */
public class NativeEngineOtsdShipsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/otsd-ships-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void deployShips(){for(String bp:List.of("106_4","106_7","106_9","106_10","106_13","106_15"))for(boolean home:List.of(false,true)){
  boolean dark=Integer.parseInt(bp.split("_")[1])>=10;String player=dark?VirtualTableScenario.DS:VirtualTableScenario.LS;
  var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();(dark?ds:ls).put("ship",bp);
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation(home?"1_135":"1_127"),StartingSetup.DSStartingLocation(home?"2_143":"1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=dark?s.GetDSCard("ship"):s.GetLSCard("ship");var site=home&&dark?s.GetDSStartingLocation():s.GetLSStartingLocation();s.MoveCardsToHand(ship);s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);if(dark)s.SkipToDSTurn(Phase.DEPLOY);else s.SkipToLSTurn(Phase.DEPLOY);int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();
  if(dark)s.DSDeployCard(ship);else s.LSDeployCard(ship);
  for(int i=0;i<100&&ship.getAtLocation()!=site;i++){if(dark&&(s.DSDecisionAvailable("Choose target")||s.DSDecisionAvailable("Choose where")))s.DSChooseCard(site);else if(!dark&&(s.LSDecisionAvailable("Choose target")||s.LSDecisionAvailable("Choose where")))s.LSChooseCard(site);else pass(s);}assertEquals(site,ship.getAtLocation());
  var row=new LinkedHashMap<String,Object>();row.put("blueprint",bp);row.put("home",home);row.put("deploymentCost",before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount()));row.put("power",s.GetPower(ship));row.put("ability",s.game().getModifiersQuerying().getTotalAbilityAtLocation(s.gameState(),player,site));row.put("piloted",s.game().getModifiersQuerying().isPiloted(s.gameState(),ship,false));rows.add(row);
 }}
 @Test public void fireAndDeploy(){for(String bp:List.of("1_158","1_313","1_323"))for(boolean cap:List.of(false,true))for(int val:List.of(1,3,5)){
  boolean dark=!bp.equals("1_158");String player=dark?VirtualTableScenario.DS:VirtualTableScenario.LS;
  var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();
  ls.put("host",dark?(cap?"1_140":"1_147"):"106_7");ds.put("host",dark?(bp.equals("1_313")?"106_15":"106_13"):(cap?"1_302":"1_305"));
  (dark?ds:ls).put("weapon",bp);(dark?ds:ls).put("second",bp);ls.put("d1",val==1?"1_28":val==3?"1_109":"1_115");ls.put("d2",val==1?"1_28":val==3?"1_109":"1_115");ds.put("d1",val==1?"1_194":val==3?"1_317":"1_262");ds.put("d2",val==1?"1_194":val==3?"1_317":"1_262");
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var host=dark?s.GetDSCard("host"):s.GetLSCard("host");var target=dark?s.GetLSCard("host"):s.GetDSCard("host");var weapon=dark?s.GetDSCard("weapon"):s.GetLSCard("weapon");var second=dark?s.GetDSCard("second"):s.GetLSCard("second");s.MoveCardsToLocation(site,host,target);if(dark)s.MoveCardsToDSHand(weapon);else s.MoveCardsToLSHand(weapon);s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);if(dark)s.SkipToDSTurn(Phase.DEPLOY);else s.SkipToLSTurn(Phase.DEPLOY);int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();
  if(dark)s.DSDeployCard(weapon);else s.LSDeployCard(weapon);
  for(int i=0;i<100&&weapon.getAttachedTo()!=host;i++){if(dark&&(s.DSDecisionAvailable("Choose target")||s.DSDecisionAvailable("Choose where")))s.DSChooseCard(host);else if(!dark&&(s.LSDecisionAvailable("Choose target")||s.LSDecisionAvailable("Choose where")))s.LSChooseCard(host);else pass(s);}assertEquals(host,weapon.getAttachedTo());int deploy=before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount());
  s.AttachCardsTo(host,second);s.SkipToPhase(Phase.BATTLE);if(dark)s.DSInitiateBattle(site);else s.LSInitiateBattle(site);
  for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(player)&&(dark?s.DSCardActionAvailable(weapon,"Fire"):s.LSCardActionAvailable(weapon,"Fire")));i++)pass(s);
  if(dark)s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));else s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("d2"),s.GetLSCard("d1"));before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();
  if(dark){s.DSUseCardAction(weapon,"Fire");s.DSChooseCard(target);}else{s.LSUseCardAction(weapon,"Fire");s.LSChooseCard(target);}
  for(int i=0;i<150&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);assertNull(s.gameState().getWeaponFiringState());
  for(int i=0;i<10&&!s.GetDecidingPlayer().equals(player);i++)pass(s);
  var row=new LinkedHashMap<String,Object>();row.put("blueprint",bp);row.put("capital",cap);row.put("destiny",val);row.put("deploymentCost",deploy);row.put("firingCost",before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount()));row.put("hit",target.isHit());row.put("forfeit",s.game().getModifiersQuerying().getForfeit(s.gameState(),target));row.put("sameWeaponAvailable",dark?s.DSCardActionAvailable(weapon,"Fire"):s.LSCardActionAvailable(weapon,"Fire"));row.put("secondWeaponAvailable",dark?s.DSCardActionAvailable(second,"Fire"):s.LSCardActionAvailable(second,"Fire"));rows.add(row);
 }}
}
