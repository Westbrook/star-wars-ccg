package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.CancelsGameTextModifier;
import com.google.gson.GsonBuilder;
import org.junit.Test;import org.junit.AfterClass;
import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
/** Controlled hit/exclusion foundation; actual battle forfeiture selection. No production overrides. */
public class NativeEngineChewbaccaLossOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/chewbacca-loss-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 @Test public void losses(){var helper=new NativeEngineHitDepartureOracleTests();for(String kind:List.of("droid","vehicle"))for(String mode:List.of("forfeit","exclude"))for(boolean canceled:List.of(false,true)){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("chewie","2_3","target",kind.equals("droid")?"1_5":"1_149")),new HashMap<>(Map.of("enemy","1_168")),20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);var site=s.GetLSStartingLocation();var target=s.GetLSCard("target");var chewie=s.GetLSCard("chewie");var enemy=s.GetDSCard("enemy");s.MoveCardsToLocation(site,target,chewie,enemy);
  if(canceled){chewie.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,chewie));}
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassAllResponses();helper.settle(s);var hit=new TopLevelGameTextAction(enemy,VirtualTableScenario.DS,enemy.getCardId());hit.setText("Controlled production hit");hit.appendEffect(new HitCardEffect(hit,target,enemy));helper.inject(s,hit);helper.settle(s);assertTrue(target.isHit());
  if(mode.equals("exclude")){var a=new TopLevelGameTextAction(enemy,VirtualTableScenario.DS,enemy.getCardId());a.setText("Controlled exclusion");a.appendEffect(new ExcludeFromBattleEffect(a,target));helper.inject(s,a);helper.settle(s);}
  else {s.SkipToDamageSegment(false);for(int i=0;i<100&&target.getZone().isInPlay();i++){String t=s.GetCurrentDecision().getText();if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&t.contains("card from battle to forfeit"))s.LSChooseCard(target);else if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&t.contains("Choose Force to lose"))s.DSChooseCard(s.GetTopOfDSReserveDeck());else helper.pass(s);}}
  assertFalse(target.getZone().isInPlay());rows.add(Map.of("kind",kind,"mode",mode,"chewieCanceled",canceled,"zone",target.getZone().name(),"used",s.gameState().getUsedPile(VirtualTableScenario.LS).contains(target),"lost",s.GetLSLostPile().contains(target),"hitAfter",target.isHit()));
 }}
}
