import React, { useEffect, useState } from 'react';

interface Props {
  title: string;
  help: string;
  load: () => Promise<string>;
  save: (url: string) => Promise<void>;
}

/** Admin: the web-app link of a Google Apps Script that stores files in Drive. Empty = attachments off. */
export const DriveLinkBox: React.FC<Props> = ({ title, help, load, save }) => {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    load()
      .then(u => {
        setUrl(u);
        setSaved(u);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setMsg(null);
    try {
      await save(url.trim());
      setSaved(url.trim());
      setMsg({ ok: true, text: url.trim() ? 'Saved. Attachments are now on.' : 'Saved. Attachments are now off.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    }
  };

  return (
    <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--line)', marginBottom: '16px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '8px' }}>{help}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={e => setUrl(e.target.value)} style={{ flex: '1 1 360px' }} />
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={url.trim() === saved}>Save link</button>
        {msg && <span style={{ fontSize: '12.5px', color: msg.ok ? '#166534' : '#B91C1C' }}>{msg.text}</span>}
      </div>
    </div>
  );
};
