import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { downloadDigitalAsset, getDigitalDelivery, DigitalDelivery } from '../lib/digitalDelivery';

const formatBytes = (value: number) => {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function DigitalAccessScreen() {
  const { orderId = '' } = useParams();
  const [delivery, setDelivery] = useState<DigitalDelivery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('Commande introuvable.');
      setLoading(false);
      return;
    }

    void getDigitalDelivery(orderId)
      .then(setDelivery)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Accès impossible.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleDownload = async (asset: DigitalDelivery['assets'][number]) => {
    setDownloading(asset.id);
    setDownloadError('');
    try {
      await downloadDigitalAsset(asset, asset.name);
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Téléchargement impossible.');
    } finally {
      setDownloading('');
    }
  };

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white"><p className="text-sm font-black">Préparation de ton accès...</p></main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] px-4 pb-24 pt-5 text-white">
      <header className="flex items-center justify-between">
        <Link to="/market/orders?module=zandofy" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </Link>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriZia</p>
          <h1 className="text-sm font-black">Accès digital</h1>
        </div>
        <AfriSellIcon name="lock" size={18} className="text-[#15EA3E]" />
      </header>

      {error ? (
        <section className="mt-8 rounded-[1.8rem] border border-red-400/20 bg-red-500/10 p-5 text-center">
          <AfriSellIcon name="lock" size={30} className="mx-auto text-red-200" />
          <h2 className="mt-4 text-lg font-black">Accès protégé</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-red-100/70">{error}</p>
        </section>
      ) : delivery && (
        <>
          <section className="mt-6 rounded-[1.8rem] border border-[#15EA3E]/18 bg-[#071007] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Commande confirmée</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{delivery.productName}</h2>
            {delivery.accessNote && <p className="mt-3 text-sm font-semibold leading-relaxed text-white/52">{delivery.accessNote}</p>}
          </section>

          {delivery.deliveryURL && (
            <a href={delivery.deliveryURL} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 p-4">
              <AfriSellIcon name="send" size={20} className="text-[#15EA3E]" />
              <span className="flex-1 text-sm font-black">Ouvrir l’accès privé</span>
              <AfriSellIcon name="arrow" size={14} className="text-[#15EA3E]" />
            </a>
          )}

          <section className="mt-4 space-y-2">
            {delivery.assets.length ? delivery.assets.map((asset) => (
              <button key={asset.id} type="button" onClick={() => void handleDownload(asset)} disabled={Boolean(downloading)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left disabled:opacity-60">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15EA3E] text-black"><AfriSellIcon name="file" size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{asset.name}</span><span className="mt-1 block text-[10px] font-semibold text-white/38">{asset.type} {formatBytes(asset.size)}</span></span>
                <span className="text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">{downloading === asset.id ? 'Préparation' : 'Télécharger'}</span>
              </button>
            )) : !delivery.deliveryURL && <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm font-semibold text-white/48">Le vendeur n’a pas encore publié le fichier de livraison.</div>}
          </section>
          {downloadError && <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-center text-xs font-bold text-red-100">{downloadError}</p>}
        </>
      )}
    </main>
  );
}
