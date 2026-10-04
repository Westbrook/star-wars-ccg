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
/** Controlled ion damage uses the exact persistent resets/flags from IonizeStarshipEffect.
 * Droid deployment, required phase timing, response windows and repair execute normally. */
public class NativeEngineRepairOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/repair-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("REPAIR "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));var p=s.GetCurrentDecision().getDecisionParameters();if(s.GetCurrentDecision().getText().toLowerCase().contains("required")&&p.get("actionId")!=null&&p.get("actionId").length>0)s.PlayerDecided(s.GetDecidingPlayer(),p.get("actionId")[0]);else s.PlayerPass(s.GetDecidingPlayer());}
 void deploy(VirtualTableScenario s,boolean dark,PhysicalCardImpl card,PhysicalCardImpl ship){if(dark)s.DSDeployCard(card);else s.LSDeployCard(card);for(int i=0;i<100;i++){if(s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose Deploy action")&&card.getAttachedTo()==ship)return;if(s.GetCurrentDecision().getText().contains("Choose capacity")){if(dark)s.DSChoose("Passenger");else s.LSChoose("Passenger");}else if(s.GetCurrentDecision().getText().contains("Choose where")||s.GetCurrentDecision().getText().contains("Choose target")){if(dark)s.DSChooseCard(ship);else s.LSChooseCard(ship);}else pass(s);}fail("deployment boundary");}
 @Test public void repairs(){for(boolean dark:List.of(false,true))for(String mode:List.of("fighter","capital","landed","off-ship","suppressed","duplicate","undamaged","weapon-leaves")){
  boolean cap=mode.equals("capital")||mode.equals("duplicate");String shipId=cap?(dark?"1_302":"1_140"):(dark?"1_305":"1_147"),droidId=dark?"2_101":"2_15";
  var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();var own=dark?ds:ls;own.put("ship",shipId);own.put("droid",droidId);own.put("second",droidId);ls.put("planet","1_127");(dark?ls:ds).put("weapon",dark?"2_81":"1_318");
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=dark?s.GetDSCard("ship"):s.GetLSCard("ship");var droid=dark?s.GetDSCard("droid"):s.GetLSCard("droid");var second=dark?s.GetDSCard("second"):s.GetLSCard("second");var planet=s.GetLSCard("planet");var weapon=dark?s.GetLSCard("weapon"):s.GetDSCard("weapon");s.MoveLocationToTable(planet);s.MoveCardsToLocation(mode.equals("landed")?s.GetLSStartingLocation():planet,ship);if(dark){s.MoveCardsToDSHand(droid,second);s.DSActivateForceCheat(20);s.SkipToDSTurn(Phase.DEPLOY);}else{s.MoveCardsToLSHand(droid,second);s.LSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);}int before=dark?s.GetDSForcePileCount():s.GetLSForcePileCount();deploy(s,dark,droid,ship);if(mode.equals("duplicate"))deploy(s,dark,second,ship);int cost=before-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount());
  if(dark)s.SkipToDSTurn(Phase.CONTROL);else s.SkipToLSTurn(Phase.CONTROL);
  if(!mode.equals("undamaged")){
   ship.addIonization(IonizationType.DEFENSE_IONIZED);ship.addIonization(IonizationType.HYPERSPEED_IONIZED);
   var a=new ResetArmorModifier(weapon,ship,0);a.skipSettingNotRemovedOnRestoreToNormal();var m=new ResetManeuverModifier(weapon,ship,0);m.skipSettingNotRemovedOnRestoreToNormal();var h=new ResetHyperspeedModifier(weapon,ship,0);h.skipSettingNotRemovedOnRestoreToNormal();s.game().getModifiersEnvironment().addUntilEndOfGameModifier(a);s.game().getModifiersEnvironment().addUntilEndOfGameModifier(m);s.game().getModifiersEnvironment().addUntilEndOfGameModifier(h);
  }
  if(mode.equals("off-ship"))s.MoveCardsToLocation(s.GetLSStartingLocation(),droid);
  if(mode.equals("suppressed")){droid.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,droid));}
  if(mode.equals("weapon-leaves")){if(dark)s.MoveCardsToTopOfLSLostPile(weapon);else s.MoveCardsToTopOfDSLostPile(weapon);}
  var row=new LinkedHashMap<String,Object>();row.put("side",dark?"dark":"light");row.put("mode",mode);row.put("deploymentCost",cost);row.put("beforePower",s.GetPower(ship));row.put("beforeManeuver",s.GetManeuver(ship));row.put("beforeHyperspeed",s.GetHyperspeed(ship));row.put("beforeDefense",s.game().getModifiersQuerying().getDefenseValue(s.gameState(),ship));
  for(int n=0;n<150&&s.gameState().getCurrentPhase()!=Phase.DEPLOY;n++)pass(s);assertEquals(Phase.DEPLOY,s.gameState().getCurrentPhase());row.put("afterPower",s.GetPower(ship));row.put("afterManeuver",s.GetManeuver(ship));row.put("afterHyperspeed",s.GetHyperspeed(ship));row.put("afterDefense",s.game().getModifiersQuerying().getDefenseValue(s.gameState(),ship));row.put("aboard",droid.getAttachedTo()==ship);row.put("droidNavigation",s.game().getModifiersQuerying().hasAstromech(s.gameState(),ship));rows.add(row);
 }}
}
