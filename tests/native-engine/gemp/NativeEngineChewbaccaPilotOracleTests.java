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
/** Ship/Han and optional Effect are fixtures; Chewbacca deployment is a real paid action. */
public class NativeEngineChewbaccaPilotOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/chewbacca-pilot-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 @Test public void pilots(){for(String mode:List.of("falcon","han","han-canceled","chewie-canceled","effect","other-ship","passenger","landed","ground","other-site")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("chewie","2_3","han","1_11","ship",mode.equals("other-ship")?"1_147":"1_143","effect","1_65","planet","1_127")),new HashMap<>(),55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var chewie=s.GetLSCard("chewie");var han=s.GetLSCard("han");var ship=s.GetLSCard("ship");var effect=s.GetLSCard("effect");var planet=s.GetLSCard("planet");var site=s.GetLSStartingLocation();s.MoveLocationToTable(planet);s.MoveCardsToLocation(mode.equals("landed")?site:planet,ship);
  if(mode.equals("han")||mode.equals("han-canceled"))s.BoardAsPassenger(ship,han);if(mode.equals("ground"))s.MoveCardsToLocation(site,han);if(mode.equals("other-site"))s.MoveCardsToLocation(s.GetDSStartingLocation(),han);if(mode.equals("effect"))s.AttachCardsTo(ship,effect);
  s.MoveCardsToLSHand(chewie);s.LSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);int before=s.GetLSForcePileCount();s.LSDeployCard(chewie);var target=mode.equals("ground")||mode.equals("other-site")?site:ship;
  for(int n=0;n<120;n++){if(s.LSDecisionAvailable("Choose Deploy action")&&chewie.getZone().isInPlay())break;String text=s.GetCurrentDecision().getText();if(s.LSDecisionAvailable("Choose capacity"))s.LSChoose(mode.equals("passenger")?"Passenger":"Pilot");else if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&(text.contains("Choose where")||text.contains("Choose target")))s.LSChooseCard(target);else s.PlayerPass(s.GetDecidingPlayer());}
  assertTrue(s.LSDecisionAvailable("Choose Deploy action"));assertTrue(chewie.getZone().isInPlay());int cost=before-s.GetLSForcePileCount();
  if(mode.endsWith("canceled")){var source=mode.equals("han-canceled")?han:chewie;source.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,source));}
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",cost);row.put("chewiePower",s.GetPower(chewie));row.put("shipPower",s.GetPower(ship));row.put("maneuver",s.GetManeuver(ship));row.put("forfeit",s.GetForfeit(ship));row.put("immunity",q.getImmunityToAttritionLessThan(s.gameState(),ship));rows.add(row);
 }}
}
