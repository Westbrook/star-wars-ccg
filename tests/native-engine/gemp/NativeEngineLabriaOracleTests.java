package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual Labria action; board/top-card/source departure are controlled fixtures. */
public class NativeEngineLabriaOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/labria-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("LABRIA "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void reveal(){for(String mode:List.of("reserve","force","used","vehicle","starship","source-departs","short","insert-reserve","insert-force")){
  String bp=mode.equals("vehicle")?"1_309":mode.equals("starship")?"1_304":"1_194";
  var s=new VirtualTableScenario(new HashMap<>(Map.of("insert","1_42")),new HashMap<>(Map.of("labria","1_184","top",bp)),20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var labria=s.GetDSCard("labria");var top=s.GetDSCard("top");var insert=s.GetLSCard("insert");s.MoveCardsToLocation(s.GetDSStartingLocation(),labria);s.SkipToPhase(Phase.CONTROL);s.MoveCardToZone(DS,top,Zone.HAND);s.MoveCardsToTopOfDSReserveDeck(top);
  if(mode.equals("short"))for(var c:new ArrayList<>(s.GetDSReserveDeck()).subList(1,s.GetDSReserveDeck().size()))s.MoveCardToZone(DS,(com.gempukku.swccgo.game.PhysicalCardImpl)c,Zone.USED_PILE);
  if(mode.startsWith("insert"))new NativeEngineReservePeekOracleTests().insert(s,insert,DS,1);
  for(int i=0;i<40&&!(s.GetDecidingPlayer().equals(DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.DSCardActionAvailable(labria));i++)pass(s);
  assertTrue(s.DSCardActionAvailable(labria));s.DSUseCardAction(labria);
  if(mode.equals("source-departs"))s.MoveCardsToDSHand(labria);
  for(int i=0;i<60&&!s.GetCurrentDecision().getText().startsWith("Top card");i++)pass(s);
  assertTrue(s.DSDecisionAvailable("Top card"));assertTrue(s.LSDecisionAvailable("Top card"));assertTrue(s.GetDSReserveDeck().contains(top));
  boolean both=true; s.PlayerDecided(LS,"");s.PlayerDecided(DS,"");
  int chosen=-1;boolean loss=mode.equals("vehicle")||mode.equals("starship");
  if(!loss){for(int i=0;i<60&&!s.GetCurrentDecision().getText().startsWith("Choose card pile");i++)pass(s);assertTrue(s.DSDecisionAvailable("Choose card pile"));chosen=mode.equals("used")?2:mode.equals("force")||mode.equals("insert-force")?1:0;s.PlayerDecided(DS,Integer.toString(chosen));}
  Zone expected=loss?Zone.LOST_PILE:chosen==1?Zone.FORCE_PILE:chosen==2?Zone.USED_PILE:Zone.RESERVE_DECK;
  for(int i=0;i<60&&com.gempukku.swccgo.logic.GameUtils.getZoneFromZoneTop(top.getZone())!=expected;i++)pass(s);assertEquals(expected,com.gempukku.swccgo.logic.GameUtils.getZoneFromZoneTop(top.getZone()));
  boolean repeat=false;for(int i=0;i<60;i++){
   if(s.DSDecisionAvailable("Choose Control action")){repeat=s.DSCardActionAvailable(labria);break;}
   if(mode.startsWith("insert")&&insert.isInsertCardRevealed())break;
   pass(s);
  }
  assertFalse(mode,repeat);
  rows.add(Map.of("mode",mode,"blueprint",bp,"destination",expected.toString(),"bothSeeReveal",both,"repeat",repeat,"insertRevealed",insert.isInsertCardRevealed(),"insertLost",s.GetLSLostPile().contains(insert)));
 }}
}
