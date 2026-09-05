import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {
  getWonyaPayTransactionStatus,
  processWonyaPayPayment,
  readNodeJsonBody
} from './server/wonyapay.js';

const parseCloudinaryUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/^cloudinary:\/\/<?([^:>]+)>?:<?([^@>]+)>?@(.+)$/);
  if (!match) return null;

  return {
    apiKey: match[1],
    apiSecret: match[2],
    cloudName: match[3]
  };
};

const normalizeSegment = (value: unknown) => String(value || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');

const signCloudinaryParams = (params: Record<string, string | number>, apiSecret: string) => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
};

const readJsonBody = async (req: any): Promise<any> => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk: Buffer | string) => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (error) {
      reject(error);
    }
  });
  req.on('error', reject);
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  process.env.WONYAPAY_BASE_URL ||= env.WONYAPAY_BASE_URL;
  process.env.WONYAPAY_TOKEN ||= env.WONYAPAY_TOKEN;
  process.env.WONYAPAY_REF_PARTENAIRE ||= env.WONYAPAY_REF_PARTENAIRE;
  const cloudinaryConfig = parseCloudinaryUrl(env.CLOUDINARY_URL) || (
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          apiSecret: env.CLOUDINARY_API_SECRET
        }
      : null
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'afrissel-cloudinary-signature-dev',
        configureServer(server) {
          server.middlewares.use('/api/cloudinary/sign-upload', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            if (!cloudinaryConfig) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Cloudinary is not configured' }));
              return;
            }

            try {
              const body = await readJsonBody(req);
              const resourceType = ['video', 'image', 'raw'].includes(body.resourceType) ? body.resourceType : '';

              if (!resourceType) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid Cloudinary resource type' }));
                return;
              }

              const ownerId = normalizeSegment(body.ownerId || body.userId);
              const folderRoot = env.CLOUDINARY_UPLOAD_FOLDER || 'afrissel/users';
              const folder = `${folderRoot}/${ownerId}`;
              const publicId = `${resourceType}_${Date.now()}`;
              const timestamp = Math.round(Date.now() / 1000);
              const paramsToSign = {
                folder,
                public_id: publicId,
                timestamp
              };

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                cloudName: cloudinaryConfig.cloudName,
                apiKey: cloudinaryConfig.apiKey,
                signature: signCloudinaryParams(paramsToSign, cloudinaryConfig.apiSecret),
                timestamp,
                folder,
                publicId,
                resourceType
              }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
          });
        }
      },
      {
        name: 'afrissel-wonyapay-dev',
        configureServer(server) {
          server.middlewares.use('/api/wonyapay/payment', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readNodeJsonBody(req);
              const result = await processWonyaPayPayment({
                action: body.action,
                amount: body.amount,
                currency: body.currency,
                phoneNumber: body.phoneNumber,
                motif: body.motif,
                refPrefix: body.refPrefix
              });
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (error: any) {
              res.statusCode = error.status || 500;
              res.end(JSON.stringify({
                success: false,
                error: error.message || 'Paiement Wonyapay impossible.',
                detail: error.payload || undefined
              }));
            }
          });

          server.middlewares.use('/api/wonyapay/status', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readNodeJsonBody(req);
              const result = await getWonyaPayTransactionStatus(body.refTransa);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (error: any) {
              res.statusCode = error.status || 500;
              res.end(JSON.stringify({
                success: false,
                error: error.message || 'Statut Wonyapay impossible.',
                detail: error.payload || undefined
              }));
            }
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
