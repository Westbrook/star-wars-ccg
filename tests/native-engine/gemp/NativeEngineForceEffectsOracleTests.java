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
public class NativeEngineForceEffectsOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/force-effects-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(results));}
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
 @Test public void exclusions(){for(boolean light:new boolean[]{true,false})for(String mode:new String[]{"fallback","none","multiple","other","fail"}){
  var s=fixture();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var site=s.GetLSStartingLocation();var hero=card(s,light,"hero");var master=card(s,light,"master");var troop=card(s,light,"troop");var sense=card(s,light,"sense");var target=card(s,!light,"shuffle");var source=card(s,!light,"source");s.MoveCardsToLocation(site,hero);if(mode.equals("fallback")||mode.equals("fail"))s.MoveCardsToLocation(site,troop);if(mode.equals("multiple")||mode.equals("other"))s.MoveCardsToLocation(site,master);s.MoveCardsToSideOfTable(source);hand(s,light,sense);hand(s,!light,target);s.SkipToPhase(Phase.CONTROL);if(light)s.PrepareLSDestiny(mode.equals("fail")?3:0);else s.PrepareDSDestiny(mode.equals("fail")?3:0);
  ready(s,!light,target);play(s,!light,target);if(s.GetCurrentDecision().getText().contains("Choose card pile")){var pile=s.gameState().getTopCardsOfPiles(owner(!light)).stream().filter(c->c.getZone()==Zone.TOP_OF_RESERVE_DECK).findFirst().orElseThrow();s.PlayerDecided(owner(!light),String.valueOf(pile.getCardId()));}
  ready(s,light,sense);int before=reserve(s,light);play(s,light,sense);if(s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getText().contains("highest-ability"))choose(s,light,mode.equals("multiple")||mode.equals("other")?master:hero);
  ready(s,!light,source);int cost=force(s,!light);if(light)s.DSUseCardAction(source,"Exclude");else s.LSUseCardAction(source,"Exclude");
  if(s.GetDecidingPlayer().equals(owner(!light))&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null)choose(s,!light,mode.equals("multiple")?new PhysicalCardImpl[]{hero,master}:new PhysicalCardImpl[]{hero});
  if(s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getText().contains("highest-ability"))choose(s,light,troop);
  
  boolean reoffered=false;for(int i=0;i<180&&!(used(s,light,sense)&&(used(s,!light,target)||lost(s,!light,target)));i++){if(can(s,!light,source))reoffered=true;pass(s);}assertTrue(used(s,light,sense));
  results.add(Map.of("name",(light?"light":"dark")+"-"+mode,"targetLost",lost(s,!light,target),"senseUsed",true,"forceSpent",cost-force(s,!light),"cardsDrawn",before-reserve(s,light),"reoffered",reoffered));
 }}
 private static class Trace extends AbstractActionProxy {final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());final List<Float> values=new ArrayList<>();@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){if(seen.add(e)&&e instanceof DestinyDrawCompleteResult d)values.add(d.getDestinyValue());return null;}}
 @Test public void assaults(){for(boolean light:new boolean[]{true,false})for(int bonus:new int[]{4,0,-1}){
  var s=fixture();if(!light)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,card(s,!light,"troop"),card(s,!light,"troop2"));var assault=card(s,light,"assault");var source=card(s,!light,"source");s.MoveCardsToSideOfTable(source);hand(s,light,assault);s.SkipToPhase(Phase.CONTROL);if(light){s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("troop"));s.PrepareLSDestiny(3);if(bonus>=0)s.PrepareDSDestiny(bonus);}else{s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("troop"));s.PrepareDSDestiny(3);if(bonus>=0)s.PrepareLSDestiny(bonus);}
  if(bonus<0)for(var c:new ArrayList<>(light?s.GetDSReserveDeck():s.GetLSReserveDeck()))hand(s,!light,(PhysicalCardImpl)c);
  if(light)s.DSForceDrainAt(site);else s.LSForceDrainAt(site);ready(s,light,assault);int attackForce=force(s,light),defenseForce=force(s,!light);var trace=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(trace);play(s,light,assault);ready(s,!light,source);if(light)s.DSUseCardAction(source);else s.LSUseCardAction(source);
  for(int i=0;i<180&&!lost(s,light,assault);i++){var txt=s.GetCurrentDecision().getText().toLowerCase();if(!txt.contains("optional")&&!txt.contains("response")&&txt.contains("lose")&&txt.contains("force")){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS))s.LSPayForceLossFromForcePile();else s.DSPayForceLossFromForcePile();}else pass(s);}
  assertTrue(lost(s,light,assault));var row=new LinkedHashMap<String,Object>();row.put("name",(light?"light":"dark")+"-assault-"+bonus);row.put("draws",trace.values);row.put("attackerLost",attackForce-force(s,light)-1);row.put("defenderLost",defenseForce-force(s,!light)-1);row.put("interruptLost",true);results.add(row);
 }}
 @Test public void productionRemoval(){for(boolean light:new boolean[]{true,false}){
  var s=fixture();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);var hero=card(s,light,"hero");var sense=card(s,light,"sense");var target=card(s,!light,"shuffle");s.MoveCardsToLocation(s.GetLSStartingLocation(),hero);hand(s,light,sense);hand(s,!light,target);s.SkipToPhase(Phase.CONTROL);if(light)s.PrepareLSDestiny(0);else s.PrepareDSDestiny(0);
  ready(s,!light,target);play(s,!light,target);if(s.GetCurrentDecision().getText().contains("Choose card pile")){var pile=s.gameState().getTopCardsOfPiles(owner(!light)).stream().filter(c->c.getZone()==Zone.TOP_OF_RESERVE_DECK).findFirst().orElseThrow();s.PlayerDecided(owner(!light),String.valueOf(pile.getCardId()));}ready(s,light,sense);play(s,light,sense);if(s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getText().contains("highest-ability"))choose(s,light,hero);
  // Inject a test action at this response decision, executing the production
  // return effect and its real removal lifecycle. No production source changes.
  var who=s.GetDecidingPlayer();var action=new com.gempukku.swccgo.logic.actions.TopLevelGameTextAction(target,who,target.getCardId());action.setText("Production return probe");action.appendEffect(new com.gempukku.swccgo.logic.effects.ReturnCardToHandFromTableEffect(action,hero));
  ((com.gempukku.swccgo.logic.decisions.CardActionSelectionDecision)s.GetCurrentDecision()).addAction(action);s.PlayerDecided(who,String.valueOf(s.GetADParam(who,"actionId").length));
  for(int i=0;i<180&&!(used(s,light,sense)&&(used(s,!light,target)||lost(s,!light,target)));i++)pass(s);assertTrue((light?s.GetLSHand():s.GetDSHand()).contains(hero));
  results.add(Map.of("name",(light?"light":"dark")+"-production-return","heroInHand",true,"senseUsed",used(s,light,sense),"targetLost",lost(s,!light,target)));
 }}

}
