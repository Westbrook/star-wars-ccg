import {noAdmissionProfiles} from './admission';
import {env} from 'cloudflare:workers';
import {premiereRules} from './premiere-rules';
import {nativeMatchService, MatchServiceError} from './service';
import {matchHandlers} from './http';

// Exact-pair infrastructure is installed, but no production pair is certified.
const productionRules = {...premiereRules,admissionProfiles:noAdmissionProfiles};

export const nativeMatchHttp = matchHandlers(() => {
  if (!env.DB) throw new MatchServiceError('Saved matches are temporarily unavailable.',503,'DATABASE_UNAVAILABLE');
  // Begin each request at primary, then preserve sequential consistency across
  // reads, transaction and response even when D1 read replicas are enabled.
  const db = env.DB.withSession('first-primary');
  return nativeMatchService(db,{currentRules:productionRules.id,rules:id => id === productionRules.id ? productionRules : undefined});
});
