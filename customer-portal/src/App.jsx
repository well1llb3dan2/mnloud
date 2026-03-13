import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useToast } from './components/ToastProvider';
import { useAuthStore } from './stores/authStore';
import { SocketProvider } from './context/SocketContext';
import { OverlayStackProvider } from './context';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Shop from './pages/Shop';
import ProductCategory from './pages/ProductCategory';
import Cart from './pages/Cart';
import Chat from './pages/Chat';
import Orders from './pages/Orders';
import Profile from './pages/Profile';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <SocketProvider>{children}</SocketProvider>;
};

// Public route wrapper (redirect to home if authenticated)
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
    const storageKey = 'customer:lastPortalVersion';
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
            position: 'top',
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
        <Route
          path="/register/:inviteCode"
          element={
            <PublicRoute>
              <Register />
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
          <Route index element={<Shop />} />
          <Route path="products" element={<Shop />} />
          <Route path="products/:category" element={<ProductCategory />} />
          <Route path="cart" element={<Cart />} />
          <Route path="chat" element={<Chat />} />
          <Route path="orders" element={<Orders />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </OverlayStackProvider>
  );
}

export default App;
