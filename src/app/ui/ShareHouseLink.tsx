import { useId, useState } from 'react';
import { activeDomain } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { createHouseLink } from '../storage/houseLink';
import { uiStrings } from './strings.sv';

/**
 * Kopierar en länk med hela huset, så att det går att öppna på en annan
 * enhet. Länken visas också i ett fält, om webbläsaren inte låter appen kopiera.
 */
export function ShareHouseLink() {
  const design = useDesignStore((state) => state.design);
  const houseName = useDesignStore((state) => state.houseName);
  const [shared, setShared] = useState<{ link: string; design: typeof design; status: string }>();
  const linkId = useId();
  // Länken gäller huset som det var; ändras huset göms den.
  const current = shared?.design === design ? shared : undefined;

  async function handleShare() {
    const pageUrl = window.location.href.split('#')[0] ?? window.location.href;
    const created = await createHouseLink(pageUrl, design, activeDomain, houseName?.trim() || undefined);
    if (isTouchDevice() && navigator.share) {
      // I mobilen och på iPad öppnas delningsmenyn, t.ex. för AirDrop eller Meddelanden.
      try {
        await navigator.share({ title: houseName?.trim() || uiStrings.projectName, url: created });
        setShared({ link: created, design, status: '' });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return setShared({ link: created, design, status: '' });
      }
    }
    try {
      await navigator.clipboard.writeText(created);
      setShared({ link: created, design, status: uiStrings.linkCopied });
    } catch {
      setShared({ link: created, design, status: uiStrings.linkCopyFailed });
    }
  }

  return (
    <div className="share-house">
      <button type="button" className="secondary-button share-house-button" onClick={() => void handleShare()}>
        {uiStrings.shareLink}
      </button>
      <p className="field-hint">{uiStrings.shareLinkHint}</p>
      {current ? (
        <div className="field">
          <label htmlFor={linkId}>{uiStrings.houseLink}</label>
          <input id={linkId} type="text" value={current.link} readOnly onFocus={(event) => event.target.select()} />
        </div>
      ) : null}
      <p className="field-hint" role="status">
        {current?.status}
      </p>
    </div>
  );
}

/** Pekskärm som huvudsakligt sätt att peka, som i mobilen och på iPad. */
function isTouchDevice(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
