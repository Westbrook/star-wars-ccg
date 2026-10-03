import {env} from 'cloudflare:workers';
import {premiereRules} from './premiere-rules';
import {nativeMatchService, MatchServiceError} from './service';
import {matchHandlers} from './http';

export const nativeMatchHttp = matchHandlers(() => {
  if (!env.DB) throw new MatchServiceError('Saved matches are temporarily unavailable.',503,'DATABASE_UNAVAILABLE');
  // Begin each request at primary, then preserve sequential consistency across
  // reads, transaction and response even when D1 read replicas are enabled.
  const db = env.DB.withSession('first-primary');
  return nativeMatchService(db,{currentRules:premiereRules.id,rules:id => id === premiereRules.id ? premiereRules : undefined});
});
