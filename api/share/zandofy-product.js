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

const absoluteURL = (value, origin) => {
  try {
    return new URL(String(value || ''), origin).toString();
  } catch {
    return `${origin}/afrizia-super-app-icon.png`;
  }
};

const productImage = (product, origin) => {
  const imageMedia = Array.isArray(product.media)
    ? product.media.find((media) => (media.resourceType || 'image') === 'image' && (media.secureUrl || media.mediaUrl))
    : null;
  return absoluteURL(imageMedia?.secureUrl || imageMedia?.mediaUrl || product.coverURL || '/afrizia-super-app-icon.png', origin);
};

const brandedProductImage = (imageURL) => {
  const uploadMarker = '/image/upload/';
  if (!imageURL.includes('res.cloudinary.com/') || !imageURL.includes(uploadMarker)) return imageURL;

  // The brand asset is uploaded once to Cloudinary during deployment setup.
  const transformation = 'w_1200,h_630,c_fill,g_auto/l_afrizia:branding:share_favicon,w_84,h_84,c_fill,r_max/fl_layer_apply,g_south_east,x_28,y_28/';
  return imageURL.replace(uploadMarker, `${uploadMarker}${transformation}`);
};

const productDescription = (product, store) => {
  const value = String(product.description || '').trim();
  if (value) return value.slice(0, 220);
  const price = product.isFree ? 'Gratuit' : `${Number(product.salePrice ?? product.price ?? 0).toLocaleString('fr-FR')} ${product.currency || 'USD'}`;
  return `${product.title || 'Produit'} disponible dans la boutique ${store.name || 'WeZandofy'} - ${price}.`;
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const storeId = safeSegment(req.query.storeId);
  const productId = safeSegment(req.query.productId);
  if (!storeId || !productId) return res.status(400).send('Produit WeZandofy invalide.');

  try {
    const [productResponse, storeResponse] = await Promise.all([
      fetch(`${databaseURL()}/zandofyProducts/${encodeURIComponent(storeId)}/${encodeURIComponent(productId)}.json`),
      fetch(`${databaseURL()}/zandofyStores/${encodeURIComponent(storeId)}.json`)
    ]);
    const product = productResponse.ok ? await productResponse.json() : null;
    const store = storeResponse.ok ? await storeResponse.json() : null;
    if (!product || !store) return res.status(404).send('Produit WeZandofy introuvable.');

    const origin = getOrigin(req);
    const search = new URLSearchParams(req.query);
    search.delete('storeId');
    search.delete('productId');
    const query = search.toString();
    const canonicalPath = `/zandofy/${encodeURIComponent(store.slug || storeId)}/product/${encodeURIComponent(productId)}`;
    const canonicalURL = `${origin}${canonicalPath}${query ? `?${query}` : ''}`;
    const imageURL = brandedProductImage(productImage(product, origin));
    const faviconURL = `${origin}/afrizia-super-app-icon.png`;
    const title = `${product.title || 'Produit WeZandofy'} | ${store.name || 'WeZandofy'}`;
    const description = productDescription(product, store);
    const price = product.isFree ? '0' : String(product.salePrice ?? product.price ?? 0);
    const currency = String(product.currency || 'USD');

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
    <link rel="apple-touch-icon" href="${escapeHtml(faviconURL)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="WeZandofy - AfriZia" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalURL)}" />
    <meta property="og:image" content="${escapeHtml(imageURL)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageURL)}" />
    <meta property="og:image:alt" content="${escapeHtml(product.title || 'Produit WeZandofy')}" />
    <meta property="og:logo" content="${escapeHtml(faviconURL)}" />
    <meta property="product:brand" content="${escapeHtml(store.name || 'WeZandofy')}" />
    <meta property="product:price:amount" content="${escapeHtml(price)}" />
    <meta property="product:price:currency" content="${escapeHtml(currency)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageURL)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalURL)}" />
    <script>window.location.replace(${JSON.stringify(canonicalURL)});</script>
  </head>
  <body></body>
</html>`);
  } catch (error) {
    console.error('WeZandofy share metadata error:', error);
    return res.status(500).send('Métadonnées de partage indisponibles.');
  }
}
