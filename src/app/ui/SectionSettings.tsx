import { useId } from 'react';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import { useRuleRanges } from '../rules/useRuleRanges';
import { useDesignStore } from '../state/designStore';
import { translate } from '../activeDomain';
import { AddToWall } from './AddToWall';
import { InstanceHeading, InstanceSettings, OffsetInput, RemoveButton, useParamFieldsWithinRules, ViolationList } from './InstanceSettings';
import { listGroupSockets, listPanelWalls, listPartFields } from './panelWalls';
import { ParamForm } from './ParamForm';
import { WallSettings } from './WallSettings';

/** Vad som är utfällt inuti sektionen: en vägg eller en fältgrupp, t.ex. taket. En sak i taget. */
export interface OpenPart {
  wallPartId?: string;
  groupKey?: string;
}

interface SectionSettingsProps {
  entry: PlacedInstance;
  /** Fönster och dörrar på sektionens väggar, och takkupor på taket. */
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
 * (ägarens val). Väggens längd ligger på väggen. Det som sitter på taket,
 * t.ex. takkupor, ligger sist under Tak med en knapp per takfall.
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
  const violationsOf = (instanceId: string) => violations.filter((violation) => violation.instanceId === instanceId);
  // Fel på t.ex. en takkupa syns på sektionen när taket är stängt, så att inget som stoppar ritningen göms.
  const inClosedGroups = nested.filter((child) => child.socket?.paramGroupKey && child.socket.paramGroupKey !== openPart.groupKey);
  const renderGroupExtra = (groupKey: string) => {
    const group = listGroupSockets(entry, nested, groupKey);
    if (group.sockets.length === 0) return null;
    return (
      <>
        {group.nested.length > 0 ? (
          <div className="nested-instances">
            {group.nested.map((child) => (
              <InstanceSettings
                key={child.instance.id}
                entry={child}
                isOpen={props.isNestedOpen(child.instance.id)}
                onToggle={() => props.onToggleNested(child.instance.id)}
                violations={violationsOf(child.instance.id)}
              />
            ))}
          </div>
        ) : null}
        {group.sockets.map((socket) => (
          <AddToWall key={socket.id} entry={entry} wall={socket} placeLabel={translate(socket.labelKey)} />
        ))}
      </>
    );
  };
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
            renderGroupExtra={renderGroupExtra}
          />
          <ViolationList violations={inClosedGroups.flatMap((child) => violationsOf(child.instance.id))} />
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
