import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import { useAuthStore } from './stores/authStore';
import { SocketProvider } from './context/SocketContext';
import { OverlayStackProvider } from './context';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import BulkFlowers from './pages/products/BulkFlowers';
import PackagedFlowers from './pages/products/PackagedFlowers';
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
          <Route path="products/bulk" element={<BulkFlowers />} />
          <Route path="products/packaged" element={<PackagedFlowers />} />
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
