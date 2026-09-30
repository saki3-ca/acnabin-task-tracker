import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

interface Props {
  messages: ChatMessage[];
  /** Whose messages sit on the right side ("me") */
  mine: 'ADMIN' | 'USER';
  emptyText?: string;
}

export const ChatBubbles: React.FC<Props> = ({ messages, mine, emptyText }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        background: '#F8FAFC',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        height: '260px',
        overflowY: 'auto'
      }}
    >
      {messages.length === 0 && (
        <div style={{ margin: 'auto', fontSize: '12.5px', color: 'var(--ink-muted)' }}>
          {emptyText || 'No messages yet.'}
        </div>
      )}
      {messages.map(m => {
        const isMine = m.sender === mine;
        return (
          <div key={m.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div
              style={{
                background: isMine ? 'var(--maroon, #800000)' : '#ffffff',
                color: isMine ? '#ffffff' : 'var(--ink)',
                border: isMine ? 'none' : '1px solid var(--line)',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '13px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {m.message}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--ink-muted)', marginTop: '2px', textAlign: isMine ? 'right' : 'left' }}>
              {m.sender === 'ADMIN' ? 'Admin' : 'User'} · {formatTime(m.createdAt)}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
