import { useHouseNotice } from '../state/houseNotice';
import { uiStrings } from './strings.sv';

/** Meddelandet om huset från en länk, överst i panelen, med en knapp som stänger det. */
export function HouseNotice() {
  const notice = useHouseNotice((state) => state.notice);
  const dismissNotice = useHouseNotice((state) => state.dismissNotice);
  if (!notice) return null;
  return (
    <div className={`house-notice${notice === 'linkFailed' ? ' house-notice-error' : ''}`} role={notice === 'linkFailed' ? 'alert' : 'status'}>
      <p>{notice === 'linkFailed' ? uiStrings.linkFailed : uiStrings.linkOpened}</p>
      <button type="button" className="secondary-button" onClick={dismissNotice}>
        {uiStrings.closeNotice}
      </button>
    </div>
  );
}
