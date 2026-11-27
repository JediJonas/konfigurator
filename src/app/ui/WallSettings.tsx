import { useId } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import { translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { AddToWall } from './AddToWall';
import { InstanceSettings, ViolationList } from './InstanceSettings';
import type { PanelWall } from './panelWalls';
import { ParamForm } from './ParamForm';

interface WallSettingsProps {
  entry: PlacedInstance;
  wall: PanelWall;
  /** Väggens mått, t.ex. längd och höjd, med gränserna enligt reglerna. */
  fields: ParamField[];
  violations: RuleViolation[];
  isOpen: boolean;
  onToggle: () => void;
  /** Om fönstret eller dörren är utfälld; en sak i taget. */
  isNestedOpen: (instanceId: string) => boolean;
  onToggleNested: (instanceId: string) => void;
}

/**
 * En vägg med egen rubrik under sektionen: väggens mått, fönstren och dörrarna
 * på den och knapparna för att bygga till (ägarens val). Stängd visar den bara felen för det som sitter på den.
 */
export function WallSettings({ entry, wall, fields, violations, isOpen, onToggle, isNestedOpen, onToggleNested }: WallSettingsProps) {
  const { setParam } = useDesignStore();
  const bodyId = useId();
  const { instance } = entry;
  const violationsOf = (instanceId: string) => violations.filter((violation) => violation.instanceId === instanceId);
  return (
    <div className="field-group wall-group" data-group-key={wall.ownerPartId}>
      <h3>
        <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
          <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width={18} height={18}>
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {translate(wall.socket.labelKey)}
        </button>
      </h3>
      {isOpen ? (
        <div id={bodyId} className="param-form">
          <ParamForm fields={fields} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
          {wall.nested.length > 0 ? (
            <div className="nested-instances">
              {wall.nested.map((child) => (
                <InstanceSettings
                  key={child.instance.id}
                  entry={child}
                  isOpen={isNestedOpen(child.instance.id)}
                  onToggle={() => onToggleNested(child.instance.id)}
                  violations={violationsOf(child.instance.id)}
                />
              ))}
            </div>
          ) : null}
          <AddToWall entry={entry} wall={wall.socket} />
        </div>
      ) : (
        // Felen på fönster och dörrar syns på väggen när den är stängd, så att inget som stoppar ritningen göms.
        <ViolationList violations={wall.nested.flatMap((child) => violationsOf(child.instance.id))} />
      )}
    </div>
  );
}
