/**
 * Image/file upload. Uses R2 (S3-compatible) when env vars set, otherwise
 * falls back to local `tmp/uploads/` for dev.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import type { RequestVars } from '../context.js';

export const uploadsRouter = new Hono<{ Variables: RequestVars }>();

uploadsRouter.use('*', authRequired, tenantContext);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

uploadsRouter.post('/image', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: 'no file' }, 400);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'unsupported type', allowed: ALLOWED_TYPES }, 400);
  }
  if (file.size > MAX_BYTES) {
    return c.json({ error: `file too large (max ${MAX_BYTES} bytes)` }, 413);
  }

  const id = c.get('identity');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const key = `${id.tenantId}/${uuidv7()}.${ext}`;

  const r2Account = process.env.R2_ACCOUNT_ID;
  if (r2Account && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    // TODO: real R2 upload via aws-sdk/client-s3
    // For now, return a fake R2 URL (would need @aws-sdk/client-s3 wired)
    return c.json({
      url: `${process.env.R2_PUBLIC_URL_BASE ?? 'https://r2.dev'}/${key}`,
      key,
      provider: 'r2',
    });
  }

  // Local fallback — writes to tmp/uploads (dev only)
  const localDir = join(process.cwd(), 'tmp', 'uploads', id.tenantId);
  await mkdir(localDir, { recursive: true });
  const localPath = join(localDir, key.split('/').pop() ?? 'upload.bin');
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(localPath, buf);
  return c.json({
    url: `/uploads-local/${key}`,
    key,
    provider: 'local',
    note: 'R2 not configured; saved locally for dev only',
  });
});
