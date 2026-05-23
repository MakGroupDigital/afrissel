import { createHash } from 'crypto';

const parseCloudinaryUrl = (value) => {
  if (!value) return null;
  const match = value.match(/^cloudinary:\/\/<?([^:>]+)>?:<?([^@>]+)>?@(.+)$/);
  if (!match) return null;

  return {
    apiKey: match[1],
    apiSecret: match[2],
    cloudName: match[3]
  };
};

const getCloudinaryConfig = () => {
  const parsedUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  if (parsedUrl) return parsedUrl;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return null;

  return { cloudName, apiKey, apiSecret };
};

const normalizeSegment = (value) => String(value || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');

const signParams = (params, apiSecret) => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
};

const parseBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = getCloudinaryConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Cloudinary is not configured',
      detail: 'Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    });
  }

  let body = {};
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const resourceType = body.resourceType === 'video' ? 'video' : body.resourceType === 'image' ? 'image' : '';
  if (!resourceType) {
    return res.status(400).json({ error: 'Invalid Cloudinary resource type' });
  }

  const ownerId = normalizeSegment(body.ownerId || body.userId);
  const folderRoot = process.env.CLOUDINARY_UPLOAD_FOLDER || 'afrissel/users';
  const folder = `${folderRoot}/${ownerId}`;
  const publicId = `${resourceType}_${Date.now()}`;
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp
  };

  return res.status(200).json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature: signParams(paramsToSign, config.apiSecret),
    timestamp,
    folder,
    publicId,
    resourceType
  });
}
