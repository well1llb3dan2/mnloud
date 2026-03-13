import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSend } from 'react-icons/fi';
import { chatService } from '../services';
import { useChatStore, useAuthStore } from '../stores';
import { useSocket } from '../context/SocketContext';
import { decryptMessages } from '../utils/e2ee';

const MessageBubble = ({ message, isOwn }) => {
  const isOrder = message.messageType === 'order';
  const bubbleClass = [
    'chat-bubble',
    isOwn ? 'own' : '',
    isOrder ? 'order' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`chat-row ${isOwn ? 'own' : ''}`}>
      <div className={bubbleClass}>
        {message.messageType === 'image' && message.attachments?.length ? (
          <img
            src={message.attachments[0]?.dataUrl}
            alt={message.attachments[0]?.filename || 'Attachment'}
            style={{ maxWidth: 220, borderRadius: 12 }}
          />
        ) : (
          <div className="chat-text">{message.content}</div>
        )}
        <div className="chat-time">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const oldestCursorRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const messageLimit = 15;
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { user } = useAuthStore();
  const {
    conversation,
    messages,
    setConversation,
    setMessages,
    prependMessages,
    isTyping,
    typingUser,
    clearUnread,
  } = useChatStore();

  const {
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useSocket();

  // Get or create conversation
  const { isLoading: isLoadingConversation } = useQuery({
    queryKey: ['conversation'],
    queryFn: async () => {
      const data = await chatService.getOrCreateConversation();
      setConversation(data.conversation);
      return data;
    },
  });

  // Get messages when conversation is loaded
  useEffect(() => {
    if (!conversation?._id) return;

    const fetchInitial = async () => {
      setIsLoadingMessages(true);
      try {
        const data = await chatService.getMessages(conversation._id, { limit: messageLimit });
        const decrypted = await decryptMessages({ messages: data.messages, userId: user?._id });
        setMessages(decrypted);
        oldestCursorRef.current = decrypted?.[0]?.createdAt || null;
        setHasMore((decrypted?.length || 0) === messageLimit);
        shouldAutoScrollRef.current = true;
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        });
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchInitial();
  }, [conversation?._id, messageLimit, setMessages, user?._id]);

  // Join conversation room
  useEffect(() => {
    if (conversation?._id) {
      joinConversation(conversation._id);
      markAsRead(conversation._id);
      clearUnread();

      return () => {
        leaveConversation(conversation._id);
      };
    }
  }, [conversation?._id]);

  // Scroll to bottom when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const loadMoreMessages = async () => {
    if (!conversation?._id || !hasMore || isLoadingMore) return;

    const before = oldestCursorRef.current;
    if (!before) return;

    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;
    const prevTop = container?.scrollTop || 0;

    setIsLoadingMore(true);
    try {
      const data = await chatService.getMessages(conversation._id, {
        limit: messageLimit,
        before,
      });
      const older = await decryptMessages({ messages: data.messages || [], userId: user?._id });
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      oldestCursorRef.current = older[0]?.createdAt || before;
      shouldAutoScrollRef.current = false;
      prependMessages(older);
      requestAnimationFrame(() => {
        if (!container) return;
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - prevHeight + prevTop;
      });
      if (older.length < messageLimit) {
        setHasMore(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 40) {
      loadMoreMessages();
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    shouldAutoScrollRef.current = nearBottom;
  };

  const handleSend = () => {
    if (!inputMessage.trim() || !conversation?._id) return;

    sendMessage(conversation._id, inputMessage.trim());
    setInputMessage('');
    stopTyping(conversation._id);
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    if (!conversation?._id) return;

    // Handle typing indicator
    startTyping(conversation._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversation._id);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoadingConversation) {
    return (
      <section className="chat-page">
        <div className="chat-loading">Loading chat...</div>
      </section>
    );
  }

  return (
    <section className="chat-page">
      <header className="chat-header">
        <div className="chat-avatar" />
        <div>
          <div className="chat-title">Support</div>
          {isTyping ? <div className="chat-subtitle">{typingUser || 'Manager'} is typing...</div> : null}
        </div>
      </header>

      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {isLoadingMessages ? (
          <div className="chat-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div>No messages yet</div>
            <small>Send a message to start chatting</small>
          </div>
        ) : (
          <>
            {isLoadingMore && <div className="chat-loading">Loading more...</div>}
            {messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={message.sender?._id === user?._id || message.sender === user?._id}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-bar">
        <input
          className="chat-input"
          value={inputMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
        />
        <button className="chat-send" onClick={handleSend} disabled={!inputMessage.trim()}>
          <FiSend />
        </button>
      </div>
    </section>
  );
};

export default Chat;
