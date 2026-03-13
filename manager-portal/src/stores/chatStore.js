import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  totalUnread: 0,
  typingUsers: {}, // { conversationId: userId }

  setConversations: (conversations) => {
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    set({ conversations, totalUnread });
  },

  updateConversation: (conversationId, updates) => {
    const { conversations } = get();
    const updated = conversations.map((c) =>
      c._id === conversationId ? { ...c, ...updates } : c
    );
    const totalUnread = updated.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    set({ conversations: updated, totalUnread });
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
  },

  setMessages: (messages) => {
    set({ messages });
  },

  prependMessages: (olderMessages) => {
    const { messages } = get();
    const existingIds = new Set(messages.map((m) => m._id));
    const uniqueOlder = olderMessages.filter((m) => !existingIds.has(m._id));
    if (uniqueOlder.length > 0) {
      set({ messages: [...uniqueOlder, ...messages] });
    }
  },

  addMessage: (message, conversationId = null) => {
    const { messages, currentConversation } = get();
    const msgConvId = conversationId || message.conversation;
    const currentConvId = currentConversation?._id;
    
    // Add message if it belongs to the current conversation
    if (msgConvId === currentConvId || message.conversation === currentConvId) {
      if (!messages.find((m) => m._id === message._id)) {
        set({ messages: [...messages, message] });
      }
    }
  },

  setTypingUser: (conversationId, userId) => {
    const { typingUsers } = get();
    set({
      typingUsers: {
        ...typingUsers,
        [conversationId]: userId || null,
      },
    });
  },

  incrementUnread: (conversationId) => {
    const { conversations, currentConversation, totalUnread } = get();
    
    // Don't increment if we're viewing this conversation
    if (currentConversation?._id === conversationId) return;
    
    const updated = conversations.map((c) =>
      c._id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c
    );
    set({ conversations: updated, totalUnread: totalUnread + 1 });
  },

  clearUnread: (conversationId) => {
    const { conversations, totalUnread } = get();
    let clearedCount = 0;
    
    const updated = conversations.map((c) => {
      if (c._id === conversationId) {
        clearedCount = c.unreadCount || 0;
        return { ...c, unreadCount: 0 };
      }
      return c;
    });
    
    set({ conversations: updated, totalUnread: Math.max(0, totalUnread - clearedCount) });
  },
}));
