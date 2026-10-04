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
public class NativeEngineGroundCreatureOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/ground-creature-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void log(VirtualTableScenario s){System.out.println("GROUND-CREATURE "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("creature","6_48","trooper","1_28","gun","1_153","die","1_88"));var ds=new HashMap<String,String>(Map.of("trooper","1_194","gun","1_312","die","1_249"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
 s.StartGame();s.MoveCardsToLSHand(s.GetLSCard("creature"));s.LSActivateForceCheat(20);s.DSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);int before=s.GetLSForcePileCount();s.LSDeployCard(s.GetLSCard("creature"));
 for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose Deploy action");i++){log(s);if(s.GetCurrentDecision().getText().startsWith("Choose where"))s.LSChooseCard(s.GetLSStartingLocation());else s.PlayerPass(s.GetDecidingPlayer());}
 assertEquals(s.GetLSStartingLocation(),s.GetLSCard("creature").getAtLocation());assertEquals(2,before-s.GetLSForcePileCount());assertEquals(4,s.GetDefense(s.GetLSCard("creature")));return s;}
 @Test public void attacks(){for(boolean hunt:List.of(false,true))for(boolean fire:List.of(false,true)){
 var s=fixture();var creature=s.GetLSCard("creature");var target=hunt?s.GetDSCard("trooper"):s.GetLSCard("trooper");var gun=hunt?s.GetDSCard("gun"):s.GetLSCard("gun");var die=hunt?s.GetDSCard("die"):s.GetLSCard("die");
 s.MoveCardsToLocation(s.GetLSStartingLocation(),target);s.AttachCardsTo(target,gun);s.SkipToPhase(Phase.BATTLE);if(hunt)s.MoveCardsToTopOfDSReserveDeck(die);else s.MoveCardsToTopOfLSReserveDeck(die);
 s.LSUseCardAction(hunt?creature:s.GetLSStartingLocation(),hunt?"Initiate attack":"Initiate attack on creature");boolean fired=false,hitDuring=false;int before=hunt?s.GetDSForcePileCount():s.GetLSForcePileCount();
 for(int i=0;i<180;i++){log(s);String t=s.GetCurrentDecision().getText();if(t.contains("Choose Battle action")&&s.gameState().getAttackState()==null)break;
 if(fire&&!fired&&t.contains("Choose weapons segment")&&s.GetDecidingPlayer().equals(hunt?s.DS:s.LS)) {if(hunt){s.DSUseCardAction(gun,"Fire");s.DSChooseCard(creature);}else{s.LSUseCardAction(gun,"Fire");s.LSChooseCard(creature);}fired=true;}
 else if(t.equals("Choose card to put on Lost Pile")){if(hunt)s.DSChooseCard(s.DSHasCardChoiceAvailable(target)?target:gun);else s.LSChooseCard(s.LSHasCardChoiceAvailable(target)?target:gun);}else if(t.contains("Choose creature"))s.LSChooseCard(creature);else if(t.contains("Choose player"))s.LSChoose(hunt?s.DS:s.LS);else if(t.contains("Choose target"))s.LSChooseCard(target);else s.PlayerPass(s.GetDecidingPlayer());
 if(creature.isHit())hitDuring=true;
 }
 assertNull(s.gameState().getAttackState());var row=new LinkedHashMap<String,Object>();row.put("hunt",hunt);row.put("fire",fire);row.put("creatureLost",s.GetLSLostPile().contains(creature));row.put("targetLost",(hunt?s.GetDSLostPile():s.GetLSLostPile()).contains(target));row.put("hitDuring",hitDuring);row.put("firingCost",before-(hunt?s.GetDSForcePileCount():s.GetLSForcePileCount()));rows.add(row);
 assertEquals(fire,s.GetLSLostPile().contains(creature));assertEquals(hunt,(hunt?s.GetDSLostPile():s.GetLSLostPile()).contains(target));
 }}
}
