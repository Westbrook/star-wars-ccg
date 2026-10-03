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
/** Actual movement Interrupts; controlled zone interventions after targets chosen. */
public class NativeEngineTravelIdentityOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/travel-identity-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 @Test public void travel(){for(String mode:new String[]{"run-stay","run-leave","run-return","escape-stay","escape-leave","escape-return","escape-arrival"}){
  try {
  var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","rebel","1_28","extra","1_28","interrupt",mode.startsWith("run")?"101_3":"1_98")),new HashMap<>(Map.of("storm","1_194","near","1_293")),10,10,
   StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveLocationToTable(s.GetDSCard("near"));
  var bay=s.GetLSStartingLocation();var near=s.GetDSCard("near");var luke=s.GetLSCard("luke");var rebel=s.GetLSCard("rebel");var interrupt=s.GetLSCard("interrupt");var extra=s.GetLSCard("extra");boolean run=mode.startsWith("run");
  s.MoveCardsToLocation(bay,rebel,s.GetDSCard("storm"));s.MoveCardsToLocation(run?near:bay,luke);s.MoveCardsToLSHand(interrupt,extra);
  while(s.GetLSForcePileCount()<4)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>4)s.LSUseForceCheat(1);
  s.SkipToPhase(Phase.BATTLE);int force=s.GetLSForcePileCount();s.DSInitiateBattle(bay);s.LSPlayCard(interrupt);
  if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(luke))s.LSChooseCard(luke);
  assertTrue(mode+" "+s.GetCurrentDecision().getText(),s.GetCurrentDecision().getText().toLowerCase().contains("response"));
  if(mode.endsWith("leave")||mode.endsWith("return")){s.MoveCardsToLSHand(luke);s.gameState().getBattleState().updateParticipants(s.game());if(mode.endsWith("return"))s.MoveCardsToLocation(run?near:bay,luke);}
  if(mode.endsWith("arrival"))s.MoveCardsToLocation(bay,extra);
  s.gameState().getBattleState().updateParticipants(s.game());
  for(int i=0;i<150&&!s.GetLSLostPile().contains(interrupt)&&!s.GetLSUsedPile().contains(interrupt);i++){
   if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)){boolean chosen=false;for(var c:new PhysicalCardImpl[]{luke,rebel,extra,run?bay:near})if(s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);chosen=true;break;}if(chosen)continue;}
   String text=s.GetCurrentDecision().getText().toLowerCase();if(text.contains("optional")||text.contains("response")){s.PlayerPass(s.GetDecidingPlayer());continue;}
   throw new AssertionError(mode+" "+text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue(mode,s.GetLSLostPile().contains(interrupt)||s.GetLSUsedPile().contains(interrupt));
  results.add(Map.of("name",mode,"lukeMoved",luke.getAtLocation()==(run?bay:near),"rebelMoved",rebel.getAtLocation()==near,"extraMoved",extra.getAtLocation()==near,"forceSpent",force-s.GetLSForcePileCount(),"interruptZone",interrupt.getZone().toString()));
  } catch (NullPointerException e) {results.add(Map.of("name",mode,"referenceError",e.getClass().getSimpleName(),"message",e.getMessage()));}
 }}
}
