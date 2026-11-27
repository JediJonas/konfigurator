import { useId } from 'react';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import { useRuleRanges } from '../rules/useRuleRanges';
import { useDesignStore } from '../state/designStore';
import { InstanceHeading, OffsetInput, RemoveButton, useParamFieldsWithinRules, ViolationList } from './InstanceSettings';
import { listPanelWalls, listPartFields } from './panelWalls';
import { ParamForm } from './ParamForm';
import { WallSettings } from './WallSettings';

/** Vad som är utfällt inuti sektionen: en vägg eller en fältgrupp, t.ex. taket. En sak i taget. */
export interface OpenPart {
  wallPartId?: string;
  groupKey?: string;
}

interface SectionSettingsProps {
  entry: PlacedInstance;
  /** Fönster och dörrar på sektionens väggar. */
  nested: PlacedInstance[];
  violations: RuleViolation[];
  /** Sektioner som sitter på en annan sektion kan flyttas längs väggen och tas bort. */
  isRemovable: boolean;
  isOpen: boolean;
  onToggle: () => void;
  openPart: OpenPart;
  onTogglePart: (part: OpenPart) => void;
  isNestedOpen: (instanceId: string) => boolean;
  onToggleNested: (instanceId: string) => void;
}

/**
 * En sektion i panelen: läget överst om den sitter på en annan sektion, sedan
 * vägghöjden som gäller alla väggar, taket och väggarna med egna rubriker
 * (ägarens val). Väggens längd ligger på väggen.
 */
export function SectionSettings(props: SectionSettingsProps) {
  const { entry, nested, violations, isRemovable, isOpen, onToggle, openPart, onTogglePart } = props;
  const { setParam } = useDesignStore();
  const bodyId = useId();
  const knownRanges = useRuleRanges(entry, isOpen, isRemovable);
  const paramFields = useParamFieldsWithinRules(entry, knownRanges);
  const { instance } = entry;
  const walls = listPanelWalls(entry, nested);
  const wallKeys = new Set(walls.flatMap((wall) => (wall.socket.partParams ?? []).map((param) => param.key)));
  const sectionFields = paramFields.filter((field) => !wallKeys.has(field.key));
  const ownViolations = violations.filter((violation) => violation.instanceId === instance.id);
  return (
    <section className="panel-section" data-instance-id={instance.id}>
      <div className="instance-heading">
        <InstanceHeading entry={entry} headingLevel={2} isOpen={isOpen} onToggle={onToggle} bodyId={bodyId} />
      </div>
      {isOpen ? (
        <div id={bodyId} className="instance-body">
          {isRemovable ? <OffsetInput entry={entry} knownRanges={knownRanges} /> : null}
          <ParamForm
            fields={sectionFields}
            values={instance.params}
            onChange={(key, value) => setParam(instance.id, key, value)}
            openGroupKey={openPart.groupKey}
            onToggleGroup={(groupKey) => onTogglePart(openPart.groupKey === groupKey ? {} : { groupKey })}
          />
          {walls.map((wall) => {
            const isWallOpen = openPart.wallPartId === wall.ownerPartId;
            return (
              <WallSettings
                key={wall.ownerPartId}
                entry={entry}
                wall={wall}
                fields={listPartFields(paramFields, wall.socket)}
                violations={violations}
                isOpen={isWallOpen}
                onToggle={() => onTogglePart(isWallOpen ? {} : { wallPartId: wall.ownerPartId })}
                isNestedOpen={props.isNestedOpen}
                onToggleNested={props.onToggleNested}
              />
            );
          })}
          {isRemovable ? <RemoveButton instanceId={instance.id} /> : null}
        </div>
      ) : null}
      {/* Felen syns även när sektionen är stängd, så att inget som stoppar ritningen göms. */}
      <ViolationList violations={isOpen ? ownViolations : violations} />
    </section>
  );
}
