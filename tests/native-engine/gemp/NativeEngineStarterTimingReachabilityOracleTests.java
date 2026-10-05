package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled provider inventories; setup/filler is not an exact-deck game trace. No interventions after play. */
public class NativeEngineStarterTimingReachabilityOracleTests {
 static final List<String> LI=List.of("101_3","1_100","1_105","1_106","1_113","1_115","1_120","1_77","1_80","1_84","1_90","1_91","1_98");
 static final List<String> DI=List.of("101_6","1_237","1_238","1_249","1_251","1_252","1_254","1_262","1_266","1_268","1_269","1_275","1_279");
 @Test public void inventories() throws Exception {
  var rows=new ArrayList<Map<String,Object>>();
  for(String mode:List.of("duel-pass","duel-cancel","friendly-dark","friendly-light","collateral-dark","collateral-light")) {
   boolean duel=mode.startsWith("duel"),cancel=mode.equals("duel-cancel"),light=mode.startsWith("friendly"),lightInitiates=mode.endsWith("light");
   var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();for(String bp:LI)ls.put(bp,bp);for(String bp:DI)ds.put(bp,bp);
   ls.putAll(Map.of("luke","101_2","rebel","1_28","extra","1_28","wolf","1_30","cz","1_6","miner","1_18","talz","1_31","gun","1_152","binoculars","1_35","near","1_130"));
   ls.put("lost","1_28");ds.put("lost","1_194");
   ls.putAll(Map.of("belt","1_40","saitorr","1_64","rifle","1_153","mine","1_162"));
   ds.putAll(Map.of("vader","101_5","storm","1_194","extra","1_194","raider","1_196","miner","1_186","gun","1_317","comlink","1_201","macro","1_224","ket","1_221","stick","1_315"));
   ds.putAll(Map.of("belt","1_207","rifle","1_312","mine","1_322"));
   var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
   s.StartGame();s.SkipToPhase(Phase.CONTROL);var bay=s.GetLSStartingLocation();var near=s.GetLSCard("near");var remote=s.GetDSStartingLocation();
   var luke=s.GetLSCard("luke");var vader=s.GetDSCard("vader");var rebel=s.GetLSCard("rebel");var storm=s.GetDSCard("storm");
   s.MoveLocationToTable(near);s.MoveCardsToLocation(bay,luke,rebel,s.GetLSCard("cz"),s.GetLSCard("miner"),s.GetLSCard("talz"),storm,s.GetDSCard("miner"),s.GetDSCard("raider"));
   if(mode.equals("friendly-dark"))s.MoveCardsToLocation(near,luke);s.MoveCardsToLocation(near,s.GetLSCard("wolf"),vader);s.AttachCardsTo(rebel,s.GetLSCard("gun"),s.GetLSCard("binoculars"),s.GetLSCard("belt"),s.GetLSCard("saitorr"));s.AttachCardsTo(luke,s.GetLSCard("rifle"));
   s.AttachCardsTo(storm,s.GetDSCard("gun"),s.GetDSCard("comlink"),s.GetDSCard("belt"),s.GetDSCard("ket"));s.AttachCardsTo(vader,s.GetDSCard("rifle"));s.AttachCardsTo(s.GetDSCard("raider"),s.GetDSCard("stick"));
   s.MoveCardsToDSSideOfTable(s.GetDSCard("macro"));s.MoveCardsToLocation(remote,s.GetLSCard("mine"),s.GetDSCard("mine"));
   for(String bp:LI)s.MoveCardsToLSHand(s.GetLSCard(bp));for(String bp:DI)s.MoveCardsToDSHand(s.GetDSCard(bp));s.MoveCardsToLSHand(s.GetLSCard("extra"));s.MoveCardsToDSHand(s.GetDSCard("extra"));
   s.MoveCardsToTopOfLSLostPile(s.GetLSCard("lost"));s.MoveCardsToTopOfDSLostPile(s.GetDSCard("lost"));
   while(s.GetLSForcePileCount()<10)s.LSActivateForceCheat(1);while(s.GetDSForcePileCount()<10)s.DSActivateForceCheat(1);
   PhysicalCardImpl card=duel?s.GetDSCard("101_6"):light?s.GetLSCard("1_80"):s.GetDSCard("1_237");var baseline=new ArrayList<Map<String,Object>>();
   if(duel){s.SkipToPhase(Phase.MOVE);s.DSMoveCard(vader,bay);}else {if(lightInitiates){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(bay);}else {s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(bay);}}
   for(int i=0;i<40;i++) {
    String who=s.GetDecidingPlayer();var d=s.GetCurrentDecision();String[] actions=d.getDecisionParameters().get("actionText");
    baseline.add(Map.of("side",who.equals(VirtualTableScenario.LS)?"light":"dark","text",d.getText(),"actions",actions==null?List.of():Arrays.asList(actions)));
    if(who.equals(light?VirtualTableScenario.LS:VirtualTableScenario.DS)&&(light?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card)))break;s.PlayerPass(who);
   }
   assertTrue(light?s.LSCardPlayAvailable(card):s.DSCardPlayAvailable(card));
   // Known successful draws isolate timing from empty-deck/failed-Obsession arithmetic.
   if(duel){s.PrepareDSDestiny(1);s.PrepareLSDestiny(1);}else if(light)s.PrepareLSDestiny(0);else s.PrepareDSDestiny(0);
   if(light)s.LSPlayCard(card);else s.DSPlayCard(card);
   var windows=new ArrayList<Map<String,Object>>();boolean canceled=false,preResultSeen=false,resultsSeen=false;int casualtyChoices=0;
   for(int i=0;i<300&&!(light?s.GetLSLostPile():s.GetDSLostPile()).contains(card);i++) {
    var d=s.GetCurrentDecision();String text=d.getText(),lower=text.toLowerCase(),who=s.GetDecidingPlayer();var duelState=s.gameState().getDuelState();
    boolean pre=duelState!=null&&!duelState.isReachedResults();preResultSeen|=pre;resultsSeen|=duelState!=null&&duelState.isReachedResults();
    if(lower.contains("response")||lower.contains("optional")) {
     String[] actions=d.getDecisionParameters().get("actionText");var w=new LinkedHashMap<String,Object>();w.put("side",who.equals(VirtualTableScenario.LS)?"light":"dark");w.put("text",text);w.put("actions",actions==null?List.of():Arrays.asList(actions));w.put("duelPreResult",pre);w.put("duelResults",duelState!=null&&duelState.isReachedResults());w.put("casualtyAlreadyChosen",casualtyChoices>0);windows.add(w);
     if(cancel&&!canceled&&who.equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(s.GetLSCard("101_3"))){s.LSPlayCard(s.GetLSCard("101_3"));canceled=true;}else s.PlayerPass(who);continue;
    }
    if(lower.contains("choose light side character")){s.DSChooseCard(luke);continue;}if(lower.contains("choose dark side character")){s.DSChooseCard(vader);continue;}
    if(lower.contains("lose")&&lower.contains("force")){if(who.equals(VirtualTableScenario.LS))s.LSPayForceLossFromForcePile();else s.DSPayForceLossFromForcePile();continue;}
    boolean chosen=false;for(var c:new PhysicalCardImpl[]{light?storm:rebel,light?s.GetDSCard("gun"):s.GetLSCard("gun"),light?s.GetDSCard("belt"):s.GetLSCard("belt"),light?s.GetDSCard("ket"):s.GetLSCard("saitorr"),s.GetLSCard("binoculars"),s.GetDSCard("comlink"),s.GetLSCard("rifle"),s.GetDSCard("rifle"),luke,vader}) {
     if(who.equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);chosen=true;casualtyChoices++;break;}if(who.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);chosen=true;casualtyChoices++;break;}
    }
    if(!chosen)throw new AssertionError(mode+" "+text+" "+d.getDecisionParameters());
   }
   assertTrue((light?s.GetLSLostPile():s.GetDSLostPile()).contains(card));if(duel&&!cancel)assertTrue(preResultSeen&&resultsSeen);if(cancel)assertTrue(canceled);if(!duel)assertTrue(casualtyChoices>0);
   var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("handInterrupts",Map.of("light",LI,"dark",DI));row.put("baseline",baseline);row.put("windows",windows);row.put("preResultSeen",preResultSeen);row.put("resultsSeen",resultsSeen);row.put("canceled",canceled);row.put("casualtyChoices",casualtyChoices);row.put("interruptLost",true);row.put("lukeZone",luke.getZone().toString());row.put("vaderZone",vader.getZone().toString());rows.add(row);
  }
  Files.writeString(Path.of(System.getProperty("starterTimingOutput","/opt/gemp-swccg/starter-timing-reachability-results.json")),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
 }
}
