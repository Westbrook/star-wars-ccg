import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw Error('Your archive is temporarily unavailable. Please try again.');return env.DB}
