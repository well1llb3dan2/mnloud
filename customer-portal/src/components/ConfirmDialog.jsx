import { useCallback, useRef, useState } from 'react';

export const useConfirmDialog = () => {
  const cancelRef = useRef();
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState((prev) => ({
        ...prev,
        isOpen: true,
        title: options?.title ?? prev.title,
        message: options?.message ?? '',
        confirmText: options?.confirmText ?? 'Confirm',
        cancelText: options?.cancelText ?? 'Cancel',
      }));
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialog = useCallback(() => (
    dialogState.isOpen ? (
      <div className="modal-backdrop" role="presentation" onClick={handleClose}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={dialogState.title}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>{dialogState.title}</h3>
          <p>{dialogState.message}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              ref={cancelRef}
              type="button"
              className="button secondary"
              onClick={handleClose}
            >
              {dialogState.cancelText}
            </button>
            <button type="button" className="button" onClick={handleConfirm}>
              {dialogState.confirmText}
            </button>
          </div>
        </div>
      </div>
    ) : null
  ), [dialogState, handleClose, handleConfirm]);

  return { confirm, ConfirmDialog };
};
