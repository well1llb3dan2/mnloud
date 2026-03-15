import React, { createContext, useContext, useRef } from 'react';

const OverlayStackContext = createContext();

export const OverlayStackProvider = ({ children }) => {
  const stackRef = useRef([]);

  // Register a close function for an overlay/modal
  const register = (closeFn) => {
    if (typeof closeFn === 'function') {
      stackRef.current.push(closeFn);
    }
  };

  // Unregister a specific close function (called when overlay closes normally)
  const unregister = (closeFn) => {
    const idx = stackRef.current.lastIndexOf(closeFn);
    if (idx !== -1) {
      stackRef.current.splice(idx, 1);
    }
  };

  // Close the top-most overlay (used by back button handler)
  const closeTop = () => {
    const closeFn = stackRef.current.pop();
    if (closeFn) {
      const result = closeFn();
      if (result === false) stackRef.current.push(closeFn);
    }
  };

  const hasOverlay = () => stackRef.current.length > 0;

  return (
    <OverlayStackContext.Provider value={{ register, unregister, closeTop, hasOverlay }}>
      {children}
    </OverlayStackContext.Provider>
  );
};

export const useOverlayStack = () => useContext(OverlayStackContext);
