package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineLostArtooOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/lost-artoo-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("ARTOO "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void artoo(){for(String mode:List.of("nav","fail","empty","astro","both","capacity","passenger")){
  System.out.println("MODE "+mode);boolean aboard=mode.equals("astro")||mode.equals("both");
  var ls=new HashMap<String,String>(Map.of("ship",mode.equals("passenger")||mode.equals("both")?"1_140":mode.equals("astro")?"1_145":"2_72","astro","2_14","luke","101_2","alter","1_71","small","1_28"));var ds=new HashMap<String,String>(Map.of("effect","1_218","die",mode.equals("fail")?"1_302":"1_262"));
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var astro=s.GetLSCard("astro");var effect=s.GetDSCard("effect");s.MoveCardsToLocation(site,ship);s.MoveCardsToDSHand(effect);s.MoveCardsToLSHand(astro,s.GetLSCard("alter"));if(aboard)s.BoardAsPassenger(ship,astro);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);s.SkipToDSTurn(Phase.DEPLOY);
  if(mode.equals("empty"))for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));int before=s.GetDSForcePileCount();s.DSDeployCard(effect);Float destiny=null;
  for(int i=0;i<200;i++){
   var text=s.GetCurrentDecision().getText();System.out.println("CURRENT "+text);
   if(text.contains("Choose Deploy action")&&(!effect.getZone().isInPlay()||effect.getAttachedTo()==ship))break;
   if(text.contains("COMPLETE_DESTINY_DRAW")&&s.gameState().getTopDrawDestinyState()!=null)destiny=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect().getDestinyDrawValue();
   if(text.contains("Choose target")&&s.GetCurrentDecision().getDecisionParameters().get("results")!=null)s.DSChoose(aboard?"Astromech Droid":"Nav Computer");
   else if(text.contains("Choose astromech"))s.DSChooseCard(astro);
   else if(text.contains("Choose where")||text.contains("Choose target"))s.DSChooseCard(ship);
   else pass(s);
  }
  assertTrue("deployment settled",s.GetCurrentDecision().getText().contains("Choose Deploy action"));int cost=before-s.GetDSForcePileCount();assertEquals(1,cost);
  if(mode.equals("capacity")||mode.equals("passenger")){
   s.BoardAsPassenger(ship,astro);s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("luke"));s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("small"));s.SkipToLSTurn(Phase.CONTROL);s.LSPlayCard(s.GetLSCard("alter"));
   for(int i=0;i<200;i++){var text=s.GetCurrentDecision().getText();if(text.contains("Choose Control action")&&s.GetLSUsedPile().contains(s.GetLSCard("alter")))break;
    if(text.contains("Choose Effect")||text.contains("Choose target"))s.LSChooseCard(effect);
    else if(text.toLowerCase().contains("character"))s.LSChooseCard(s.GetLSCard("luke"));else pass(s);
   }
  }
  if(mode.equals("capacity")||mode.equals("passenger")){assertTrue("Alter settled",s.GetCurrentDecision().getText().contains("Choose Control action"));assertTrue(s.GetDSLostPile().contains(effect));}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("destiny",destiny);row.put("cost",cost);row.put("effectLost",s.GetDSLostPile().contains(effect));row.put("astroLost",s.GetLSLostPile().contains(astro));row.put("astroUsed",s.GetLSUsedPile().contains(astro));row.put("astroAboard",astro.getAttachedTo()==ship);row.put("navigation",s.game().getModifiersQuerying().hasIcon(s.gameState(),ship,Icon.NAV_COMPUTER));row.put("astromechs",s.game().getModifiersQuerying().getAstromechCapacity(s.gameState(),ship));rows.add(row);
 }}
}
