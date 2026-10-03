package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real deployment and Noble Sacrifice. Modifiers/attachments are controlled fixtures. */
public class NativeEngineNobleSacrificeOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/noble-sacrifice-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void sacrifice(){for(String mode:List.of("retrieve","decline","attachments","blocked","forfeit-four","tarl","plans","sense","deployed-departs")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("noble","1_99","target","1_28","gun","1_152","device","1_35","a","1_115","b","1_115","c","1_115","d","1_115","e","1_115")),new HashMap<>(Map.of("trooper","1_194","plans","13_86","tarl","8_114","vader","101_5","sense","1_267")),20,20,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToPhase(Phase.CONTROL);var noble=s.GetLSCard("noble");var target=s.GetLSCard("target");var trooper=s.GetDSCard("trooper");var gun=s.GetLSCard("gun");var device=s.GetLSCard("device");var sense=s.GetDSCard("sense");var vader=s.GetDSCard("vader");var lost=List.of(s.GetLSCard("a"),s.GetLSCard("b"),s.GetLSCard("c"),s.GetLSCard("d"),s.GetLSCard("e"));
  s.MoveCardsToLSHand(noble,gun,device);s.MoveCardsToLocation(s.GetLSStartingLocation(),target);s.MoveCardsToDSHand(trooper,sense);s.MoveCardsToLocation(s.GetDSStartingLocation(),vader);for(var c:lost)s.MoveCardsToTopOfLSLostPile(c);
  while(s.GetDSForcePileCount()<6)s.DSActivateForceCheat(1);while(s.GetLSForcePileCount()<8)s.LSActivateForceCheat(1);int force=s.GetLSForcePileCount();
  if(mode.equals("attachments"))s.AttachCardsTo(target,gun,device);
  if(mode.equals("blocked"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new MayNotContributeToForceRetrievalModifier(s.GetDSStartingLocation(),target));
  if(mode.equals("forfeit-four"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ForfeitModifier(s.GetDSStartingLocation(),target,2));
  if(mode.equals("tarl"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("tarl"));
  if(mode.equals("plans"))s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));
  s.PrepareDSDestiny(0);s.SkipToPhase(Phase.DEPLOY);s.DSDeployCard(trooper);
  for(int i=0;i<80&&!(s.GetDecidingPlayer().equals(LS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.LSCardPlayAvailable(noble));i++){
   if(s.GetDecidingPlayer().equals(DS)&&s.DSHasCardChoiceAvailable(s.GetLSStartingLocation()))s.DSChooseCard(s.GetLSStartingLocation());else pass(s);
  }
  assertTrue(mode,s.LSCardPlayAvailable(noble));s.LSPlayCard(noble);int optional=0;boolean paidBeforeResponse=false,sensed=false,moved=false;
  for(int i=0;i<160&&!s.GetLSLostPile().contains(noble);i++){
   String text=s.GetCurrentDecision().getText();System.out.println("NOBLE "+mode+" "+s.GetDecidingPlayer()+" "+text);
   if(text.contains("Choose character to sacrifice"))s.LSChooseCard(target);
   else if(text.contains("Choose deployed character"))s.LSChooseCard(trooper);
   else if(text.contains("Do you want to retrieve")){optional++;assertEquals(Zone.OUT_OF_PLAY,target.getZone());if(mode.equals("decline"))s.LSChooseNo();else s.LSChooseYes();}
   else if(text.contains("proceed with Force retrieval"))s.LSChooseYes();
   else if(s.GetDecidingPlayer().equals(LS)&&(text.contains("Choose order")||text.contains("Choose card to put on Lost Pile"))){if(s.LSHasCardChoiceAvailable(gun))s.LSChooseCard(gun);else s.LSChooseCard(device);}
   else if(s.GetDecidingPlayer().equals(DS)&&(text.contains("Choose character")||text.contains("Choose a highest-ability character")))s.DSChooseCard(vader);
   else {
    if(text.contains("Playing")&&target.getZone()==Zone.OUT_OF_PLAY){paidBeforeResponse=true;if(mode.equals("deployed-departs")&&!moved){s.MoveCardsToDSHand(trooper);moved=true;}}
    if(mode.equals("sense")&&!sensed&&target.getZone()==Zone.OUT_OF_PLAY&&s.GetDecidingPlayer().equals(DS)&&s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.DSCardPlayAvailable(sense)){s.DSPlayCard(sense);sensed=true;}else pass(s);
   }
  }
  if(mode.equals("sense"))for(int i=0;i<40&&!s.GetDSUsedPile().contains(sense);i++)pass(s);
  assertTrue(mode,s.GetLSLostPile().contains(noble));assertEquals(mode,Zone.OUT_OF_PLAY,target.getZone());assertTrue(mode,paidBeforeResponse);if(mode.equals("sense")){assertTrue(sensed);assertTrue(s.GetDSUsedPile().contains(sense));assertEquals(0,optional);}if(mode.equals("deployed-departs"))assertTrue(moved);
  rows.add(Map.of("mode",mode,"retrieved",lost.stream().filter(c->s.GetLSUsedPile().contains(c)).count(),"optional",optional,"spent",force-s.GetLSForcePileCount(),"out",true,"paidBeforeResponse",paidBeforeResponse,"gunZone",gun.getZone().toString(),"deviceZone",device.getZone().toString()));
 }}
}
