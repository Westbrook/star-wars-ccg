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
public class NativeEngineGeneratorOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/generator-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("generator","3_61","trench","3_63","trooper","1_28","rifle","1_153"));var ds=new HashMap<String,String>(Map.of("walker","3_155","gun","3_158","event","3_115","again","3_115","die","1_262","low","1_194","troop","1_194","ridge","3_149","ridgeTroop","1_194"));ds.put("pilot","1_179");ds.put("three","3_158");var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("3_59"),StartingSetup.DSStartingLocation("3_144"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");for(String k:List.of("generator","trench"))s.MoveLocationToTable(s.GetLSCard(k));s.MoveLocationToTable(s.GetDSCard("ridge"));s.MoveCardsToLocation(s.GetLSCard("trench"),s.GetDSCard("walker"));s.AttachCardsTo(s.GetDSCard("walker"),s.GetDSCard("gun"));s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("troop"));s.MoveCardsToLocation(s.GetDSCard("ridge"),s.GetDSCard("ridgeTroop"));s.MoveCardsToLocation(s.GetLSCard("generator"),s.GetLSCard("trooper"));s.AttachCardsTo(s.GetLSCard("trooper"),s.GetLSCard("rifle"));s.MoveCardsToDSHand(s.GetDSCard("event"),s.GetDSCard("again"));return s;}
 void run(String mode){boolean success=mode.equals("success")||mode.equals("chosen-pilot");var s=fixture();if(mode.equals("chosen-pilot"))s.BoardAsPilot(s.GetDSCard("walker"),s.GetDSCard("pilot"));s.SkipToDSTurn(Phase.CONTROL);var event=s.GetDSCard("event");s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard(mode.equals("success")?"die":mode.equals("failure")?"low":"three"));int force=s.GetDSForcePile().size(),lost=s.GetLSLostPile().size();s.DSUseCardAction(event);boolean lossBeforeFlip=false,cardsBeforeForce=false;
 for(int i=0;i<180&&s.GetDSLostPile().stream().noneMatch(c->c.getBlueprintId(true).equals("3_115"))&&s.GetDSUsedPile().stream().noneMatch(c->c.getBlueprintId(true).equals("3_115"));i++){String t=s.GetCurrentDecision().getText();if(t.contains("Choose AT-AT Cannon"))s.DSChooseCard(s.GetDSCard("gun"));else if(t.contains("Choose AT-AT pilot"))s.DSChooseCard(s.GetDSCard(mode.equals("chosen-pilot")?"pilot":"walker"));else if(t.equals("Choose Force to lose")){cardsBeforeForce=s.GetLSLostPile().stream().anyMatch(c->c.getBlueprintId(true).equals("1_28"));lossBeforeFlip=!s.GetLSCard("generator").isBlownAway();s.LSChooseCard((PhysicalCardImpl)s.GetLSReserveDeck().getFirst());}else if(t.startsWith("Choose card to put on Lost Pile")){s.LSDecided(s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);}else s.PlayerPass(s.GetDecidingPlayer());}
 assertTrue((success?s.GetDSLostPile():s.GetDSUsedPile()).stream().anyMatch(c->c.getBlueprintId(true).equals("3_115")));assertEquals(success,s.GetLSCard("generator").isBlownAway());assertEquals(force,s.GetDSForcePile().size());var row=new LinkedHashMap<String,Object>();row.put("case",mode);row.put("blownAway",s.GetLSCard("generator").isBlownAway());row.put("eventZone",success?"lost":"used");row.put("lightCardsLost",s.GetLSLostPile().size()-lost);row.put("forceSpent",force-s.GetDSForcePile().size());row.put("shieldActive",s.game().getModifiersQuerying().isLocationUnderHothEnergyShield(s.gameState(),s.GetLSCard("trench")));if(success){assertTrue(cardsBeforeForce);assertTrue(lossBeforeFlip);row.put("cardsBeforeForce",true);row.put("lossBeforeFlip",true);}rows.add(row);
 }
 @Test public void success(){run("success");}
 @Test public void failure(){run("failure");}
 @Test public void exactlyEight(){run("exact-eight");}
 @Test public void chosenPilot(){run("chosen-pilot");}
}
