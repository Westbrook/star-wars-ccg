package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.cards.GameConditions;
import com.google.gson.GsonBuilder;
import org.junit.Test;import org.junit.AfterClass;
import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
/** Controlled spy/site/Force fixture, then actual Effect deployment, opponent-turn
 * regular landspeed action, and voluntary owner-deploy break-cover action. */
public class NativeEngineUndercoverOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/undercover-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){String t=s.GetCurrentDecision().getText();System.out.println("UC "+s.GetDecidingPlayer()+" "+t);if(t.contains("Do you want to Pass?"))s.PlayerChooseYes(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
 boolean can(VirtualTableScenario s,String side,PhysicalCardImpl c,String text){return s.GetDecidingPlayer().equals(side)&&(side.equals(LS)?s.LSCardActionAvailable(c,text):s.DSCardActionAvailable(c,text));}
 void use(VirtualTableScenario s,String side,PhysicalCardImpl c,String text){if(side.equals(LS))s.LSUseCardAction(c,text);else s.DSUseCardAction(c,text);}
 void choose(VirtualTableScenario s,String side,PhysicalCardImpl c){if(side.equals(LS))s.LSChooseCard(c);else s.DSChooseCard(c);}
 void turn(VirtualTableScenario s,String side,Phase phase){if(side.equals(LS))s.SkipToLSTurn(phase);else s.SkipToDSTurn(phase);}
 void settle(VirtualTableScenario s){for(int i=0;i<100&&!s.GetCurrentDecision().getText().matches("Choose (Deploy|Move|Control) action or Pass");i++)pass(s);}
 @Test public void undercover(){for(String mode:List.of("light","dark","light-aboard")){
  boolean light=!mode.equals("dark");String side=light?LS:DS,opponent=light?DS:LS;var s=new VirtualTableScenario(new HashMap<>(Map.of("spy","1_17","effect","2_40","troop","1_28","next","1_132","host","1_149","device","1_40")),new HashMap<>(Map.of("spy","1_184","effect","2_129","troop","1_194","device","1_207")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_285"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);var spy=light?s.GetLSCard("spy"):s.GetDSCard("spy");var effect=light?s.GetLSCard("effect"):s.GetDSCard("effect");var enemy=light?s.GetDSCard("troop"):s.GetLSCard("troop");var device=light?s.GetLSCard("device"):s.GetDSCard("device");var site=s.GetLSStartingLocation();var next=s.GetLSCard("next");s.MoveLocationToTable(next);s.MoveCardsToLocation(site,spy,enemy);s.AttachCardsTo(spy,device);if(mode.equals("light-aboard")){var host=s.GetLSCard("host");s.MoveCardsToLocation(site,host);s.BoardAsPassenger(host,spy);}
  if(light)s.MoveCardsToLSHand(effect);else s.MoveCardsToDSHand(effect);turn(s,side,Phase.DEPLOY);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);int before=s.gameState().getForcePile(side).size();use(s,side,effect,"Deploy");
  for(int i=0;i<100&&!spy.isUndercover();i++){String t=s.GetCurrentDecision().getText();if(s.GetDecidingPlayer().equals(side)&&(t.contains("Choose target")||t.contains("Choose where")))choose(s,side,spy);else pass(s);}settle(s);assertTrue(spy.isUndercover());var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("deployCost",before-s.gameState().getForcePile(side).size());row.put("ownerUnchanged",spy.getOwner().equals(side));row.put("opponentSide",spy.getZoneOwner().equals(opponent));row.put("detached",spy.getAttachedTo()==null);row.put("atSite",spy.getAtLocation()==site);row.put("activeDefault",s.gameState().isCardInPlayActive(spy,false,false,false,false,false,false,false,false));row.put("ownerOccupies",Filters.occupies(side).accepts(s.gameState(),q,site));row.put("opponentDrainProhibited",q.isProhibitedFromForceDrainingAtLocation(s.gameState(),site,opponent));row.put("deviceAttached",device.getAttachedTo()==spy);
  turn(s,opponent,Phase.CONTROL);row.put("opponentControlsForDrain",Filters.controlsForForceDrain(opponent).accepts(s.gameState(),q,site));row.put("opponentCanDrain",GameConditions.canInitiateForceDrainAtLocation(s.game(),opponent,site));s.SkipToPhase(Phase.MOVE);for(int i=0;i<70&&!can(s,side,spy,"Move");i++)pass(s);assertTrue(can(s,side,spy,"Move"));int ownerForce=s.gameState().getForcePile(side).size(),opponentForce=s.gameState().getForcePile(opponent).size();use(s,side,spy,"Move");choose(s,side,next);for(int i=0;i<100&&spy.getAtLocation()!=next;i++)pass(s);settle(s);assertSame(next,spy.getAtLocation());row.put("moveOwnerCost",ownerForce-s.gameState().getForcePile(side).size());row.put("moveOpponentCost",opponentForce-s.gameState().getForcePile(opponent).size());row.put("regularMove",q.hasPerformedRegularMoveThisTurn(spy));row.put("undercoverAfterMove",spy.isUndercover());
  turn(s,side,Phase.DEPLOY);for(int i=0;i<70&&!can(s,side,spy,"Break cover");i++)pass(s);assertTrue(can(s,side,spy,"Break cover"));use(s,side,spy,"Break cover");for(int i=0;i<100&&(spy.isUndercover()||effect.getZone().isInPlay());i++)pass(s);settle(s);row.put("coverBroken",!spy.isUndercover());row.put("effectLost",s.gameState().getLostPile(side).contains(effect));row.put("ownerSideRestored",spy.getZoneOwner().equals(side));row.put("deviceRetained",device.getAttachedTo()==spy);rows.add(row);
 }}
}
