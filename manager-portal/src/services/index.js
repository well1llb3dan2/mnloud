import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
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

export const userService = {
  getCustomers: async () => {
    const response = await api.get('/users/customers');
    return response.data;
  },

  getManagers: async () => {
    const response = await api.get('/users/managers');
    return response.data;
  },

  toggleUserStatus: async (id) => {
    const response = await api.patch(`/users/users/${id}/toggle-status`);
    return response.data;
  },

  updateStatus: async (id, isActive) => {
    const response = await api.patch(`/users/${id}/status`, { isActive });
    return response.data;
  },

  createInvite: async (role = 'customer') => {
    const response = await api.post('/users/invites', { role });
    return response.data;
  },

  getInvites: async () => {
    const response = await api.get('/users/invites');
    return response.data;
  },

  deleteInvite: async (id) => {
    const response = await api.delete(`/users/invites/${id}`);
    return response.data;
  },
};

export const priceTierService = {
  getAll: async () => {
    const response = await api.get('/price-tiers/all');
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/price-tiers', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.patch(`/price-tiers/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/price-tiers/${id}`);
    return response.data;
  },
};

export const productService = {
  // Flowers
  getFlowers: async () => {
    const response = await api.get('/products/flower');
    return response.data;
  },

  createFlower: async (formData) => {
    const response = await api.post('/products/flower', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateFlower: async (id, formData) => {
    const response = await api.patch(`/products/flower/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteFlower: async (id) => {
    const response = await api.delete(`/products/flower/${id}`);
    return response.data;
  },

  // Concentrates
  getConcentrates: async () => {
    const response = await api.get('/products/concentrates');
    return response.data;
  },

  getConcentrateTypes: async () => {
    const response = await api.get('/products/concentrate-types');
    return response.data;
  },

  createConcentrateType: async (name) => {
    const response = await api.post('/products/concentrate-types', { name });
    return response.data;
  },

  deleteConcentrateType: async (id) => {
    const response = await api.delete(`/products/concentrate-types/${id}`);
    return response.data;
  },

  createConcentrateBase: async (formData) => {
    const response = await api.post('/products/concentrates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateConcentrateBase: async (id, formData) => {
    const response = await api.patch(`/products/concentrates/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteConcentrateBase: async (id) => {
    const response = await api.delete(`/products/concentrates/${id}`);
    return response.data;
  },

  addConcentrateStrain: async (baseId, data) => {
    const response = await api.post(`/products/concentrates/${baseId}/strains`, data);
    return response.data;
  },

  updateConcentrateStrain: async (strainId, data) => {
    const response = await api.patch(`/products/concentrates/strains/${strainId}`, data);
    return response.data;
  },

  deleteConcentrateStrain: async (strainId) => {
    const response = await api.delete(`/products/concentrates/strains/${strainId}`);
    return response.data;
  },

  // Disposables
  getDisposables: async () => {
    const response = await api.get('/products/disposables');
    return response.data;
  },

  getDisposableTypes: async () => {
    const response = await api.get('/products/disposable-types');
    return response.data;
  },

  createDisposableType: async (name) => {
    const response = await api.post('/products/disposable-types', { name });
    return response.data;
  },

  deleteDisposableType: async (id) => {
    const response = await api.delete(`/products/disposable-types/${id}`);
    return response.data;
  },

  createDisposableBase: async (formData) => {
    const response = await api.post('/products/disposables', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateDisposableBase: async (id, formData) => {
    const response = await api.patch(`/products/disposables/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteDisposableBase: async (id) => {
    const response = await api.delete(`/products/disposables/${id}`);
    return response.data;
  },

  addDisposableStrain: async (baseId, data) => {
    const response = await api.post(`/products/disposables/${baseId}/strains`, data);
    return response.data;
  },

  updateDisposableStrain: async (strainId, data) => {
    const response = await api.patch(`/products/disposables/strains/${strainId}`, data);
    return response.data;
  },

  deleteDisposableStrain: async (strainId) => {
    const response = await api.delete(`/products/disposables/strains/${strainId}`);
    return response.data;
  },

  // Edibles
  getEdibles: async () => {
    const response = await api.get('/products/edibles');
    return response.data;
  },

  getEdibleTypes: async () => {
    const response = await api.get('/products/edible-types');
    return response.data;
  },

  createEdibleType: async (name) => {
    const response = await api.post('/products/edible-types', { name });
    return response.data;
  },

  deleteEdibleType: async (id) => {
    const response = await api.delete(`/products/edible-types/${id}`);
    return response.data;
  },

  createEdible: async (formData) => {
    const response = await api.post('/products/edibles', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateEdible: async (id, formData) => {
    const response = await api.patch(`/products/edibles/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteEdible: async (id) => {
    const response = await api.delete(`/products/edibles/${id}`);
    return response.data;
  },

  addEdibleVariant: async (edibleId, data) => {
    const response = await api.post(`/products/edibles/${edibleId}/variants`, data);
    return response.data;
  },

  updateEdibleVariant: async (variantId, data) => {
    const response = await api.patch(`/products/edibles/variants/${variantId}`, data);
    return response.data;
  },

  deleteEdibleVariant: async (variantId) => {
    const response = await api.delete(`/products/edibles/variants/${variantId}`);
    return response.data;
  },

  // Delete image
  deleteImage: async (type, id) => {
    const response = await api.delete(`/products/${type}/${id}/image`);
    return response.data;
  },
};

export const strainsService = {
  getAll: async (params) => {
    const response = await api.get('/strains', { params });
    return response.data;
  },
  getAi: async (params) => {
    const response = await api.get('/strains/ai', { params });
    return response.data;
  },
  searchAi: async (params) => {
    const response = await api.get('/strains/ai/search', { params });
    return response.data;
  },
  detailsAi: async (params) => {
    const response = await api.get('/strains/ai/details', { params });
    return response.data;
  },
};

export const chatService = {
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  getConversation: async (conversationId) => {
    const response = await api.get(`/chat/conversations/${conversationId}`);
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

  sendImage: async (conversationId, formData) => {
    const response = await api.post(
      `/chat/conversations/${conversationId}/messages`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  markAsRead: async (conversationId) => {
    const response = await api.post(`/chat/conversations/${conversationId}/read`);
    return response.data;
  },
};

export const orderService = {
  getAll: async (params) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  getByMessage: async (messageId) => {
    const response = await api.get(`/orders/by-message/${messageId}`);
    return response.data;
  },

  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(`/orders/${id}`, { status });
    return response.data;
  },
};

export const inviteService = {
  getAll: async () => {
    const response = await api.get('/users/invites');
    return response.data;
  },

  create: async () => {
    const response = await api.post('/users/invites');
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/users/invites/${id}`);
    return response.data;
  },
};

export const pushService = {
  getVapidPublicKey: async () => {
    const response = await api.get('/push/vapid-public-key');
    return response.data;
  },

  subscribe: async (subscription, portal = 'manager') => {
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
