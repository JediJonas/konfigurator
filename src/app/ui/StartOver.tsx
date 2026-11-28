import { useDesignStore } from '../state/designStore';
import { ConfirmAction } from './ConfirmAction';
import { uiStrings } from './strings.sv';

/**
 * Nollställer det sparade huset och börjar om med mallen. Man får bekräfta
 * i panelen först, eftersom det inte går att ångra.
 */
export function StartOver() {
  const resetDesign = useDesignStore((state) => state.resetDesign);
  return <ConfirmAction label={uiStrings.startOver} question={uiStrings.startOverQuestion} confirmLabel={uiStrings.confirmStartOver} onConfirm={resetDesign} className="start-over" />;
}
