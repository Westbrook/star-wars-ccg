package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.decisions.CardActionSelectionDecision;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Foundation oracle: controlled table/Force, injected production effects; no claimed card-play coverage. */
public class NativeEngineHitDepartureOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/hit-departure-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){String t=s.GetCurrentDecision().getText();System.out.println("HIT "+s.GetDecidingPlayer()+" "+t);if(t.contains("Choose card to put on Lost Pile")){s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);return;}if(t.toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
 void inject(VirtualTableScenario s,TopLevelGameTextAction a){var d=(CardActionSelectionDecision)s.GetCurrentDecision();int index=d.getDecisionParameters().get("actionId").length;d.addAction(a);s.PlayerDecided(s.GetDecidingPlayer(),String.valueOf(index));}
 void settle(VirtualTableScenario s){for(int i=0;i<100;i++){String t=s.GetCurrentDecision().getText();if(t.contains("weapons segment")||t.equals("Choose Battle action or Pass"))return;pass(s);}throw new AssertionError("Did not settle "+s.GetCurrentDecision().getText());}
 Map<String,Object> snap(VirtualTableScenario s,PhysicalCard c){Map<String,Object> r=new LinkedHashMap<>();r.put("zone",c.getZone().name());r.put("hit",c.isHit());r.put("participating",Filters.participatingInBattle.accepts(s.gameState(),s.game().getModifiersQuerying(),c));r.put("lost",s.GetLSLostPile().contains(c));r.put("capturedShip",c.isCapturedStarship());r.put("attachedTo",c.getAttachedTo()==null?null:c.getAttachedTo().getBlueprintId(false));return r;}
 @Test public void departure(){for(String mode:List.of("move","restore-move","exclude","capture-character","capture-ship","return-hand")){
  boolean space=mode.equals("capture-ship");var s=new VirtualTableScenario(new HashMap<>(Map.of("target",space?"1_140":"1_28","ally",space?"1_147":"1_19","attachment",space?"1_28":"1_152")),new HashMap<>(Map.of("enemy",space?"1_302":"1_168","beam","2_115")),20,20,StartingSetup.LSStartingLocation(space?"1_127":"1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);var site=s.GetLSStartingLocation();var target=s.GetLSCard("target");var ally=s.GetLSCard("ally");var attachment=s.GetLSCard("attachment");var enemy=s.GetDSCard("enemy");var beam=s.GetDSCard("beam");s.MoveCardsToLocation(site,target,ally,enemy);s.AttachCardsTo(target,attachment);if(space){s.gameState().moveCardToAttachedInPassengerCapacitySlot(attachment,target);s.AttachCardsTo(enemy,beam);}
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassAllResponses();settle(s);
  var hit=new TopLevelGameTextAction(enemy,VirtualTableScenario.DS,enemy.getCardId());hit.setText("Controlled production hit");hit.appendEffect(new HitCardEffect(hit,target,enemy));inject(s,hit);settle(s);assertTrue(mode,target.isHit());assertFalse(mode,s.GetLSLostPile().contains(target));var before=snap(s,target);
  var a=new TopLevelGameTextAction(enemy,VirtualTableScenario.DS,enemy.getCardId());a.setText("Controlled departure "+mode);
  if(mode.equals("restore-move"))a.appendEffect(new RestoreCardToNormalEffect(a,target));
  if(mode.equals("move")||mode.equals("restore-move"))a.appendEffect(new RelocateBetweenLocationsEffect(a,target,s.GetDSStartingLocation()));
  if(mode.equals("exclude"))a.appendEffect(new ExcludeFromBattleEffect(a,target));
  if(mode.equals("capture-character"))a.appendEffect(new CaptureWithSeizureEffect(a,target,enemy));
  if(space)a.appendEffect(new CaptureStarshipEffect(a,target,beam));
  if(mode.equals("return-hand"))a.appendEffect(new ReturnCardToHandFromTableEffect(a,target));
  inject(s,a);settle(s);rows.add(Map.of("mode",mode,"before",before,"after",snap(s,target),"attachmentAfter",snap(s,attachment),"battleContinues",s.gameState().isDuringBattle()));
 }}
}
