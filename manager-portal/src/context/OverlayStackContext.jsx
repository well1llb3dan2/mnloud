import React, { createContext, useContext, useRef } from 'react';

const OverlayStackContext = createContext();

export const OverlayStackProvider = ({ children }) => {
  const stackRef = useRef([]);
  const backActionRef = useRef([]);

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
    if (closeFn) closeFn();
  };

  const hasOverlay = () => stackRef.current.length > 0;

  const registerBackAction = (actionFn) => {
    if (typeof actionFn === 'function') {
      backActionRef.current.push(actionFn);
    }
  };

  const unregisterBackAction = (actionFn) => {
    const idx = backActionRef.current.lastIndexOf(actionFn);
    if (idx !== -1) {
      backActionRef.current.splice(idx, 1);
    }
  };

  const runBackAction = () => {
    const actionFn = backActionRef.current.pop();
    if (actionFn) actionFn();
  };

  const hasBackAction = () => backActionRef.current.length > 0;

  return (
    <OverlayStackContext.Provider
      value={{
        register,
        unregister,
        closeTop,
        hasOverlay,
        registerBackAction,
        unregisterBackAction,
        runBackAction,
        hasBackAction,
      }}
    >
      {children}
    </OverlayStackContext.Provider>
  );
};

export const useOverlayStack = () => useContext(OverlayStackContext);
