import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversation: null,
  messages: [],
  unreadCount: 0,
  isTyping: false,
  typingUser: null,

  setConversation: (conversation) => {
    set({ conversation });
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

  addMessage: (message) => {
    const { messages } = get();
    // Avoid duplicates
    if (!messages.find((m) => m._id === message._id)) {
      set({ messages: [...messages, message] });
    }
  },

  setUnreadCount: (count) => {
    set({ unreadCount: count });
  },

  incrementUnread: () => {
    set({ unreadCount: get().unreadCount + 1 });
  },

  clearUnread: () => {
    set({ unreadCount: 0 });
  },

  setTyping: (isTyping, user = null) => {
    set({ isTyping, typingUser: user });
  },

  updateMessageReadStatus: (messageId, readBy) => {
    const { messages } = get();
    set({
      messages: messages.map((m) =>
        m._id === messageId ? { ...m, readBy: [...(m.readBy || []), readBy] } : m
      ),
    });
  },
}));
