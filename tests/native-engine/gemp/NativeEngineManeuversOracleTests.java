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
/** Plays printed Interrupts through real GEMP timing, including weapon draws. */
public class NativeEngineManeuversOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/maneuvers-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){System.out.println("MANEUVER "+s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+new GsonBuilder().create().toJson(s.GetCurrentDecision().getDecisionParameters()));s.PlayerPass(s.GetDecidingPlayer());}
 boolean can(VirtualTableScenario s,boolean dark,PhysicalCardImpl c){return s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&s.GetCurrentDecision().getDecisionParameters().get("cardId")!=null&&(dark?s.DSCardPlayAvailable(c):s.LSCardPlayAvailable(c));}
 void play(VirtualTableScenario s,boolean dark,PhysicalCardImpl c,PhysicalCardImpl target){for(int i=0;i<100&&!can(s,dark,c);i++)pass(s);assertTrue(can(s,dark,c));if(dark)s.DSPlayCard(c);else s.LSPlayCard(c);for(int i=0;i<100&&!(dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(c);i++){if(s.GetDecidingPlayer().equals(dark?VirtualTableScenario.DS:VirtualTableScenario.LS)&&(s.GetCurrentDecision().getText().contains("Choose starfighter")||s.GetCurrentDecision().getText().contains("Choose target"))){if(dark)s.DSChooseCard(target);else s.LSChooseCard(target);}else pass(s);}assertTrue((dark?s.GetDSUsedPile():s.GetLSUsedPile()).contains(c));}
 @Test public void maneuvers(){for(String mode:List.of("few","dark","duplicates","combined","no-hyperdrive","unpiloted","landed","capital","shot-few","shot-dark","shot-double")){
  boolean shot=mode.startsWith("shot"),darkShot=!mode.equals("shot-dark"),noHyper=mode.equals("no-hyperdrive");String bp=noHyper?"1_300":mode.equals("unpiloted")?"1_144":mode.equals("capital")?"1_140":mode.equals("shot-dark")?"1_305":"1_147";
  var ls=new HashMap<String,String>(Map.of("few","1_70","few2","1_70","ywing","1_147","gun","1_158","d1","1_115","d2","1_115"));var ds=new HashMap<String,String>(Map.of("dark","1_241","dark2","1_241","capital","1_302","gun","1_323","pilot","1_179","d1","1_262","d2","1_262"));boolean darkTarget=noHyper||mode.equals("shot-dark");(darkTarget?ds:ls).put("target",bp);
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_127"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();var site=s.GetLSStartingLocation();var target=darkTarget?s.GetDSCard("target"):s.GetLSCard("target");s.MoveCardsToLocation(mode.equals("landed")?s.GetDSStartingLocation():site,target);if(noHyper)s.BoardAsPilot(target,s.GetDSCard("pilot"));s.MoveCardsToLSHand(s.GetLSCard("few"),s.GetLSCard("few2"));s.MoveCardsToDSHand(s.GetDSCard("dark"),s.GetDSCard("dark2"));s.DSActivateForceCheat(15);s.LSActivateForceCheat(15);
  if(shot){var host=darkShot?s.GetDSCard("capital"):s.GetLSCard("ywing");var gun=darkShot?s.GetDSCard("gun"):s.GetLSCard("gun");s.MoveCardsToLocation(site,host);s.AttachCardsTo(host,gun);if(darkShot)s.SkipToDSTurn(Phase.BATTLE);else s.SkipToLSTurn(Phase.BATTLE);if(darkShot)s.DSInitiateBattle(site);else s.LSInitiateBattle(site);for(int i=0;i<100&&!(s.GetDecidingPlayer().equals(darkShot?VirtualTableScenario.DS:VirtualTableScenario.LS)&&(darkShot?s.DSCardActionAvailable(gun,"Fire"):s.LSCardActionAvailable(gun,"Fire")));i++)pass(s);
   if(darkShot){s.MoveCardsToTopOfDSReserveDeck(s.GetDSCard("d2"),s.GetDSCard("d1"));s.DSUseCardAction(gun,"Fire");s.DSChooseCard(target);}else{s.MoveCardsToTopOfLSReserveDeck(s.GetLSCard("d1"));s.LSUseCardAction(gun,"Fire");s.LSChooseCard(target);}
   var interrupt=darkShot?s.GetLSCard("few"):s.GetDSCard("dark");play(s,!darkShot,interrupt,target);if(mode.equals("shot-double"))play(s,false,s.GetLSCard("few2"),target);
   for(int i=0;i<150&&!(s.gameState().getWeaponFiringState()==null&&s.GetCurrentDecision().getText().contains("weapons segment"));i++)pass(s);assertNull(s.gameState().getWeaponFiringState());
  }else{ s.SkipToLSTurn(Phase.DEPLOY);if(!List.of("unpiloted","landed","capital").contains(mode)){
   if(!mode.equals("dark")&&!noHyper)play(s,false,s.GetLSCard("few"),target);if(mode.equals("duplicates"))play(s,false,s.GetLSCard("few2"),target);if(mode.equals("combined")||mode.equals("dark")||noHyper)play(s,true,s.GetDSCard("dark"),target);
  }}
  var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("power",s.GetPower(target));row.put("maneuver",s.GetManeuver(target));row.put("hyperspeed",noHyper?null:s.GetHyperspeed(target));row.put("hit",target.isHit());row.put("fewUsed",s.GetLSUsedPile().contains(s.GetLSCard("few")));row.put("darkUsed",s.GetDSUsedPile().contains(s.GetDSCard("dark")));rows.add(row);
  if(List.of("unpiloted","landed","capital").contains(mode))assertFalse(can(s,false,s.GetLSCard("few")));
 }}
}
