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
/** Real card queries and Veers deployment; controlled initial table/hand placements. */
public class NativeEngineIsbAgentsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/isb-agents-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>();var ds=new HashMap<String,String>();ls.put("dodonna","1_10");ls.put("luke","1_19");ls.put("han","1_11");ls.put("troop","1_28");ds.put("yularen","1_166");ds.put("veers","104_6");ds.put("tarkin","1_179");ds.put("bast","1_165");ds.put("snow","3_91");ds.put("troop","1_194");ds.put("transport","1_310");var s=new VirtualTableScenario(ls,ds,18,18,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("104_4"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.ACTIVATE);s.DSActivateForceCheat(12);s.LSActivateForceCheat(12);return s;}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void yularen(){for(String mode:new String[]{"lone","tarkin","bast","dodonna","all","other-site","aboard"}){
  var s=fixture();var site=s.GetLSStartingLocation();var y=s.GetDSCard("yularen");s.MoveCardsToLocation(site,y);
  if(mode.equals("tarkin")||mode.equals("all")||mode.equals("aboard"))s.MoveCardsToLocation(site,s.GetDSCard("tarkin"));
  if(mode.equals("bast")||mode.equals("all"))s.MoveCardsToLocation(site,s.GetDSCard("bast"));
  if(mode.equals("dodonna")||mode.equals("all"))s.MoveCardsToLocation(site,s.GetLSCard("dodonna"));
  if(mode.equals("other-site"))s.MoveCardsToLocation(s.GetDSStartingLocation(),s.GetDSCard("tarkin"));
  if(mode.equals("aboard")){var v=s.GetDSCard("transport");s.MoveCardsToLocation(site,v);s.AttachCardsTo(v,y);s.gameState().moveCardToAttachedInPassengerCapacitySlot(y,v);}
  s.SkipToPhase(Phase.CONTROL);float value=s.GetPower(y);assertEquals(mode.equals("lone")||mode.equals("other-site")?1:2,value,0);rows.add(Map.of("name","yularen-"+mode,"power",value));
 }}
 @Test public void forfeit(){for(String mode:new String[]{"same-site","other-site","aboard"}){
  var s=fixture();var site=s.GetLSStartingLocation();var v=s.GetDSCard("veers");var snow=s.GetDSCard("snow");var troop=s.GetDSCard("troop");s.MoveCardsToLocation(site,snow,troop);s.MoveCardsToLocation(mode.equals("other-site")?s.GetDSStartingLocation():site,v);
  if(mode.equals("aboard")){var transport=s.GetDSCard("transport");s.MoveCardsToLocation(site,transport);s.AttachCardsTo(transport,v);s.gameState().moveCardToAttachedInPassengerCapacitySlot(v,transport);}
  s.SkipToPhase(Phase.CONTROL);rows.add(Map.of("name","veers-"+mode,"snowForfeit",s.GetForfeit(snow),"trooperForfeit",s.GetForfeit(troop)));
 }}
 @Test public void deployment(){for(int count:new int[]{0,2,3}){
  var s=fixture();var veers=s.GetDSCard("veers");var chars=new PhysicalCardImpl[]{s.GetLSCard("dodonna"),s.GetLSCard("luke"),s.GetLSCard("han")};for(int i=0;i<count;i++)s.MoveCardsToLocation(s.GetLSStartingLocation(),chars[i]);s.MoveCardsToDSHand(veers);s.SkipToPhase(Phase.DEPLOY);boolean offered=s.DSDeployAvailable(veers);assertEquals(count<3,offered);var row=new LinkedHashMap<String,Object>();row.put("name","veers-deploy-"+count);row.put("offered",offered);
  if(offered){int before=s.GetDSForcePileCount();s.DSDeployCard(veers);var choices=s.DSGetCardChoices();row.put("hothOffered",choices.contains(String.valueOf(s.GetDSStartingLocation().getCardId())));row.put("tatooineOffered",choices.contains(String.valueOf(s.GetLSStartingLocation().getCardId())));s.DSChooseCard(s.GetDSStartingLocation());for(int i=0;i<80&&veers.getZone()!=Zone.AT_LOCATION;i++)pass(s);assertEquals(Zone.AT_LOCATION,veers.getZone());row.put("cost",before-s.GetDSForcePileCount());}
  rows.add(row);
 }}
}
