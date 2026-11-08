import { describe, expect, it } from 'vitest';
import { createServerBackend, type Transport } from './backend';
import { mirrorFromBoot, toPush, type Boot } from './v3';

const file = (id: number, kind: string, ownerType: string, ownerId: string, hasThumb = true) => ({ id, kind, ownerType, ownerId, name: `f${id}`, mime: 'image/jpeg', size: 1, hasThumb, uploadedAt: '2026-11-05 10:00:00' });
const boot: Boot = {
  rev: 1, user: { id: 'u1', name: 'Mosab', role: 'admin', perms: [] },
  state: {
    docs: [{ id: 'd29', no: 'SHP-0007', type: 'SHP', status: 'done', date: '2026-11-07', by: 'Mosab', hdr: {}, lines: [] }, { id: 'd30', no: 'RCV-0001', type: 'RCV', status: 'done', date: '2026-11-07', by: 'Mosab', hdr: {}, lines: [] }],
    orders: [{ ref: 'kf3298', wb: '23744281', st: 'cx', pk: 'p1', lines: [], cx: { at: 1793900000000, by: 'Mosab', reason: '', was: 'open', returned: false } }],
  },
  files: [file(22, 'doc_photo', 'doc', 'd29'), file(23, 'doc_photo', 'doc', 'd30', false), file(6, 'cancel', 'order', 'kf3298')],
};
const none = () => { throw new Error('no network in this test'); };
const transport: Transport = { pull: none, push: none, upload: none };

describe('server files', () => {
  const b = createServerBackend(boot, transport);
  it('finds the photo of a document numbered like SHP-0007 (was cut to "SHP")', async () => {
    const S = b.current();
    const shp = S.docs.find((x) => x.no === 'SHP-0007')!;
    expect(shp.attachment).toBe('documents/SHP-0007.jpg');
    expect(await b.fileUrl(shp.attachment!)).toBe('/api/files/22?thumb=1');
    expect(await b.fileUrl('documents/RCV-0001.jpg')).toBe('/api/files/23');
    expect(await b.fileUrl('documents/SHP-0007-signed.jpg')).toBe('/api/files/22?thumb=1');
  });
  it('shows the cancel photo, and that adds nothing to save', async () => {
    const S = b.current();
    const o = S.orders.find((x) => x.ref === 'kf3298')!;
    expect(o.cancel?.attachment).toBe('documents/cancel-kf3298.jpg');
    expect(await b.fileUrl(o.cancel!.attachment!)).toBe('/api/files/6?thumb=1');
    expect(await b.fileUrl('documents/cancel-zz0000.jpg')).toBeNull();
  });
  it('downloads an original file by its server id from any device', async () => {
    expect(await b.fileUrl('srvfile:22')).toBe('/api/files/22');
  });
});

describe('round trip with the photo paths', () => {
  it('reading the server state and saving it back sends no order or document change', () => {
    const S = createServerBackend(boot, transport).current();
    const p = toPush(S, mirrorFromBoot(boot), 'Mosab');   // (the small sample has no supplies counter, so only that meta differs)
    expect(p.moves).toEqual([]); expect(p.coll).toEqual({});
  });
});
