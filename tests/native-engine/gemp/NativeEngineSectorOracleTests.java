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
public class NativeEngineSectorOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/sector-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void log(VirtualTableScenario s){System.out.println("SECTOR "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));}
 @Test public void sectors(){for(String mode:List.of("cloud","asteroid-low","asteroid-high","asteroid-card","asteroid-empty")){
  System.out.println("MODE "+mode);boolean cloud=mode.equals("cloud");
  var ls=new HashMap<String,String>(Map.of("sector",cloud?"5_85":"4_81","second",cloud?"5_85":"4_81","ship","1_147","site","1_129"));var ds=new HashMap<String,String>(Map.of("die",mode.equals("asteroid-card")?"4_155":mode.equals("asteroid-high")?"1_262":"1_284"));
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var planet=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var sector=s.GetLSCard("sector");s.MoveCardsToLSHand(sector,s.GetLSCard("second"));s.MoveLocationToTable(s.GetLSCard("site"));s.LSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);
  for(var sec:List.of(sector,s.GetLSCard("second"))){if(s.GetDecidingPlayer().equals(s.DS))s.DSPass();s.LSDeployCard(sec);
   for(int i=0;i<150&&!s.GetCurrentDecision().getText().contains("Choose Deploy action");i++){log(s);var text=s.GetCurrentDecision().getText();if(text.startsWith("On which side"))s.LSChoose("Left");else if(text.contains("Choose system"))s.LSChooseCard(planet);else if(text.contains("Choose where"))s.PlayerDecided(s.GetDecidingPlayer(),"0");else s.PlayerPass(s.GetDecidingPlayer());}
   assertTrue("sector deployed",sec.getZone().isInPlay());assertTrue(s.GetCurrentDecision().getText().contains("Choose Deploy action"));
  }
  s.MoveCardsToLocation(sector,ship);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("power",s.game().getModifiersQuerying().getPower(s.gameState(),ship));row.put("maneuver",s.game().getModifiersQuerying().getManeuver(s.gameState(),ship));
  if(!cloud){s.SkipToLSTurn(Phase.CONTROL);if(mode.equals("asteroid-empty"))for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));
   s.LSPass();log(s);s.DSUseCardAction(ship);Float total=null;
   for(int i=0;i<150;i++){log(s);var text=s.GetCurrentDecision().getText();if(text.contains("Choose Control action"))break;if(text.contains("DRAWING_DESTINY_COMPLETE")&&s.gameState().getTopDrawDestinyState()!=null)total=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect().getTotalDestiny(s.game());s.PlayerPass(s.GetDecidingPlayer());}
   assertTrue(s.GetCurrentDecision().getText().contains("Choose Control action"));row.put("lost",s.GetLSLostPile().contains(ship));row.put("total",total);
  }
  rows.add(row);
 }}
}
