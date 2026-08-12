import {
  parseJsonBody,
  processWonyaPayPayment,
  setCorsHeaders
} from '../../server/wonyapay.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const result = await processWonyaPayPayment({
      action: body.action,
      amount: body.amount,
      currency: body.currency,
      phoneNumber: body.phoneNumber,
      motif: body.motif,
      refPrefix: body.refPrefix
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Paiement Wonyapay impossible.',
      detail: error.payload || undefined
    });
  }
}

