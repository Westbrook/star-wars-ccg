'use client';
import {ArrowUpRight} from 'lucide-react';
import {starterFormat, type StarterDeck} from '@/lib/starters';

export default function StarterTile({deck,onSelect}:{deck:StarterDeck;onSelect:(deck:StarterDeck)=>void}) {
  return <button className={'deck-tile starter-tile '+(deck.side==='light'?'rebel':'imperial')} onClick={()=>onSelect(deck)}>
    <div className="deck-picture"><span className="side-label">{deck.side.toUpperCase()} SIDE</span><span className="starter-kind">{deck.size===60?'OPEN DEMO':'GEMP BEGINNER'}</span></div>
    <div className="starter-info"><span className="eyebrow amber">{starterFormat(deck.size)}</span><h3>{deck.title}</h3><p>{deck.description}</p><div className="starter-meta"><span>{deck.main.length} main · {deck.outside.length} outside</span><span>{deck.virtualCount} virtual cards</span></div><span className="starter-action">View & customize<ArrowUpRight size={17}/></span></div>
  </button>;
}
