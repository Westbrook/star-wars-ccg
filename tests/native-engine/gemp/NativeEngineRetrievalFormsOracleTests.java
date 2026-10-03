package com.gempukku.swccgo.rules.devices;
import com.gempukku.swccgo.common.*;
import com.gempukku.swccgo.filters.Filters;
import com.gempukku.swccgo.framework.*;
import com.gempukku.swccgo.game.*;
import com.gempukku.swccgo.logic.actions.*;
import com.gempukku.swccgo.logic.effects.*;
import com.gempukku.swccgo.logic.modifiers.*;
import com.gempukku.swccgo.logic.timing.*;
import com.gempukku.swccgo.logic.timing.results.*;
import com.google.gson.GsonBuilder;
import org.junit.Test;
import org.junit.AfterClass;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Shared production retrieval primitives, not certification of granting cards. */
public class NativeEngineRetrievalFormsOracleTests {
 static final String LS=VirtualTableScenario.LS,DS=VirtualTableScenario.DS;
 static final List<Map<String,Object>> results=new ArrayList<>();
 @AfterClass public static void output() throws Exception {Files.writeString(Path.of("/opt/gemp-swccg/retrieval-forms-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(results));}
 void pass(VirtualTableScenario s){try{s.PlayerPass(s.GetDecidingPlayer());}catch(Exception e){throw new AssertionError(s.GetDecidingPlayer()+" "+s.GetCurrentDecision().getText()+" "+s.GetCurrentDecision().getDecisionParameters(),e);}}
 @Test public void forms(){for(String mode:List.of("up-to-one","up-to-four","up-to-modifier","empty","hand-mixed","hand-used","hand-fixed","leave","return","new-top","random","random-canceled")){
  var s=new VirtualTableScenario(new HashMap<>(Map.of("source","1_106","a","1_28","b","1_115","c","1_28","d","1_115","e","1_28","extra","1_115")),new HashMap<>(Map.of("plans","13_86")),40,40,StartingSetup.LSStartingLocation("1_129"),StartingSetup.DSStartingLocation("1_284"),StartingSetup.NoLSStartingInterrupts,StartingSetup.NoDSStartingInterrupts,StartingSetup.NoLSShields,StartingSetup.NoDSShields,VirtualTableScenario.Open);
  s.StartGame();s.SkipToLSTurn(Phase.CONTROL);s.MoveCardsToLSHand(s.GetLSCard("source"),s.GetLSCard("extra"));var cards=List.of(s.GetLSCard("a"),s.GetLSCard("b"),s.GetLSCard("c"),s.GetLSCard("d"),s.GetLSCard("e"));for(var card:cards)s.MoveCardsToLSHand(card);if(!mode.equals("empty"))for(var card:cards.reversed())s.MoveCardsToTopOfLSLostPile(card);
  while(s.GetLSForcePileCount()<6)s.LSActivateForceCheat(1);while(s.GetLSForcePileCount()>6)s.LSUseForceCheat(1);
  boolean upTo=mode.startsWith("up-to")||mode.equals("empty"),random=mode.startsWith("random"),hand=mode.equals("hand-mixed")||mode.equals("hand-used"),identity=Set.of("leave","return","new-top").contains(mode);
  boolean plans=upTo||hand||mode.equals("random-canceled");if(plans)s.MoveCardsToDSSideOfTable(s.GetDSCard("plans"));s.SkipToPhase(Phase.DEPLOY);
  if(mode.equals("up-to-modifier"))s.game().getModifiersEnvironment().addUntilEndOfTurnModifier(new ForceRetrievalModifier(s.GetDSCard("plans"),-1,LS));
  var seen=Collections.newSetFromMap(new IdentityHashMap<Object,Boolean>());var retrieved=new ArrayList<String>();boolean[] changed={false},done={false};int[] initiated={0},about={0};
  s.game().getActionsEnvironment().addUntilEndOfGameActionProxy(new AbstractActionProxy(){@Override public List<TriggerAction> getRequiredAfterTriggers(SwccgGame g,EffectResult e){
   if(!seen.add(e))return null;if(e instanceof ForceRetrievalInitiatedResult)initiated[0]++;
   if(e instanceof AboutToRetrieveForceResult){about[0]++;if(identity&&!changed[0]){changed[0]=true;if(mode.equals("new-top"))s.MoveCardsToTopOfLSLostPile(s.GetLSCard("extra"));else {s.MoveCardsToLSHand(cards.getFirst());if(mode.equals("return"))s.MoveCardsToTopOfLSLostPile(cards.getFirst());}}}
   if(e instanceof RetrieveForceResult r){retrieved.add(""+cards.indexOf(r.getMostRecentCardRetrieved()));}return null;
  }});
  var source=s.GetLSCard("source");var action=new TopLevelGameTextAction(source,source.getCardId());
  if(upTo)action.appendEffect(new RetrieveCardsEffect(action,LS,4,true,Filters.and(Filters.Rebel,Filters.trooper)));
  else if(mode.equals("hand-fixed"))action.appendEffect(new RetrieveCardsIntoHandEffect(action,LS,3,false));
  else action.appendEffect(new RetrieveForceEffect(action,LS,identity?1:3,random){@Override public boolean mayBeTakenIntoHand(){return hand;}});
  action.appendEffect(new PassthruEffect(action){@Override protected void doPlayEffect(SwccgGame g){done[0]=true;}});s.game().getActionsEnvironment().addActionToStack(action);pass(s);
  int quantities=0,payments=0,destinations=0;
  for(int i=0;i<350&&!done[0];i++){
   String text=s.GetCurrentDecision().getText();
   if(text.contains("Choose value for X")){quantities++;s.LSDecided(mode.equals("up-to-one")?1:mode.equals("up-to-modifier")?3:4);}
   else if(text.contains("proceed with Force retrieval")){payments++;if(mode.equals("random-canceled"))s.LSChooseNo();else s.LSChooseYes();}
   else if(text.contains("Choose where to retrieve")){boolean toHand=mode.equals("hand-mixed")&&destinations!=1;destinations++;s.LSDecided(toHand?"1":"0");}
   else if(text.startsWith("Choose card")&&text.contains("retrieve")){boolean picked=false;for(var card:cards)if(s.LSHasCardChoiceAvailable(card)){s.LSChooseCard(card);picked=true;break;}assertTrue(picked);}
   else pass(s);
  }
  assertTrue(mode,done[0]);if(identity)assertTrue(changed[0]);
  var row=new LinkedHashMap<String,Object>();row.put("name",mode);row.put("quantityChoices",quantities);row.put("paymentChoices",payments);row.put("destinationChoices",destinations);row.put("spent",6-s.GetLSForcePileCount());row.put("initiated",initiated[0]);row.put("about",about[0]);row.put("retrieved",retrieved.size());
  if(!random){row.put("order",retrieved);row.put("zones",cards.stream().map(c->s.GetLSHand().contains(c)?"hand":s.GetLSUsedPile().contains(c)?"used":"lost").toList());row.put("lostOrder",s.GetLSLostPile().stream().map(c->cards.indexOf(c)).toList());}
  else {assertEquals(mode.equals("random-canceled")?0:3,retrieved.size());assertEquals(retrieved.size(),new HashSet<>(retrieved).size());row.put("remaining",s.GetLSLostPileCount());}
  results.add(row);
 }}
}
