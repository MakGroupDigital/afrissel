import { firebaseAuth } from './firebase';

export type DigitalDeliveryAsset = {
  id: string;
  name: string;
  type: string;
  size: number;
  downloadPath: string;
  resourceType: string;
};

export type DigitalDelivery = {
  orderId: string;
  productId: string;
  productName: string;
  deliveryMode: 'file' | 'link' | string;
  accessNote: string;
  deliveryURL: string;
  assets: DigitalDeliveryAsset[];
};

export async function getDigitalDelivery(orderId: string): Promise<DigitalDelivery> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Connecte-toi pour accéder à ta livraison.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/digital-delivery', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ orderId })
  });
  const payload = await response.json().catch(() => null) as DigitalDelivery & { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || 'Livraison digitale indisponible.');
  return payload as DigitalDelivery;
}

export async function downloadDigitalAsset(asset: DigitalDeliveryAsset, filename: string): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Connecte-toi pour télécharger ce fichier.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch(asset.downloadPath, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || 'Téléchargement impossible.');
  }

  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectURL);
}
