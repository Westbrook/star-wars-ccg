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
public class NativeEngineStewOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/stew-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 VirtualTableScenario fixture(boolean light){var s=new VirtualTableScenario(new HashMap<>(Map.of("stew","1_72","beru","1_2","owen","1_22","hydro","1_37","vapor","1_41")),new HashMap<>(),40,40,StartingSetup.LSStartingLocation("1_132"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.MoveCardsToHand(s.GetLSCard("stew"));s.SkipToPhase(Phase.CONTROL);if(light)s.SkipToLSTurn(Phase.ACTIVATE);if(!s.GetDecidingPlayer().equals(LS))pass(s);return s;}
 void trim(VirtualTableScenario s,String side,int count){var cards=new ArrayList<>(side.equals(LS)?s.GetLSReserveDeck():s.GetDSReserveDeck());while(cards.size()>count){s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)cards.removeLast());}}
 @Test public void eligibility(){for(String mode:List.of("empty-light","empty-dark","empty-both")){var s=fixture(false);if(!mode.equals("empty-dark"))trim(s,LS,0);if(!mode.equals("empty-light"))trim(s,DS,0);s.SkipToPhase(Phase.DEPLOY);if(!s.GetDecidingPlayer().equals(LS))pass(s);rows.add(Map.of("name",mode,"offered",s.LSCardActionAvailable(s.GetLSCard("stew"))));}}
 @Test public void results(){for(String mode:List.of("dark-turn","light-turn","bonus-zero","bonus-max","hydro","vapor","short-dark","short-light","short-both","source-leaves")){
  boolean light=List.of("light-turn","hydro","vapor","source-leaves").contains(mode);var s=fixture(light);var stew=s.GetLSCard("stew");
  boolean bonus=mode.startsWith("bonus")||mode.equals("source-leaves");if(bonus){s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("beru"),s.GetLSCard("owen"));s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("hydro"));}
  if(mode.equals("hydro")||mode.equals("vapor"))s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("hydro"));if(mode.equals("vapor"))s.AttachCardsTo(s.GetLSStartingLocation(),s.GetLSCard("vapor"));
  if(mode.equals("short-light")||mode.equals("short-both"))trim(s,LS,1);if(mode.equals("short-dark")||mode.equals("short-both"))trim(s,DS,1);
  int lf=s.GetLSForcePileCount(),df=s.GetDSForcePileCount(),hand=s.GetLSHandCount(),draws=0,extra=-1;boolean orderPrompt=false,changed=false;List<String> order=new ArrayList<>();int lastL=s.GetLSReserveDeckCount(),lastD=s.GetDSReserveDeckCount();
  System.out.println("START "+mode+" "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" reserves="+lastL+"/"+lastD+" hand="+s.GetLSHand().contains(stew)+" zone="+stew.getZone());
  s.GetCurrentDecision().getDecisionParameters().forEach((k,v)->System.out.println(k+"="+Arrays.toString(v)));s.LSPlayCard(stew);
  for(int i=0;i<180&&!s.GetLSLostPile().contains(stew);i++){
   int l=s.GetLSReserveDeckCount(),d=s.GetDSReserveDeckCount();for(int n=l;n<lastL;n++)order.add("light");for(int n=d;n<lastD;n++)order.add("dark");lastL=l;lastD=d;
   String text=s.GetCurrentDecision().getText();System.out.println("STEW "+mode+" "+s.GetDecidingPlayer()+" "+text+" "+s.GetCurrentDecision().getDecisionParameters());
   if(mode.equals("source-leaves")&&!changed&&text.contains("Force just activated")){s.MoveCardsToHand(s.GetLSCard("beru"));changed=true;}
   if(text.contains("Choose effect to be performed first")){orderPrompt=true;s.PlayerDecided(s.GetDecidingPlayer(),"0");}
   else if(text.contains("Choose number of additional Force")){extra=mode.equals("bonus-zero")?0:s.LSGetChoiceMax();s.LSDecided(extra);}
   else if(s.GetDecidingPlayer().equals(LS)&&s.LSCardActionAvailable(s.GetLSCard("hydro"),"Draw activated Force into hand")){s.LSUseCardAction(s.GetLSCard("hydro"),"Draw activated Force into hand");draws++;}
   else pass(s);
  }
  int l=s.GetLSReserveDeckCount(),d=s.GetDSReserveDeckCount();for(int n=l;n<lastL;n++)order.add("light");for(int n=d;n<lastD;n++)order.add("dark");assertTrue(s.GetLSLostPile().contains(stew));if(mode.equals("source-leaves"))assertTrue(changed);
  var row=new LinkedHashMap<String,Object>();row.put("name",mode);row.put("light",s.GetLSForcePileCount()-lf);row.put("dark",s.GetDSForcePileCount()-df);row.put("draws",draws);row.put("extra",extra);row.put("orderPrompt",orderPrompt);rows.add(row);
 }}
}
