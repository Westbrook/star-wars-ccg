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
/** Actual card plays; board setup, empty Reserve and removal are explicit fixture interventions. */
public class NativeEngineCancellationOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/cancellation-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("hero","101_2","sense","1_109","second","1_109","alter","1_71","shuffle","1_115","troop","1_28","immune","1_64","wolf","1_30","cz","1_6","camp","1_131")),new HashMap<>(Map.of("hero","101_5","sense","1_267","second","1_267","alter","1_234","shuffle","1_262","macro","1_224","troop","1_194","immune","1_221")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);return s;}
 private String owner(boolean light){return light?VirtualTableScenario.LS:VirtualTableScenario.DS;}
 private PhysicalCardImpl card(VirtualTableScenario s,boolean light,String key){return light?s.GetLSCard(key):s.GetDSCard(key);}
 private void hand(VirtualTableScenario s,boolean light,PhysicalCardImpl... cards){if(light)s.MoveCardsToLSHand(cards);else s.MoveCardsToDSHand(cards);}
 private boolean can(VirtualTableScenario s,boolean light,PhysicalCardImpl card){return s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(light?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card));}
 private void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 private void ready(VirtualTableScenario s,boolean light,PhysicalCardImpl card){for(int i=0;i<70&&!can(s,light,card);i++)pass(s);assertTrue(can(s,light,card));}
 private void play(VirtualTableScenario s,boolean light,PhysicalCardImpl card,String text){if(light){if(text==null)s.LSPlayCard(card);else s.LSPlayCard(card,text);}else{if(text==null)s.DSPlayCard(card);else s.DSPlayCard(card,text);}}
 private void choose(VirtualTableScenario s,boolean light,PhysicalCardImpl card){if(s.GetDecidingPlayer().equals(owner(light))&&s.GetCurrentDecision().getText().contains("highest-ability")){if(light)s.LSChooseCard(card);else s.DSChooseCard(card);}}
 private boolean used(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return (light?s.GetLSUsedPile():s.GetDSUsedPile()).contains(c);}
 private boolean lost(VirtualTableScenario s,boolean light,PhysicalCardImpl c){return (light?s.GetLSLostPile():s.GetDSLostPile()).contains(c);}
 private int reserve(VirtualTableScenario s,boolean light){return light?s.GetLSReserveDeckCount():s.GetDSReserveDeckCount();}
 @Test public void senseAndCounters(){for(boolean light:new boolean[]{true,false})for(String mode:new String[]{"zero","equal","empty","counter","nested","leave","return"}){
  var s=fixture();var hero=card(s,light,"hero");var sense=card(s,light,"sense");var target=card(s,!light,"shuffle");var alter=card(s,!light,"alter");var second=card(s,light,"second");
  s.MoveCardsToLocation(s.GetLSStartingLocation(),hero);hand(s,light,sense,second);hand(s,!light,target,alter);s.SkipToPhase(Phase.CONTROL);if(light)s.PrepareLSDestiny(mode.equals("equal")?4:0);else s.PrepareDSDestiny(mode.equals("equal")?6:0);
  if(mode.equals("empty"))for(var c:new ArrayList<>(light?s.GetLSReserveDeck():s.GetDSReserveDeck()))hand(s,light,(PhysicalCardImpl)c);
  ready(s,!light,target);play(s,!light,target,null);
  if(s.GetCurrentDecision().getText().contains("Choose card pile")){var pile=s.gameState().getTopCardsOfPiles(owner(!light)).stream().filter(c->c.getZone()==Zone.TOP_OF_RESERVE_DECK).findFirst().orElseThrow();s.PlayerDecided(owner(!light),String.valueOf(pile.getCardId()));}
  ready(s,light,sense);int before=reserve(s,light);play(s,light,sense,null);choose(s,light,hero);
  if(mode.equals("leave")||mode.equals("return")){hand(s,light,hero);if(mode.equals("return"))s.MoveCardsToLocation(s.GetLSStartingLocation(),hero);}
  if(mode.equals("counter")||mode.equals("nested")){ready(s,!light,alter);play(s,!light,alter,null);if(mode.equals("nested")){ready(s,light,second);play(s,light,second,"Cancel");}}
  for(int i=0;i<180&&!((used(s,!light,target)||lost(s,!light,target))&&(used(s,light,sense)||lost(s,light,sense)));i++)pass(s);
  assertTrue(used(s,!light,target)||lost(s,!light,target));
  results.add(Map.of("name",(light?"light":"dark")+"-"+mode,"targetLost",lost(s,!light,target),"senseUsed",used(s,light,sense),"senseLost",lost(s,light,sense),"alterUsed",used(s,!light,alter),"alterLost",lost(s,!light,alter),"secondUsed",used(s,light,second),"cardsDrawn",before-reserve(s,light)));
 }}
 @Test public void alters(){for(String mode:new String[]{"table","deploy","immune-table","immune-deploy"}){
  var s=fixture();var hero=s.GetLSCard("hero");var alter=s.GetLSCard("alter");boolean immune=mode.startsWith("immune");var target=s.GetDSCard(immune?"immune":"macro");s.MoveCardsToLocation(s.GetLSStartingLocation(),hero,s.GetDSCard("troop"));s.MoveCardsToLSHand(alter);
  if(mode.endsWith("deploy"))s.MoveCardsToDSHand(target);else if(immune)s.AttachCardsTo(s.GetDSCard("troop"),target);else s.MoveCardsToDSHand(target);
  s.SkipToPhase(Phase.DEPLOY);s.PrepareLSDestiny(0);int before=s.GetLSReserveDeckCount(),forceBefore=s.GetDSForcePileCount();
  if(mode.equals("table")){s.DSPlayCardAndPassResponses(target);}
  else if(mode.endsWith("deploy")){s.DSPlayCard(target);if(immune&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(s.GetDSCard("troop")))s.DSChooseCard(s.GetDSCard("troop"));}
  if(immune){if(s.GetDecidingPlayer().equals(VirtualTableScenario.DS))pass(s);results.add(Map.of("name",mode,"offered",can(s,true,alter)));continue;}
  ready(s,true,alter);play(s,true,alter,null);if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose Effect"))s.LSChooseCard(target);choose(s,true,hero);
  for(int i=0;i<150&&!used(s,true,alter);i++)pass(s);assertTrue(used(s,true,alter));results.add(Map.of("name",mode,"targetLost",lost(s,false,target),"alterUsed",true,"cardsDrawn",before-s.GetLSReserveDeckCount(),"forceSpent",forceBefore-s.GetDSForcePileCount()));
 }}

 @Test public void reacts(){for(String mode:new String[]{"move","deploy"}){
  var s=fixture();var bay=s.GetLSStartingLocation();var camp=s.GetLSCard("camp");var wolf=s.GetLSCard("wolf");var cz=s.GetLSCard("cz");var sense=s.GetDSCard("sense");var hero=s.GetDSCard("hero");s.MoveLocationToTable(camp);s.MoveCardsToLocation(bay,hero);s.MoveCardsToDSHand(sense);
  if(mode.equals("move"))s.MoveCardsToLocation(camp,wolf);else{s.MoveCardsToLocation(camp,cz);s.MoveCardsToLSHand(wolf);}
  s.SkipToPhase(Phase.CONTROL);s.PrepareDSDestiny(0);int forceBefore=s.GetLSForcePileCount();s.DSForceDrainAt(bay);
  var source=mode.equals("move")?wolf:cz;for(int i=0;i<70&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.LSCardActionAvailable(source));i++)pass(s);
  if(mode.equals("move")){s.LSUseCardAction(wolf,"Move");if(s.GetCurrentDecision().getText().contains("Choose where"))s.LSChooseCard(bay);}else{s.LSUseCardAction(cz);if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(wolf))s.LSChooseCard(wolf);if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose where"))s.LSChooseCard(bay);}
  ready(s,false,sense);play(s,false,sense,null);choose(s,false,hero);for(int i=0;i<150&&!used(s,false,sense);i++)pass(s);assertTrue(used(s,false,sense));
  results.add(Map.of("name","react-"+mode,"returnedToHand",s.GetLSHand().contains(wolf),"stayedAtOrigin",wolf.getAtLocation()==camp,"forceSpent",forceBefore-s.GetLSForcePileCount(),"senseUsed",true));
 }}
}
