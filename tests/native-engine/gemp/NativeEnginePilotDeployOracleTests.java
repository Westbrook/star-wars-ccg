package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real deployment and Barrier actions. Force and starting locations are fixtures. */
public class NativeEnginePilotDeployOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/pilot-deploy-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 boolean decision(VirtualTableScenario s,boolean light,String text){return light?s.LSDecisionAvailable(text):s.DSDecisionAvailable(text);}
 void choose(VirtualTableScenario s,boolean light,PhysicalCardImpl card){if(light)s.LSChooseCard(card);else s.DSChooseCard(card);}
 void pass(VirtualTableScenario s){System.out.println("PAIR "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void deployPairs(){for(String mode:List.of("light-system","dark-system","dark-bay","dark-cargo","empty-bay","barrier-ship","barrier-pilot")){
  boolean light=mode.startsWith("light"),paired=!mode.startsWith("empty"),barrierMode=mode.startsWith("barrier");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("ship","1_141","pilot","1_11","barrier","1_105")),new HashMap<>(Map.of("ship","1_300","pilot","1_179","carrier","1_302")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=light?s.GetLSCard("ship"):s.GetDSCard("ship");var pilot=light?s.GetLSCard("pilot"):s.GetDSCard("pilot");var barrier=s.GetLSCard("barrier");var carrier=s.GetDSCard("carrier");var planet=s.GetDSStartingLocation();var bay=s.GetLSStartingLocation();var target=mode.endsWith("bay")?bay:mode.endsWith("cargo")?carrier:planet;
  if(light)s.MoveCardsToLSHand(ship,pilot);else s.MoveCardsToDSHand(ship,pilot,carrier);s.MoveCardsToLSHand(barrier);
  s.DSActivateForceCheat(25);s.LSActivateForceCheat(20);if(light)s.SkipToLSTurn(Phase.DEPLOY);else s.SkipToPhase(Phase.DEPLOY);
  if(mode.endsWith("cargo"))new NativeEngineVesselsOracleTests().deploy(s,carrier,planet,null);
  var arrivals=new ArrayList<Boolean>();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(e instanceof PlayCardResult p&&(p.getPlayedCard()==ship||p.getPlayedCard()==pilot))arrivals.add(p.getOtherPlayedCard()!=null&&pilot.getAttachedTo()==ship);return null;}});
  int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSDeployCard(ship);else s.DSDeployCard(ship);
  boolean playedBarrier=false;
  for(int i=0;i<160;i++){
   if(decision(s,light,"Choose Deploy action")&&(ship.getAtLocation()==target||ship.getAttachedTo()==target))break;
   if(decision(s,light,"Do you want to simultaneously")){if(light){if(paired)s.LSChooseYes();else s.LSChooseNo();}else{if(paired)s.DSChooseYes();else s.DSChooseNo();}}
   else if(decision(s,light,"Choose a pilot from hand"))choose(s,light,pilot);
   else if(decision(s,light,"Choose where to deploy"))choose(s,light,target);
   else if(decision(s,light,"Choose capacity")){if(light)s.LSChoose("Starship");else s.DSChoose("Starship");}
   else if(barrierMode&&!playedBarrier&&s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardPlayAvailable(barrier)){s.LSPlayCard(barrier,"Prevent "+(mode.endsWith("ship")?"Black 3":"Grand Moff Tarkin"));playedBarrier=true;}
   else pass(s);
  }
  assertTrue(decision(s,light,"Choose Deploy action"));assertTrue(ship.getAtLocation()==target||ship.getAttachedTo()==target);assertEquals(paired,pilot.getAttachedTo()==ship);if(barrierMode)assertTrue(playedBarrier);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount()));row.put("pilotAboard",pilot.getAttachedTo()==ship);row.put("pilotSlot",pilot.isPilotOf());row.put("power",s.GetPower(ship));row.put("cargo",ship.getAttachedTo()==carrier);row.put("arrivalCount",arrivals.size());row.put("sharedArrival",arrivals.stream().allMatch(Boolean::booleanValue));row.put("barrierUsed",s.GetLSUsedPile().contains(barrier));var q=s.game().getModifiersQuerying();row.put("shipBarred",q.mayNotMove(s.gameState(),ship)&&q.isProhibitedFromParticipatingInBattle(s.gameState(),ship,ship.getOwner()));row.put("pilotBarred",q.mayNotMove(s.gameState(),pilot)&&q.isProhibitedFromParticipatingInBattle(s.gameState(),pilot,pilot.getOwner()));rows.add(row);
 }}
}
