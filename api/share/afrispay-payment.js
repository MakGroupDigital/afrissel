const DEFAULT_DATABASE_URL = 'https://afrisellapp-default-rtdb.firebaseio.com';

const databaseURL = () => (
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  DEFAULT_DATABASE_URL
).replace(/\/$/, '');

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const safeSegment = (value) => String(value || '').trim().replace(/[.#$\[\]/]/g, '');

const getOrigin = (req) => {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || (host.startsWith('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : 'https://afri.afrisell.app';
};

const formatAmount = (amount, currency) => `${Number(amount || 0).toLocaleString('fr-FR')} ${currency || 'USD'}`;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const paymentLinkId = safeSegment(req.query.paymentLinkId);
  if (!paymentLinkId) return res.status(400).send('Lien de paiement invalide.');

  try {
    const response = await fetch(`${databaseURL()}/afriSpayPaymentLinks/${encodeURIComponent(paymentLinkId)}.json`);
    const link = response.ok ? await response.json() : null;
    if (!link) return res.status(404).send('Lien de paiement introuvable.');

    const origin = getOrigin(req);
    const canonicalURL = `${origin}/pay/${encodeURIComponent(paymentLinkId)}`;
    const title = `Paiement AfriSpay · ${String(link.title || 'Paiement sécurisé')}`;
    const amountDetail = link.amountMode === 'fixed' ? ` Montant : ${formatAmount(link.amount, link.currency)}.` : ' Le montant est choisi par le payeur.';
    const description = `${String(link.description || '').trim() || `Paiement pour ${String(link.title || 'un service')}.`} Appuie sur ce lien pour payer de façon sécurisée avec AfriSpay ou Mobile Money.${amountDetail}`.slice(0, 250);
    const logoURL = `${origin}/afrispay.jpeg`;
    const faviconURL = `${origin}/afrizia-super-app-icon.png`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalURL)}" />
    <link rel="icon" type="image/png" href="${escapeHtml(faviconURL)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="AfriSpay · AfriZia" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalURL)}" />
    <meta property="og:image" content="${escapeHtml(logoURL)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(logoURL)}" />
    <meta property="og:image:alt" content="AfriSpay" />
    <meta property="og:logo" content="${escapeHtml(logoURL)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(logoURL)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalURL)}" />
    <script>window.location.replace(${JSON.stringify(canonicalURL)});</script>
  </head>
  <body></body>
</html>`);
  } catch (error) {
    console.error('AfriSpay payment share metadata error:', error);
    return res.status(500).send('Métadonnées de paiement indisponibles.');
  }
}
