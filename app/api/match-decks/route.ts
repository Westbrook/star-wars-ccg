import {env} from 'cloudflare:workers';
import {nativeDeckService} from '@/lib/native-decks';
import {nativeDeckHandlers} from '@/lib/native-deck-http';
import {premiereRules} from '@/lib/native-engine/premiere-rules';
import {MatchServiceError} from '@/lib/native-engine/service';
const handlers=nativeDeckHandlers(()=>{
 if(!env.DB)throw new MatchServiceError('Saved decks are temporarily unavailable.',503,'DATABASE_UNAVAILABLE');
 return nativeDeckService(env.DB.withSession('first-primary'),premiereRules);
});
export const GET=handlers.list;
export const POST=handlers.save;
