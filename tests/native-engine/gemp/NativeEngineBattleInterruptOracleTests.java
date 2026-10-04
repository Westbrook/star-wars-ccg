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
public class NativeEngineBattleInterruptOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/battle-interrupt-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("PASS "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText());s.PlayerPass(s.GetDecidingPlayer());}
 boolean can(VirtualTableScenario s,PhysicalCardImpl card){return s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&s.LSCardPlayAvailable(card);}
 VirtualTableScenario fixture(String mode){String bp=mode.startsWith("sky")?"1_110":mode.startsWith("strong")?"1_116":mode.startsWith("nowhere")?"1_102":"1_119";var ls=new HashMap<String,String>(Map.of("card",bp,"luke","101_2","leia","1_17","han","1_11","droid","1_5","troop","1_28","ship","106_7"));var ds=new HashMap<String,String>(Map.of("tarkin","1_179","vader","101_5","boring","1_235","ship","1_305"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation(mode.startsWith("nowhere")?"1_127":"1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);var site=s.GetLSStartingLocation();if(mode.startsWith("nowhere")){s.MoveCardsToLocation(site,s.GetLSCard("ship"),s.GetDSCard("ship"));s.BoardAsPilot(s.GetDSCard("ship"),s.GetDSCard("tarkin"));}else {s.MoveCardsToLocation(site,s.GetLSCard(mode.startsWith("warrior")?"han":mode.equals("leia")?"leia":"luke"),s.GetDSCard(mode.equals("strong-vader")?"vader":"tarkin"));if(mode.startsWith("sky"))s.MoveCardsToLocation(site,s.GetLSCard("leia"));if(mode.equals("warrior-droid"))s.MoveCardsToLocation(site,s.GetLSCard("droid"));}s.MoveCardsToHand(s.GetLSCard("card"),s.GetDSCard("boring"));if(mode.equals("nowhere-own")){s.SkipToLSTurn(Phase.BATTLE);s.LSInitiateBattle(site);}else{s.SkipToDSTurn(Phase.BATTLE);s.DSInitiateBattle(site);}return s;}
 @Test public void additions(){for(String mode:List.of("sky","sky-leia-leaves","sky-canceled","strong","strong-vader","warrior","leia","warrior-droid","nowhere","nowhere-own")){
  System.out.println("MODE "+mode);var s=fixture(mode);var card=s.GetLSCard("card");if(!mode.startsWith("nowhere"))s.PassBattleStartResponses();for(int i=0;i<5&&!s.GetDecidingPlayer().equals(VirtualTableScenario.LS);i++)pass(s);boolean offered=can(s,card);int force=s.GetLSForcePileCount();var q=s.game().getModifiersQuerying();int before=q.getNumBattleDestinyDraws(s.gameState(),VirtualTableScenario.LS,false,false);
  if(offered){if(mode.equals("leia"))s.LSUseCardAction(card,"Add two battle destiny");else s.LSPlayCard(card);if(mode.equals("sky-leia-leaves"))s.MoveCardsToTopOfOwnLostPile(s.GetLSCard("leia"));if(mode.equals("sky-canceled")){for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(s.GetDSCard("boring"),"Cancel"));i++)pass(s);s.DSUseCardAction(s.GetDSCard("boring"),"Cancel");}
   for(int i=0;i<100&&!s.GetLSLostPile().contains(card)&&!s.GetLSUsedPile().contains(card);i++)pass(s);assertTrue(s.GetLSLostPile().contains(card)||s.GetLSUsedPile().contains(card));
  }
  int after=q.getNumBattleDestinyDraws(s.gameState(),VirtualTableScenario.LS,false,false);rows.add(Map.of("mode",mode,"offered",offered,"before",before,"after",after,"forcePaid",force-s.GetLSForcePileCount(),"lost",s.GetLSLostPile().contains(card),"used",s.GetLSUsedPile().contains(card)));
 }}
 @Test public void leiaText(){var s=fixture("sky");s.PassBattleStartResponses();var leia=s.GetLSCard("leia");var troop=s.GetLSCard("troop");var site=s.GetDSStartingLocation();s.MoveCardsToLocation(site,leia,troop);var q=s.game().getModifiersQuerying();rows.add(Map.of("mode","leia-text","leiaPower",q.getPower(s.gameState(),leia),"troopPower",q.getPower(s.gameState(),troop),"immunity",q.getImmunityToAttritionLessThan(s.gameState(),leia)));}
}
