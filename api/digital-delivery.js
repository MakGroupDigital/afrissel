const DEFAULT_DATABASE_URL = 'https://afrisellapp-default-rtdb.firebaseio.com';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyCdqNyHc2Fgr3brSc5oWR1ucEYzi_4rza4';

const getDatabaseUrl = () => (
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  DEFAULT_DATABASE_URL
).replace(/\/$/, '');

const parseBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
};

const readDatabase = async (path, idToken) => {
  const response = await fetch(`${getDatabaseUrl()}/${path}.json?access_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new Error('Lecture des données de livraison impossible.');
  return response.json();
};

const getAuthenticatedUser = async (idToken) => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.users?.[0] || null;
};

const assetResponse = (asset, orderId) => ({
  id: asset.publicId || asset.name,
  name: asset.name || 'Fichier digital',
  type: asset.type || 'application/octet-stream',
  size: Number(asset.size || 0),
  downloadPath: `/api/digital-delivery?orderId=${encodeURIComponent(orderId)}&asset=${encodeURIComponent(asset.publicId || asset.name)}`,
  resourceType: asset.resourceType || 'raw'
});

const getDeliveryContext = async (idToken, orderId) => {
  const authenticatedUser = await getAuthenticatedUser(idToken);
  if (!authenticatedUser?.localId) {
    const error = new Error('Session AfriZia invalide.');
    error.statusCode = 401;
    throw error;
  }

  const order = await readDatabase(`orders/${encodeURIComponent(orderId)}`, idToken);
  if (!order || order.buyerId !== authenticatedUser.localId) {
    const error = new Error('Cette livraison ne t’est pas destinée.');
    error.statusCode = 403;
    throw error;
  }
  if (!order.isDigital) {
    const error = new Error('Cette commande ne contient pas de produit digital.');
    error.statusCode = 400;
    throw error;
  }
  if (order.status !== 'paid' || order.paymentStatus !== 'confirmed') {
    const error = new Error('La livraison sera disponible après confirmation du paiement.');
    error.statusCode = 403;
    throw error;
  }

  const manifest = await readDatabase(`digitalDeliveryAssets/${encodeURIComponent(order.productId)}`, idToken);
  if (!manifest) {
    const error = new Error('Les fichiers digitaux ne sont pas encore disponibles.');
    error.statusCode = 404;
    throw error;
  }

  return { order, manifest };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.DIGITAL_DELIVERY_ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  const authorization = req.headers.authorization || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken) return res.status(401).json({ error: 'Connexion requise.' });

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await parseBody(req);
    } catch {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
  } else if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const orderId = String(body.orderId || req.query?.orderId || '').trim();
  if (!orderId) return res.status(400).json({ error: 'Commande introuvable.' });

  try {
    const { order, manifest } = await getDeliveryContext(idToken, orderId);

    if (req.method === 'GET') {
      const assetId = String(req.query?.asset || '').trim();
      const asset = Array.isArray(manifest.assets)
        ? manifest.assets.find((candidate) => (candidate.publicId || candidate.name) === assetId)
        : null;
      if (!asset?.secureUrl) return res.status(404).json({ error: 'Fichier digital introuvable.' });

      const assetResponse = await fetch(asset.secureUrl);
      if (!assetResponse.ok) return res.status(502).json({ error: 'Fichier digital indisponible.' });
      const content = Buffer.from(await assetResponse.arrayBuffer());
      res.setHeader('Content-Type', asset.type || assetResponse.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Content-Length', content.length);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(asset.name || 'afriZia-file')}`);
      return res.status(200).send(content);
    }

    return res.status(200).json({
      orderId,
      productId: order.productId,
      productName: order.productName,
      deliveryMode: manifest.deliveryMode || 'file',
      accessNote: manifest.accessNote || '',
      deliveryURL: manifest.deliveryURL || '',
      assets: Array.isArray(manifest.assets) ? manifest.assets.filter((asset) => asset?.secureUrl).map((asset) => assetResponse(asset, orderId)) : []
    });
  } catch (error) {
    console.error('Digital delivery error:', error);
    return res.status(error?.statusCode || 500).json({ error: error instanceof Error ? error.message : 'Livraison digitale indisponible.' });
  }
}
