import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react';
import { uploadQueue } from '../../lib/uploadQueue';

/** Small panel at the bottom right that shows the attachment uploads running in the background. */
export const UploadPanel: React.FC = () => {
  const items = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.get);
  const [hidden, setHidden] = useState(false);

  const active = items.some(i => i.status === 'waiting' || i.status === 'uploading');
  const failed = items.filter(i => i.status === 'failed').length;

  useEffect(() => {
    if (active || failed > 0) setHidden(false);
  }, [items.length, active, failed]);

  // Everything finished fine: fade the panel away after a few seconds
  useEffect(() => {
    if (items.length === 0 || active || failed > 0) return;
    const t = setTimeout(() => uploadQueue.clearFinished(), 6000);
    return () => clearTimeout(t);
  }, [items, active, failed]);

  if (items.length === 0 || hidden) return null;

  const done = items.filter(i => i.status === 'done').length;

  return (
    <div
      style={{
        position: 'fixed', right: '18px', bottom: '18px', width: '340px', maxWidth: 'calc(100vw - 36px)', zIndex: 3000,
        background: '#fff', border: '1px solid var(--line)', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--maroon)', color: '#fff', borderRadius: '10px 10px 0 0', fontSize: '13px', fontWeight: 600 }}>
        {active ? <Loader2 size={15} className="spin" /> : failed ? '⚠' : <CheckCircle2 size={15} />}
        <span style={{ flex: 1 }}>
          {active ? `Uploading ${items.length - done} file${items.length - done === 1 ? '' : 's'}…` : failed ? 'Some files did not upload' : `${done} file${done === 1 ? '' : 's'} uploaded`}
        </span>
        {!active && (
          <button onClick={() => { uploadQueue.clearFinished(); setHidden(true); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }} title="Close">
            <X size={15} />
          </button>
        )}
      </div>
      <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(i => (
          <div key={i.key} style={{ fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ overflowWrap: 'anywhere' }}>{i.file.name}</span>
              <span style={{ whiteSpace: 'nowrap', color: i.status === 'failed' ? '#B91C1C' : i.status === 'done' ? '#166534' : 'var(--ink-soft)' }}>
                {i.status === 'done' ? 'Done' : i.status === 'failed' ? 'Failed' : i.status === 'waiting' ? 'Waiting' : `${Math.round(i.progress * 100)}%`}
              </span>
            </div>
            {(i.status === 'uploading' || i.status === 'waiting') && (
              <div style={{ height: '5px', background: '#E5E7EB', borderRadius: '3px', marginTop: '4px' }}>
                <div style={{ width: `${Math.round(i.progress * 100)}%`, height: '100%', background: 'var(--teal)', borderRadius: '3px', transition: 'width 0.2s' }} />
              </div>
            )}
            {i.status === 'failed' && (
              <div style={{ color: '#B91C1C', marginTop: '2px' }}>
                {i.error}{' '}
                <button onClick={() => uploadQueue.retry(i.key)} style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  <RotateCcw size={11} style={{ verticalAlign: 'middle' }} /> Retry
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
