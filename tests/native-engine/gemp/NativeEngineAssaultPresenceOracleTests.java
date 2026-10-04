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
/** Controlled occupancy boards; actual Force drain, Assault, draws and losses. */
public class NativeEngineAssaultPresenceOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/assault-presence-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 static class Trace extends AbstractActionProxy {
  final Set<EffectResult> seen=Collections.newSetFromMap(new IdentityHashMap<>());final List<Float> draws=new ArrayList<>();Float total=null;
  @Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame game,EffectResult e){if(!seen.add(e))return null;if(e instanceof DestinyDrawCompleteResult d)draws.add(d.getDestinyValue());else if(e instanceof AboutToCompleteDrawingDestinyResult d)total=d.getTotalDestiny(game);return null;}
 }
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void occupancy(){for(boolean ownerLight:new boolean[]{true,false})for(String mode:List.of("space","enclosed","unpiloted","landed","cargo","open")){
  if(!ownerLight&&mode.equals("open"))continue;
  var ls=new HashMap<String,String>(Map.of("ship","1_140","fighter","1_142","vehicle",mode.equals("open")?"1_149":"1_151","pilot","1_11","passenger","1_28","guard","1_28","assault","1_113"));
  var ds=new HashMap<String,String>(Map.of("ship","1_302","fighter","1_305","vehicle","1_310","pilot","1_179","passenger","1_194","guard","1_194","assault","1_238"));
  for(int i=0;i<4;i++){ls.put("draw"+i,"1_113");ds.put("draw"+i,"1_238");}
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_289"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=List.of("space","cargo").contains(mode)?s.GetDSStartingLocation():s.GetLSStartingLocation();String hostKey=List.of("enclosed","unpiloted","open").contains(mode)?"vehicle":mode.equals("landed")?"fighter":"ship";
  var host=ownerLight?s.GetLSCard(hostKey):s.GetDSCard(hostKey);var pilot=ownerLight?s.GetLSCard("pilot"):s.GetDSCard("pilot");var passenger=ownerLight?s.GetLSCard("passenger"):s.GetDSCard("passenger");
  s.MoveCardsToLocation(site,host);
  if(mode.equals("cargo")){var cargo=ownerLight?s.GetLSCard("vehicle"):s.GetDSCard("vehicle");s.BoardAsVehicle(host,cargo);s.BoardAsPilot(cargo,pilot);s.BoardAsPassenger(cargo,passenger);}
  else{if(!mode.equals("unpiloted"))s.BoardAsPilot(host,pilot);s.BoardAsPassenger(host,passenger);}
  if(List.of("unpiloted","landed").contains(mode))s.MoveCardsToLocation(site,ownerLight?s.GetLSCard("guard"):s.GetDSCard("guard"));
  var card=ownerLight?s.GetDSCard("assault"):s.GetLSCard("assault");if(ownerLight)s.MoveCardsToDSHand(card);else s.MoveCardsToLSHand(card);
  s.DSActivateForceCheat(30);s.LSActivateForceCheat(30);if(ownerLight)s.SkipToLSTurn(Phase.CONTROL);else s.SkipToPhase(Phase.CONTROL);
  for(int i=3;i>=0;i--){if(ownerLight)s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("draw"+i));else s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("draw"+i));}
  String owner=ownerLight?VirtualTableScenario.LS:VirtualTableScenario.DS,actor=ownerLight?VirtualTableScenario.DS:VirtualTableScenario.LS;
  float power=s.game().getModifiersQuerying().getTotalPowerAtLocation(s.gameState(),site,owner,false,false);
  if(ownerLight)s.LSForceDrainAt(site);else s.DSForceDrainAt(site);
  for(int i=0;i<50&&!(s.GetDecidingPlayer().equals(actor)&&(ownerLight?s.DSCardPlayAvailable(card):s.LSCardPlayAvailable(card)));i++)pass(s);
  assertTrue(ownerLight?s.DSCardPlayAvailable(card):s.LSCardPlayAvailable(card));var trace=new Trace();s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(trace);
  int df=s.GetDSForcePileCount(),lf=s.GetLSForcePileCount();if(ownerLight)s.DSPlayCard(card);else s.LSPlayCard(card);
  for(int i=0;i<300&&!(ownerLight?s.GetDSLostPile():s.GetLSLostPile()).contains(card);i++){
   String text=s.GetCurrentDecision().getText().toLowerCase(),who=s.GetDecidingPlayer();
   if(!text.contains("optional")&&!text.contains("response")&&text.contains("lose")&&text.contains("force")){if(who.equals(VirtualTableScenario.LS))s.LSPayForceLossFromForcePile();else s.DSPayForceLossFromForcePile();}
   else if(text.contains("optional")||text.contains("response"))pass(s);else throw new AssertionError(mode+" "+text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue((ownerLight?s.GetDSLostPile():s.GetLSLostPile()).contains(card));
  var row=new LinkedHashMap<String,Object>();row.put("owner",ownerLight?"light":"dark");row.put("mode",mode);row.put("power",power);row.put("draws",trace.draws);row.put("total",trace.total);row.put("darkForceLost",df-s.GetDSForcePileCount()-(ownerLight?1:0));row.put("lightForceLost",lf-s.GetLSForcePileCount()-(ownerLight?0:1));row.put("interruptLost",true);rows.add(row);
 }}
}
