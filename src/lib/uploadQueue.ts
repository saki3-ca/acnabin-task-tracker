// Uploads proposal attachments in the background, so the form can close right after the proposal is saved.
// It lives outside the screens, so an upload carries on when the user switches tabs.
import { uploadToDrive } from './driveFiles';
import { invoiceService } from '../services/invoiceService';
import { proposalService } from '../services/proposalService';

export interface UploadItem {
  key: string;
  proposalId: string;
  client: string;
  /** Invoice challan upload: goes to TDS-VDS / <invoice number> / VDS or TDS */
  invoice?: { id: string; invoiceNo: string; kind: 'VDS' | 'TDS' };
  driveUrl: string;
  file: File;
  progress: number;
  status: 'waiting' | 'uploading' | 'done' | 'failed';
  error?: string;
}

let items: UploadItem[] = [];
let running = false;
const listeners = new Set<() => void>();
let counter = 0;

const emit = () => listeners.forEach(l => l());

export const uploadQueue = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get(): UploadItem[] {
    return items;
  },
  add(driveUrl: string, proposalId: string, client: string, files: File[]) {
    files.forEach(file => {
      items = [...items, { key: `u${++counter}`, proposalId, client, driveUrl, file, progress: 0, status: 'waiting' }];
    });
    emit();
    void run();
  },
  addInvoice(driveUrl: string, invoice: { id: string; invoiceNo: string; kind: 'VDS' | 'TDS' }, files: File[]) {
    files.forEach(file => {
      items = [...items, { key: `u${++counter}`, proposalId: '', client: `${invoice.invoiceNo} / ${invoice.kind}`, invoice, driveUrl, file, progress: 0, status: 'waiting' }];
    });
    emit();
    void run();
  },
  retry(key: string) {
    items = items.map(i => (i.key === key ? { ...i, status: 'waiting', progress: 0, error: undefined } : i));
    emit();
    void run();
  },
  clearFinished() {
    items = items.filter(i => i.status === 'waiting' || i.status === 'uploading');
    emit();
  },
  busy() {
    return items.some(i => i.status === 'waiting' || i.status === 'uploading');
  }
};

const patch = (key: string, change: Partial<UploadItem>) => {
  items = items.map(i => (i.key === key ? { ...i, ...change } : i));
  emit();
};

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = items.find(i => i.status === 'waiting');
      if (!next) break;
      patch(next.key, { status: 'uploading', progress: 0 });
      try {
        const inv = next.invoice;
        const up = await uploadToDrive(
          next.driveUrl, next.client, next.file, f => patch(next.key, { progress: f }),
          inv ? { invoiceNo: inv.invoiceNo, kind: inv.kind } : {}
        );
        if (inv) {
          await invoiceService.addAttachment({
            invoiceId: inv.id, kind: inv.kind, fileName: up.name, mime: next.file.type || '', size: next.file.size, driveFileId: up.driveFileId
          });
        } else {
          await proposalService.addAttachment({
            proposalId: next.proposalId, fileName: up.name, mime: next.file.type || '', size: next.file.size,
            driveFileId: up.driveFileId, clientFolder: up.clientFolder
          });
        }
        patch(next.key, { status: 'done', progress: 1 });
        window.dispatchEvent(new Event(inv ? 'invoice-files-changed' : 'proposal-files-changed'));
      } catch (e: any) {
        patch(next.key, { status: 'failed', error: e?.message || 'Upload failed' });
      }
    }
  } finally {
    running = false;
  }
}

// Warn before closing the tab while a file is still going up
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', e => {
    if (uploadQueue.busy()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
