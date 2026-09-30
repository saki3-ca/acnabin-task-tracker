import React from 'react';
import { useAuth } from '../../context/AuthContext';

/** "Client name (C-26123)" text, for <option>s and exports. */
export function clientText(name: string, jobNumber?: string): string {
  return jobNumber ? `${name} (${jobNumber})` : name;
}

/**
 * Client name with its job ID beside it, so two clients with the same name
 * can be told apart. Pass the client id when known; without one, the job ID
 * is shown only if exactly one client has that name.
 */
export const ClientLabel: React.FC<{ id?: string | null; name: string }> = ({ id, name }) => {
  const { allClients } = useAuth();

  let job: string | undefined;
  if (id) {
    job = allClients.find(c => c.id === id)?.jobNumber;
  } else {
    const matches = allClients.filter(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (matches.length === 1) job = matches[0].jobNumber;
  }

  return (
    <>
      {name}
      {job && (
        <span
          style={{
            marginLeft: '6px',
            fontFamily: 'monospace',
            fontSize: '0.85em',
            fontWeight: 600,
            color: 'var(--ink-muted, #64748B)',
            whiteSpace: 'nowrap'
          }}
        >
          ({job})
        </span>
      )}
    </>
  );
};
