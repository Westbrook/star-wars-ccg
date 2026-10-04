package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.actions.TriggerAction;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real system/Sunsdown/spy deployments and battle. Board and Reserve tops are fixture-controlled. */
public class NativeEngineSunsdownOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/sunsdown-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("SUNS "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 void deployMenu(VirtualTableScenario s){for(int i=0;i<80&&!s.DSDecisionAvailable("Choose Deploy action");i++)pass(s);assertTrue(s.DSDecisionAvailable("Choose Deploy action"));}
 @Test public void sunlight(){for(String mode:List.of("normal","duplicate","depart","spy","conversion","empty")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("warrior","1_31","luke","101_2","top","1_115","battle","1_115","planet","1_127")),new HashMap<>(Map.of("planet","1_289","suns","1_230","second","1_230","trooper","1_194","top","1_194","spy","1_184")),30,30,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var site=s.GetLSStartingLocation();var planet=s.GetDSCard("planet");var suns=s.GetDSCard("suns");var warrior=s.GetLSCard("warrior");var spy=s.GetDSCard("spy");
  s.MoveCardsToLocation(site,warrior,s.GetLSCard("luke"),s.GetDSCard("trooper"));s.MoveCardsToDSHand(planet,suns,s.GetDSCard("second"),spy);s.SkipToPhase(Phase.DEPLOY);s.DSActivateForceCheat(8);deployMenu(s);int before=s.GetDSForcePileCount();s.DSDeployLocation(planet);deployMenu(s);s.DSDeployCard(suns);
  for(int i=0;i<80&&suns.getAttachedTo()!=planet;i++){if(s.DSDecisionAvailable("Choose where to deploy"))s.DSChooseCard(planet);else pass(s);}assertEquals(planet,suns.getAttachedTo());deployMenu(s);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("deploymentCost",before-s.GetDSForcePileCount());row.put("nighttime",s.IsNighttimeAt(site));row.put("warriorPower",s.GetPower(warrior));assertTrue(s.IsNighttimeAt(site));assertEquals(3,s.GetPower(warrior));
  if(mode.equals("duplicate")){var second=s.GetDSCard("second");s.DSDeployCard(second);for(int i=0;i<80&&second.getAttachedTo()!=planet;i++){if(s.DSDecisionAvailable("Choose where to deploy"))s.DSChooseCard(planet);else pass(s);}assertEquals(planet,second.getAttachedTo());deployMenu(s);}
  if(mode.equals("depart")){s.MoveCardToZone(DS,suns,Zone.LOST_PILE);row.put("afterNighttime",s.IsNighttimeAt(site));row.put("afterWarriorPower",s.GetPower(warrior));}
  if(mode.equals("spy")){before=s.GetDSForcePileCount();s.DSDeployCard(spy);s.DSChooseCard(site);for(int i=0;i<80&&spy.getAtLocation()!=site;i++)pass(s);assertEquals(site,spy.getAtLocation());row.put("spyCost",before-s.GetDSForcePileCount());rows.add(row);continue;}
  if(mode.equals("conversion")){s.MoveCardsToLSHand(s.GetLSCard("planet"));s.SkipToLSTurn(Phase.DEPLOY);s.LSDeployLocation(s.GetLSCard("planet"));for(int i=0;i<80&&suns.getAttachedTo()!=s.GetLSCard("planet");i++)pass(s);row.put("convertedAttachment",suns.getAttachedTo()==s.GetLSCard("planet"));row.put("afterNighttime",s.IsNighttimeAt(site));rows.add(row);continue;}
  s.MoveCardsToDSHand(s.GetDSCard("top"));s.MoveCardsToLSHand(s.GetLSCard("top"),s.GetLSCard("battle"));s.SkipToPhase(Phase.BATTLE);
  s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("top"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("battle"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("top"));
  if(mode.equals("empty"))for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardToZone(DS,(PhysicalCardImpl)c,Zone.USED_PILE);
  var events=new ArrayList<String>();var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){if(!seen.add(e))return null;if(e instanceof BattleDestinyDrawsCompleteForBothPlayersResult){row.put("darkPower",s.GetDSTotalPower());row.put("lightPower",s.GetLSTotalPower());}if(e instanceof DestinyDrawnResult d)events.add(d.getDestinyType().toString()+":"+(d.getCard()==null?"none":d.getCard().getOwner()));return null;}});
  s.DSInitiateBattle(site);
  for(int i=0;i<150&&!s.IsReachedDamageSegment();i++){if(s.LSDecisionAvailable("battle destiny?"))s.LSChooseYes();else if(s.DSDecisionAvailable("battle destiny?"))s.DSChooseYes();else pass(s);}
  assertTrue(s.IsReachedDamageSegment());row.put("events",events);row.put("darkAttrition",s.GetUnpaidDSAttrition());row.put("lightAttrition",s.GetUnpaidLSAttrition());rows.add(row);
 }}
}
