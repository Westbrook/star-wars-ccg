package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.evaluators.ConstantEvaluator;
import com.google.gson.*;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
public class NativeEngineStatOracleTests {
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/stat-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 VirtualTableScenario fixture(boolean droid){return fixture(droid?"1_6":"1_19");}
 VirtualTableScenario fixture(String blueprint){var s=new VirtualTableScenario(new HashMap<>(Map.of("hero",blueprint)),new HashMap<>(Map.of("hero","1_168","saber","1_324")),16,16,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);s.MoveCardsToLocation(s.GetLSStartingLocation(),s.GetLSCard("hero"),s.GetDSCard("hero"));return s;}
 @Test public void queries() throws Exception{
  var cases=JsonParser.parseString(Files.readString(Path.of("/opt/gemp-swccg/stat-cases.json"))).getAsJsonArray();
  for(var item:cases){var c=item.getAsJsonObject();var s=c.has("blueprint")?fixture(c.get("blueprint").getAsString()):fixture(c.get("droid").getAsBoolean());var h=s.GetLSCard("hero");
   for(var entry:c.getAsJsonArray("ops")){var op=entry.getAsJsonObject();var src=op.get("source").getAsString().equals("hero")?h:s.GetDSStartingLocation();int amount=op.get("amount").getAsInt();String type=op.get("stat").getAsString()+":"+op.get("kind").getAsString();
    Modifier mod=switch(type){
     case "armor:define"->new DefinedByGameTextArmorModifier(h,amount);
     case "armor:add"->new ArmorModifier(src,h,amount);
     case "armor:reset"->new ResetArmorModifier(src,h,amount);
     case "maneuver:define"->new DefinedByGameTextManeuverModifier(h,new ConstantEvaluator(amount));
     case "maneuver:add"->new ManeuverModifier(src,h,amount);
     case "maneuver:reset"->new ResetManeuverModifier(src,h,amount);
     case "defense:add"->new DefenseValueModifier(src,h,amount);
     case "defense:reset"->new ResetDefenseValueModifier(src,h,amount);
     case "defense:minimum"->new MinimumDefenseValueReducedToModifier(src,h,null,amount);
     case "defense:maximum"->new MaximumDefenseValueModifiedToModifier(src,h,null,amount);
     case "defense:base-cap"->new MayNotHaveDefenseValueIncreasedAbovePrintedModifier(src,h);
     case "defense:prevent-reduce"->new MayNotHaveDefenseValueReducedModifier(src,h,op.has("by")?(op.get("by").getAsString().equals("dark")?VirtualTableScenario.DS:VirtualTableScenario.LS):null);
     case "forfeit:define"->new DefinedByGameTextForfeitModifier(src,h,amount);
     case "forfeit:add"->new ForfeitModifier(src,h,amount);
     case "forfeit:reset"->new ResetForfeitModifier(src,h,amount);
     case "forfeit:prevent-reduce"->new MayNotHaveForfeitValueReducedModifier(src,h);
     case "forfeit:prevent-increase"->new MayNotHaveForfeitValueIncreasedModifier(src,h);
     case "forfeit:increase-limit"->new ForfeitIncreaseLimitModifier(src,h,amount);
     case "forfeit:printed-cap"->new MayNotHaveForfeitIncreasedAbovePrintedModifier(src,h);
     case "forfeit:base-double"->new DoubledModifier(src,h);
     default->throw new IllegalArgumentException(type);
    };s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(mod);
   }
   var q=s.game().getModifiersQuerying();rows.add(Map.of("name",c.get("name").getAsString(),"defense",q.getDefenseValue(s.gameState(),h),"ability",q.getAbility(s.gameState(),h),"armor",q.getArmor(s.gameState(),h),"maneuver",q.getManeuver(s.gameState(),h),"forfeit",q.getForfeit(s.gameState(),h)));
  }
 }
 void pass(VirtualTableScenario s){if(s.GetCurrentDecision().getText().toLowerCase().contains("battle destiny?"))s.PlayerChooseNo(s.GetDecidingPlayer());else s.PlayerPass(s.GetDecidingPlayer());}
 @Test public void protectedLightsaberHit(){for(boolean late:new boolean[]{false,true}){
  var s=fixture(false);var h=s.GetLSCard("hero");var saber=s.GetDSCard("saber");s.AttachCardsTo(s.GetDSCard("hero"),saber);s.DSActivateForceCheat(8);s.SkipToPhase(Phase.BATTLE);s.DSInitiateBattle(s.GetLSStartingLocation());for(int i=0;i<60&&!(s.GetDecidingPlayer().equals(VirtualTableScenario.DS)&&s.DSCardActionAvailable(saber,"Fire"));i++)pass(s);
  Modifier protection=new MayNotHaveForfeitValueReducedModifier(s.GetLSStartingLocation(),h);if(!late)s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(protection);
  s.PrepareDSDestiny(7);s.DSUseCardAction(saber,"Fire");s.DSChooseCard(h);for(int i=0;i<100&&!h.isHit();i++)pass(s);assertTrue(h.isHit());
  if(late)s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(protection);
  float protectedValue=s.game().getModifiersQuerying().getForfeit(s.gameState(),h);s.game().getModifiersEnvironment().removeEndOfTurnModifiers();
  rows.add(Map.of("name",late?"protection-after-hit":"protection-before-hit","hit",h.isHit(),"protected",protectedValue,"after",s.game().getModifiersQuerying().getForfeit(s.gameState(),h)));
 }}
}
