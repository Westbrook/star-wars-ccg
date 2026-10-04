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
public class NativeEngineSpaceSlugOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/space-slug-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void log(VirtualTableScenario s){System.out.println("SLUG "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));}
 VirtualTableScenario fixture(){return fixture(true);}
 VirtualTableScenario fixture(boolean withCave){var ls=new HashMap<String,String>(Map.of("slug","4_6","big","4_82","cave","4_83","ship","1_147","die1","1_70","die2","1_88","corvette","1_140","pilot","1_11","zero","4_81","zero2","4_81"));var s=new VirtualTableScenario(ls,new HashMap<>(),55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
 s.StartGame();
 s.MoveLocationToTable(s.GetLSCard("big"));
 if(withCave)s.MoveLocationToTable(s.GetLSCard("cave"));
 s.MoveCardsToLSHand(s.GetLSCard("slug"));
 s.LSActivateForceCheat(20);
 s.SkipToLSTurn(Phase.DEPLOY);
 s.LSDeployCard(s.GetLSCard("slug"));
 for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose Deploy action");i++){log(s);var t=s.GetCurrentDecision().getText();if(t.startsWith("Choose where"))s.LSChooseCard(s.GetLSCard("big"));else s.PlayerPass(s.GetDecidingPlayer());}
 assertTrue(s.GetCurrentDecision().getText().contains("Choose Deploy action"));assertEquals(withCave,s.GetLSCard("cave").isSpaceSlugBelly());return s;}
 @Test public void mouth(){var s=fixture();var slug=s.GetLSCard("slug");if(s.GetDecidingPlayer().equals(s.DS))s.DSPass();
 s.LSUseCardAction(slug,"Close mouth");for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose Deploy action");i++)s.PlayerPass(s.GetDecidingPlayer());assertTrue(slug.isMouthClosed());rows.add(Map.of("mode","mouth","closed",slug.isMouthClosed(),"belly",s.GetLSCard("cave").isSpaceSlugBelly()));}
 @Test public void hunt(){for(String mode:List.of("eat","relocate","closed-relocate")){boolean relocate=!mode.equals("eat");var s=fixture();PhysicalCardImpl slug=s.GetLSCard("slug"),ship=s.GetLSCard("ship");
 s.MoveCardsToLocation(s.GetLSCard("big"),ship);
 s.SkipToPhase(Phase.BATTLE);
 s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die1"),s.GetLSCard("die2"));log(s);
 s.LSUseCardAction(slug,"Initiate attack");
 for(int i=0;i<160;i++){log(s);String t=s.GetCurrentDecision().getText();if(t.contains("Choose Battle action")&&s.gameState().getAttackState()==null)break;if(mode.equals("closed-relocate")&&t.contains("Choose weapons segment")&&s.GetDecidingPlayer().equals(s.LS)&&!slug.isMouthClosed())s.LSUseCardAction(slug,"Close mouth");else if(t.contains("relocated to")){if(relocate)s.DSChooseYes();else s.DSChooseNo();}else if(t.contains("Choose player"))s.LSChoose(s.LS);else if(t.contains("Choose target"))s.LSChooseCard(ship);else s.PlayerPass(s.GetDecidingPlayer());}
 assertNull(s.gameState().getAttackState());assertEquals(!relocate,s.GetLSLostPile().contains(ship));assertEquals(relocate,ship.getAtLocation()==s.GetLSCard("cave"));rows.add(Map.of("mode",mode,"shipLost",s.GetLSLostPile().contains(ship),"inBelly",ship.getAtLocation()==s.GetLSCard("cave")));
 }}
 @Test public void assault(){for(boolean withCave:List.of(false,true)){
  var s=fixture(withCave);PhysicalCardImpl slug=s.GetLSCard("slug"),ship=s.GetLSCard("ship"),big=s.GetLSCard("big"),corvette=s.GetLSCard("corvette");
  s.MoveCardsToLocation(big,ship,corvette);
  s.BoardAsPilot(ship,s.GetLSCard("pilot"));
  s.SkipToPhase(Phase.BATTLE);
  // This helper adds each argument to the top, so supply the intended draws in reverse.
  s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("zero2"),s.GetLSCard("zero"),s.GetLSCard("die1"));
  s.LSUseCardAction(big,"Initiate attack on creature");boolean loop=false;
  try {
   for(int i=0;i<180;i++){
    log(s);String t=s.GetCurrentDecision().getText();
    if(t.contains("Choose Battle action")&&s.gameState().getAttackState()==null)break;
    if(t.equals("Do you want to draw 1 destiny?"))s.LSChooseYes();
    else if(t.contains("Choose creature"))s.LSChooseCard(slug);
    else s.PlayerPass(s.GetDecidingPlayer());
   }
  }catch(UnsupportedOperationException e){
   // Preserve this pinned-engine discrepancy instead of patching its CaveRule.
   if(!withCave||!e.getMessage().equals("There's been 5000 actions/effects since last user decision. Game is probably looping, so ending game."))throw e;
   loop=true;
  }
  assertEquals(withCave,loop);if(!loop)assertNull(s.gameState().getAttackState());
  assertTrue(s.GetLSLostPile().contains(slug));
  rows.add(Map.of("mode",withCave?"assault-cave":"assault","slugLost",s.GetLSLostPile().contains(slug),"shipLost",s.GetLSLostPile().contains(ship),"belly",s.GetLSCard("cave").isSpaceSlugBelly(),"loop",loop));
 }}
}
