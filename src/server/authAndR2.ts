import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

export interface SellerUser {
  user_id: string;
  email: string;
  name: string;
  role: 'seller';
}

export const DEMO_SELLERS: SellerUser[] = [
  { user_id: 'usr_98765', email: 'alpha@zenxusbay.dev', name: 'Alpha Dev', role: 'seller' },
  { user_id: 'usr_44120', email: 'kinetix@zenxusbay.dev', name: 'Kinetix Lab', role: 'seller' },
];

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PAYMENT_HMAC_SECRET =
  process.env.PAYMENT_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

const PUBLIC_R2_DIR = path.resolve(process.cwd(), 'data', 'r2-public');
const PRIVATE_R2_DIR = path.resolve(process.cwd(), 'data', 'r2-private');

export const MAX_PUBLIC_ASSET_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_PRIVATE_ARCHIVE_BYTES = 250 * 1024 * 1024; // 250 MB

const ALLOWED_PUBLIC_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg']);
const ALLOWED_PRIVATE_EXTS = new Set(['.zip', '.gz', '.pdf']);

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function resolveSafeStoragePath(baseDir: string, relativeKey: string): string | null {
  const cleaned = relativeKey.replace(/^r2:\/\/[^/]+\//, '').replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, cleaned);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

export function signSellerToken(user: SellerUser): string {
  const payload = {
    sub: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySellerToken(token: string): SellerUser | null {
  const parts = (token || '').split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      sub: string;
      email: string;
      name: string;
      role: 'seller';
      exp: number;
    };
    if (!parsed || !parsed.sub || parsed.exp < Date.now()) {
      return null;
    }
    return {
      user_id: parsed.sub,
      email: parsed.email,
      name: parsed.name,
      role: 'seller',
    };
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  seller?: SellerUser;
}

export function requireSellerAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Требуется авторизация продавца (ZenxusBay).' });
    return;
  }
  const seller = verifySellerToken(match[1]);
  if (!seller) {
    res.status(401).json({ error: 'Сессия истекла или недействительна.' });
    return;
  }
  req.seller = seller;
  next();
}

export function signHmacBody(bodyText: string): string {
  return crypto.createHmac('sha256', PAYMENT_HMAC_SECRET).update(bodyText).digest('hex');
}

export function verifyHmacSignature(bodyText: string, signatureHex: string): boolean {
  if (!signatureHex) return false;
  const expected = signHmacBody(bodyText);
  const sigBuf = Buffer.from(signatureHex.toLowerCase());
  const expBuf = Buffer.from(expected.toLowerCase());
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function savePublicAssetToR2(params: {
  storeId: string;
  fileName: string;
  dataBase64: string;
}): { ok: boolean; error?: string; url?: string; objectKey?: string; sizeBytes?: number } {
  const ext = path.extname(params.fileName || '').toLowerCase();
  if (!ALLOWED_PUBLIC_EXTS.has(ext)) {
    return { ok: false, error: 'Разрешены только изображения .webp, .png, .jpg.' };
  }

  const base64Clean = params.dataBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_PUBLIC_ASSET_BYTES) {
    return { ok: false, error: 'Размер изображения должен быть от 1 байта до 2 МБ.' };
  }

  const safeStoreId = params.storeId.replace(/[^a-zA-Z0-9_-]/g, '');
  const uuid = crypto.randomUUID();
  const objectKey = `${safeStoreId}/${uuid}${ext}`;
  const targetPath = resolveSafeStoragePath(PUBLIC_R2_DIR, objectKey);
  if (!targetPath) {
    return { ok: false, error: 'Некорректный путь хранения.' };
  }

  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, buffer);

  return {
    ok: true,
    objectKey,
    url: `/cdn/${objectKey}`,
    sizeBytes: buffer.length,
  };
}

export function getPublicAssetPath(storeId: string, fileName: string): string | null {
  const safeKey = `${storeId}/${fileName}`;
  const targetPath = resolveSafeStoragePath(PUBLIC_R2_DIR, safeKey);
  if (!targetPath || !fs.existsSync(targetPath)) {
    return null;
  }
  return targetPath;
}

