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
public class NativeEngineFighterTroubleOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/fighter-trouble-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("TROUBLE "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 boolean can(VirtualTableScenario s,boolean dark,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(dark?s.DSCardPlayAvailable(c):s.LSCardPlayAvailable(c));}
 void deploy(VirtualTableScenario s,PhysicalCardImpl pilot,PhysicalCardImpl ship){s.LSDeployCard(pilot);for(int i=0;i<100;i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getText().contains("Choose Deploy action")&&pilot.getAttachedTo()==ship)return;if(s.GetCurrentDecision().getText().contains("Choose capacity"))s.LSChoose("Pilot");else if(s.GetCurrentDecision().getText().contains("Choose where")||s.GetCurrentDecision().getText().contains("Choose target"))s.LSChooseCard(ship);else pass(s);}fail("deploy did not settle");}
 @Test public void trouble(){for(String mode:List.of("bonus","no-bonus","few","other-ship","suppressed","unpiloted","empty","no-force","target-leaves","bonus-source-leaves")){
  System.out.println("MODE "+mode);var ls=new HashMap<String,String>(Map.of("ship",mode.equals("other-ship")?"1_145":"2_72","jek","1_13","ywing","1_147","few","1_70"));var ds=new HashMap<String,String>(Map.of("enemy","1_302","problem","1_253","die","1_262"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var site=s.GetLSStartingLocation();var ship=s.GetLSCard("ship");var jek=s.GetLSCard("jek");var problem=s.GetDSCard("problem");var few=s.GetLSCard("few");s.MoveCardsToLocation(site,ship,s.GetLSCard("ywing"),s.GetDSCard("enemy"));s.MoveCardsToLSHand(jek,few);s.MoveCardsToDSHand(problem);s.LSActivateForceCheat(12);s.DSActivateForceCheat(12);s.SkipToLSTurn(Phase.DEPLOY);int beforeDeploy=s.GetLSForcePileCount();if(!mode.equals("unpiloted"))deploy(s,jek,ship);int deploymentCost=beforeDeploy-s.GetLSForcePileCount();s.SkipToDSTurn(Phase.BATTLE);
  if(mode.equals("suppressed")){ship.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(site,ship));}
  if(mode.equals("no-force")){for(var c:new ArrayList<>(s.GetDSForcePile()))s.MoveCardsToTopOfDSReserveDeck((PhysicalCardImpl)c);s.DSActivateForceCheat(1);}
  int power=s.GetPower(ship),maneuver=s.GetManeuver(ship);s.DSInitiateBattle(site);int battleDraws=s.GetLSBattleDestinyCount();s.SkipToDamageSegment(false);boolean offered=false;
  for(int i=0;i<200;i++){if(can(s,true,problem)){offered=true;break;}if(s.GetCurrentDecision().getText().contains("Choose Battle action"))break;if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromReserveDeck();else if(s.AwaitingDSBattleDamagePayment())s.DSPayBattleDamageFromReserveDeck();else pass(s);}
  int before=s.GetDSForcePileCount();boolean bonusOffered=false,bonusUsed=false,fewUsed=false;Float destiny=null;
  if(offered){if(mode.equals("empty"))for(var c:new ArrayList<>(s.GetDSReserveDeck()))s.MoveCardsToDSHand((PhysicalCardImpl)c);else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));before=s.GetDSForcePileCount();s.DSPlayCard(problem);if(s.GetCurrentDecision().getText().contains("Choose starfighter"))s.DSChooseCard(ship);
   if(mode.equals("target-leaves"))s.MoveCardsToLSHand(ship);
   for(int i=0;i<300&&!s.GetDSLostPile().contains(problem);i++){
    var t=s.GetCurrentDecision().getText();if(t.contains("COMPLETE_DESTINY_DRAW")&&s.gameState().getTopDrawDestinyState()!=null)destiny=s.gameState().getTopDrawDestinyState().getDrawDestinyEffect().getDestinyDrawValue();
    if(!bonusUsed&&s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.DSCardActionAvailable(ship,"Add 2 to destiny")){
     bonusOffered=true;if(List.of("bonus","few","bonus-source-leaves").contains(mode)){s.DSUseCardAction(ship,"Add 2 to destiny");bonusUsed=true;if(mode.equals("bonus-source-leaves"))s.MoveCardsToLSHand(ship);continue;}
    }
    if(mode.equals("few")&&!fewUsed&&can(s,false,few)){s.LSPlayCard(few);fewUsed=true;continue;}
    if(t.contains("Choose starfighter")){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS))s.LSChooseCard(ship);else s.DSChooseCard(ship);}
    else if(t.toLowerCase().contains("lost pile")&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null)s.LSChooseCard(s.LSHasCardChoiceAvailable(ship)?ship:jek);
    else pass(s);
   }assertTrue(s.GetDSLostPile().contains(problem));
  }
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("battleDraws",battleDraws);row.put("destiny",destiny);row.put("deploymentCost",deploymentCost);row.put("power",power);row.put("maneuver",maneuver);row.put("offered",offered);row.put("bonusOffered",bonusOffered);row.put("bonusUsed",bonusUsed);row.put("cost",before-s.GetDSForcePileCount());row.put("shipLost",s.GetLSLostPile().contains(ship));row.put("problemLost",s.GetDSLostPile().contains(problem));row.put("drew",s.GetDSUsedPile().contains(s.GetDSCard("die")));row.put("fewUsed",s.GetLSUsedPile().contains(few));rows.add(row);
 }}
}
