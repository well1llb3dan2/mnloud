import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const getRoleConfig = (role = 'customer') => {
  const prefix = role === 'manager' ? 'R2_MANAGER' : 'R2_CUSTOMER';
  const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`] || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`] || process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env[`${prefix}_BUCKET`] || process.env.R2_BUCKET;
  return { accessKeyId, secretAccessKey, bucket };
};

const isR2Enabled = (role = 'customer') => {
  const { accessKeyId, secretAccessKey, bucket } = getRoleConfig(role);
  return Boolean(
    bucket &&
    accessKeyId &&
    secretAccessKey &&
    (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT || process.env.R2_PUBLIC_ENDPOINT)
  );
};

const getR2Endpoint = ({ publicEndpoint = false } = {}) => {
  if (publicEndpoint && process.env.R2_PUBLIC_ENDPOINT) return process.env.R2_PUBLIC_ENDPOINT;
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null;
};

const getR2Client = ({ role = 'customer', publicEndpoint = false } = {}) => {
  const endpoint = getR2Endpoint({ publicEndpoint });
  if (!endpoint) return null;
  const { accessKeyId, secretAccessKey } = getRoleConfig(role);
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
    },
    forcePathStyle: true,
  });
};

const buildObjectKey = (originalName, prefix = 'uploads') => {
  const ext = path.extname(originalName || '').toLowerCase();
  return `${prefix}/${uuidv4()}${ext}`;
};

export const storeUpload = async (file, { prefix = 'uploads', role = 'manager' } = {}) => {
  if (!file) return null;
  if (!isR2Enabled(role)) {
    return `uploads/${file.filename}`;
  }

  const client = getR2Client({ role });
  if (!client) return null;
  const key = buildObjectKey(file.originalname, prefix);
  const { bucket } = getRoleConfig(role);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));
  return key;
};

export const deleteMedia = async (mediaPath, { role = 'manager' } = {}) => {
  if (!mediaPath) return;
  if (!isR2Enabled(role)) {
    const fullPath = path.join(process.cwd(), mediaPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return;
  }

  const client = getR2Client({ role });
  if (!client) return;
  const { bucket } = getRoleConfig(role);
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: mediaPath,
  }));
};

export const getSignedMediaUrl = async (mediaPath, { expiresIn, role = 'customer' } = {}) => {
  if (!mediaPath || !isR2Enabled(role)) return null;
  const client = getR2Client({ role, publicEndpoint: true });
  if (!client) return null;
  const { bucket } = getRoleConfig(role);
  const ttl = Number(expiresIn || process.env.R2_SIGNED_URL_TTL || 900);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: mediaPath,
  });
  return getSignedUrl(client, command, { expiresIn: ttl });
};

export const isR2Active = isR2Enabled;
