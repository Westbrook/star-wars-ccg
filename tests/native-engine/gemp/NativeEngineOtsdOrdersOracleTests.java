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
public class NativeEngineOtsdOrdersOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/otsd-orders-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 boolean acting(VirtualTableScenario s,boolean dark){return s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS);}
 VirtualTableScenario fixture(boolean dark){var own=new HashMap<String,String>();own.put("card",dark?"106_17":"106_5");own.put("ship",dark?"106_15":"106_7");own.put("target",dark?"106_10":"106_9");own.put("site",dark?"1_295":"1_129");var enemy=new HashMap<String,String>();enemy.put("troop",dark?"1_28":"1_194");System.out.println("fixture dark="+dark);var s=new VirtualTableScenario(dark?enemy:own,dark?own:enemy,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);return s;}
 @Test public void recover(){for(boolean dark:List.of(false,true)){
  var s=fixture(dark);PhysicalCardImpl card=dark?s.GetDSCard("card"):s.GetLSCard("card"),target=dark?s.GetDSCard("target"):s.GetLSCard("target");s.MoveCardsToHand(card);s.MoveCardsToTopOfOwnLostPile(target);if(dark)s.SkipToDSTurn(Phase.DEPLOY);else s.SkipToLSTurn(Phase.DEPLOY);int beforeForce=dark?s.GetDSForcePileCount():s.GetLSForcePileCount(),beforeLife=dark?s.GetDSLifeForceRemaining():s.GetLSLifeForceRemaining();String text="Take starfighter from Lost Pile into hand";if(dark)s.DSUseCardAction(card,text);else s.LSUseCardAction(card,text);
  for(int i=0;i<150&&!(dark?s.GetDSHand():s.GetLSHand()).contains(target);i++){
   String q=s.GetCurrentDecision().getText();System.out.println("recover "+dark+" "+q);if(acting(s,dark)&&q.startsWith("Choose Force to lose")){if(dark)s.DSChooseCard(s.GetTopOfDSForcePile());else s.LSChooseCard(s.GetTopOfLSForcePile());}
   else if(acting(s,dark)&&q.toLowerCase().contains("choose")&&(q.toLowerCase().contains("starfighter")||q.toLowerCase().contains("lost pile")||q.toLowerCase().contains("into hand"))){if(dark)s.DSChooseCard(target);else s.LSChooseCard(target);}else pass(s);
  }
  assertTrue((dark?s.GetDSHand():s.GetLSHand()).contains(target));for(int i=0;i<100&&!(dark?s.GetDSLostPile():s.GetLSLostPile()).contains(card);i++)pass(s);assertTrue((dark?s.GetDSLostPile():s.GetLSLostPile()).contains(card));rows.add(Map.of("kind","recover","dark",dark,"forceSpent",beforeForce-(dark?s.GetDSForcePileCount():s.GetLSForcePileCount()),"lifeLost",beforeLife-(dark?s.GetDSLifeForceRemaining():s.GetLSLifeForceRemaining()),"target",target.getBlueprintId(false),"inHand",true,"interruptLost",true));
 }}
 @Test public void drain(){for(boolean dark:List.of(false,true)){
  var s=fixture(dark);PhysicalCardImpl card=dark?s.GetDSCard("card"):s.GetLSCard("card"),site=dark?s.GetDSCard("site"):s.GetLSCard("site"),ship=dark?s.GetDSCard("ship"):s.GetLSCard("ship"),troop=dark?s.GetLSCard("troop"):s.GetDSCard("troop");s.MoveLocationToTable(site);s.MoveCardsToLocation(site,troop);s.MoveCardsToLocation(s.GetLSStartingLocation(),ship);s.MoveCardsToHand(card);if(dark)s.SkipToLSTurn(Phase.CONTROL);else s.SkipToDSTurn(Phase.CONTROL);int before=dark?s.GetDSLifeForceRemaining():s.GetLSLifeForceRemaining();if(dark)s.LSForceDrainAt(site);else s.DSForceDrainAt(site);
  for(int i=0;i<100&&!(acting(s,dark)&&(dark?s.DSCardActionAvailable(card,"Cancel Force drain"):s.LSCardActionAvailable(card,"Cancel Force drain")));i++)pass(s);if(dark)s.DSUseCardAction(card,"Cancel Force drain");else s.LSUseCardAction(card,"Cancel Force drain");
  for(int i=0;i<100&&!(dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card);i++)pass(s);assertTrue((dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card));rows.add(Map.of("kind","drain","dark",dark,"lifeLost",before-(dark?s.GetDSLifeForceRemaining():s.GetLSLifeForceRemaining()),"interruptUsed",true));
 }}
}
