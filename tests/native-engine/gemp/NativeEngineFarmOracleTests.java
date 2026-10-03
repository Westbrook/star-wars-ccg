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
public class NativeEngineFarmOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/farm-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("hydro","1_37","second","1_37","vapor","1_41")),new HashMap<>(),40,40,StartingSetup.LSStartingLocation("1_132"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);return s;}
 @Test public void activation(){for(String mode:List.of("alone","vapor","decline-first","two-stations")){var s=fixture();s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("hydro"));if(mode.equals("two-stations"))s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("second"));if(mode.equals("vapor")||mode.equals("decline-first"))s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("vapor"));s.SkipToLSTurn(Phase.ACTIVATE);int hand=s.GetLSHandCount(),force=s.GetLSForcePileCount();s.LSChooseAction("Activate Force");s.LSDecided(3);if(s.DSDecisionAvailable("Choose amount of Force to allow opponent to activate without you performing a top-level action"))s.DSDecided(3);int draws=0,offers=0;boolean declined=false;for(int i=0;i<100;i++){System.out.println("FARM "+mode+" "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters());if(s.GetDecidingPlayer().equals(LS)&&s.LSCardActionAvailable(s.GetLSCard("hydro"),"Draw activated Force into hand")){offers++;if(mode.equals("decline-first")&&!declined){declined=true;pass(s);}else{s.LSUseCardAction(s.GetLSCard("hydro"),"Draw activated Force into hand");draws++;}}else if(s.AwaitingLSActivatePhaseActions()||s.AwaitingDSActivatePhaseActions())break;else pass(s);}
 rows.add(Map.of("name",mode,"draws",draws,"offers",offers,"hand",s.GetLSHandCount()-hand,"force",s.GetLSForcePileCount()-force));assertEquals(3,s.GetLSHandCount()-hand+s.GetLSForcePileCount()-force);
 }}
 @Test public void deploy(){for(String card:List.of("hydro","vapor")){var s=fixture();var c=s.GetLSCard(card);s.MoveCardsToHand(c);s.SkipToLSTurn(Phase.DEPLOY);s.LSActivateForceCheat(2);int before=s.GetLSForcePileCount();s.LSDeployCard(c);for(int i=0;i<50&&c.getAttachedTo()==null;i++){System.out.println("FARM DEPLOY "+card+" zone="+c.getZone()+" "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());if(s.GetDecidingPlayer().equals(LS)&&s.LSHasCardChoiceAvailable(s.GetLSStartingLocation()))s.LSChooseCard(s.GetLSStartingLocation());else pass(s);}assertEquals(s.GetLSStartingLocation(),c.getAttachedTo());rows.add(Map.of("name","deploy-"+card,"cost",before-s.GetLSForcePileCount()));}}
}
