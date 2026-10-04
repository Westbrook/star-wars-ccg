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
/** Real battle initiation, Interrupt play and nested movement; board/Force are controlled fixtures. */
public class NativeEngineHyperEscapeOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/hyper-escape-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("ESCAPE "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 boolean can(VirtualTableScenario s,PhysicalCardImpl card){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.LSCardPlayAvailable(card);}
 @Test public void escape(){for(String mode:List.of("single","two-ships","one-force","no-force","out-of-range","no-destination","own-battle","weapon-and-crew")){
  System.out.println("MODE "+mode);var ls=new HashMap<String,String>(Map.of("ship","1_147","second","1_147","escape","1_88","destination",mode.equals("out-of-range")?"2_143":"1_135","crew","2_15","weapon","1_158"));
  // Coruscant belongs to Dark. Keep actual card ownership valid.
  if(mode.equals("out-of-range"))ls.remove("destination");var ds=new HashMap<String,String>(Map.of("enemy","1_302"));if(mode.equals("out-of-range"))ds.put("destination","2_143");
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var origin=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var second=s.GetLSCard("second");var card=s.GetLSCard("escape");var dest=mode.equals("out-of-range")?s.GetDSCard("destination"):s.GetLSCard("destination");
  if(!mode.equals("no-destination"))s.MoveLocationToTable(dest);s.MoveCardsToLocation(origin,ship,s.GetDSCard("enemy"));if(mode.equals("two-ships")||mode.equals("one-force"))s.MoveCardsToLocation(origin,second);s.MoveCardsToLSHand(card);s.DSActivateForceCheat(8);s.LSActivateForceCheat(mode.equals("no-force")?0:mode.equals("one-force")?1:8);if(mode.equals("weapon-and-crew")){s.BoardAsPassenger(ship,s.GetLSCard("crew"));s.AttachCardsTo(ship,s.GetLSCard("weapon"));}
  if(mode.equals("own-battle")){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(origin);}else{s.SkipToDSTurn(Phase.BATTLE);if(mode.equals("no-force")||mode.equals("one-force")){for(var c:new ArrayList<>(s.GetLSForcePile()))s.MoveCardsToTopOfLSReserveDeck((PhysicalCardImpl)c);if(mode.equals("one-force"))s.LSActivateForceCheat(1);}s.DSInitiateBattle(origin);}int before=s.GetLSForcePileCount();boolean offered=false;
  for(int i=0;i<70;i++){if(can(s,card)){offered=true;break;}if(s.GetCurrentDecision().getText().contains("weapons segment"))break;pass(s);}
  if(offered){s.LSPlayCard(card);for(int i=0;i<180&&!s.GetLSUsedPile().contains(card);i++){
   String t=s.GetCurrentDecision().getText();if(t.toLowerCase().contains("choose")&&t.toLowerCase().contains("move away"))s.LSChooseCard(s.LSHasCardChoiceAvailable(ship)?ship:second);
   else if(t.toLowerCase().contains("choose")&&(t.toLowerCase().contains("system")||t.toLowerCase().contains("location")||t.toLowerCase().contains("move to")))s.LSChooseCard(dest);
   else pass(s);
  }assertTrue(s.GetLSUsedPile().contains(card));}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("offered",offered);row.put("shipMoved",ship.getAtLocation()==dest);row.put("secondMoved",second.getAtLocation()==dest);row.put("movementCost",before-s.GetLSForcePileCount());row.put("used",s.GetLSUsedPile().contains(card));if(mode.equals("weapon-and-crew")){row.put("crewAboard",s.GetLSCard("crew").getAttachedTo()==ship);row.put("weaponAttached",s.GetLSCard("weapon").getAttachedTo()==ship);row.put("shipRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(ship));row.put("crewRegularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(s.GetLSCard("crew")));}rows.add(row);
 }}
}