interface PresignUploadTicket {
  upload_id: string;
  store_id: string;
  owner_user_id: string;
  r2_object_key: string;
  file_name: string;
  expires_at: number;
  signature: string;
}

const pendingPresigns = new Map<string, PresignUploadTicket>();

export function createPrivatePresignedUpload(params: {
  storeId: string;
  ownerUserId: string;
  fileName: string;
  fileSizeBytes: number;
}): { ok: boolean; error?: string; upload_url?: string; r2_object_key?: string; expires_at?: string } {
  const rawName = path.basename(params.fileName || 'archive.zip').replace(/[^a-zA-Z0-9._-]/g, '_');
  const lower = rawName.toLowerCase();
  const isTarGz = lower.endsWith('.tar.gz');
  const ext = isTarGz ? '.gz' : path.extname(lower);

  if (!ALLOWED_PRIVATE_EXTS.has(ext)) {
    return { ok: false, error: 'Разрешены только файлы .zip, .tar.gz или .pdf.' };
  }
  if (!Number.isFinite(params.fileSizeBytes) || params.fileSizeBytes <= 0 || params.fileSizeBytes > MAX_PRIVATE_ARCHIVE_BYTES) {
    return { ok: false, error: 'Размер архива не должен превышать 250 МБ.' };
  }

  const safeStoreId = params.storeId.replace(/[^a-zA-Z0-9_-]/g, '');
  const uuid = crypto.randomUUID();
  const r2ObjectKey = `${safeStoreId}/${uuid}-${rawName}`;
  const uploadId = crypto.randomBytes(12).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const signature = signHmacBody(`${uploadId}:${r2ObjectKey}:${expiresAt}`);

  pendingPresigns.set(uploadId, {
    upload_id: uploadId,
    store_id: safeStoreId,
    owner_user_id: params.ownerUserId,
    r2_object_key: r2ObjectKey,
    file_name: rawName,
    expires_at: expiresAt,
    signature,
  });

  return {
    ok: true,
    upload_url: `/api/r2/presigned-upload/${uploadId}?sig=${signature}`,
    r2_object_key: r2ObjectKey,
    expires_at: new Date(expiresAt).toISOString(),
  };
}

export function completePrivatePresignedUpload(params: {
  uploadId: string;
  sig: string;
  bodyBuffer: Buffer;
}): { ok: boolean; status: number; error?: string; r2_object_key?: string; size_mb?: number; file_name?: string } {
  const ticket = pendingPresigns.get(params.uploadId);
  if (!ticket) {
    return { ok: false, status: 404, error: 'Presigned Upload URL не найден или уже использован.' };
  }
  if (ticket.expires_at < Date.now()) {
    pendingPresigns.delete(params.uploadId);
    return { ok: false, status: 403, error: 'Срок действия Presigned URL истёк.' };
  }
  if (ticket.signature !== params.sig) {
    return { ok: false, status: 403, error: 'Недействительная подпись Presigned URL.' };
  }
  if (params.bodyBuffer.length === 0 || params.bodyBuffer.length > MAX_PRIVATE_ARCHIVE_BYTES) {
    return { ok: false, status: 413, error: 'Файл пустой или превышает лимит 250 МБ.' };
  }

  const targetPath = resolveSafeStoragePath(PRIVATE_R2_DIR, ticket.r2_object_key);
  if (!targetPath) {
    return { ok: false, status: 400, error: 'Некорректный ключ объекта R2.' };
  }

  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, params.bodyBuffer);
  pendingPresigns.delete(params.uploadId);

  return {
    ok: true,
    status: 200,
    r2_object_key: ticket.r2_object_key,
    file_name: ticket.file_name,
    size_mb: Math.round((params.bodyBuffer.length / (1024 * 1024)) * 100) / 100 || 0.01,
  };
}

export function getPrivateObjectBuffer(params: {
  r2ObjectKey: string;
  fallbackText: string;
}): Buffer {
  const resolved = resolveSafeStoragePath(PRIVATE_R2_DIR, params.r2ObjectKey);
  if (resolved && fs.existsSync(resolved)) {
    return fs.readFileSync(resolved);
  }
  return Buffer.from(params.fallbackText, 'utf-8');
}
