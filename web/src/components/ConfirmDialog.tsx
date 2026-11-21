import { useEffect, useRef } from 'react';
import { useApp } from '../context';
import { btn, btnPrimary, Modal } from './ui';

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useApp();
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirm) noRef.current?.focus();
  }, [confirm]);

  const yes = () => {
    const run = confirm?.run;
    closeConfirm();
    run?.();
  };

  return (
    <Modal open={!!confirm} onClose={closeConfirm} labelledBy="cfmText" className="w-[min(380px,92vw)]">
      {confirm && (
        <>
          <p id="cfmText" className="mb-[18px] text-[1.05rem]">
            {confirm.text}
          </p>
          {confirm.equal ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button ref={noRef} className={`${btnPrimary} py-4 text-[1.3rem] font-bold`} onClick={closeConfirm}>
                No
              </button>
              <button className={`${btn} py-4 text-[1.3rem] font-bold`} onClick={yes}>
                {confirm.yes}
              </button>
            </div>
          ) : (
            <>
              <button ref={noRef} className={`${btnPrimary} w-full py-4 text-[1.3rem] font-bold`} onClick={closeConfirm}>
                No
              </button>
              <button className="mt-[26px] ml-auto block cursor-pointer rounded-full border-0 bg-transparent px-2 py-0.5 text-[.7rem] text-mut" onClick={yes}>
                {confirm.yes}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
