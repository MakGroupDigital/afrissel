const DEFAULT_DATABASE_URL = 'https://afrisellapp-default-rtdb.firebaseio.com';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyCdqNyHc2Fgr3brSc5oWR1ucEYzi_4rza4';
const DEFAULT_VERCEL_PROJECT_ID = 'prj_iHS8glHLhHKwvyiXqedil7c8Eohj';
const DEFAULT_VERCEL_TEAM_ID = 'team_BUW68aJeYnEVRcon8hC0EeoY';

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

const readDatabase = async (path, idToken) => {
  const response = await fetch(`${getDatabaseUrl()}/${path}.json?access_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new Error('Lecture de la boutique impossible.');
  return response.json();
};

const writeDatabase = async (updates, idToken) => {
  const response = await fetch(`${getDatabaseUrl()}/.json?access_token=${encodeURIComponent(idToken)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Mise à jour du domaine impossible.');
};

const normalizeDomain = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, 'www.')
  .split('/')[0]
  .replace(/\.$/, '');

const isValidDomain = (domain) => (
  domain.length <= 253 &&
  domain.includes('.') &&
  !domain.includes('..') &&
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)
);

const vercelConfig = () => {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || '';
  return {
    token,
    projectId: process.env.VERCEL_PROJECT_ID || DEFAULT_VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID || DEFAULT_VERCEL_TEAM_ID
  };
};

const vercelRequest = async (path, { token, teamId }, options = {}) => {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`https://api.vercel.com${path}${teamId ? `${separator}teamId=${encodeURIComponent(teamId)}` : ''}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.code || payload?.message || 'Opération domaine Vercel impossible.';
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload || {};
};

const getDnsRecords = (domain, config, verification = []) => {
  const isSubdomain = domain.split('.').length > 2 && !domain.startsWith('www.');
  const records = isSubdomain || domain.startsWith('www.')
    ? [{ type: 'CNAME', name: domain.split('.')[0], value: config?.cname || 'cname.vercel-dns.com' }]
    : [{ type: 'A', name: '@', value: config?.aValues?.[0] || '76.76.21.21' }];
  const verificationRecords = Array.isArray(verification)
    ? verification.map((item) => ({ type: item.type || 'TXT', name: item.domain || item.name || domain, value: item.value || item.token || '' })).filter((item) => item.value)
    : [];
  return [...records, ...verificationRecords];
};

const getProjectDomain = async (domain, config) => {
  try {
    return await vercelRequest(`/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`, config);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ZANDOFY_DOMAIN_ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authorization = req.headers.authorization || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken) return res.status(401).json({ error: 'Connexion requise.' });

  try {
    const authenticatedUser = await getAuthenticatedUser(idToken);
    if (!authenticatedUser?.localId) return res.status(401).json({ error: 'Session AfriZia invalide.' });
    const body = await parseBody(req);
    const action = body.action || 'connect';
    const domain = normalizeDomain(body.domain);
    const store = await readDatabase(`zandofyStores/${encodeURIComponent(authenticatedUser.localId)}`, idToken);
    if (!store || store.ownerId !== authenticatedUser.localId) return res.status(404).json({ error: 'Boutique Zandofy introuvable.' });

    const currentDomain = domain || normalizeDomain(store.customDomain);
    if (!isValidDomain(currentDomain)) return res.status(400).json({ error: 'Ajoute un domaine valide, par exemple boutique.com.' });
    if (currentDomain.endsWith('afrisell.app') || currentDomain.endsWith('vercel.app')) return res.status(400).json({ error: 'Ce domaine est réservé à AfriZia.' });

    const config = vercelConfig();
    if (!config.token) return res.status(503).json({ error: 'La gestion des domaines Vercel n’est pas encore configurée sur le serveur.' });

    let projectDomain = await getProjectDomain(currentDomain, config);
    if (action === 'connect' && !projectDomain) {
      projectDomain = await vercelRequest(`/v10/projects/${encodeURIComponent(config.projectId)}/domains`, config, {
        method: 'POST',
        body: JSON.stringify({ name: currentDomain })
      });
    }

    if (action === 'verify' && !projectDomain) {
      return res.status(404).json({ error: 'Ajoute d’abord ce domaine au projet.' });
    }

    if (action === 'verify' && projectDomain?.verified !== true) {
      projectDomain = await vercelRequest(`/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(currentDomain)}/verify`, config, { method: 'POST' });
    }

    const domainConfig = await vercelRequest(`/v6/domains/${encodeURIComponent(currentDomain)}/config`, config);
    const verified = projectDomain?.verified === true;
    await writeDatabase({
      [`zandofyStores/${authenticatedUser.localId}/customDomain`]: currentDomain,
      [`zandofyStores/${authenticatedUser.localId}/customDomainStatus`]: verified ? 'verified' : 'pending',
      [`zandofyStores/${authenticatedUser.localId}/customDomainVerified`]: verified,
      [`zandofyStores/${authenticatedUser.localId}/customDomainCheckedAt`]: Date.now(),
      [`zandofyStores/${authenticatedUser.localId}/updatedAt`]: { '.sv': 'timestamp' }
    }, idToken);

    return res.status(200).json({
      domain: currentDomain,
      status: verified ? 'verified' : 'pending',
      ssl: verified ? 'active' : 'pending',
      routing: verified ? 'active' : 'pending',
      dnsRecords: getDnsRecords(currentDomain, domainConfig, projectDomain?.verification),
      verification: projectDomain?.verification || [],
      message: verified ? 'Domaine vérifié. SSL et routage Vercel actifs.' : 'Domaine ajouté. Configure les DNS puis lance la vérification.'
    });
  } catch (error) {
    console.error('Zandofy custom domain error:', error);
    return res.status(error?.statusCode || 500).json({ error: error instanceof Error ? error.message : 'Gestion du domaine impossible.', detail: error?.payload || undefined });
  }
}
