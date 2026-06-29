import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { realtimeDb } from '../lib/firebase';
import { SafariServiceType, createSafariRequest } from '../domains/logistics';

type SafariService = {
  id: string;
  type: SafariServiceType;
  title: string;
  shortTitle: string;
  body: string;
  icon: AfriSellIconName;
  action: string;
  titlePlaceholder: string;
  originLabel: string;
  destinationLabel: string;
  detailsPlaceholder: string;
};

const services: SafariService[] = [
  {
    id: 'expedier',
    type: 'shipping',
    title: 'Expedier un colis',
    shortTitle: 'Colis',
    body: 'Livraison locale, retrait vendeur, preuve de remise et suivi.',
    icon: 'send',
    action: 'Demander',
    titlePlaceholder: 'Ex: livraison téléphone',
    originLabel: 'Adresse de retrait',
    destinationLabel: 'Adresse de livraison',
    detailsPlaceholder: 'Taille, poids, fragilite, consignes de remise...'
  },
  {
    id: 'mobilite',
    type: 'mobility',
    title: 'Mobilite',
    shortTitle: 'Transport',
    body: 'Course urbaine, trajet planifie, transport vendeur ou client.',
    icon: 'app',
    action: 'Planifier',
    titlePlaceholder: 'Ex: course vers Gombe',
    originLabel: 'Depart',
    destinationLabel: 'Arrivee',
    detailsPlaceholder: 'Heure souhaitee, nombre de personnes, bagages...'
  },
  {
    id: 'immobilier',
    type: 'real_estate',
    title: 'Immobilier',
    shortTitle: 'Immo',
    body: 'Recherche, visite, location, achat terrain ou maison.',
    icon: 'market',
    action: 'Explorer',
    titlePlaceholder: 'Ex: appartement deux chambres',
    originLabel: 'Zone recherchee',
    destinationLabel: 'Ville ou quartier cible',
    detailsPlaceholder: 'Budget, type de bien, urgence, visite souhaitee...'
  },
  {
    id: 'relais',
    type: 'storage',
    title: 'Relais & stockage',
    shortTitle: 'Relais',
    body: 'Point relais, garde colis, stockage court et coordination terrain.',
    icon: 'shield',
    action: 'Reserver',
    titlePlaceholder: 'Ex: stockage cartons boutique',
    originLabel: 'Lieu de dépôt',
    destinationLabel: 'Lieu de retrait',
    detailsPlaceholder: 'Volume, durée, conditions de sécurité...'
  }
];

type SafariDelivery = {
  orderId: string;
  productName?: string;
  buyerId?: string;
  sellerId?: string;
  sellerName?: string;
  buyerName?: string;
  status?: string;
  delivery?: {
    title?: string;
    eta?: string;
    price?: number;
  };
  createdAt?: number;
};

type SafariRequest = {
  id: string;
  userId?: string;
  serviceLabel?: string;
  title?: string;
  origin?: string;
  destination?: string;
  status?: string;
  budget?: number;
  createdAt?: number;
};

const statusLabel = (status?: string) => {
  if (status === 'pending_assignment') return 'Recherche agent';
  if (status === 'pickup_requested') return 'Retrait demande';
  if (status === 'assigned') return 'Agent assigne';
  if (status === 'in_transit') return 'En route';
  if (status === 'delivered') return 'Livre';
  return status || 'En attente';
};

