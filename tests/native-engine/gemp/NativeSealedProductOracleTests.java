package com.gempukku.swccgo.rules.devices;

import com.gempukku.swccgo.framework.VirtualTableScenario;
import com.gempukku.swccgo.game.CardCollection;
import com.gempukku.swccgo.cards.packs.RarityReader;
import com.gempukku.swccgo.packagedProduct.*;
import com.google.gson.*;
import org.junit.Test;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Executes unchanged product implementations. Only their RNG is injected;
 * bounded choices are retained so native collation can replay the exact draw. */
public class NativeSealedProductOracleTests {
 static class RecordingRandom extends Random {
  final List<Integer> choices=new ArrayList<>();
  RecordingRandom(long seed){super(seed);}
  @Override public int nextInt(int bound){int n=super.nextInt(bound);choices.add(n);return n;}
 }
 List<String> cards(List<CardCollection.Item> items){
  List<String> cards=new ArrayList<>();for(var item:items)for(int i=0;i<item.getCount();i++)cards.add(item.getBlueprintId());return cards;
 }
 @Test public void sealedProducts() throws Exception {
  var library=VirtualTableScenario._cardLibrary;
  var fixed=cards(new OfficialTournamentSealedDeck(library).openPackage());
  assertEquals(23,fixed.size());
  List<Map<String,Object>> packs=new ArrayList<>();
  for(int set:List.of(1,2))for(int seed=1;seed<=8;seed++){
   var pack=set==1?new PremiereBoosterPack(library):new ANewHopeBoosterPack(library);
   var rng=new RecordingRandom(seed);var field=pack.getClass().getDeclaredField("_random");field.setAccessible(true);field.set(pack,rng);
   var opened=cards(pack.openPackage());assertEquals(15,opened.size());
   packs.add(Map.of("set",set,"seed",seed,"entropy",rng.choices,"cards",opened));
  }
  var excluded=new LinkedHashMap<String,List<String>>();
  for(String set:List.of("1","2","106")){var missing=new ArrayList<String>();for(String bp:new RarityReader().getSetRarity(set).getAllCards())if(library.getSwccgoCardBlueprint(bp)==null)missing.add(bp);Collections.sort(missing);excluded.put(set,missing);}
  var output=Map.of("fixed",fixed,"packs",packs,"excluded",excluded);
  Files.writeString(Path.of("/opt/gemp-swccg/native-sealed-products-results.json"),new GsonBuilder().setPrettyPrinting().create().toJson(output));
 }
}
