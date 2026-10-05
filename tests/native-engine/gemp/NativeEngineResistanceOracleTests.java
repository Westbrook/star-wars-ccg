package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Prepared boards; actual drain/deployment actions and production insert-loss
 * primitive. Fixed +3 drain modifier isolates a four-Force obligation. */
public class NativeEngineResistanceOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/resistance-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(boolean light,int count,boolean opponent,String mode){
  var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();for(int i=0;i<4;i++){ls.put("t"+i,"1_28");ds.put("t"+i,"1_194");}ls.put("effect","6_58");ds.put("effect","6_147");ls.put("a","1_130");ls.put("b","1_131");ls.put("c","1_132");ls.put("source","4_16");ds.put("source","1_208");ls.put("alter","1_71");ds.put("alter","1_234");
  var s=new VirtualTableScenario(ls,ds,40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();
  for(String key:List.of("a","b","c"))s.MoveLocationToTable(s.GetLSCard(key));
  for(int n=0;n<count;n++)s.MoveCardsToLocation(s.GetLSCard(List.of("a","b","c").get(n)),light?s.GetLSCard("t"+n):s.GetDSCard("t"+n));
  if(opponent)s.MoveCardsToLocation(s.GetLSStartingLocation(),light?s.GetDSCard("t3"):s.GetLSCard("t3"));
  var effect=light?s.GetLSCard("effect"):s.GetDSCard("effect");if(mode.equals("arrive")||mode.equals("deploy"))s.MoveCardsToHand(effect);else s.MoveCardsToSideOfTable(effect);
  s.MoveCardsToHand(s.GetLSCard("alter"),s.GetDSCard("alter"));s.DSActivateForceCheat(8);s.LSActivateForceCheat(8);
  if(light)s.SkipToDSTurn(Phase.CONTROL);else s.SkipToLSTurn(Phase.CONTROL);
  if(mode.equals("suppressed")){effect.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(s.GetLSStartingLocation(),effect));}
  return s;
 }
 void pass(VirtualTableScenario s){try{if(s.AwaitingLSForceLossPayment())s.LSPayForceLossFromReserveDeck();else if(s.AwaitingDSForceLossPayment())s.DSPayForceLossFromReserveDeck();else if(s.GetCurrentDecision().getText().toLowerCase().contains("required responses"))s.PlayerDecided(s.GetDecidingPlayer(),s.GetCurrentDecision().getDecisionParameters().get("actionId")[0]);else s.PlayerPass(s.GetDecidingPlayer());}catch(RuntimeException e){throw new AssertionError(s.GetCurrentDecision().getText(),e);}}
 int lost(VirtualTableScenario s,boolean light){return light?s.GetLSLostPileCount():s.GetDSLostPileCount();}
 @Test public void losses(){for(boolean light:new boolean[]{false,true})for(String kind:List.of("drain","insert"))for(int count:new int[]{0,2,3}){
  run(light,kind,count,true,"normal");
 }for(boolean light:new boolean[]{false,true}){run(light,"insert",0,false,"normal");for(String mode:List.of("depart","arrive","suppressed"))for(String kind:List.of("drain","insert"))run(light,kind,3,true,mode);}}
 void run(boolean light,String kind,int count,boolean opponent,String mode){
  var s=fixture(light,count,opponent,mode);var effect=light?s.GetLSCard("effect"):s.GetDSCard("effect");String side=light?LS:DS;int before=lost(s,light);boolean[] done={false};
  if(kind.equals("drain")){s.ApplyAdHocModifier(new ForceDrainModifier(light?s.GetDSCard("t3"):s.GetLSCard("t3"),s.GetLSStartingLocation(),3,light?DS:LS));if(light)s.DSForceDrainAt(s.GetLSStartingLocation());else s.LSForceDrainAt(s.GetLSStartingLocation());}
  else {var source=light?s.GetDSCard("source"):s.GetLSCard("source");var action=new TopLevelGameTextAction(source,source.getCardId());action.appendEffect(new LoseForceFromInsertCardEffect(action,side,4));action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame game){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);pass(s);}
  boolean changed=false;for(int n=0;n<150;n++){
   if(!changed&&lost(s,light)>before){if(mode.equals("depart"))s.MoveCardsToHand(effect);if(mode.equals("arrive"))s.MoveCardsToSideOfTable(effect);changed=true;}
   if(kind.equals("insert")?done[0]:s.gameState().getForceDrainState()==null)break;pass(s);
  }
  assertTrue(kind.equals("insert")?done[0]:s.gameState().getForceDrainState()==null);int delta=lost(s,light)-before;assertEquals(light+":"+kind+":"+count+":"+mode,mode.equals("depart")||mode.equals("suppressed")||count<3&&opponent?4:2,delta);
  rows.add(Map.of("side",light?"light":"dark","kind",kind,"count",count,"opponent",opponent,"mode",mode,"lost",delta));
 }
 @Test public void deployments(){for(boolean light:new boolean[]{false,true}){var s=fixture(light,0,true,"deploy");var effect=light?s.GetLSCard("effect"):s.GetDSCard("effect");if(light)s.SkipToLSTurn(Phase.DEPLOY);else s.SkipToDSTurn(Phase.DEPLOY);int before=light?s.GetLSForcePileCount():s.GetDSForcePileCount();if(light)s.LSPlayCard(effect);else s.DSPlayCard(effect);boolean offered=false;for(int n=0;n<100&&effect.getZone()!=Zone.SIDE_OF_TABLE;n++){if(s.GetCurrentDecision().getDecisionParameters().containsKey("cardId")&&s.GetDecidingPlayer().equals(light?DS:LS)&&(light?s.DSCardPlayAvailable(s.GetDSCard("alter")):s.LSCardPlayAvailable(s.GetLSCard("alter"))))offered=true;pass(s);}assertEquals(Zone.SIDE_OF_TABLE,effect.getZone());assertFalse(offered);int cost=before-(light?s.GetLSForcePileCount():s.GetDSForcePileCount());assertEquals(0,cost);rows.add(Map.of("side",light?"light":"dark","kind","deployment","cost",cost,"alterOffered",offered));}}
}
