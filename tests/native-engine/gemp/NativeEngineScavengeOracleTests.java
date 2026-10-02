package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineScavengeOracleTests {
 private static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/scavenge-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private void run(int value,boolean gear,boolean lightTurn,boolean battle,boolean reverse){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("filler","1_28","other","1_105","gun","1_152","belt","1_40","vehicle","1_148","fighter","1_28")),new HashMap<>(Map.of("card","1_275","raider1","1_196","raider2","1_196")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoDSShields,StartingSetup.NoLSShields,VirtualTableScenario.Open);
  s.StartGame();if(lightTurn)s.SkipToLSTurn(Phase.ACTIVATE);else s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(6);s.LSActivateForceCheat(3);var site=s.GetLSStartingLocation();s.MoveCardsToLocation(site,s.GetDSCard("raider1"),s.GetDSCard("raider2"));if(battle)s.MoveCardsToLocation(site,s.GetLSCard("fighter"));var card=s.GetDSCard("card");s.MoveCardsToDSHand(card);
  for(var c:new ArrayList<>(s.GetLSUsedPile()))s.MoveCardsToTopOfLSReserveDeck((PhysicalCardImpl)c);s.MoveCardsToTopOfLSUsedPile(s.GetLSCard("filler"));if(gear)s.MoveCardsToTopOfLSUsedPile(s.GetLSCard("gun"));s.MoveCardsToTopOfLSUsedPile(s.GetLSCard("other"));if(gear){s.MoveCardsToTopOfLSUsedPile(s.GetLSCard("belt"));s.MoveCardsToTopOfLSUsedPile(s.GetLSCard("vehicle"));}
  s.SkipToPhase(battle?Phase.BATTLE:Phase.CONTROL);if(battle){s.DSInitiateBattle(site);s.PassBattleStartResponses();}
  if(value<0)for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.PrepareDSDestiny(value);
  for(int i=0;i<20&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(card));i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(s.DSCardPlayAvailable(card));int force=s.GetDSForcePileCount();s.DSPlayCard(card);var viewers=new HashSet<String>();var ordering=new ArrayList<String>();boolean optionalSearch=false;
  var order=reverse?List.of("vehicle","belt","gun"):List.of("gun","belt","vehicle");
  for(int i=0;i<180&&!s.GetDSLostPile().contains(card);i++){
   String text=s.GetCurrentDecision().getText().toLowerCase(),who=s.GetDecidingPlayer();
   if(text.contains("optional")||text.contains("response")){s.PlayerPass(who);continue;}
   if(text.contains("used pile")&&!text.startsWith("choose")){viewers.add(who);if(who.equals(VirtualTableScenario.DS))s.DSChooseCards();else s.LSChooseCards();continue;}
   if(text.contains("choose card")&&text.contains("lost pile")){ordering.add(who);boolean chosen=false;for(var key:order){var c=s.GetLSCard(key);if(who.equals(VirtualTableScenario.DS)&&s.DSHasCardChoiceAvailable(c)){s.DSChooseCard(c);chosen=true;break;}if(who.equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(c)){s.LSChooseCard(c);chosen=true;break;}}if(chosen)continue;}
   if(text.contains("scavenge")||text.contains("search")){optionalSearch=true;s.DSChooseYes();continue;}
   throw new AssertionError(text+" "+s.GetCurrentDecision().getDecisionParameters());
  }
  assertTrue(s.GetDSLostPile().contains(card));var o=new LinkedHashMap<String,Object>();o.put("name",value+"-"+(gear?"gear":"empty")+"-"+(lightTurn?"light":battle?"battle":"dark")+"-"+(reverse?"reverse":"forward"));o.put("forceSpent",force-s.GetDSForcePileCount());o.put("interruptLost",true);o.put("used",s.GetLSUsedPile().stream().map(c->c.getBlueprintId(true)).toList());o.put("lost",s.GetLSLostPile().stream().map(c->c.getBlueprintId(true)).toList());o.put("revealedBoth",viewers.size()==2);o.put("orderingPlayers",ordering);o.put("optionalSearch",optionalSearch);results.add(o);
 }
 @Test public void scavengeOutcomes(){for(int value:new int[]{0,1,2,3,-1})run(value,true,false,false,false);run(1,true,false,false,true);run(1,false,false,false,false);run(1,true,true,false,false);run(1,true,false,true,false);}
}
