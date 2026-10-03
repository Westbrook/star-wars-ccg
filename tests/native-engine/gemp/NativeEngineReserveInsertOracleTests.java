package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.timing.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Real card deployments; removal test controls only the revealed flag. */
public class NativeEngineReserveInsertOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> rows=new ArrayList<>();
 @AfterClass public static void output() throws Exception{Files.writeString(Path.of("/opt/gemp-swccg/reserve-inserts-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));}
 void pass(VirtualTableScenario s){s.PlayerPass(s.GetDecidingPlayer());}
 VirtualTableScenario fixture(String owner,int count){var s=new VirtualTableScenario(new HashMap<>(Map.of("insert","1_42")),new HashMap<>(Map.of("insert","1_208")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);s.StartGame();if(owner.equals(LS))s.SkipToLSTurn(Phase.CONTROL);else s.SkipToPhase(Phase.CONTROL);var card=owner.equals(LS)?s.GetLSCard("insert"):s.GetDSCard("insert");if(owner.equals(LS))s.MoveCardsToLSHand(card);else s.MoveCardsToDSHand(card);String target=s.game().getOpponent(owner);var deck=new ArrayList<>(s.gameState().getReserveDeck(target));for(var c:deck.subList(count,deck.size()))s.MoveCardsToTopOfOwnUsedPile((PhysicalCardImpl)c);s.SkipToPhase(Phase.DEPLOY);return s;}
 PhysicalCardImpl deploy(VirtualTableScenario s,String owner){var card=owner.equals(LS)?s.GetLSCard("insert"):s.GetDSCard("insert");if(owner.equals(LS))s.LSDeployCard(card);else s.DSDeployCard(card);for(int i=0;i<30&&!card.isInserted();i++)pass(s);assertTrue(card.isInserted());return card;}
 @Test public void placement(){for(String owner:List.of(LS,DS))for(int count:List.of(1,2,4)){
  var s=fixture(owner,count);String target=s.game().getOpponent(owner);var card=owner.equals(LS)?s.GetLSCard("insert"):s.GetDSCard("insert");boolean allowed=owner.equals(LS)?s.LSDeployAvailable(card):s.DSDeployAvailable(card);assertEquals(count>=2,allowed);var row=new LinkedHashMap<String,Object>();row.put("kind","placement");row.put("owner",owner.equals(LS)?"light":"dark");row.put("count",count);row.put("allowed",allowed);
  if(allowed){int life=s.GetPlayerLifeForceRemaining(target);deploy(s,owner);assertEquals(count,s.gameState().getReserveDeck(target).size());assertEquals(count+1,s.gameState().getReserveDeck(target,false).size());boolean topOrdinary=true;for(int i=0;i<30;i++){s.gameState().shuffleReserveDeck(target);topOrdinary&=!s.gameState().getReserveDeck(target,false).getFirst().isInserted();}assertTrue(topOrdinary);row.put("ordinaryCount",s.gameState().getReserveDeck(target).size());row.put("lifeChange",s.GetPlayerLifeForceRemaining(target)-life);row.put("ownerPreserved",card.getOwner().equals(owner));row.put("topOrdinary",topOrdinary);}
  rows.add(row);
 }}
 @Test public void removal(){for(String owner:List.of(LS,DS)){
  var s=fixture(owner,4);String target=s.game().getOpponent(owner);var card=deploy(s,owner);int count=s.gameState().getReserveDeck(target).size(),life=s.GetPlayerLifeForceRemaining(target);card.setInsertCardRevealed(true);boolean[]done={false};var action=new TopLevelGameTextAction(card,card.getCardId());action.appendEffect(new LoseInsertCardEffect(action,card));action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);for(int i=0;i<60&&!done[0];i++)pass(s);assertTrue(done[0]);assertTrue(s.gameState().getLostPile(owner).contains(card));assertFalse(card.isInserted());rows.add(Map.of("kind","removal","owner",owner.equals(LS)?"light":"dark","ordinaryCount",s.gameState().getReserveDeck(target).size(),"lifeChange",s.GetPlayerLifeForceRemaining(target)-life,"ownerLost",s.gameState().getLostPile(owner).contains(card),"registrationCleared",!card.isInserted()));assertEquals(count,s.gameState().getReserveDeck(target).size());
 }}
}
