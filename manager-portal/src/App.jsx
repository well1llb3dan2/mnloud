import { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useToast, VStack, Heading, Text, Button, Link } from '@chakra-ui/react';
import { useAuthStore } from './stores/authStore';
import { SocketProvider } from './context/SocketContext';
import { OverlayStackProvider } from './context';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Flowers from './pages/products/Flowers';
import Disposables from './pages/products/Disposables';
import Concentrates from './pages/products/Concentrates';
import Edibles from './pages/products/Edibles';
import PriceTiers from './pages/PriceTiers';
import Chats from './pages/Chats';
import ChatDetail from './pages/ChatDetail';
import Orders from './pages/Orders';
import Invites from './pages/Invites';
import Users from './pages/Users';
import Profile from './pages/Profile';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <SocketProvider>{children}</SocketProvider>;
};

// Public route wrapper
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const toast = useToast();

  const browserSupport = useMemo(() => {
    const ua = navigator.userAgent || '';
    if (/chrome|chromium|crios/i.test(ua) && !/edg/i.test(ua)) return 'chrome';
    if (/safari/i.test(ua) && !/chrome|crios|chromium|edg|fxios|opr/i.test(ua)) return 'safari';
    const isIosDevice = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIosDevice && !/crios|fxios|edg|opr/i.test(ua)) return 'safari';
    return 'unsupported';
  }, []);

  if (browserSupport === 'unsupported') {
    const currentUrl = window.location.href;
    return (
      <VStack spacing={6} maxW="420px" mx="auto" mt="80px" px={8} textAlign="center">
        <Heading size="lg">Unsupported Browser</Heading>
        <Text opacity={0.8}>
          This app works best in Chrome or Safari. Please open it in one of those browsers for the best experience.
        </Text>
        <VStack spacing={3} w="full">
          <Button
            as={Link}
            href={`googlechrome://${currentUrl.replace(/^https?:\/\//, '')}`}
            w="full"
            colorScheme="purple"
            _hover={{ textDecoration: 'none' }}
          >
            Open in Chrome
          </Button>
          <Button
            w="full"
            bg="gray.600"
            color="white"
            _hover={{ bg: 'gray.500' }}
            onClick={() => navigator.clipboard?.writeText(currentUrl)}
          >
            Copy Link
          </Button>
        </VStack>
      </VStack>
    );
  }

  useEffect(() => {
    const storageKey = 'manager:lastPortalVersion';
    let isMounted = true;

    const checkPortalUpdate = async () => {
      try {
        const response = await fetch('/', { method: 'HEAD', cache: 'no-store' });
        const version = response.headers.get('etag') || response.headers.get('last-modified');
        if (!version) return;
        const previous = localStorage.getItem(storageKey);
        if (previous && previous !== version && isMounted) {
          toast({
            title: 'Update available',
            description: 'A new version of the portal is available. Refresh to update.',
            status: 'info',
            duration: null,
            isClosable: true,
            position: 'top-right',
          });
        }
        localStorage.setItem(storageKey, version);
      } catch (error) {
        // Ignore update check errors
      }
    };

    checkPortalUpdate();
    const intervalId = setInterval(checkPortalUpdate, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [toast]);

  useEffect(() => {
    const navOffset = 80;

    const isTextInput = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const ensureVisible = (el) => {
      if (!isTextInput(el)) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const rect = el.getBoundingClientRect();
      const visibleBottom = viewportHeight - navOffset;

      if (rect.bottom > visibleBottom) {
        const delta = rect.bottom - visibleBottom + 12;
        window.scrollBy({ top: delta, behavior: 'smooth' });
      } else if (rect.top < 0) {
        window.scrollBy({ top: rect.top - 12, behavior: 'smooth' });
      }
    };

    const handleFocusIn = (event) => {
      setTimeout(() => ensureVisible(event.target), 50);
    };

    const handleViewportChange = () => {
      const active = document.activeElement;
      if (isTextInput(active)) {
        ensureVisible(active);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return (
    <OverlayStackProvider>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/flower" element={<Flowers />} />
          <Route path="products/disposables" element={<Disposables />} />
          <Route path="products/concentrates" element={<Concentrates />} />
          <Route path="products/edibles" element={<Edibles />} />
          <Route path="price-tiers" element={<PriceTiers />} />
          <Route path="chats" element={<Chats />} />
          <Route path="chats/:conversationId" element={<ChatDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="invites" element={<Invites />} />
          <Route path="users" element={<Users />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </OverlayStackProvider>
  );
}

export default App;