export default function SafariServicesScreen() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const [deliveries, setDeliveries] = useState<SafariDelivery[]>([]);
  const [requests, setRequests] = useState<SafariRequest[]>([]);
  const [activeServiceId, setActiveServiceId] = useState(serviceId || services[0].id);
  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (serviceId && services.some((service) => service.id === serviceId)) {
      setActiveServiceId(serviceId);
    }
  }, [serviceId]);

  useEffect(() => {
    if (!user) {
      setDeliveries([]);
      setRequests([]);
      return undefined;
    }

    const deliveriesRef = ref(realtimeDb, 'safariDeliveries');
    const requestsRef = ref(realtimeDb, 'safariRequests');
    const unsubscribeDeliveries = onValue(deliveriesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, SafariDelivery> | null;
      const nextDeliveries = Object.entries(data || {})
        .map(([orderId, delivery]) => ({ ...delivery, orderId: delivery.orderId || orderId }))
        .filter((delivery) => delivery.buyerId === user.uid || delivery.sellerId === user.uid)
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setDeliveries(nextDeliveries);
    });
    const unsubscribeRequests = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, SafariRequest> | null;
      const nextRequests = Object.entries(data || {})
        .map(([id, request]) => ({ ...request, id: request.id || id }))
        .filter((request) => request.userId === user.uid)
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setRequests(nextRequests);
    });

    return () => {
      unsubscribeDeliveries();
      unsubscribeRequests();
    };
  }, [user]);

  const activeService = services.find((service) => service.id === activeServiceId) || services[0];
  const activeDeliveries = useMemo(() => deliveries.slice(0, 5), [deliveries]);
  const activeRequests = useMemo(() => requests.slice(0, 4), [requests]);

  const selectService = (service: SafariService) => {
    setActiveServiceId(service.id);
    setStatus('');
    navigate(`/safari/${service.id}`, { replace: true });
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { next: `/safari/${activeService.id}` } });
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await createSafariRequest({
        user,
        serviceType: activeService.type,
        title,
        origin,
        destination,
        contactPhone,
        details,
        budget: Number(budget || 0)
      });
      setTitle('');
      setOrigin('');
      setDestination('');
      setContactPhone('');
      setBudget('');
      setDetails('');
      setStatus('Mission Safari créée. Un agent ou partenaire pourra la prendre en charge.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Mission Safari impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-7 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Safari</p>
          <h1 className="mt-1 text-xl font-black tracking-normal">Mobilite & services</h1>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(21,234,62,0.18),transparent_34%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <img src="/safari.jpeg" alt="Safari" className="h-20 w-20 rounded-[1.5rem] object-cover" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Transport, livraison, immobilier</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Le terrain connecté au commerce.</h2>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/48">
              Expedition, mobilite, relais et visites sont reliés aux commandes, au wallet et au chat.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-4 gap-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => selectService(service)}
            className={`rounded-2xl border p-2 text-left active:scale-[0.98] ${
              activeService.id === service.id
                ? 'border-[#15EA3E]/45 bg-[#15EA3E]/12 text-[#15EA3E]'
                : 'border-white/10 bg-white/[0.04] text-white/72'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/24">
              <AfriSellIcon name={service.icon} size={17} />
            </span>
            <span className="mt-2 block truncate text-[9px] font-black uppercase tracking-[0.08em]">{service.shortTitle}</span>
          </button>
        ))}
      </section>

      <form onSubmit={submitRequest} className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">{activeService.action}</p>
            <h2 className="mt-1 text-lg font-black">{activeService.title}</h2>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">{activeService.body}</p>
          </div>
          {!user && (
            <Link to="/login" state={{ next: `/safari/${activeService.id}` }} className="shrink-0 rounded-full bg-[#15EA3E] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black">
              Connexion
            </Link>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={activeService.titlePlaceholder} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={activeService.originLabel} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={activeService.destinationLabel} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <div className="grid grid-cols-2 gap-2">
            <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Téléphone" inputMode="tel" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
            <input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Budget USD" inputMode="decimal" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          </div>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={activeService.detailsPlaceholder} rows={3} className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#15EA3E]/50" />
        </div>

        {status && (
          <p className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${
            status.includes('requis') || status.includes('impossible') || status.includes('invalide')
              ? 'border-red-500/25 bg-red-500/10 text-red-100'
              : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
          }`}>
            {status}
          </p>
        )}

        <button disabled={busy} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-60">
          {busy ? 'Création...' : activeService.action}
          <AfriSellIcon name="arrow" size={16} />
        </button>
      </form>

      {activeRequests.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Missions demandées</h2>
            <span className="text-[10px] font-black text-[#15EA3E]">{activeRequests.length}</span>
          </div>
          <div className="space-y-3">
            {activeRequests.map((request) => (
              <article key={request.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{request.title || 'Mission Safari'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{request.serviceLabel || 'Safari'}</p>
                    <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-white/45">
                      {request.origin} vers {request.destination}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                    {statusLabel(request.status)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeDeliveries.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Livraisons commandes</h2>
            <span className="text-[10px] font-black text-[#15EA3E]">{activeDeliveries.length}</span>
          </div>
          <div className="space-y-3">
            {activeDeliveries.map((delivery) => (
              <article key={delivery.orderId} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{delivery.productName || 'Commande AfriSell'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{delivery.delivery?.title || 'Safari'}</p>
                    <p className="mt-2 text-[11px] font-semibold text-white/45">
                      {delivery.buyerId === user?.uid ? `Vendeur: ${delivery.sellerName || 'AfriSell'}` : `Client: ${delivery.buyerName || 'AfriSell'}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                    {statusLabel(delivery.status)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-black/24 p-3">
                  <span className="text-[10px] font-bold text-white/50">ETA: {delivery.delivery?.eta || 'A confirmer'}</span>
                  <Link to="/chat" className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
                    Chat
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
