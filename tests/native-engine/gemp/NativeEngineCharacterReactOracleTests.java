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
/** Real Wolfman reactions, disembarking, embarking and Sense; initial table and Force are fixtures. */
public class NativeEngineCharacterReactOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/character-react-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("CHARREACT "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void reacts(){for(String mode:List.of("ground","open","closed","landed","cancel","sense-fails","embark","ground-embark","battle")){
  boolean ground=mode.startsWith("ground"),embark=mode.endsWith("embark"),battle=mode.equals("battle"),cancel=mode.equals("cancel"),trySense=cancel||mode.equals("sense-fails");
  var s=new VirtualTableScenario(new HashMap<>(Map.of("host",mode.equals("landed")?"1_147":mode.equals("open")?"1_149":"1_151","wolf","1_30","gun","1_152","dune","1_130","dest","1_149","rebel","1_28")),new HashMap<>(Map.of("vader","101_5","sense","1_267")),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var from=s.GetLSStartingLocation();var to=s.GetLSCard("dune");var host=s.GetLSCard("host");var wolf=s.GetLSCard("wolf");var gun=s.GetLSCard("gun");var dest=s.GetLSCard("dest");var vader=s.GetDSCard("vader");var sense=s.GetDSCard("sense");
  s.MoveLocationToTable(to);s.MoveCardsToLocation(from,host);if(ground)s.MoveCardsToLocation(from,wolf);else s.AttachCardsTo(host,wolf);s.AttachCardsTo(wolf,gun);if(embark)s.MoveCardsToLocation(to,dest);s.MoveCardsToLocation(to,vader);if(battle)s.MoveCardsToLocation(to,s.GetLSCard("rebel"));s.MoveCardsToDSHand(sense);s.DSActivateForceCheat(12);s.LSActivateForceCheat(8);s.SkipToDSTurn(battle?Phase.BATTLE:Phase.CONTROL);s.PrepareDSDestiny(mode.equals("sense-fails")?6:0);if(battle)s.DSInitiateBattle(to);else s.DSForceDrainAt(to);
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSCardActionAvailable(wolf,"react"));i++)pass(s);assertTrue(s.LSCardActionAvailable(wolf,"react"));int before=s.GetLSForcePileCount();s.LSUseCardAction(wolf,"react");if(s.LSDecisionAvailable("Choose where"))s.LSChooseCard(to);
  boolean exited=false,boarded=false,sensed=false;for(int i=0;i<180;i++){
   if(s.LSDecisionAvailable("Perform a movement before")){if(!exited&&!ground){s.LSUseCardAction(wolf,"Disembark");exited=true;}else s.LSPass();}
   else if(s.LSDecisionAvailable("Perform a movement after")){if(embark&&!boarded){s.LSUseCardAction(wolf,"Embark");boarded=true;}else s.LSPass();}
   else if(s.LSDecisionAvailable("Choose where")&&s.LSHasCardChoiceAvailable(dest))s.LSChooseCard(dest);
   else if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose("Passenger");
   else if(trySense&&!sensed&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardPlayAvailable(sense)){assertNull(wolf.getAttachedTo());assertEquals(from,wolf.getAtLocation());s.DSPlayCard(sense);sensed=true;if(s.DSDecisionAvailable("highest-ability"))s.DSChooseCard(vader);}
   else if(s.gameState().getMoveAsReactState()==null&&(cancel?s.GetDSUsedPile().contains(sense):wolf.getAtLocation()==to||wolf.getAttachedTo()==dest))break;
   else pass(s);
  }
  assertEquals(!cancel,embark?wolf.getAttachedTo()==dest:wolf.getAtLocation()==to);if(trySense)assertTrue(sensed);
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",before-s.GetLSForcePileCount());row.put("leftCarrier",wolf.getAttachedTo()!=host);row.put("atDestination",wolf.getAtLocation()==to||wolf.getAttachedTo()==dest);row.put("boarded",wolf.getAttachedTo()==dest);row.put("gunCarried",gun.getAttachedTo()==wolf);row.put("regularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(wolf));if(cancel)row.put("locked",s.game().getModifiersQuerying().isProhibitedFromParticipatingInReact(s.gameState(),wolf));rows.add(row);
 }}
}
