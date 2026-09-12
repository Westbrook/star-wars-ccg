import type {Side} from '@/lib/native-proof/types';

export function LocationForce({icons}:{icons:Record<Side,number>}){
 return <span className="proof-location-force" aria-label={'Printed Force icons: Dark '+icons.dark+', Light '+icons.light}><span>Dark <b>{icons.dark}</b><span aria-hidden="true">✦</span></span><span>Light <b>{icons.light}</b><span aria-hidden="true">✦</span></span></span>;
}
