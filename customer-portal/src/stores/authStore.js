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
        
        // Only allow customers on this portal
        if (data.user.role !== 'customer') {
          throw new Error('Access denied. Please use the manager portal.');
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

      register: async (registrationData) => {
        const data = await authService.register(registrationData);

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
            password: registrationData?.password,
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
        const { accessToken } = get();

        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const data = await authService.getMe();
          
          if (data.user.role !== 'customer') {
            throw new Error('Access denied');
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          if (data.user?._id) {
            await ensurePublicKeyRegistered(data.user._id, authService.updatePublicKey);
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
      name: 'customer-auth',
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
