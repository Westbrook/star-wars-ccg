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
public class NativeEngineBactaOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/bacta-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){try{if(s.GetCurrentDecision().getText().equals("Choose card to put on Lost Pile")){s.LSChooseCard(s.LSHasCardChoiceAvailable(s.GetLSCard("patient"))?s.GetLSCard("patient"):s.GetLSCard("gun"));return;}if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void patients(){for(String mode:new String[]{"zero-fx","one-fx","two-fx","skip","droid","attachments","asterisk"}){
  var ls=new HashMap<>(Map.of("tank","3_32","patient",mode.equals("droid")?"1_5":mode.equals("asterisk")?"1_12":"1_19","second","1_28","fx","3_9","fx2","3_9","gun","1_152"));var ds=new HashMap<String,String>();for(int i=0;i<10;i++)ds.put("enemy"+i,"1_194");
  var s=new VirtualTableScenario(ls,ds,20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.LSActivateForceCheat(15);s.DSActivateForceCheat(15);var site=s.GetLSStartingLocation();var patient=s.GetLSCard("patient");var tank=s.GetLSCard("tank");s.MoveCardsToLSSideOfTable(tank);s.MoveCardsToLocation(site,patient,s.GetLSCard("second"));if(mode.equals("one-fx")||mode.equals("two-fx"))s.MoveCardsToLocation(site,s.GetLSCard("fx"));if(mode.equals("two-fx"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetLSCard("fx2"));if(mode.equals("attachments"))s.AttachCardsTo(patient,s.GetLSCard("gun"));for(int i=0;i<10;i++)s.MoveCardsToLocation(site,s.GetDSCard("enemy"+i));
  s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(site);s.SkipToDamageSegment();for(int i=0;i<100&&!s.AwaitingLSBattleDamagePayment();i++)pass(s);int before=s.GetUnpaidLSBattleDamage();s.LSChooseCard(patient);
  boolean offered=false;for(int i=0;i<100&&!mode.equals("droid");i++){if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(tank,"Stack")){offered=true;break;}if(s.AwaitingLSBattleDamagePayment())break;pass(s);}
  assertEquals(!mode.equals("droid"),offered);
  if(offered&&!mode.equals("skip")){s.LSUseCardAction(tank,"Stack");for(int i=0;i<100&&!s.IsStackedOn(tank,patient);i++)pass(s);assertTrue(s.IsStackedOn(tank,patient));}else if(offered)pass(s);
  int paid=before-(s.gameState().getBattleState()==null?0:s.GetUnpaidLSBattleDamage());boolean stacked=s.IsStackedOn(tank,patient),lost=s.GetLSLostPile().contains(patient),gunLost=s.GetLSLostPile().contains(s.GetLSCard("gun"));boolean inactive=s.game().getModifiersQuerying().getCardState(s.gameState(),patient,false,false,false,false,false,false,false,false)==CardState.INACTIVE;int cost=-1;boolean hand=false;
  if(stacked){for(int i=0;i<100&&s.gameState().getBattleState()!=null;i++){if(s.AwaitingLSBattleDamagePayment())s.LSPayBattleDamageFromReserveDeck();else pass(s);}s.SkipToLSTurn(Phase.DEPLOY);for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("actionId")&&s.LSCardActionAvailable(tank,"Take"));i++)pass(s);int force=s.GetLSForcePileCount();s.LSUseCardAction(tank,"Take");for(int i=0;i<100&&!s.GetLSHand().contains(patient);i++)pass(s);cost=force-s.GetLSForcePileCount();hand=s.GetLSHand().contains(patient);}
  rows.add(Map.of("name",mode,"offered",offered,"stacked",stacked,"lost",lost,"paid",paid,"cost",cost,"hand",hand,"gunLost",gunLost,"inactive",inactive));
 }}
}
