package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Controlled response inventory, not a legal setup/full match or zone intervention. */
public class NativeEngineTravelResponseOracleTests {
 @Test public void responses() throws Exception {
  var rows=new ArrayList<Map<String,Object>>();
  for(String mode:List.of("run","run-light","escape")) {
   boolean run=mode.startsWith("run"),lightInitiates=mode.equals("run-light");
   var ls=new HashMap<String,String>(); var ds=new HashMap<String,String>();
   for(String bp:List.of("101_3","1_100","1_105","1_106","1_113","1_115","1_120","1_77","1_80","1_84","1_90","1_91","1_98"))ls.put(bp,bp);
   for(String bp:List.of("101_6","1_237","1_238","1_249","1_251","1_252","1_254","1_262","1_266","1_268","1_269","1_275","1_279"))ds.put(bp,bp);
   ls.putAll(Map.of("luke","101_2","rebel","1_28","extra","1_28","wolf","1_30","cz","1_6","gun","1_152","near","1_130","miner","1_18","binoculars","1_35"));
   ds.putAll(Map.of("storm","1_194","extra","1_194","comlink","1_201","gun","1_317","vader","101_5","miner","1_186","macro","1_224"));
   var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
   s.StartGame();s.SkipToPhase(Phase.CONTROL);
   var bay=s.GetLSStartingLocation();var near=s.GetLSCard("near");var luke=s.GetLSCard("luke");var rebel=s.GetLSCard("rebel");var interrupt=s.GetLSCard(run?"101_3":"1_98");
   s.MoveLocationToTable(near);s.MoveCardsToLocation(bay,rebel,s.GetLSCard("cz"),s.GetLSCard("miner"),s.GetDSCard("storm"),s.GetDSCard("miner"));
   s.MoveCardsToLocation(near,s.GetLSCard("wolf"),s.GetDSCard("vader"));s.MoveCardsToLocation(run?near:bay,luke);
   s.AttachCardsTo(rebel,s.GetLSCard("gun"),s.GetLSCard("binoculars"));s.AttachCardsTo(s.GetDSCard("storm"),s.GetDSCard("gun"),s.GetDSCard("comlink"));
   for(String bp:List.of("101_3","1_100","1_105","1_106","1_113","1_115","1_120","1_77","1_80","1_84","1_90","1_91","1_98"))s.MoveCardsToLSHand(s.GetLSCard(bp));
   for(String bp:List.of("101_6","1_237","1_238","1_249","1_251","1_252","1_254","1_262","1_266","1_268","1_269","1_275","1_279"))s.MoveCardsToDSHand(s.GetDSCard(bp));
   s.MoveCardsToLSHand(s.GetLSCard("extra"));s.MoveCardsToDSHand(s.GetDSCard("extra"));
   while(s.GetLSForcePileCount()<10)s.LSActivateForceCheat(1);while(s.GetDSForcePileCount()<10)s.DSActivateForceCheat(1);
   if(lightInitiates){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(bay);}else{s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(bay);}
   var before=new ArrayList<>(lightInitiates?s.GetDSAvailableActions():s.GetLSAvailableActions());
   if(lightInitiates)s.DSPass();
   assertTrue(s.LSCardPlayAvailable(interrupt));s.LSPlayCard(interrupt);
   var windows=new ArrayList<Map<String,Object>>();
   for(int i=0;i<160&&!s.GetLSLostPile().contains(interrupt)&&!s.GetLSUsedPile().contains(interrupt);i++) {
    var d=s.GetCurrentDecision();String text=d.getText();String player=s.GetDecidingPlayer();
    if(text.toLowerCase().contains("response")||text.toLowerCase().contains("optional")) {
     String[] actions=d.getDecisionParameters().get("actionText");
     windows.add(Map.of("side",player.equals(VirtualTableScenario.LS)?"light":"dark","text",text,"actions",actions==null?List.of():Arrays.asList(actions)));
     s.PlayerPass(player);continue;
    }
    boolean chosen=false;if(player.equals(VirtualTableScenario.LS))for(var c:new PhysicalCardImpl[]{luke,rebel,run?bay:near})if(s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);chosen=true;break;}
    if(!chosen)throw new AssertionError(text+" "+d.getDecisionParameters());
   }
   assertTrue(s.GetLSLostPile().contains(interrupt)||s.GetLSUsedPile().contains(interrupt));
   rows.add(Map.of("mode",mode,"before",before,"windows",windows,"lukeMoved",luke.getAtLocation()==(run?bay:near),"interruptZone",interrupt.getZone().toString()));
  }
  Files.writeString(Path.of("/opt/gemp-swccg/travel-response-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
 }
}
