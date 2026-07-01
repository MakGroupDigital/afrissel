import { Product, CheckoutDelivery } from '../store/useAppStore';

export type OrderDocumentKind = 'receipt' | 'invoice';

export type OrderDocumentInput = {
  kind: OrderDocumentKind;
  orderId: string;
  product: Product;
  delivery?: CheckoutDelivery | null;
  buyerName: string;
  totalAmount: number;
  currency: string;
  verificationUrl: string;
  createdAt?: number;
};

const formatMoney = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Image impossible: ${src}`));
  image.src = src;
});

const drawRoundImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  context.save();
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
};

const drawPseudoBarcode = (context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, height: number) => {
  context.fillStyle = '#ffffff';
  context.fillRect(x, y, width, height);
  context.fillStyle = '#050505';
  let cursor = x + 10;
  for (let index = 0; index < value.length && cursor < x + width - 12; index += 1) {
    const code = value.charCodeAt(index);
    const lineWidth = 1 + (code % 4);
    const gap = 2 + (code % 3);
    context.fillRect(cursor, y + 8, lineWidth, height - 18);
    cursor += lineWidth + gap;
  }
  context.font = '700 18px monospace';
  context.textAlign = 'center';
  context.fillText(value.slice(0, 22), x + width / 2, y + height - 5);
};

const drawText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split(' ');
  let line = '';
  let nextY = y;
  words.forEach((word) => {
    const testLine = `${line}${line ? ' ' : ''}${word}`;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, nextY);
      line = word;
      nextY += lineHeight;
      return;
    }
    line = testLine;
  });
  if (line) context.fillText(line, x, nextY);
  return nextY;
};

export async function generateOrderDocumentPng(input: OrderDocumentInput) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1560;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible.');

  const isReceipt = input.kind === 'receipt';
  const title = isReceipt ? 'RECU AFRISELL' : 'FACTURE AFRISELL';
  const secureLabel = isReceipt ? 'PAIEMENT CONFIRME' : 'PAIEMENT A LA LIVRAISON';
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(input.createdAt || Date.now()));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(input.verificationUrl)}`;

  const [afriSellLogo, marketLogo, qrImage, productImage] = await Promise.all([
    loadImage('/afriselliconecentral.png').catch(() => loadImage('/afrissel-logo.jpeg')),
    loadImage('/afrimarket sans nom icone sans fond.png').catch(() => loadImage('/afrimarket.jpeg')),
    loadImage(qrUrl),
    loadImage(input.product.imageUrl || '/afrimarket.jpeg').catch(() => loadImage('/afrimarket.jpeg'))
  ]);

  const gradient = context.createLinearGradient(0, 0, 1080, 1560);
  gradient.addColorStop(0, '#071007');
  gradient.addColorStop(0.48, '#050505');
  gradient.addColorStop(1, '#0f2112');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1560);

  context.fillStyle = 'rgba(21,234,62,0.18)';
  context.beginPath();
  context.arc(210, 120, 250, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.06)';
  context.beginPath();
  context.arc(980, 620, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(255,255,255,0.08)';
  context.strokeStyle = 'rgba(21,234,62,0.3)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(56, 56, 968, 1448, 42);
  context.fill();
  context.stroke();

  drawRoundImage(context, afriSellLogo, 94, 94, 94, 94, 28);
  drawRoundImage(context, marketLogo, 892, 94, 94, 94, 28);

  context.fillStyle = '#15EA3E';
  context.font = '900 24px Arial';
  context.fillText('AFRISELL SUPER APP', 212, 122);
  context.fillStyle = '#ffffff';
  context.font = '900 52px Arial';
  context.fillText(title, 212, 178);

  context.fillStyle = isReceipt ? '#15EA3E' : '#FFD84D';
  context.beginPath();
  context.roundRect(94, 230, 892, 70, 24);
  context.fill();
  context.fillStyle = '#050505';
  context.font = '900 26px Arial';
  context.textAlign = 'center';
  context.fillText(secureLabel, 540, 275);
  context.textAlign = 'start';

  drawRoundImage(context, productImage, 94, 340, 258, 258, 34);
  context.fillStyle = '#ffffff';
  context.font = '900 34px Arial';
  drawText(context, input.product.name, 382, 370, 550, 42);
  context.fillStyle = 'rgba(255,255,255,0.58)';
  context.font = '700 24px Arial';
  context.fillText(`Stand: ${input.product.seller}`, 382, 470);
  context.fillText(`Client: ${input.buyerName}`, 382, 510);
  context.fillText(`Livraison: ${input.delivery?.title || 'Safari'}`, 382, 550);
  context.fillText(`Date: ${date}`, 382, 590);

  context.fillStyle = 'rgba(0,0,0,0.34)';
  context.beginPath();
  context.roundRect(94, 650, 892, 236, 34);
  context.fill();
  const lines = [
    ['Produit', formatMoney(Number(input.product.villagePrice || input.product.price || 0), input.currency)],
    ['Livraison', formatMoney(Number(input.delivery?.price || 0), input.currency)],
    ['Total', formatMoney(input.totalAmount, input.currency)]
  ];
  lines.forEach(([label, value], index) => {
    const y = 710 + index * 62;
    context.fillStyle = index === 2 ? '#15EA3E' : 'rgba(255,255,255,0.64)';
    context.font = index === 2 ? '900 34px Arial' : '800 26px Arial';
    context.fillText(label, 132, y);
    context.textAlign = 'right';
    context.fillText(value, 948, y);
    context.textAlign = 'start';
  });

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.roundRect(94, 936, 320, 320, 34);
  context.fill();
  context.drawImage(qrImage, 124, 966, 260, 260);

  context.fillStyle = '#ffffff';
  context.font = '900 30px Arial';
  context.fillText('Verification securisee', 454, 980);
  context.fillStyle = 'rgba(255,255,255,0.58)';
  context.font = '700 23px Arial';
  drawText(context, 'Scanne ce QR code pour voir l etat du produit, de la commande, du paiement et de la livraison.', 454, 1028, 470, 34);
  context.fillStyle = '#15EA3E';
  context.font = '900 22px monospace';
  drawText(context, input.verificationUrl, 454, 1162, 470, 30);

  drawPseudoBarcode(context, input.orderId, 94, 1312, 892, 114);

  context.fillStyle = 'rgba(255,255,255,0.42)';
  context.font = '700 20px Arial';
  context.textAlign = 'center';
  context.fillText(`Document ${input.orderId} • AfriSell Market • Non modifiable`, 540, 1470);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
