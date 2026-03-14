import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  FiShoppingBag,
  FiShoppingCart,
  FiMessageCircle,
  FiClipboard,
  FiUser,
} from 'react-icons/fi';
import { useAuthStore, useCartStore, useChatStore } from '../stores';
import { useBackButton } from '../hooks';

const NavItem = ({ icon, label, path, badge }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === path || 
    (path !== '/' && location.pathname.startsWith(path));

  return (
    <button
      type="button"
      className={`nav-item${isActive ? ' active' : ''}`}
      onClick={() => navigate(path)}
    >
      <span style={{ position: 'relative' }}>
        <span className="nav-icon">{icon}</span>
        {badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -6,
              background: '#ff6b6b',
              color: '#fff',
              borderRadius: '999px',
              fontSize: '0.65rem',
              padding: '0 6px',
              lineHeight: '18px',
              minWidth: 18,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="nav-label">{label}</span>
    </button>
  );
};

const Layout = () => {
  // Handle back button behavior for PWA
  useBackButton();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const cartCount = useCartStore((state) => state.getItemCount());
  const unreadCount = useChatStore((state) => state.unreadCount);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const isStandalone = useMemo(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone) return true;
    return false;
  }, []);
  const isIos = useMemo(() => {
    const ua = window.navigator.userAgent || '';
    const iOSDevice = /iphone|ipad|ipod/i.test(ua);
    const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOs;
  }, []);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const showInstallButton = !isStandalone && isAuthenticated && (Boolean(deferredPrompt) || isIos);

  const handleInstallClick = () => {
    setShowInstallGuide(true);
  };

  const handleInstallPrompt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="app-shell">
      <main className="app-content">
        {showInstallButton && (
          <div className="install-banner">
            <button type="button" className="button" onClick={handleInstallClick}>
              {isIos ? 'Add to Home Screen' : 'Install App'}
            </button>
          </div>
        )}
        <Outlet />
      </main>

      {showInstallGuide && (
        <div className="install-guide-backdrop" role="presentation">
          <div className="install-guide" role="dialog" aria-modal="true" aria-label="Install app guide">
            <div className="install-guide-header">
              <h3>Install the Loud app</h3>
              <button
                type="button"
                className="install-guide-close"
                onClick={() => setShowInstallGuide(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {isIos ? (
              <div className="install-guide-body">
                <p>On iPhone or iPad, use the Share menu to add the app.</p>
                <ol className="install-steps">
                  <li>Tap the Share button in Safari.</li>
                  <li>Scroll and select “Add to Home Screen”.</li>
                  <li>Confirm the name, then tap Add.</li>
                </ol>
                <div className="install-tip">
                  Tip: Install works best in Safari, not in an in-app browser.
                </div>
              </div>
            ) : (
              <div className="install-guide-body">
                <p>On Android, use the browser prompt to install.</p>
                <ol className="install-steps">
                  <li>Tap the Install button below.</li>
                  <li>When the prompt appears, confirm Install.</li>
                  <li>Open the app from your home screen.</li>
                </ol>
                {deferredPrompt ? (
                  <button type="button" className="button" onClick={handleInstallPrompt}>
                    Install Now
                  </button>
                ) : (
                  <div className="install-tip">
                    If you do not see a prompt, open the browser menu and choose “Install app”.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <NavItem icon={<FiShoppingBag size={22} />} label="Shop" path="/" />
        <NavItem
          icon={<FiShoppingCart size={22} />}
          label="Cart"
          path="/cart"
          badge={cartCount}
        />
        <NavItem
          icon={<FiMessageCircle size={22} />}
          label="Chat"
          path="/chat"
          badge={unreadCount}
        />
        <NavItem icon={<FiClipboard size={22} />} label="Orders" path="/orders" />
        <NavItem icon={<FiUser size={22} />} label="Profile" path="/profile" />
      </nav>
    </div>
  );
};

export default Layout;
