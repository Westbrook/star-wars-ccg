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
public class NativeEngineDroidServiceOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/droid-service-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 boolean acting(VirtualTableScenario s,boolean dark){return s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS);}
 VirtualTableScenario fixture(boolean dark){var own=new HashMap<String,String>();own.put("effect",dark?"106_14":"106_3");own.put("card",dark?"1_250":"1_108");own.put("droid",dark?"2_101":"1_5");own.put("site",dark?"1_295":"1_129");var enemy=new HashMap<String,String>();enemy.put("troop",dark?"1_28":"1_194");var s=new VirtualTableScenario(dark?enemy:own,dark?own:enemy,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);return s;}
 @Test public void lossAndCancel(){for(boolean dark:List.of(false,true))for(boolean cancel:List.of(false,true)){
  var s=fixture(dark);PhysicalCardImpl effect=dark?s.GetDSCard("effect"):s.GetLSCard("effect"),card=dark?s.GetDSCard("card"):s.GetLSCard("card"),droid=dark?s.GetDSCard("droid"):s.GetLSCard("droid"),site=dark?s.GetDSCard("site"):s.GetLSCard("site"),troop=dark?s.GetLSCard("troop"):s.GetDSCard("troop");s.AttachCardsTo(dark?s.GetLSStartingLocation():s.GetDSStartingLocation(),effect);s.MoveLocationToTable(site);s.MoveCardsToLocation(site,troop);s.MoveCardsToHand(card);if(cancel)s.MoveCardsToLocation(site,droid);else s.MoveCardsToHand(droid);if(dark)s.SkipToLSTurn(Phase.CONTROL);else s.SkipToDSTurn(Phase.CONTROL);int beforeLost=(dark?s.GetDSLostPile():s.GetLSLostPile()).size();if(dark)s.LSForceDrainAt(site);else s.DSForceDrainAt(site);
  if(cancel){for(int i=0;i<100&&!(acting(s,dark)&&(dark?s.DSCardActionAvailable(card,"Cancel Force drain"):s.LSCardActionAvailable(card,"Cancel Force drain")));i++)pass(s);if(dark)s.DSUseCardAction(card,"Cancel Force drain");else s.LSUseCardAction(card,"Cancel Force drain");for(int i=0;i<100&&!(dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card);i++)pass(s);assertTrue((dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(card));rows.add(Map.of("kind","drain-cancel","dark",dark,"interruptUsed",true,"cardsLost",(dark?s.GetDSLostPile():s.GetLSLostPile()).size()-beforeLost));}
  else{for(int i=0;i<100&&!(acting(s,dark)&&s.GetCurrentDecision().getText().startsWith("Choose Force to lose"));i++)pass(s);System.out.println("LOSS "+dark+" "+s.GetCurrentDecision().getText());if(dark)s.DSChooseCard(droid);else s.LSChooseCard(droid);for(int i=0;i<100&&!(dark?s.GetDSLostPile():s.GetLSLostPile()).contains(droid);i++)pass(s);assertTrue((dark?s.GetDSLostPile():s.GetLSLostPile()).contains(droid));for(int i=0;i<20&&!s.GetCurrentDecision().getText().toLowerCase().contains("action");i++){System.out.println("AFTER "+s.GetCurrentDecision().getText());assertFalse(s.GetCurrentDecision().getText().startsWith("Choose Force to lose"));pass(s);}rows.add(Map.of("kind","droid-loss","dark",dark,"droidLost",true,"cardsLost",(dark?s.GetDSLostPile():s.GetLSLostPile()).size()-beforeLost));}
 }}
}
