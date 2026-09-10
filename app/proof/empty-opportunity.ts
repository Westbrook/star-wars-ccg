import type {Prompt,Side} from '@/lib/native-proof/types';

export function emptyOpportunityChoice(prompt:Prompt|null|undefined){
 const choice=prompt?.choices[0];
 return prompt?.automatic&&prompt.choices.length===1&&choice?.id==='pass'&&choice.label==='Pass empty opportunity'?choice:null;
}

type ShortcutKey=Pick<KeyboardEvent,'key'|'repeat'|'isComposing'|'defaultPrevented'|'altKey'|'ctrlKey'|'metaKey'|'shiftKey'>;
type ShortcutState={prompt:Prompt|null|undefined;seat:Side|undefined;waiting:boolean;blocked:boolean;hidden:boolean;focusConsumesArrows:boolean};
export function canPassEmptyOpportunity(event:ShortcutKey,state:ShortcutState){
 return event.key==='ArrowRight'&&!event.repeat&&!event.isComposing&&!event.defaultPrevented
  &&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey
  &&!state.waiting&&!state.blocked&&!state.hidden&&!state.focusConsumesArrows
  &&!!state.seat&&state.prompt?.side===state.seat&&!!emptyOpportunityChoice(state.prompt);
}

// Leave native text navigation and arrow-driven widgets in control of their keys.
export const arrowFocusSelector='input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"],[role="tablist"],[role="menu"],[role="listbox"],[role="tree"],[role="grid"],[role="radiogroup"],[role="dialog"],[role="alertdialog"]';
