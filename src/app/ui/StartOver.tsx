import { useDesignStore } from '../state/designStore';
import { ConfirmAction } from './ConfirmAction';
import { uiStrings } from './strings.sv';

/**
 * Nollställer det sparade huset och börjar om med mallen. Man får bekräfta
 * i panelen först; efteråt går huset att få tillbaka med Ångra tills sidan laddas om.
 */
export function StartOver() {
  const resetDesign = useDesignStore((state) => state.resetDesign);
  return <ConfirmAction label={uiStrings.startOver} question={uiStrings.startOverQuestion} confirmLabel={uiStrings.confirmStartOver} onConfirm={resetDesign} className="start-over" />;
}
