package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.TopLevelGameTextAction;
import com.gempukku.swccgo.logic.effects.RecordCardsBeingPlayedEffect;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
/** Production uniqueness queries and initiated-play recording. Zone placements
 * are controlled interventions, not complete deployment/return cards. */
public class NativeEnginePersonaOracleTests {
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/persona-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 private VirtualTableScenario fixture(){var s=new VirtualTableScenario(new HashMap<>(Map.of("luke","101_2","copy","101_2","alt","1_19","lando","5_5","wolf1","1_30","wolf2","1_30","wolf3","1_30","wolf4","1_30","run","101_3","run2","101_3")),new HashMap<>(Map.of("lando","5_99","lab","1_184","spy","1_195")),10,10,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();s.SkipToPhase(Phase.CONTROL);return s;}
 private void record(VirtualTableScenario s,PhysicalCardImpl c){new RecordCardsBeingPlayedEffect(new TopLevelGameTextAction(c,c.getCardId()),List.of(c)).doPlayEffect(s.game());}
 @Test public void identityLimits(){for(String mode:new String[]{"empty","same-title","same-persona","opponent-same-title","out-title","out-persona","lost-persona","restricted-two","restricted-three","turn-title","turn-persona","turn-canceled","turn-restricted-two","turn-restricted-three","next-turn"}){
  var s=fixture();var target=s.GetLSCard("copy");var source=s.GetLSCard("luke");var site=s.GetLSStartingLocation();
  if(mode.equals("same-title"))s.MoveCardsToLocation(site,source);
  if(mode.equals("same-persona")){target=s.GetLSCard("alt");s.MoveCardsToLocation(site,source);}
  if(mode.equals("opponent-same-title")){target=s.GetLSCard("lando");s.MoveCardsToLocation(site,s.GetDSCard("lando"));}
  if(mode.equals("out-title")||mode.equals("out-persona")){if(mode.endsWith("persona"))target=s.GetLSCard("alt");s.MoveOutOfPlay(source);}
  if(mode.equals("lost-persona")){target=s.GetLSCard("alt");s.MoveCardsToTopOfLSLostPile(source);}
  if(mode.startsWith("restricted")){target=s.GetLSCard("wolf4");s.MoveCardsToLocation(site,s.GetLSCard("wolf1"),s.GetLSCard("wolf2"));if(mode.endsWith("three"))s.MoveCardsToLocation(site,s.GetLSCard("wolf3"));}
  if(mode.startsWith("turn-restricted")){target=s.GetLSCard("wolf4");record(s,s.GetLSCard("wolf1"));record(s,s.GetLSCard("wolf2"));if(mode.endsWith("three"))record(s,s.GetLSCard("wolf3"));}
  else if(mode.startsWith("turn")||mode.equals("next-turn")){if(mode.equals("turn-persona"))target=s.GetLSCard("alt");if(mode.equals("turn-canceled")){source=s.GetLSCard("run");target=s.GetLSCard("run2");}record(s,source);s.MoveCardsToTopOfLSLostPile(source);if(mode.equals("next-turn"))s.SkipToLSTurn(Phase.CONTROL);}
  var q=s.game().getModifiersQuerying();results.add(Map.of("name",mode,"tableAllowed",!q.isUniquenessOnTableLimitReached(s.gameState(),target),"turnAllowed",!q.isPlayingCardTitleTurnLimitReached(s.gameState(),target)));
 }}
}
