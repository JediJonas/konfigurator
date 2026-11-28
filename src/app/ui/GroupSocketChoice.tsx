import { useId } from 'react';
import type { Socket } from '../../core/model/objectType';
import { activeDomain, translate } from '../activeDomain';
import { uiStrings } from './strings.sv';

interface GroupSocketChoiceProps {
  groupKey: string;
  sockets: readonly Socket[];
  chosen: Socket;
  onChoose: (socketId: string) => void;
}

/**
 * Väljer kopplingspunkten i en fältgrupp som knapparna lägger till på, t.ex.
 * takfallet. Samma val görs med ett tryck på takfallet i 3D-vyn; listan gör
 * det med tangentbord och visar vilket som är valt. Med en enda punkt behövs
 * inget val.
 */
export function GroupSocketChoice({ groupKey, sockets, chosen, onChoose }: GroupSocketChoiceProps) {
  const id = useId();
  if (sockets.length < 2) return null;
  return (
    <div className="field">
      <label htmlFor={id}>{activeDomain.strings[`socketChoice.${groupKey}`] ?? uiStrings.socketChoice}</label>
      <select id={id} value={chosen.id} onChange={(event) => onChoose(event.target.value)}>
        {sockets.map((socket) => (
          <option key={socket.id} value={socket.id}>
            {translate(socket.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
