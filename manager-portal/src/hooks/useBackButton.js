import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import { useOverlayStack } from '../context';

const HOME_ROUTE = '/';

export const useBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { hasOverlay, closeTop, hasBackAction, runBackAction } = useOverlayStack();
  const lastBackPress = useRef(0);
  const overlayBackPress = useRef(0);
  const toastIdRef = useRef(null);
  const overlayToastIdRef = useRef(null);

  const handlePopState = useCallback((e) => {
    // Ignore popstate caused by camera UI or file input handoff
    try {
      if (window.__ignoreNextPopState) {
        window.__ignoreNextPopState = false;
        window.history.pushState(null, '', window.location.href);
        return;
      }
      const ignoreUntil = window.__ignorePopStateUntil || 0;
      if (Date.now() < ignoreUntil) {
        window.history.pushState(null, '', window.location.href);
        return;
      }
    } catch (err) {}

    // If camera just returned, ignore this immediate pop caused by camera UI on some devices
    let cameraJustReturned = false;
    try {
      const lastCameraAccept = window.__lastCameraAccept || 0;
      if (Date.now() - lastCameraAccept < 3000) {
        cameraJustReturned = true;
        window.__lastCameraAccept = 0;
        window.history.pushState(null, '', window.location.href);
        return;
      }
    } catch (err) {}

    // Step-wise back actions (e.g., multi-step forms)
    if (hasBackAction()) {
      runBackAction();
      window.history.pushState(null, '', window.location.href);
      return;
    }

    // Close overlays first (single press)
    if (hasOverlay()) {
      if (cameraJustReturned) {
        window.history.pushState(null, '', window.location.href);
        return;
      }

      if (overlayToastIdRef.current) toast.close(overlayToastIdRef.current);
      overlayBackPress.current = 0;
      closeTop();
      window.history.pushState(null, '', window.location.href);
      return;
    }

    const path = location.pathname;

    // Dashboard: double press to exit
    if (path === HOME_ROUTE) {
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        if (toastIdRef.current) toast.close(toastIdRef.current);
        window.history.back();
        return;
      }

      lastBackPress.current = now;
      toastIdRef.current = toast({
        title: 'Press back again to exit',
        status: 'info',
        duration: 2000,
        isClosable: false,
        position: 'bottom',
      });

      window.history.pushState(null, '', window.location.href);
      return;
    }

    const segments = path.split('/').filter(Boolean);

    if (segments.length >= 3) {
      // deeper page - let browser handle
      return;
    }

    if (segments.length === 2) {
      // e.g., /products/bulk -> /products
      const parent = `/${segments[0]}`;
      navigate(parent, { replace: true });
      return;
    }

    if (segments.length === 1) {
      // main tab -> dashboard
      navigate(HOME_ROUTE, { replace: true });
      return;
    }

    navigate(HOME_ROUTE, { replace: true });
  }, [hasBackAction, runBackAction, hasOverlay, closeTop, location.pathname, navigate, toast]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  return null;
};

export default useBackButton;
