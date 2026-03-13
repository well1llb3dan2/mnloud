import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import { useOverlayStack } from '../context';

// Main tab routes (bottom nav) - back from these goes to home
const HOME_ROUTE = '/';

export const useBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { hasOverlay, closeTop } = useOverlayStack();
  const lastBackPress = useRef(0);
  const toastIdRef = useRef(null);

  const handlePopState = useCallback((e) => {
    // If camera just returned, ignore this immediate pop caused by camera UI on some devices
    try {
      const lastCameraAccept = window.__lastCameraAccept || 0;
      if (Date.now() - lastCameraAccept < 1500) {
        // Clear the flag and re-push state to stay in app
        window.__lastCameraAccept = 0;
        window.history.pushState(null, '', window.location.href);
        return;
      }
    } catch (err) {}

    // If there's an open overlay/modal, close it first (single press)
    if (hasOverlay()) {
      closeTop();
      // Restore history so we remain in the app
      window.history.pushState(null, '', window.location.href);
      return;
    }

    const path = location.pathname;

    // Home route: double press to exit
    if (path === HOME_ROUTE) {
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        if (toastIdRef.current) toast.close(toastIdRef.current);
        // Allow default back (exit)
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

      // Prevent leaving immediately
      window.history.pushState(null, '', window.location.href);
      return;
    }

    // Handle hierarchical path navigation: /parent (1 segment) -> home
    // /parent/child (2 segments) -> parent
    // /parent/child/... (>=3) -> allow normal back
    const segments = path.split('/').filter(Boolean);

    if (segments.length >= 3) {
      // Deeper page: allow normal history back
      return;
    }

    if (segments.length === 2) {
      // e.g., /products/flower -> go to shop landing
      if (segments[0] === 'products') {
        navigate(HOME_ROUTE, { replace: true });
        return;
      }
      const parent = `/${segments[0]}`;
      navigate(parent, { replace: true });
      return;
    }

    if (segments.length === 1) {
      // e.g., /products -> go to home
      navigate(HOME_ROUTE, { replace: true });
      return;
    }

    // Fallback
    navigate(HOME_ROUTE, { replace: true });
  }, [hasOverlay, closeTop, location.pathname, navigate, toast]);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  return null;
};

export default useBackButton;
