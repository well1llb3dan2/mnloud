import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(() => {});

const normalizePosition = (position) => {
  if (!position) return 'bottom';
  if (position.includes('top')) return 'top';
  return 'bottom';
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = {
      id,
      title: options.title || '',
      description: options.description || '',
      status: options.status || 'info',
      isClosable: options.isClosable !== false,
      position: normalizePosition(options.position),
    };

    setToasts((prev) => [...prev, toast]);

    if (options.duration !== null) {
      const duration = options.duration ?? 3000;
      window.setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const toastApi = useMemo(() => {
    const api = (options) => showToast(options);
    api.close = (id) => removeToast(id);
    return api;
  }, [removeToast, showToast]);

  const topToasts = toasts.filter((toast) => toast.position === 'top');
  const bottomToasts = toasts.filter((toast) => toast.position === 'bottom');

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      {topToasts.length > 0 && (
        <div className="toast-stack top">
          {topToasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.status}`}>
              <strong>{toast.title}</strong>
              {toast.description ? <div>{toast.description}</div> : null}
            </div>
          ))}
        </div>
      )}
      {bottomToasts.length > 0 && (
        <div className="toast-stack bottom">
          {bottomToasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.status}`}>
              <strong>{toast.title}</strong>
              {toast.description ? <div>{toast.description}</div> : null}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
