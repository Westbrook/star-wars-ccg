package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real Takeel plays, with controlled production modifier/cancellation providers. */
public class NativeEngineTakeelOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/takeel-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void takeel(){for(String mode:List.of("normal","dark-two","light-two","cancel-one","cancel-only","substitute","redraw","limited","reserve-one","zero","skip","individual-modifier","total-modifier","repeat")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","trooper","1_28","five","1_115","one","1_28")),new HashMap<>(Map.of("vader","101_5","takeel","1_269","second","1_269","one","1_194","five","1_262","zero","1_284")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.DSActivateForceCheat(5);s.LSActivateForceCheat(5);var site=s.GetLSStartingLocation();var takeel=s.GetDSCard("takeel");s.MoveCardsToLocation(site,s.GetLSCard("luke"),s.GetLSCard("trooper"),s.GetDSCard("vader"));s.MoveCardsToDSHand(takeel,s.GetDSCard("second"),s.GetDSCard("one"),s.GetDSCard("five"),s.GetDSCard("zero"));s.MoveCardsToLSHand(s.GetLSCard("one"),s.GetLSCard("five"));s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.PassBattleStartResponses();
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("five"));s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard(mode.equals("zero")?"zero":"one"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("one"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("five"));
  if(mode.equals("reserve-one"))for(var c:new ArrayList<>(s.GetDSReserveDeck()).subList(1,s.GetDSReserveDeckCount()))s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)c);
  var env=s.game().getModifiersEnvironment();if(Set.of("dark-two","cancel-one","reserve-one","limited").contains(mode))env.addUntilEndOfBattleModifier(new AddsBattleDestinyModifier(site,1,DS));if(mode.equals("light-two"))env.addUntilEndOfBattleModifier(new AddsBattleDestinyModifier(site,1,LS));if(mode.equals("limited"))env.addUntilEndOfBattleModifier(new MayNotDrawMoreThanBattleDestinyModifier(site,1,DS));if(mode.equals("individual-modifier"))env.addUntilEndOfBattleModifier(new EachBattleDestinyModifier(site,2,DS));if(mode.equals("total-modifier")){env.addUntilEndOfBattleModifier(new TotalBattleDestinyModifier(site,2,DS));env.addUntilEndOfBattleModifier(new TotalBattleDestinyModifier(site,4,LS));}
  var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());boolean[] intervened={false},completed={false};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){
   if(!seen.add(e))return null;
   if(e instanceof AboutToDrawDestinyCardResult d&&d.getDestinyType()==DestinyType.BATTLE_DESTINY&&e.getPerformingPlayerId().equals(DS)&&mode.equals("substitute"))g.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().setSubstituteDestiny(4f);
   if(e instanceof DestinyDrawnResult d&&d.getDestinyType()==DestinyType.BATTLE_DESTINY&&e.getPerformingPlayerId().equals(DS)&&!intervened[0]&&Set.of("cancel-one","cancel-only","redraw").contains(mode)){intervened[0]=true;g.getGameState().getTopEachDrawnDestinyState().getDrawDestinyEffect().cancelDestiny(mode.equals("redraw"));}
   if(e.getType()==EffectResult.Type.BATTLE_DESTINY_DRAWS_COMPLETE_FOR_BOTH_PLAYERS)completed[0]=true;
   return null;
  }});
  s.SkipToPowerSegment();
  for(int i=0;i<200&&!completed[0];i++){if(s.DSDecisionAvailable("Do you want to draw")){if(mode.equals("skip"))s.DSChooseNo();else s.DSChooseYes();}else if(s.LSDecisionAvailable("Do you want to draw")){if(mode.equals("skip"))s.LSChooseNo();else s.LSChooseYes();}else pass(s);}
  assertTrue(mode,completed[0]);if(!s.GetDecidingPlayer().equals(DS))pass(s);var b=s.gameState().getBattleState();boolean offered=s.DSCardPlayAvailable(takeel);
  var result=new LinkedHashMap<String,Object>();result.put("name",mode);result.put("offered",offered);result.put("darkCount",b.getNumBattleDestinyDrawn(DS));result.put("lightCount",b.getNumBattleDestinyDrawn(LS));var before=new LinkedHashMap<String,Object>();before.put("dark",b.getNumBattleDestinyDrawn(DS)==0?null:b.getTotalBattleDestiny(s.game(),DS));before.put("light",b.getNumBattleDestinyDrawn(LS)==0?null:b.getTotalBattleDestiny(s.game(),LS));result.put("before",before);
  if(offered){int force=s.GetDSForcePileCount();s.DSPlayCard(takeel);for(int i=0;i<100&&!s.GetDSLostPile().contains(takeel);i++)pass(s);assertTrue(s.GetDSLostPile().contains(takeel));assertEquals(force-1,s.GetDSForcePileCount());}
  if(mode.equals("repeat")){var second=s.GetDSCard("second");for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(DS)&&s.DSCardPlayAvailable(second));i++)pass(s);assertTrue(s.DSCardPlayAvailable(second));int force=s.GetDSForcePileCount();s.DSPlayCard(second);for(int i=0;i<100&&!s.GetDSLostPile().contains(second);i++)pass(s);assertTrue(s.GetDSLostPile().contains(second));assertEquals(force-1,s.GetDSForcePileCount());}
  var after=new LinkedHashMap<String,Object>();after.put("dark",b.getNumBattleDestinyDrawn(DS)==0?null:b.getTotalBattleDestiny(s.game(),DS));after.put("light",b.getNumBattleDestinyDrawn(LS)==0?null:b.getTotalBattleDestiny(s.game(),LS));result.put("after",after);results.add(result);
 }}
}
