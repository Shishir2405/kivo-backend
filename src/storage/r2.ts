import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

import { config } from '@/config';
import { ApiError } from '@/utils/ApiError';

let client: S3Client | null = null;

/** Lazily build the S3 client pointed at the account's R2 endpoint. */
function getClient(): S3Client {
  if (!config.r2.isConfigured) {
    throw ApiError.serviceUnavailable('Object storage is not configured');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId as string,
        secretAccessKey: config.r2.secretAccessKey as string,
      },
    });
  }
  return client;
}

export interface PresignedUpload {
  /** Presigned PUT url the client uploads the file body to. */
  uploadUrl: string;
  /** Object key under which the file will live. */
  key: string;
  /** Public CDN url the file is reachable at once uploaded (if a public base is set). */
  publicUrl: string;
  /** Seconds until the presigned url expires. */
  expiresIn: number;
}

/**
 * Build a deterministic, collision-resistant object key:
 *   `<userId>/<folder>/<nanoid>-<safeFilename>`
 */
export function buildObjectKey(userId: string, folder: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  return `${userId}/${cleanFolder}/${nanoid()}-${safe || 'file'}`;
}

/** Public URL for an object (uses the configured CDN base, else the R2 endpoint). */
export function publicUrl(key: string): string {
  if (config.r2.publicBaseUrl) {
    return `${config.r2.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  }
  return `https://${config.r2.accountId}.r2.cloudflarestorage.com/${config.r2.bucket}/${key}`;
}

/** Create a presigned PUT url for a direct browser → R2 upload. */
export async function presignUpload(
  key: string,
  contentType: string,
): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: config.r2.presignExpiresIn,
  });
  return {
    uploadUrl,
    key,
    publicUrl: publicUrl(key),
    expiresIn: config.r2.presignExpiresIn,
  };
}

/** Create a short-lived presigned GET url (for private objects). */
export async function presignDownload(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.r2.bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: config.r2.presignExpiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }),
  );
}
