import { randomBytes } from 'crypto';

export const getWonyaPayConfig = () => {
  const baseUrl = process.env.WONYAPAY_BASE_URL || 'https://app-api.wonyasoft.com';
  const token = process.env.WONYAPAY_TOKEN || '';
  const refPartenaire = process.env.WONYAPAY_REF_PARTENAIRE || '';

  if (!token || !refPartenaire) {
    throw new Error('Configuration Wonyapay manquante: WONYAPAY_TOKEN et WONYAPAY_REF_PARTENAIRE requis.');
  }

  return { baseUrl, token, refPartenaire };
};

export const normalizeWonyaPayPhoneNumber = (phoneNumber = '') => {
  const digits = String(phoneNumber).replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 12 && digits.startsWith('243')) return `0${digits.slice(3)}`;
  if (digits.length === 13 && digits.startsWith('2430')) return digits.slice(3);

  throw new Error(`Numéro Mobile Money invalide: ${phoneNumber}. Format attendu: 0997654321 ou +243...`);
};

export const generateWonyaPayRefTransa = (prefix = 'AFS') => {
  const cleanPrefix = String(prefix || 'AFS').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'A');
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(10).toString('hex').toUpperCase();
  return `${cleanPrefix}${time}${random}`.replace(/[^A-Z0-9]/g, '').slice(0, 20).padEnd(20, '0');
};

export const normalizeWonyaPayStatus = (status = '') => (
  String(status)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
);

export const extractWonyaPayStatus = (payload) => {
  const candidates = [
    payload?.StatutWonya,
    payload?.data?.StatutWonya,
    payload?.statutWonya,
    payload?.data?.statutWonya,
    payload?.status,
    payload?.data?.status,
    payload?.StatutTransa,
    payload?.data?.StatutTransa,
    payload?.transactionStatus,
    payload?.data?.transactionStatus
  ];

  return candidates.find((value) => String(value || '').trim()) || '';
};

export const isCompletedWonyaPayStatus = (status) => {
  const normalized = normalizeWonyaPayStatus(status);
  return [
    'succes',
    'success',
    'recu',
    'received',
    'completed',
    'successful',
    'paid',
    'confirmed',
    'valide',
    'valid',
    'ok'
  ].includes(normalized);
};

export const isFailedWonyaPayStatus = (status) => {
  const normalized = normalizeWonyaPayStatus(status);
  return [
    'echec',
    'failed',
    'failure',
    'error',
    'erreur',
    'rejected',
    'reject',
    'cancelled',
    'canceled',
    'annule',
    'expire',
    'expired'
  ].includes(normalized);
};

export const parseJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
};

export const readNodeJsonBody = async (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
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

export const setCorsHeaders = (req, res) => {
  const requestOrigin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
};

export const extractWonyaPayErrorMessage = (payload, fallback = 'Erreur Wonyapay') => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);

  const candidates = [
    payload.message,
    payload.error,
    payload.detail,
    payload.data?.message,
    payload.data?.error,
    payload.data?.detail,
    payload.errors?.[0]?.message,
    payload.errors?.[0]
  ];

  const direct = candidates.find((value) => typeof value === 'string' && value.trim());
  if (direct) return direct;

  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
};

export const processWonyaPayPayment = async ({
  action,
  amount,
  currency = 'CDF',
  phoneNumber,
  motif,
  refPrefix
}) => {
  const config = getWonyaPayConfig();
  const montant = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(montant) || montant <= 0) throw new Error('Montant Wonyapay invalide.');

  const devise = currency === 'USD' ? 'USD' : 'CDF';
  const nextAction = action === 'B2C' ? 'B2C' : 'C2B';
  const mobileMoney = normalizeWonyaPayPhoneNumber(phoneNumber);
  let lastPayload = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const refTransa = generateWonyaPayRefTransa(refPrefix || (nextAction === 'B2C' ? 'AFR' : 'AFD'));
    const payload = {
      RefPartenaire: config.refPartenaire,
      RefTransa: refTransa,
      Montant: montant,
      Devise: devise,
      Action: nextAction,
      MobileMoney: mobileMoney,
      Motif: motif || `AfriSpay ${nextAction === 'B2C' ? 'retrait' : 'dépôt'}`
    };

    const response = await fetch(`${config.baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify(payload)
    });

    lastStatus = response.status;
    lastPayload = await response.json().catch(() => null);

    if (response.ok) {
      const providerStatus = extractWonyaPayStatus(lastPayload) || 'pending';
      return {
        success: true,
        refTransa,
        refPartenaire: config.refPartenaire,
        action: nextAction,
        amount: montant,
        currency: devise,
        phoneNumber: mobileMoney,
        providerStatus,
        completed: isCompletedWonyaPayStatus(providerStatus),
        failed: isFailedWonyaPayStatus(providerStatus),
        rawResponse: lastPayload
      };
    }

    if (response.status === 409 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
      continue;
    }

    break;
  }

  const message = extractWonyaPayErrorMessage(lastPayload, `Erreur Wonyapay (${lastStatus || 'inconnue'})`);
  const error = new Error(message);
  error.status = lastStatus || 500;
  error.payload = lastPayload;
  throw error;
};

export const getWonyaPayTransactionStatus = async (refTransa) => {
  const cleanRef = String(refTransa || '').trim();
  if (!cleanRef) throw new Error('RefTransa Wonyapay requis.');

  const config = getWonyaPayConfig();
  const response = await fetch(`${config.baseUrl}/transactionStatus/status/${encodeURIComponent(cleanRef)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractWonyaPayErrorMessage(payload, `Statut Wonyapay indisponible (${response.status})`);
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const providerStatus = extractWonyaPayStatus(payload);
  return {
    success: true,
    refTransa: cleanRef,
    providerStatus,
    completed: isCompletedWonyaPayStatus(providerStatus),
    failed: isFailedWonyaPayStatus(providerStatus),
    rawResponse: payload
  };
};
