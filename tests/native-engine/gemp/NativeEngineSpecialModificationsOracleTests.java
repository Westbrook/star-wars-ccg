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
/** Initial ships/pilots are fixtures; the normal Effect is actually deployed. */
public class NativeEngineSpecialModificationsOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output()throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/special-modifications-results.json"),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(rows));}
 @Test public void modifications(){for(String mode:List.of("han","lando","other-pilot","landed","unpiloted","effect-canceled","pilot-canceled","ship-canceled","other-fighter","capital","opponent")){
  String shipBp=mode.equals("capital")?"1_140":mode.equals("other-fighter")?"1_147":mode.equals("opponent")?"1_302":"1_143",pilotBp=mode.equals("lando")?"5_5":mode.equals("other-pilot")?"1_13":"1_11";
  var ls=new HashMap<String,String>(Map.of("effect","1_65","pilot",pilotBp,"planet","1_127"));var ds=new HashMap<String,String>();(mode.equals("opponent")?ds:ls).put("ship",shipBp);
  var s=new VirtualTableScenario(ls,ds,55,55,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();var ship=mode.equals("opponent")?s.GetDSCard("ship"):s.GetLSCard("ship");var pilot=s.GetLSCard("pilot");var effect=s.GetLSCard("effect");var planet=s.GetLSCard("planet");s.MoveLocationToTable(planet);s.MoveCardsToLocation(mode.equals("landed")?s.GetLSStartingLocation():planet,ship);
  if(!List.of("unpiloted","capital","other-fighter","opponent").contains(mode))s.BoardAsPilot(ship,pilot);
  s.MoveCardsToLSHand(effect);s.LSActivateForceCheat(20);s.SkipToLSTurn(Phase.DEPLOY);int before=s.GetLSForcePileCount();s.LSDeployCard(effect);
  for(int n=0;n<100;n++){if(s.LSDecisionAvailable("Choose Deploy action")&&effect.getAttachedTo()==ship)break;String text=s.GetCurrentDecision().getText();if(s.GetDecidingPlayer().equals(VirtualTableScenario.LS)&&(text.contains("Choose where")||text.contains("Choose target")))s.LSChooseCard(ship);else s.PlayerPass(s.GetDecidingPlayer());}
  assertEquals(ship,effect.getAttachedTo());assertTrue(s.LSDecisionAvailable("Choose Deploy action"));int cost=before-s.GetLSForcePileCount();
  if(mode.endsWith("canceled")){var source=mode.startsWith("effect")?effect:mode.startsWith("pilot")?pilot:ship;source.setGameTextCanceled(true);s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new CancelsGameTextModifier(planet,source));}
  var q=s.game().getModifiersQuerying();var row=new LinkedHashMap<String,Object>();row.put("mode",mode);row.put("cost",cost);row.put("power",s.GetPower(ship));row.put("maneuver",mode.equals("capital")||mode.equals("opponent")?null:s.GetManeuver(ship));row.put("armor",mode.equals("capital")||mode.equals("opponent")?q.getArmor(s.gameState(),ship):null);row.put("forfeit",s.GetForfeit(ship));row.put("immunity",q.getImmunityToAttritionLessThan(s.gameState(),ship));row.put("effectOwner",effect.getOwner().equals(VirtualTableScenario.LS)?"light":"dark");rows.add(row);
 }}
}
