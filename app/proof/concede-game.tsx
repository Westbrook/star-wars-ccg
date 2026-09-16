'use client';
import {useRef,useState} from 'react';
import {Flag} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import type {Projection,Side} from '@/lib/native-proof/types';
const name=(side:Side)=>side==='light'?'Light side':'Dark side';
export function gameOverMessage(game:Projection){return game.concededBy?`${name(game.concededBy)} forfeited the game. ${name(game.winner!)} wins by concession. The final position and history are saved.`:'The opposing player has no Life Force remaining. This game is over; its final result and history are saved.';}
export function ConcedeGame({game,solo,disabled,onOpenChange,onConcede}:{game:Projection;solo:boolean;disabled:boolean;onOpenChange:(open:boolean)=>void;onConcede:(side:Side,revision:number)=>void}){
 const trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[side,setSide]=useState<Side>(game.seat);
 function change(value:boolean){setOpen(value);onOpenChange(value);}
 if(game.winner)return null;
 return <><button ref={trigger} className="button proof-concede" disabled={disabled} onClick={()=>{setSide(game.seat);change(true)}}><Flag size={16}/>Forfeit game</button>
 <Dialog open={open} onOpenChange={change}><DialogContent className="proof-concede-dialog" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus()}}>
  <DialogTitle>Forfeit this game?</DialogTitle>
  <DialogDescription>{name(side)} will concede. {name(side==='light'?'dark':'light')} wins immediately. This cannot be undone; the saved history remains available.</DialogDescription>
  {solo&&<fieldset><legend>Which side is conceding?</legend><div>{(['dark','light'] as const).map(s=><button key={s} className="button" aria-pressed={side===s} onClick={()=>setSide(s)}>{name(s)}</button>)}</div></fieldset>}
  <p>This ends the whole game. It does not forfeit a character or pay battle losses.</p>
  <div className="proof-concede-actions"><button className="button" autoFocus onClick={()=>change(false)}>Keep playing</button><button className="button proof-concede" disabled={disabled} onClick={()=>{onConcede(side,game.revision);change(false)}}>Forfeit as {name(side)}</button></div>
 </DialogContent></Dialog></>;
}
