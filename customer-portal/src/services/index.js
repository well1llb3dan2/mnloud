import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  validateInvite: async (code) => {
    const response = await api.get(`/auth/invite/${code}`);
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  logout: async (refreshToken) => {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  },

  updatePublicKey: async (data) => {
    const response = await api.put('/auth/keys', data);
    return response.data;
  },

  getPublicKey: async (userId) => {
    const response = await api.get(`/auth/keys/${userId}`);
    return response.data;
  },

  getPrivateKey: async () => {
    const response = await api.get('/auth/keys/private');
    return response.data;
  },

  listPublicKeys: async (role) => {
    const response = await api.get('/auth/keys', { params: role ? { role } : undefined });
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

export const productService = {
  getAllProducts: async () => {
    const response = await api.get('/products');
    return response.data;
  },

  getFlowers: async () => {
    const response = await api.get('/products/flower?active=true');
    return response.data;
  },

  getDisposables: async () => {
    const response = await api.get('/products/disposables?active=true');
    return response.data;
  },

  getConcentrates: async () => {
    const response = await api.get('/products/concentrates?active=true');
    return response.data;
  },

  getEdibles: async () => {
    const response = await api.get('/products/edibles?active=true');
    return response.data;
  },

  getPriceTiers: async () => {
    const response = await api.get('/price-tiers');
    return response.data;
  },
};

export const strainService = {
  getFilters: async () => {
    const response = await api.get('/strains/filters');
    return response.data;
  },
};

export const chatService = {
  getOrCreateConversation: async () => {
    const response = await api.get('/chat/my-conversation');
    return response.data;
  },

  getMessages: async (conversationId, params) => {
    const response = await api.get(
      `/chat/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  },

  sendMessage: async (conversationId, data) => {
    const response = await api.post(
      `/chat/conversations/${conversationId}/messages`,
      data
    );
    return response.data;
  },

  markAsRead: async (conversationId) => {
    const response = await api.post(`/chat/conversations/${conversationId}/read`);
    return response.data;
  },
};

export const orderService = {
  getMyOrders: async () => {
    const response = await api.get('/orders/my-orders');
    return response.data;
  },

  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
};

export const pushService = {
  getVapidPublicKey: async () => {
    const response = await api.get('/push/vapid-public-key');
    return response.data;
  },

  subscribe: async (subscription, portal = 'customer') => {
    const response = await api.post('/push/subscribe', {
      subscription,
      portal,
    });
    return response.data;
  },

  unsubscribe: async (endpoint) => {
    const response = await api.post('/push/unsubscribe', { endpoint });
    return response.data;
  },
};
