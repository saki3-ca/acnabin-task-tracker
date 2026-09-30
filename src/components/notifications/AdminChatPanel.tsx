import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessagesSquare, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { ChatMessage } from '../../types';
import { ChatBubbles } from './ChatBubbles';

export const AdminChatPanel: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [userId, setUserId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = useMemo(
    () =>
      allUsers
        .filter(u => u.status === 'ACTIVE' && u.id !== currentUser?.id && u.role !== 'ADMIN')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers, currentUser]
  );

  const load = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      return;
    }
    try {
      setMessages(await notificationService.chatGetThread(userId));
    } catch {
      setMessages([]);
    }
  }, [userId]);

  useEffect(() => {
    load();
    if (!userId) return;
    const t = setInterval(load, 15000); // pick up the user's answer
    return () => clearInterval(t);
  }, [load, userId]);

  const handleSend = async () => {
    if (!userId) return setError('Please select a user.');
    if (!text.trim()) return setError('Please type a question.');
    setSending(true);
    setError(null);
    try {
      await notificationService.chatSendQuestion(userId, text.trim());
      setText('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="table-card">
      <div className="banner-strip banner-maroon">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <MessagesSquare size={16} />
          <span>ASK A USER (ADMIN CHAT)</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <select
          className="form-select"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          style={{ height: '36px', fontSize: '13px', maxWidth: '380px' }}
        >
          <option value="">Select a user…</option>
          {choices.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.empId})
            </option>
          ))}
        </select>

        {userId && (
          <>
            <ChatBubbles messages={messages} mine="ADMIN" emptyText="No questions sent to this user yet." />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                className="form-input"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type your question, e.g. What's your name?"
                rows={2}
                style={{ flex: 1, fontSize: '13px', resize: 'vertical' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
            {error && <div className="auth-alert-error" style={{ margin: 0 }}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
};
