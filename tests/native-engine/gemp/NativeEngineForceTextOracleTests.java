package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.EffectResult;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual card actions; table setup is an explicit fixture intervention. */
public class NativeEngineForceTextOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/force-text-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("hero","1_21","master","4_2","source","102_1","sense","1_109","alter","1_71","shuffle","1_115","troop","1_28","troop2","1_28","assault","1_113")),new HashMap<>(Map.of("hero","101_5","master","9_109","source","102_6","sense","1_267","alter","1_234","shuffle","1_262","troop","1_194","troop2","1_194","assault","1_238")),12,12,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();return s;}
 private String owner(boolean light){return light?VirtualTableScenario.LS:VirtualTableScenario.DS;}
 private PhysicalCardImpl card(VirtualTableScenario s,boolean light,String key){return light?s.GetLSCard(key):s.GetDSCard(key);}
 private void hand(VirtualTableScenario s,boolean light,PhysicalCardImpl... cards){if(light)s.MoveCardsToLSHand(cards);else s.MoveCardsToDSHand(cards);}
 private boolean can(VirtualTableScenario s,boolean light,PhysicalCardImpl card){return s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(light?s.LSCardActionAvailable(card):s.DSCardActionAvailable(card));}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private void ready(VirtualTableScenario s,boolean light,PhysicalCardImpl card){for(int i=0;i<70&&!can(s,light,card);i++)pass(s);assertTrue(can(s,light,card));}
 private void play(VirtualTableScenario s,boolean light,PhysicalCardImpl card){if(light)s.LSPlayCard(card);else s.DSPlayCard(card);}
 private void choose(VirtualTableScenario s,boolean light,PhysicalCardImpl... cards){if(light)s.LSChooseCards(cards);else s.DSChooseCards(cards);}
 private int force(VirtualTableScenario s,boolean light){return light?s.GetLSForcePileCount():s.GetDSForcePileCount();}
 private int reserve(VirtualTableScenario s,boolean light){return light?s.GetLSReserveDeckCount():s.GetDSReserveDeckCount();}
 private boolean used(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return (light?s.GetLSUsedPile():s.GetDSUsedPile()).contains(c);}
 private boolean lost(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return (light?s.GetLSLostPile():s.GetDSLostPile()).contains(c);}
 @Test public void exclusions(){for(boolean light:new boolean[]{true,false})for(String mode:new String[]{"active","suppressed"}){
  var s=fixture();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var site=s.GetLSStartingLocation();var hero=card(s,light,"hero");var master=card(s,light,"master");var troop=card(s,light,"troop");var sense=card(s,light,"sense");var target=card(s,!light,"shuffle");var source=card(s,!light,"source");s.MoveCardsToLocation(site,hero);if(mode.equals("fallback")||mode.equals("fail"))s.MoveCardsToLocation(site,troop);if(mode.equals("multiple")||mode.equals("other"))s.MoveCardsToLocation(site,master);s.MoveCardsToSideOfTable(source);if(mode.equals("suppressed")){source.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new com.gempukku.swccgo.logic.modifiers.CancelsGameTextModifier(site,source));}hand(s,light,sense);hand(s,!light,target);s.SkipToPhase(Phase.CONTROL);if(light)s.PrepareLSDestiny(mode.equals("fail")?3:0);else s.PrepareDSDestiny(mode.equals("fail")?3:0);
  ready(s,!light,target);play(s,!light,target);if(s.GetCurrentDecision().getText().contains("Choose card pile")){var pile=s.gameState().getTopCardsOfPiles(owner(!light)).stream().filter(c->c.getZone()==Zone.TOP_OF_RESERVE_DECK).findFirst().orElseThrow();s.PlayerDecided(owner(!light),String.valueOf(pile.getCardId()));}
  ready(s,light,sense);int before=reserve(s,light);play(s,light,sense);if(s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getText().contains("highest-ability"))choose(s,light,mode.equals("multiple")||mode.equals("other")?master:hero);
  boolean offered=false;for(int i=0;i<180&&!used(s,light,sense);i++){if(can(s,!light,source))offered=true;pass(s);}assertTrue(used(s,light,sense));assertEquals(mode.equals("active"),offered);results.add(Map.of("side",light?"light":"dark","suppressed",mode.equals("suppressed"),"offered",offered));
 }}

}
