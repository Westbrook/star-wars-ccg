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
/** Actual Affect Mind deployments; explicitly synthetic aggregate grants probe
 * unchanged production total/reset/prevention ordering. No rules changes. */
public class NativeEngineLocationAbilityOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/location-ability-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(int count){var ls=new HashMap<String,String>(Map.of("host","1_21","mind","1_43","source","1_53"));var ds=new HashMap<String,String>(Map.of("vader","101_5","molator","1_225","alter","1_234"));for(int i=0;i<4;i++)ds.put("troop"+i,"1_194");var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.LSActivateForceCheat(8);s.DSActivateForceCheat(8);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("host"));for(int i=0;i<count;i++)s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetDSCard("troop"+i));return s;}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private Map<String,Object> snapshot(VirtualTableScenario s,String name){var q=s.game().getModifiersQuerying();var site=s.GetLSStartingLocation();var row=new LinkedHashMap<String,Object>();row.put("name",name);row.put("total",q.getTotalAbilityAtLocation(s.gameState(),VirtualTableScenario.DS,site));row.put("ordinaryPresent",q.getTotalAbilityPresentAtLocation(s.gameState(),VirtualTableScenario.DS,site));row.put("individual",q.getAbility(s.gameState(),s.GetDSCard("troop0")));row.put("lightControls",com.gempukku.swccgo.filters.Filters.controls(VirtualTableScenario.LS).accepts(s.game(),site));row.put("presence",q.hasPresenceAt(s.gameState(),VirtualTableScenario.DS,site,false,null,null));return row;}
 private int startDeploy(VirtualTableScenario s){s.MoveCardsToLSHand(s.GetLSCard("mind"));s.SkipToLSTurn(Phase.DEPLOY);int before=s.GetLSForcePileCount();s.LSPlayCard(s.GetLSCard("mind"));assertTrue(s.GetCurrentDecision().getText().contains("Choose where to deploy"));s.LSChooseCard(s.GetLSCard("host"));return before;}
 @Test public void deployments(){for(int count:new int[]{1,2,3,4}){var s=fixture(count);int before=startDeploy(s);s.PassAllResponses();assertEquals(s.GetLSCard("host"),s.GetLSCard("mind").getAttachedTo());var row=snapshot(s,"deploy-"+count);row.put("spent",before-s.GetLSForcePileCount());row.put("attached",true);results.add(row);}}
 @Test public void darkJedi(){for(String mode:new String[]{"vader","reduced","moved"}){var s=fixture(4);var vader=s.GetDSCard("vader");s.MoveCardsToLocation(s.GetLSStartingLocation(),vader);startDeploy(s);s.PassAllResponses();if(!mode.equals("vader"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetLSStartingLocation(),vader,5));if(mode.equals("moved"))s.MoveCardsToLocation(s.GetDSStartingLocation(),vader);results.add(snapshot(s,mode));}}
 @Test public void targetChangesDuringDeployment(){var s=fixture(4);startDeploy(s);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetLSStartingLocation(),s.GetLSCard("host"),5));s.PassAllResponses();var row=snapshot(s,"target-lowered");row.put("attached",s.GetLSCard("host").equals(s.GetLSCard("mind").getAttachedTo()));row.put("hostAbility",s.game().getModifiersQuerying().getAbility(s.gameState(),s.GetLSCard("host")));results.add(row);}
 @Test public void totalQueries(){for(String mode:new String[]{"add","subtract","zero","reset","minimum-reset","protect","protect-low-reset","protect-high-reset","protect-battle","reset-battle"}){var s=fixture(4);s.MoveCardsToSideOfTable(s.GetLSCard("source"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());s.PassBattleStartResponses();var env=s.game().getModifiersEnvironment();var src=s.GetLSCard("source");var site=s.GetLSStartingLocation();var who=VirtualTableScenario.DS;
 if(mode.equals("add"))env.addUntilEndOfTurnModifier(new TotalAbilityModifier(src,site,2,who));
 if(mode.equals("subtract")||mode.equals("protect"))env.addUntilEndOfTurnModifier(new TotalAbilityModifier(src,site,-2,who));
 if(mode.equals("zero"))env.addUntilEndOfTurnModifier(new TotalAbilityModifier(src,site,-9,who));
 if(mode.equals("reset")){env.addUntilEndOfTurnModifier(new TotalAbilityModifier(src,site,5,who));env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(src,site,1,who));}
 if(mode.equals("minimum-reset")){env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(src,site,2,who));env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(s.GetDSStartingLocation(),site,0.5f,who));}
 if(mode.startsWith("protect"))env.addUntilEndOfTurnModifier(new MayNotHaveTotalAbilityReducedModifier(src,site,who));
 if(mode.equals("protect-low-reset"))env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(src,site,1,who));
 if(mode.equals("protect-high-reset"))env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(src,site,6,who));
 if(mode.equals("protect-battle")||mode.equals("reset-battle"))env.addUntilEndOfTurnModifier(new TotalAbilityForBattleDestinyModifier(src,site,-3,who));
 if(mode.equals("reset-battle"))env.addUntilEndOfTurnModifier(new ResetTotalAbilityModifier(src,site,2,who));
 var row=snapshot(s,"query-"+mode);row.put("battleAbility",s.game().getModifiersQuerying().getTotalAbilityAtLocation(s.gameState(),who,site,false,false,true,who,true,false,null));row.put("draws",s.GetDSBattleDestinyCount());results.add(row);
 }}

 @Test public void molatorAfterMind(){var s=fixture(4);var source=s.GetDSCard("molator");s.MoveCardsToSideOfTable(source);startDeploy(s);s.PassAllResponses();assertEquals(s.GetLSCard("host"),s.GetLSCard("mind").getAttachedTo());s.SkipToPhase(Phase.BATTLE);s.LSInitiateBattle(s.GetLSStartingLocation());s.PassBattleStartResponses();for(int i=0;i<50&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.DSCardActionAvailable(source));i++)pass(s);int before=s.GetDSForcePileCount();s.DSUseCardAction(source);assertEquals(4,s.DSGetChoiceMax());s.DSDecided("4");s.PassAllResponses();var row=snapshot(s,"molator-after-mind");row.put("spent",before-s.GetDSForcePileCount());row.put("power",s.GetDSTotalPower());row.put("draws",s.GetDSBattleDestinyCount());results.add(row);}
}
