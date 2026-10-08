import React, { useEffect, useRef, useState } from 'react';

// Deployed Tender Agent dashboard (Cloudflare Pages). Override per environment with VITE_TENDER_AGENT_URL.
const TENDER_AGENT_URL: string =
  (import.meta as any).env?.VITE_TENDER_AGENT_URL || 'https://tender-agent-d01.pages.dev/';

// "embed=1" tells the dashboard to hide its own header and match this portal's layout
const EMBED_URL = `${TENDER_AGENT_URL}${TENDER_AGENT_URL.includes('?') ? '&' : '?'}embed=1`;
const TENDER_AGENT_ORIGIN = new URL(TENDER_AGENT_URL).origin;

/** Tender Agent tab: the tender monitoring dashboard shown inside the portal. Access is decided by the Admin (Tab Access).
 *  The dashboard reports its own height, so the frame has no scrollbar and the page scrolls once, like the other tabs. */
export const TenderAgentView: React.FC = () => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(640);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== TENDER_AGENT_ORIGIN || e.source !== frameRef.current?.contentWindow) return;
      const h = Number(e.data?.type === 'tender-agent-height' ? e.data.height : 0);
      if (h > 0 && h < 100000) setHeight(h);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="tab-pane">
      {!loaded && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: '13px' }}>Loading Tender Agent…</div>
      )}
      <iframe
        ref={frameRef}
        title="Tender Agent"
        src={EMBED_URL}
        scrolling="no"
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height, border: 0, display: loaded ? 'block' : 'none', background: 'transparent' }}
      />
    </div>
  );
};
