import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { ChatMessage } from '../../types';
import { ChatBubbles } from './ChatBubbles';

interface Props {
  questionId: number;
  onClose: () => void;
  onDone: () => void;
}

export const ChatReplyModal: React.FC<Props> = ({ questionId, onClose, onDone }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationService.chatGetThread().then(setMessages).catch(() => setMessages([]));
  }, []);

  const handleSend = async () => {
    if (!text.trim()) {
      setError('Please type your answer first.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await notificationService.chatReply(questionId, text.trim());
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => !sending && onClose()}
    >
      <div
        style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="banner-strip banner-maroon"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>QUESTION FROM ADMIN</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ChatBubbles messages={messages} mine="USER" emptyText="Loading…" />
          <textarea
            className="form-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            style={{ fontSize: '13px', resize: 'vertical' }}
          />
          {error && (
            <div className="auth-alert-error" style={{ margin: 0 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFC' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>Later</button>
          <button type="button" className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ minWidth: '110px' }}>
            <Send size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {sending ? 'Sending…' : 'Send answer'}
          </button>
        </div>
      </div>
    </div>
  );
};
