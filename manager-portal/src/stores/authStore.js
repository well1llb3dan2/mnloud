import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';
import { ensureKeypairSynced, ensurePublicKeyRegistered } from '../utils/e2ee';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      login: async (email, password) => {
        const data = await authService.login(email, password);
        
        // Only allow managers on this portal
        if (data.user.role !== 'manager') {
          throw new Error('Access denied. This portal is for managers only.');
        }

        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });

        if (data.user?._id) {
          await ensureKeypairSynced({
            userId: data.user._id,
            password,
            updateKeys: authService.updatePublicKey,
            getPrivateKey: authService.getPrivateKey,
          });
        }

        return data;
      },

      logout: async () => {
        try {
          const { refreshToken } = get();
          if (refreshToken) {
            await authService.logout(refreshToken);
          }
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      checkAuth: async () => {
        if (import.meta.env.VITE_DISABLE_LOGIN === 'true') {
          const nickname = import.meta.env.VITE_DEV_NICKNAME || 'Loud Manager';
          set({
            user: { nickname, role: 'manager' },
            accessToken: 'dev-bypass',
            refreshToken: null,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        const { accessToken } = get();

        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const data = await authService.getMe();
          
          if (data.user.role !== 'manager') {
            throw new Error('Access denied');
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          if (data.user?._id) {
            await ensureKeypairSynced({
              userId: data.user._id,
              password: null,
              updateKeys: authService.updatePublicKey,
              getPrivateKey: authService.getPrivateKey,
            });
          }
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },
    }),
    {
      name: 'manager-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.checkAuth();
        }
      },
    }
  )
);
