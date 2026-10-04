package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

public class NativeEngineAttackTimingOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/attack-timing-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 @Test public void events(){
  List<String> deployment=new ArrayList<>();
  var helper=new NativeEngineSpaceSlugOracleTests(){@Override void log(VirtualTableScenario s){String t=s.GetCurrentDecision().getText();if(t.startsWith("CHANGED_ASTEROID_CAVE_OR_SPACE_SLUG_BELLY")&&!deployment.contains("cave"))deployment.add("cave");if(t.startsWith("PLAY -")&&!deployment.contains("deployed"))deployment.add("deployed");}};
  var s=helper.fixture();s.MoveCardsToLocation(s.GetLSCard("big"),s.GetLSCard("ship"));s.SkipToPhase(Phase.BATTLE);s.LSUseCardAction(s.GetLSCard("slug"),"Initiate attack");List<String> attack=new ArrayList<>();
  for(int i=0;i<30;i++){
   String t=s.GetCurrentDecision().getText();
   if(t.startsWith("ATTACK_TARGET_SELECTED")&&!attack.contains("target"))attack.add("target");
   if(t.startsWith("ATTACK_INITIATED")&&!attack.contains("initiated"))attack.add("initiated");
   if(t.startsWith("Choose weapons segment")){attack.add("weapons");break;}
   s.PlayerPass(s.GetDecidingPlayer());
  }
  assertEquals(List.of("cave","deployed"),deployment);assertEquals(List.of("target","initiated","weapons"),attack);
  rows.add(Map.of("mode","events","deployment",deployment,"attack",attack));
 }
 @Test public void departures(){
  for(String boundary:List.of("target","initiated","weapons","before-draw","drawn","draw-complete","total")){
   var s=new NativeEngineSpaceSlugOracleTests().fixture(false);var ship=s.GetLSCard("ship");s.MoveCardsToLocation(s.GetLSCard("big"),ship);s.SkipToPhase(Phase.BATTLE);
   s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die2"),s.GetLSCard("die1"));
   int used=s.GetLSUsedPile().size(),reserve=s.GetLSReserveDeck().size();boolean removed=false;String error=null;
   s.LSUseCardAction(s.GetLSCard("slug"),"Initiate attack");
   try {for(int i=0;i<150;i++){
    String t=s.GetCurrentDecision().getText();System.out.println("TIMING "+boundary+" "+s.GetDecidingPlayer()+" "+t);
    if(t.contains("Choose Battle action")&&s.gameState().getAttackState()==null)break;
    boolean at=switch(boundary){case "target"->t.startsWith("ATTACK_TARGET_SELECTED");case "initiated"->t.startsWith("ATTACK_INITIATED");case "weapons"->t.startsWith("Choose weapons segment");case "before-draw"->t.startsWith("ABOUT_TO_DRAW_DESTINY_CARD");case "drawn"->t.startsWith("DESTINY_DRAWN");case "draw-complete"->t.startsWith("COMPLETE_DESTINY_DRAW");default->t.startsWith("DRAWING_DESTINY_COMPLETE");};
    // Controlled departure isolates the core timing rule; no removal-card admission is implied.
    if(!removed&&at){s.MoveCardsToLSHand(ship);removed=true;}
    s.PlayerPass(s.GetDecidingPlayer());
   }
   }catch(NullPointerException e){
    if(!removed||!boundary.equals("target")||!e.getMessage().contains("getPermanentCardId()"))throw e;
    error=e.getClass().getSimpleName()+": "+e.getMessage();
   }
   assertTrue(removed);if(error==null)assertNull(s.gameState().getAttackState());assertTrue(s.GetLSHand().contains(ship));
   var row=new LinkedHashMap<String,Object>();row.put("mode",boundary);row.put("ended",error==null&&s.gameState().getAttackState()==null);row.put("draws",reserve-s.GetLSReserveDeck().size());row.put("used",s.GetLSUsedPile().size()-used);row.put("shipHand",s.GetLSHand().contains(ship));row.put("error",error);rows.add(row);
  }
 }
}
