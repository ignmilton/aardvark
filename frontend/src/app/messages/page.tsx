'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token';

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = getAuthToken() || '';

  useEffect(() => {
    async function loadConversations() {
      try {
        const [convRes, meRes] = await Promise.all([
          fetchApi<{ success: boolean; data: Conversation[] }>('/messages/conversations', { token }),
          fetchApi<{ id: string }>('/auth/me', { token }),
        ]);
        setConversations(convRes.data || []);
        setCurrentUserId(meRes.id);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, [token]);

  useEffect(() => {
    if (!selectedConversation) return;
    async function loadMessages() {
      try {
        const response = await fetchApi<{ success: boolean; data: Message[] }>(
          `/messages/conversations/${selectedConversation}`,
          { token },
        );
        setMessages(response.data || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    }
    loadMessages();
  }, [selectedConversation, token]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await fetchApi('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConversation,
          content: newMessage.trim(),
        }),
        token,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          senderId: currentUserId,
          content: newMessage.trim(),
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      ]);
      setNewMessage('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>

        <div className="flex border rounded-lg overflow-hidden h-[600px]">
          {/* Conversation list */}
          <div className="w-80 border-r overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                    selectedConversation === conv.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                      {conv.participantAvatar ? (
                        <img src={conv.participantAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        conv.participantName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{conv.participantName}</span>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to view messages
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                          msg.senderId === currentUserId
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.senderId === currentUserId ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSend} className="p-4 border-t flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border rounded-lg bg-background"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-40"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
