import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { plural } from '../constants';
import { Alert, lnk } from './ui';

export function StatusAlerts() {
  const { lights, connError, noLights, refresh } = useApp();
  const [dismissed, setDismissed] = useState('');

  const alertKey = connError ? 'conn' : noLights ? 'empty' : '';
  const showAlert = !!alertKey && dismissed !== alertKey;
  useEffect(() => {
    if (!alertKey) setDismissed('');
  }, [alertKey]);

  const offline = lights.filter((l) => !l.online);

  return (
    <>
      {showAlert && (
        <div className="mt-5">
          <Alert
            tone={connError ? 'danger' : 'info'}
            title={connError ? 'Not connected to the lights server' : 'No lights found yet'}
            onDismiss={() => setDismissed(alertKey)}
          >
            {connError ? (
              <>
                {connError}{' '}
                <button type="button" className={`${lnk} underline`} onClick={() => void refresh()}>
                  Try again
                </button>
              </>
            ) : (
              'Check Settings \u203a Network: the broadcast address, a scan range, or add a light\u2019s IP. Make sure this server is on the same network as the lights.'
            )}
          </Alert>
        </div>
      )}

      {!connError && offline.length > 0 && (
        <div className="mt-5">
          <Alert tone="danger" title={`${plural(offline.length)} not responding`}>
            {offline.slice(0, 3).map((l) => l.label).join(', ')}
            {offline.length > 3 ? ` and ${offline.length - 3} more` : ''}. Check that they have power and are on this network.{' '}
            <button type="button" className={`${lnk} underline`} onClick={() => void refresh()}>
              Check again
            </button>
          </Alert>
        </div>
      )}
    </>
  );
}
