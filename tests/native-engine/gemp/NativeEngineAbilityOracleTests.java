package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.game.state.GameState;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.modifiers.querying.ModifiersQuerying;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Unmodified production queries plus real Effect actions. Synthetic numeric
 * modifier grants and table placement are explicit fixture interventions. */
public class NativeEngineAbilityOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/ability-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();ls.put("hero","1_21");ls.put("source","1_53");ls.put("scramble","4_37");ls.put("sense","1_109");ls.put("droid","1_6");ds.put("source","1_225");ds.put("pilot","1_172");ds.put("vader","1_168");ds.put("shuffle","1_262");for(int i=0;i<4;i++){ls.put("troop"+i,"1_28");ds.put("troop"+i,"1_194");}var s=new VirtualTableScenario(ls,ds,16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);return s;}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private String who(boolean light){return light?VirtualTableScenario.LS:VirtualTableScenario.DS;}
 private boolean can(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(who(light))&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(light?s.LSCardActionAvailable(c):s.DSCardActionAvailable(c));}
 private void ready(VirtualTableScenario s,boolean light,PhysicalCardImpl c){for(int i=0;i<80&&!can(s,light,c);i++)pass(s);assertTrue(s.GetCurrentDecision().getText(),can(s,light,c));}
 private Modifier add(PhysicalCard src,PhysicalCard target,float amount){return new AbstractModifier(src,null,Filters.sameCardId(target),ModifierType.ABILITY){@Override public float getAbilityModifier(GameState gs,ModifiersQuerying q,PhysicalCard c){return amount;}};}
 @Test public void queries(){for(String mode:new String[]{"add","subtract","zero","fraction","double-add","reset","minimum-reset","droid","battle-add","battle-prevent"}){
  var s=fixture();var src=s.GetLSCard("source");var target=s.GetLSCard(mode.equals("droid")?"droid":"hero");s.MoveCardsToSideOfTable(src);s.MoveCardsToLocation(s.GetLSStartingLocation(),target);s.SkipToPhase(Phase.CONTROL);var env=s.game().getModifiersEnvironment();var q=s.game().getModifiersQuerying();
  if(mode.equals("add"))env.addUntilEndOfTurnModifier(add(src,target,2));
  if(mode.equals("subtract"))env.addUntilEndOfTurnModifier(add(src,target,-2));
  if(mode.equals("zero"))env.addUntilEndOfTurnModifier(add(src,target,-9));
  if(mode.equals("fraction"))env.addUntilEndOfTurnModifier(new ResetAbilityModifier(src,target,0.5f));
  if(mode.equals("double-add")||mode.equals("reset")){env.addUntilEndOfTurnModifier(new DoubledModifier(src,target));env.addUntilEndOfTurnModifier(add(src,target,mode.equals("reset")?8:2));}
  if(mode.equals("reset")||mode.equals("minimum-reset"))env.addUntilEndOfTurnModifier(new ResetAbilityModifier(src,target,2));
  if(mode.equals("minimum-reset"))env.addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetDSStartingLocation(),target,4));
  if(mode.equals("droid")){env.addUntilEndOfTurnModifier(new ResetAbilityModifier(src,target,5));env.addUntilEndOfTurnModifier(add(src,target,2));}
  if(mode.startsWith("battle-"))env.addUntilEndOfTurnModifier(new AbilityForBattleDestinyModifier(src,target,2));
  if(mode.equals("battle-prevent"))env.addUntilEndOfTurnModifier(new MayNotApplyAbilityForBattleDestinyModifier(src,target));
  results.add(Map.of("name","query-"+mode,"ability",q.getAbility(s.gameState(),target),"battleAbility",q.getAbilityForBattleDestiny(s.gameState(),target)));
 }}
 @Test public void trade(){for(boolean light:new boolean[]{true,false})for(int amount:new int[]{1,4}){
  var s=fixture();var site=s.GetLSStartingLocation();for(int i=0;i<4;i++)s.MoveCardsToLocation(site,s.GetLSCard("troop"+i),s.GetDSCard("troop"+i));var source=light?s.GetLSCard("source"):s.GetDSCard("source");s.MoveCardsToSideOfTable(source);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);ready(s,light,source);int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSUseCardAction(source);else s.DSUseCardAction(source);assertTrue(s.GetCurrentDecision().getText(),s.GetCurrentDecision().getText().contains("amount of Force"));s.PlayerDecided(who(light),String.valueOf(amount));
  // Stop at the next ordinary weapons opportunity after all paid costs resolve.
  for(int i=0;i<80&&s.GetCurrentDecision().getText().contains("response");i++)pass(s);
  var q=s.game().getModifiersQuerying();results.add(Map.of("name",(light?"light":"dark")+"-trade-"+amount,"spent",before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()),"ordinary",q.getTotalAbilityPresentAtLocation(s.gameState(),who(light),site),"draws",s.GetBattleDestinyCount(who(light)),"power",light?s.GetLSTotalPower():s.GetDSTotalPower(),"reoffered",can(s,light,source)));
 }}
 @Test public void scramble(){for(String mode:new String[]{"pilot","vader","no-pilot"}){
  var s=fixture();var site=s.GetLSStartingLocation();var source=s.GetLSCard("scramble");var target=mode.equals("no-pilot")?s.GetDSCard("troop0"):s.GetDSCard(mode);s.MoveCardsToLocation(site,target);s.MoveCardsToLSHand(source);s.SkipToLSTurn(Phase.DEPLOY);s.LSPlayCard(source);s.PassAllResponses(); assertEquals("Choose Deploy action or Pass",s.GetCurrentDecision().getText());
  var q=s.game().getModifiersQuerying();results.add(Map.of("name","scramble-"+mode,"sourceLost",s.GetLSLostPile().contains(source),"ability",q.getAbility(s.gameState(),target),"battleAbility",q.getAbilityForBattleDestiny(s.gameState(),target)));
 }}
 @Test public void senseNumericalChanges(){for(String mode:new String[]{"lower-target","raise-other"}){
  var s=fixture();var hero=s.GetLSCard("hero");var troop=s.GetLSCard("troop0");var target=s.GetDSCard("shuffle");var sense=s.GetLSCard("sense");s.MoveCardsToLocation(s.GetLSStartingLocation(),hero,troop);s.MoveCardsToLSHand(sense);s.MoveCardsToDSHand(target);s.SkipToPhase(Phase.CONTROL);s.PrepareLSDestiny(0);ready(s,false,target);s.DSPlayCard(target);if(s.GetCurrentDecision().getText().contains("Choose card pile")){var pile=s.gameState().getTopCardsOfPiles(VirtualTableScenario.DS).stream().filter(c->c.getZone()==Zone.TOP_OF_RESERVE_DECK).findFirst().orElseThrow();s.DSDecided(String.valueOf(pile.getCardId()));}ready(s,true,sense);s.LSPlayCard(sense);if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("highest-ability"))s.LSChooseCard(hero);
  s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ResetAbilityModifier(s.GetDSStartingLocation(),mode.equals("lower-target")?hero:troop,mode.equals("lower-target")?0.5f:7));
  for(int i=0;i<120&&!(s.GetLSUsedPile().contains(sense)&&(s.GetDSLostPile().contains(target)||s.GetDSUsedPile().contains(target)));i++)pass(s);
  results.add(Map.of("name","sense-"+mode,"senseUsed",s.GetLSUsedPile().contains(sense),"targetLost",s.GetDSLostPile().contains(target)));
 }}
}
