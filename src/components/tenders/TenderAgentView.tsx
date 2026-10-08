import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

// Deployed Tender Agent dashboard (Cloudflare Pages). Override per environment with VITE_TENDER_AGENT_URL.
const TENDER_AGENT_URL: string =
  (import.meta as any).env?.VITE_TENDER_AGENT_URL || 'https://tender-agent-d01.pages.dev/';

// "embed=1" tells the dashboard to hide its own header so it sits cleanly under this portal's header and tabs
const EMBED_URL = `${TENDER_AGENT_URL}${TENDER_AGENT_URL.includes('?') ? '&' : '?'}embed=1`;

/** Tender Agent tab: the tender monitoring dashboard shown inside the portal. Access is decided by the Admin (Tab Access). */
export const TenderAgentView: React.FC = () => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="tab-pane">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <a className="btn btn-secondary btn-sm" href={TENDER_AGENT_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} style={{ marginRight: 6 }} /> Open in new window
        </a>
      </div>
      <div className="table-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        {!loaded && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: '13px' }}>Loading Tender Agent…</div>
        )}
        <iframe
          title="Tender Agent"
          src={EMBED_URL}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: 'calc(100vh - 230px)', minHeight: '640px', border: 0, display: loaded ? 'block' : 'none', background: 'var(--cream)' }}
        />
      </div>
    </div>
  );
};
