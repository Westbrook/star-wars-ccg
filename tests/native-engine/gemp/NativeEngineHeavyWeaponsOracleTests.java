package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.filters.Filters;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineHeavyWeaponsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/heavy-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(){var ls=new HashMap<String,String>(Map.of("gen","3_61","trench","3_63","warrior","1_28","support","1_28","rifle","1_153","vehicle","1_149","fighter","1_147","gun","3_75","droid","3_8","die","1_115"));var ds=new HashMap<String,String>(Map.of("walker","3_155","gun","3_158","second","3_158","trooper","1_194","ridge","3_149","die","1_262"));var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("3_59"),StartingSetup.DSStartingLocation("3_144"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();if(s.GetCurrentDecision().getText().startsWith("On which side"))s.LSChoose("Left");for(String k:List.of("gen","trench"))s.MoveLocationToTable(s.GetLSCard(k));s.MoveLocationToTable(s.GetDSCard("ridge"));s.DSActivateForceCheat(20);s.LSActivateForceCheat(20);return s;}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 void run(boolean artillery,boolean remote,String type){var s=fixture();var site=s.GetLSCard("gen");var origin=remote?s.GetLSCard("trench"):site;var warrior=s.GetLSCard("warrior");var walker=s.GetDSCard("walker");var gun=artillery?s.GetLSCard("gun"):s.GetDSCard("gun");var user=artillery?warrior:walker;var victim=artillery?s.GetDSCard("trooper"):s.GetLSCard(type.equals("character")?"warrior":type);String player=artillery?s.LS:s.DS;
 s.MoveCardsToLocation(artillery?origin:site,warrior);s.MoveCardsToLocation(site,s.GetDSCard("trooper"));s.MoveCardsToLocation(artillery?site:origin,walker);if(artillery&&remote)s.MoveCardsToLocation(site,s.GetLSCard("support"));if(!artillery&&!type.equals("character"))s.MoveCardsToLocation(site,victim);s.AttachCardsTo(warrior,s.GetLSCard("rifle"));s.AttachCardsTo(artillery?origin:walker,gun);s.AttachCardsTo(walker,s.GetDSCard("second"));if(artillery&&remote)s.MoveCardsToLocation(origin,s.GetLSCard("droid"));
 if(artillery)s.SkipToLSTurn(Phase.BATTLE);else s.SkipToDSTurn(Phase.BATTLE);if(artillery)s.LSInitiateBattle(site);else s.DSInitiateBattle(site);
 for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(player)&&(artillery?s.LSCardActionAvailable(gun,"Fire"):s.DSCardActionAvailable(gun,"Fire")));i++)pass(s);
 if(artillery)s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("die"));else s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("die"));int before=artillery?s.GetLSForcePileCount():s.GetDSForcePileCount();boolean participant=Filters.participatingInBattle.accepts(s.game(),user);float defense=s.game().getModifiersQuerying().getDefenseValue(s.gameState(),victim);
 if(artillery)s.LSUseCardAction(gun,"Fire");else s.DSUseCardAction(gun,"Fire");
 for(int i=0;i<150&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++){
  String t=s.GetCurrentDecision().getText();System.out.println("HEAVY "+t+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));
  if(t.startsWith("Choose target")){if(artillery)s.LSChooseCard(victim);else s.DSChooseCard(victim);}else if(t.startsWith("Choose character")){s.LSChooseCard(warrior);}else pass(s);
 }
 assertNull(s.gameState().getWeaponFiringState());for(int i=0;i<10&&!s.GetDecidingPlayer().equals(player);i++)pass(s);
 var row=new LinkedHashMap<String,Object>();row.put("case",(artillery?"golan":"cannon")+"-"+type+(remote?"-adjacent":"-same"));row.put("hit",victim.isHit());row.put("forceSpent",before-(artillery?s.GetLSForcePileCount():s.GetDSForcePileCount()));row.put("userParticipating",participant);row.put("baseDefense",defense);row.put("repeatAvailable",artillery?s.LSCardActionAvailable(gun,"Fire"):s.DSCardActionAvailable(gun,"Fire"));row.put("otherWeaponUsable",Filters.canUseWeapon(artillery?s.GetLSCard("rifle"):s.GetDSCard("second")).accepts(s.game(),user));rows.add(row);
 }
 @Test public void cannon(){for(String target:List.of("character","vehicle","fighter"))for(boolean remote:List.of(false,true))run(false,remote,target);}
 @Test public void golan(){for(boolean remote:List.of(false,true))run(true,remote,"character");}
 @Test public void power(){var s=fixture();var gen=s.GetLSCard("gen");var trench=s.GetLSCard("trench");var gun=s.GetLSCard("gun");var droid=s.GetLSCard("droid");s.AttachCardsTo(gen,gun);var row=new LinkedHashMap<String,Object>();row.put("case","power");row.put("generator",s.game().getModifiersQuerying().isPowered(s.gameState(),gun));s.AttachCardsTo(trench,gun);row.put("adjacentGenerator",s.game().getModifiersQuerying().isPowered(s.gameState(),gun));s.MoveCardsToLocation(trench,droid);row.put("presentDroid",s.game().getModifiersQuerying().isPowered(s.gameState(),gun));s.MoveCardsToLocation(gen,droid);row.put("adjacentDroid",s.game().getModifiersQuerying().isPowered(s.gameState(),gun));rows.add(row);}
}
