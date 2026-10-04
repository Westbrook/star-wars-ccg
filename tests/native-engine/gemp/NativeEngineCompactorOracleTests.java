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
public class NativeEngineCompactorOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/compactor-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("PASS "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("compactor","1_125","flyboy","1_89","troop","1_28","droid","1_5","gun","1_152","scomp","1_108","r2","2_14"));var ds=new HashMap<String,String>(Map.of("enemy","1_194","crush","1_278","boring","1_235"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_285"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);s.MoveLocationToTable(s.GetLSCard("compactor"));return s;}
 @Test public void relocate(){for(boolean own:List.of(false,true)){
  var s=fixture();var origin=s.GetDSStartingLocation();var dest=s.GetLSCard("compactor");var troop=s.GetLSCard("troop");var droid=s.GetLSCard("droid");var card=s.GetLSCard("flyboy");var gun=s.GetLSCard("gun");s.MoveCardsToLocation(origin,troop,droid,s.GetDSCard("enemy"));s.AttachCardsTo(troop,gun);s.MoveCardsToHand(card);
  if(own){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(origin);}else{s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(origin);}int before=s.GetLSForcePileCount();boolean offered=false;
  for(int i=0;i<100;i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.LSCardPlayAvailable(card)){offered=true;break;}pass(s);}assertTrue(offered);s.LSPlayCard(card);for(int i=0;i<150&&!s.GetLSUsedPile().contains(card);i++){System.out.println("FLY "+s.GetCurrentDecision().getText());pass(s);}assertTrue(s.GetLSUsedPile().contains(card));assertEquals(dest,troop.getAtLocation());assertEquals(dest,droid.getAtLocation());assertEquals(troop,gun.getAttachedTo());
  rows.add(Map.of("kind","relocate","ownBattle",own,"troopMoved",troop.getAtLocation()==dest,"droidMoved",droid.getAtLocation()==dest,"weaponAttached",gun.getAttachedTo()==troop,"forcePaid",before-s.GetLSForcePileCount(),"regularMove",s.game().getModifiersQuerying().hasPerformedRegularMoveThisTurn(troop),"used",s.GetLSUsedPile().contains(card)));
 }}
 @Test public void crush(){var s=fixture();var site=s.GetLSCard("compactor");var troop=s.GetLSCard("troop");var enemy=s.GetDSCard("enemy");var gun=s.GetLSCard("gun");var card=s.GetDSCard("crush");s.MoveCardsToLocation(site,troop,enemy);s.AttachCardsTo(troop,gun);s.MoveCardsToHand(card);s.SkipToDSTurn(Phase.DEPLOY);s.DSUseCardAction(card,"Make everything");
  for(int i=0;i<100&&!s.GetCurrentDecision().getText().contains("Choose card to be lost");i++)pass(s);assertEquals(VirtualTableScenario.DS,s.GetDecidingPlayer());s.DSChooseCard(troop);
  for(int i=0;i<100&&!s.GetLSLostPile().contains(gun);i++){String t=s.GetCurrentDecision().getText();System.out.println("CRUSH "+s.GetDecidingPlayer()+" "+t);if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(troop))s.LSChooseCard(troop);else if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.LSHasCardChoiceAvailable(gun))s.LSChooseCard(gun);else pass(s);}
  assertTrue(s.GetLSLostPile().contains(troop));assertTrue(s.GetLSLostPile().contains(gun));assertFalse(s.GetDSLostPile().contains(enemy));for(int i=0;i<100&&!s.GetDSLostPile().contains(card);i++)pass(s);assertTrue(s.GetDSLostPile().contains(card));rows.add(Map.of("kind","crush","actorChooses",true,"attachmentsLost",s.GetLSLostPile().contains(gun),"enemyLost",s.GetDSLostPile().contains(enemy),"interruptLost",s.GetDSLostPile().contains(card),"locationRemains",site.getZone()==Zone.LOCATIONS));}
 @Test public void boring(){var s=fixture();var site=s.GetDSStartingLocation();var r2=s.GetLSCard("r2");var card=s.GetLSCard("scomp");var boring=s.GetDSCard("boring");s.MoveCardsToLocation(site,r2);s.MoveCardsToHand(card,boring);s.SkipToLSTurn(Phase.DEPLOY);s.LSUseCardAction(card,"Look at Reserve Deck");s.PlayerDecided(VirtualTableScenario.LS,s.GetCurrentDecision().getDecisionParameters().get("cardId")[0]);for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(boring,"Cancel"));i++)pass(s);s.DSUseCardAction(boring,"Cancel");for(int i=0;i<100&&!s.GetDSUsedPile().contains(boring);i++)pass(s);rows.add(Map.of("kind","boring","scompLost",s.GetLSLostPile().contains(card),"boringUsed",s.GetDSUsedPile().contains(boring)));assertTrue(s.GetLSLostPile().contains(card));assertTrue(s.GetDSUsedPile().contains(boring));}
}
