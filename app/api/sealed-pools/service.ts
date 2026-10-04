import {env} from 'cloudflare:workers';
import {nativeSealedService,SealedError} from '@/lib/native-sealed';
import {nativeSealedHandlers} from '@/lib/native-sealed-http';
export const sealedHttp=nativeSealedHandlers(()=>{
 if(!env.DB)throw new SealedError('Saved pools are temporarily unavailable.',503,'DATABASE_UNAVAILABLE');
 return nativeSealedService(env.DB.withSession('first-primary'));
});
