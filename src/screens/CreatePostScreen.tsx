import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AfriMarketContent, formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { cn } from '../lib/utils';

type CreationIntent = 'media' | 'text' | 'product' | 'offer';

const textStyleOptions = [
  {
    id: 'emerald',
    label: 'Vert profond',
    className: 'bg-[radial-gradient(circle_at_80%_10%,rgba(21,234,62,0.32),transparent_34%),linear-gradient(135deg,#061107,#102815)] text-white'
  },
  {
    id: 'lime',
    label: 'Citron',
    className: 'bg-[linear-gradient(135deg,#15EA3E,#D7FF4F)] text-black'
  },
  {
    id: 'graphite',
    label: 'Graphite',
    className: 'bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_26%),linear-gradient(135deg,#050505,#1D1F1D)] text-white'
  },
  {
    id: 'sunset',
    label: 'Orange',
    className: 'bg-[linear-gradient(135deg,#FF7A1A,#151006)] text-white'
  },
  {
    id: 'clean',
    label: 'Clair',
    className: 'bg-[linear-gradient(135deg,#F8FFF9,#DDF8E4)] text-[#071007]'
  }
];

const getBusinessAccounts = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return [];
  return [
    profile.businessAccount,
    ...Object.entries(profile.businessAccounts || {}).map(([accountKey, account]) => (
      account && typeof account === 'object'
        ? { accountKey, ...account }
        : { accountKey }
    ))
  ].filter(Boolean);
};

const normalizeAccessText = (value: unknown) => String(value || '').trim().toLowerCase();

const accountMatchesAny = (account: Record<string, unknown>, values: Set<string>) => {
  const fields = [
    account.accountKey,
    account.categoryId,
    account.categoryLabel,
    account.moduleName,
    account.serviceId,
    account.serviceLabel,
    account.segmentId,
    account.segmentLabel
  ].map(normalizeAccessText);

  return fields.some((field) => (
    values.has(field) ||
    Array.from(values).some((value) => field.includes(value))
  ));
};

const commerceAccessValues = new Set([
  'commerce',
  'e-commerce',
  'market',
  'marché',
  'marche',
  'abc + market',
  'store',
  'boutique',
  'supplier',
  'fournisseur',
  'producer',
  'producteur',
  'retailer',
  'grossiste',
  'wholesaler',
  'seller',
  'vendeur'
]);

const serviceAccessValues = new Set([
  'services',
  'services professionnels',
  'provider',
  'prestataire',
  'freelance',
  'a-freelance',
  'creative',
  'tech_service',
  'local_service',
  'health',
  'santé',
  'sante',
  'education',
  'éducation',
  'school',
  'transport_provider',
  'real_estate_provider',
  'service_provider',
  'health_provider',
  'school_provider'
]);

const hasBusinessAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return false;
  const accounts = getBusinessAccounts(profile);

  return Boolean(accounts.length || profile.primaryRole === 'seller' || profile.primaryRole === 'provider' || profile.primaryRole === 'business' || profile.primaryRole === 'creator');
};

const hasCommerceAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return false;
  const roles = (profile.roles || []).map(normalizeAccessText);
  const roleSubtypes = Object.values(profile.roleSubtypes || {}).map(normalizeAccessText);
  if (profile.primaryRole === 'seller' || profile.primaryRole === 'business' || roles.some((role) => ['seller', 'business'].includes(role))) return true;
  if (commerceAccessValues.has(normalizeAccessText(profile.primarySubtype))) return true;
  if (roleSubtypes.some((subtype) => commerceAccessValues.has(subtype))) return true;
  return getBusinessAccounts(profile).some((account) => accountMatchesAny(account as Record<string, unknown>, commerceAccessValues));
};

const hasServiceAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return false;
  const roles = (profile.roles || []).map(normalizeAccessText);
  const roleSubtypes = Object.values(profile.roleSubtypes || {}).map(normalizeAccessText);
  if (profile.primaryRole === 'provider' || profile.primaryRole === 'business' || roles.some((role) => ['provider', 'business'].includes(role))) return true;
  if (serviceAccessValues.has(normalizeAccessText(profile.primarySubtype))) return true;
  if (roleSubtypes.some((subtype) => serviceAccessValues.has(subtype))) return true;
  return getBusinessAccounts(profile).some((account) => accountMatchesAny(account as Record<string, unknown>, serviceAccessValues));
};

const makeFileName = (prefix: string, extension: string) => (
  `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
);

type CameraFacing = 'environment' | 'user';

export default function CreatePostScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useFirebaseAuth();
  const { marketProducts, publishContent } = useAfriMarket();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState('Préparation caméra...');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shouldAssociate, setShouldAssociate] = useState(false);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [category, setCategory] = useState('Partage');
  const [price, setPrice] = useState('');
  const [villagePrice, setVillagePrice] = useState('');
  const [buyersNeeded, setBuyersNeeded] = useState('3');
  const [stock, setStock] = useState('');
  const [location, setLocation] = useState('');
  const [offerModule, setOfferModule] = useState('Services');
  const [textStyle, setTextStyle] = useState(textStyleOptions[0].id);
  const [status, setStatus] = useState('');
  const [publishing, setPublishing] = useState(false);
  const rawIntent = searchParams.get('intent') as CreationIntent | null;
  const intent: CreationIntent = rawIntent && ['media', 'text', 'product', 'offer'].includes(rawIntent) ? rawIntent : 'media';
  const requestedModule = searchParams.get('module') || '';
  const canAddBusiness = hasBusinessAccess(profile);
  const canPublishProduct = hasCommerceAccess(profile);
  const canPublishOffer = hasServiceAccess(profile);
  const ownProducts = useMemo(
    () => marketProducts.filter((product) => product.authorId === user?.uid),
    [marketProducts, user?.uid]
  );
  const isTextIntent = intent === 'text';
  const isProductIntent = intent === 'product';
  const isOfferIntent = intent === 'offer';
  const isMarketIntent = isProductIntent || isOfferIntent;
  const canAssociate = !isMarketIntent && canAddBusiness && ownProducts.length > 0;
  const selectedProduct = ownProducts.find((product) => product.id === linkedProductId);
  const canPublishCurrentIntent = (!isProductIntent || canPublishProduct) && (!isOfferIntent || canPublishOffer);
  const submitLabel = isProductIntent ? 'Publier dans le Marché' : isOfferIntent ? 'Publier l’offre' : isTextIntent ? 'Publier le texte' : 'Publier sur ABC';

  useEffect(() => {
    if (!requestedModule) return;
    if (isOfferIntent) {
      setOfferModule(requestedModule);
      setCategory(requestedModule);
    }
    if (isProductIntent && requestedModule === 'zandofy') {
      setCategory('Zandofy');
    }
    if (isProductIntent && requestedModule === 'market') {
      setCategory('Market');
    }
  }, [isOfferIntent, isProductIntent, requestedModule]);

  const stopCamera = () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async (facing: CameraFacing = cameraFacing, userInitiated = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Caméra indisponible sur ce navigateur. Utilise Galerie ou Mémoire.');
      setCameraReady(false);
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setCameraStatus('La caméra demande une connexion sécurisée. Ouvre l’app en HTTPS ou sur localhost.');
      setCameraReady(false);
      return;
    }

    setCameraStatus(facing === 'user' ? 'Demande accès caméra selfie...' : 'Demande accès caméra arrière...');
    stopCamera();

    const constraintsList: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: facing }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false },
      { video: { facingMode: facing }, audio: false },
      { video: true, audio: false }
    ];

    let lastError: unknown = null;
    for (const constraints of constraintsList) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            const video = videoRef.current;
            if (!video) {
              resolve();
              return;
            }
            if (video.readyState >= 2) {
              resolve();
              return;
            }
            video.onloadedmetadata = () => resolve();
            window.setTimeout(resolve, 900);
          });
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraFacing(facing);
        setCameraReady(true);
        setCameraStatus('');
        return;
      } catch (error) {
        lastError = error;
        console.warn('Tentative caméra AfriSell impossible:', error);
      }
    }

    const errorName = lastError instanceof DOMException ? lastError.name : '';
    if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
      setCameraStatus(
        userInitiated
          ? 'Accès caméra refusé par le navigateur. Autorise la caméra dans les réglages du site puis réessaie.'
          : 'Appuie sur Autoriser caméra pour afficher la demande d’accès du navigateur.'
      );
    } else if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') {
      setCameraStatus('Aucune caméra compatible détectée. Tu peux importer depuis Galerie ou Mémoire.');
    } else {
      setCameraStatus('Caméra indisponible pour le moment. Réessaie ou importe depuis Galerie.');
    }
    setCameraReady(false);
  };

  useEffect(() => {
    void startCamera('environment', false);

    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  // Camera bootstrap only runs once; facing changes are explicit user actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const setFilesForPublish = (files: File[]) => {
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (!mediaFiles.length) {
      setStatus('Choisis une image ou une vidéo compatible.');
      return;
    }
    const hasVideo = mediaFiles.some((file) => file.type.startsWith('video/'));
    if (isMarketIntent && hasVideo) {
      setStatus('Produit et offre utilisent des photos. Choisis une ou plusieurs images.');
      return;
    }
    const normalizedFiles = hasVideo ? [mediaFiles.find((file) => file.type.startsWith('video/')) as File] : mediaFiles.slice(0, 7);
    if (!hasVideo && mediaFiles.length > 7) {
      setStatus('Maximum 7 photos par publication.');
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFiles(normalizedFiles);
    setPreviewUrl(URL.createObjectURL(normalizedFiles[0]));
    setStatus('');
    if (!title.trim()) {
      setTitle(normalizedFiles[0].name.replace(/\.[^.]+$/, '') || 'Nouvelle publication');
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    setFilesForPublish(Array.from(event.target.files ?? []) as File[]);
    event.target.value = '';
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus('Caméra pas encore prête.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFilesForPublish([new File([blob], makeFileName('abc-photo', 'jpg'), { type: 'image/jpeg' })]);
    }, 'image/jpeg', 0.92);
  };

  const toggleRecording = () => {
    const stream = streamRef.current;
    if (!stream) {
      setStatus('Caméra pas encore prête.');
      return;
    }

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }

    if (!('MediaRecorder' in window)) {
      setStatus('Enregistrement vidéo indisponible sur ce navigateur.');
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setFilesForPublish([new File([blob], makeFileName('abc-video', 'webm'), { type: 'video/webm' })]);
      setIsRecording(false);
    };
    recorder.start();
    setIsRecording(true);
  };

  const switchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    void startCamera(nextFacing, true);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFiles([]);
    setStatus('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (publishing) return;
    if (isTextIntent && !description.trim()) {
      setStatus('Écris le contenu du poste texte.');
      return;
    }
    if (!isTextIntent && !selectedFiles.length) {
      setStatus('Ajoute une vidéo ou des photos.');
      return;
    }
    if (isMarketIntent && !selectedFiles.length) {
      setStatus('Ajoute au moins une photo pour publier dans le Marché.');
      return;
    }
    if (isProductIntent && !canPublishProduct) {
      navigate('/profile?panel=business&request=commerce');
      return;
    }
    if (isOfferIntent && !canPublishOffer) {
      navigate('/profile?panel=business&request=services');
      return;
    }
    setPublishing(true);
    setStatus('');
    try {
      await publishContent({
        title: title.trim() || (isTextIntent ? description.trim().slice(0, 48) : title),
        description,
        category: isProductIntent ? category || 'Market' : isOfferIntent ? category || offerModule : 'Partage',
        files: selectedFiles,
        isSellable: isMarketIntent || (shouldAssociate && Boolean(linkedProductId)),
        linkedProductId: shouldAssociate ? linkedProductId : undefined,
        target: isProductIntent ? 'market' : isOfferIntent ? 'offer' : isTextIntent ? 'text' : 'abc',
        price: price ? Number(price) : undefined,
        villagePrice: villagePrice ? Number(villagePrice) : undefined,
        buyersNeeded: buyersNeeded ? Number(buyersNeeded) : undefined,
        stock: stock ? Number(stock) : undefined,
        location,
        offerModule,
        textStyle: isTextIntent ? textStyle : undefined
      });
      navigate(isMarketIntent ? '/market' : '/feed');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="relative h-full overflow-hidden bg-black text-white">
      <video ref={videoRef} muted playsInline autoPlay className={cn('absolute inset-0 h-full w-full object-cover', cameraFacing === 'user' && '-scale-x-100')} />
      {previewUrl && (
        selectedFiles[0]?.type.startsWith('video/') ? (
          <video src={previewUrl} controls playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62),transparent_24%,rgba(0,0,0,0.76))]" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-5">
        <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
          <AfriSellIcon name="close" size={17} />
        </button>
        <div className="flex max-w-[78vw] items-center gap-1.5 overflow-x-auto rounded-full bg-black/42 p-1.5 backdrop-blur-md scrollbar-hide">
          <button type="button" onClick={() => navigate('/create/hub')} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
            <AfriSellIcon name="hub" size={13} className="text-[#15EA3E]" />
            Hub
          </button>
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
            <AfriSellIcon name="app" size={13} className="text-[#15EA3E]" />
            Galerie
          </button>
          <button type="button" onClick={switchCamera} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
            <AfriSellIcon name="camera" size={13} className="text-[#15EA3E]" />
            {cameraFacing === 'environment' ? 'Selfie' : 'Arrière'}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
            <AfriSellIcon name="clip" size={13} className="text-[#15EA3E]" />
            Memoire
          </button>
          {canAddBusiness && (
            <button type="button" onClick={() => navigate('/business?account=commerce')} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
              <AfriSellIcon name="market" size={13} className="text-[#15EA3E]" />
              Produit
            </button>
          )}
        </div>
      </header>

      <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="sr-only" />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={cameraCaptureInputRef} type="file" accept="image/*" capture={cameraFacing} onChange={handleFileSelect} className="hidden" />

      {cameraStatus && (
        <div className="absolute inset-x-6 top-24 z-20 rounded-2xl border border-white/10 bg-black/55 p-3 text-center text-xs font-semibold text-white/68 backdrop-blur-md">
          {cameraStatus}
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" onClick={() => void startCamera(cameraFacing, true)} className="rounded-full bg-[#15EA3E] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black">
              Autoriser caméra
            </button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/70">
              Galerie
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5">
        {!isTextIntent && (
        <div className="mb-4 flex items-end justify-center gap-5">
          <button type="button" onClick={capturePhoto} disabled={!cameraReady} className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-white/12 shadow-[0_0_22px_rgba(0,0,0,0.42)] backdrop-blur-md disabled:opacity-45" aria-label="Capturer photo">
            <span className="h-9 w-9 rounded-full bg-white" />
          </button>
          {!isMarketIntent && (
          <button type="button" onClick={toggleRecording} className={cn('flex h-13 w-13 items-center justify-center rounded-full border border-white/20 backdrop-blur-md', isRecording ? 'bg-red-500 text-white' : 'bg-black/45 text-[#15EA3E]')} aria-label={isRecording ? 'Arrêter vidéo' : 'Enregistrer vidéo'}>
            <AfriSellIcon name={isRecording ? 'close' : 'video'} size={18} />
          </button>
          )}
          <button type="button" onClick={() => cameraCaptureInputRef.current?.click()} className="flex h-13 w-13 items-center justify-center rounded-full border border-white/20 bg-black/45 text-[#15EA3E] backdrop-blur-md" aria-label="Caméra native">
            <AfriSellIcon name="camera" size={18} />
          </button>
        </div>
        )}

        <section className="rounded-[1.45rem] border border-white/10 bg-black/58 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-[#15EA3E]/12 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
              {isProductIntent ? 'Produit' : isOfferIntent ? 'Offre' : isTextIntent ? 'Texte' : 'Média'}
            </span>
            {!canPublishCurrentIntent && (
              <button type="button" onClick={() => navigate(isProductIntent ? '/profile?panel=business&request=commerce' : '/profile?panel=business&request=services')} className="rounded-full bg-amber-300 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                Demander accès
              </button>
            )}
          </div>
          <div className="grid gap-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={isTextIntent ? 'Écris ton poste...' : 'Description'} rows={isTextIntent ? 4 : 2} className="resize-none rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
          </div>

          {isTextIntent && (
            <div className="mt-3">
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Style de publication</p>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {textStyleOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTextStyle(option.id)}
                    className={cn(
                      'h-24 w-24 shrink-0 overflow-hidden rounded-2xl border p-2 text-left active:scale-[0.98]',
                      option.className,
                      textStyle === option.id ? 'border-[#15EA3E] ring-2 ring-[#15EA3E]/28' : 'border-white/10'
                    )}
                  >
                    <span className="block text-[9px] font-black uppercase tracking-wider opacity-70">{option.label}</span>
                    <span className="mt-4 block text-sm font-black leading-tight">Votre texte ici</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMarketIntent && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={isOfferIntent ? 'Catégorie service' : 'Catégorie'} className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
              <select value={offerModule} onChange={(event) => setOfferModule(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-black/50 px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45">
                <option value="Services">Services</option>
                <option value="Restauration">Restauration</option>
                <option value="Event">Event</option>
                <option value="Immobilier">Immobilier</option>
                <option value="Safari">Safari</option>
                <option value="A-Freelance">A-Freelance</option>
                <option value="AfriSchool">AfriSchool</option>
                <option value="AfriMed">AfriMed</option>
              </select>
              <input value={price} onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Prix" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
              <input value={villagePrice} onChange={(event) => setVillagePrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Prix Village" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
              <input value={stock} onChange={(event) => setStock(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={isOfferIntent ? 'Places / capacité' : 'Stock'} className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
              <input value={buyersNeeded} onChange={(event) => setBuyersNeeded(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Acheteurs Prix Village" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ville, pays ou zone" className="col-span-2 h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/62">
              {isTextIntent ? 'Texte uniquement' : selectedFiles.length ? `${selectedFiles.length} média` : cameraReady ? 'Caméra active' : 'Galerie disponible'}
            </span>
            {selectedFiles.length > 0 && (
              <button type="button" onClick={clearSelection} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/70">
                Reprendre
              </button>
            )}
            {canAssociate && (
              <label className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/70">
                <input type="checkbox" checked={shouldAssociate} onChange={(event) => setShouldAssociate(event.target.checked)} className="h-3 w-3 accent-[#15EA3E]" />
                Associer à un produit ou offre ?
              </label>
            )}
            {canAddBusiness && (
              <button type="button" onClick={() => navigate('/freelance/publier-service')} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/70">
                Service
              </button>
            )}
          </div>

          {canAssociate && shouldAssociate && (
            <select value={linkedProductId} onChange={(event) => setLinkedProductId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45">
              <option value="">Sélectionner un produit ou une offre</option>
              {ownProducts.map((product: AfriMarketContent) => (
                <option key={product.id} value={product.id}>
                  {product.target === 'offer' ? 'Offre' : 'Produit'} - {product.title} - {formatMarketPrice(product.villagePrice || product.price, product.currency)}
                </option>
              ))}
            </select>
          )}

          {selectedProduct && (
            <p className="mt-2 truncate text-[10px] font-black text-[#15EA3E]">
              Associe: {selectedProduct.title}
            </p>
          )}

          {status && <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold text-red-100">{status}</p>}

          <button type="submit" disabled={publishing || !canPublishCurrentIntent || (!isTextIntent && !selectedFiles.length)} className="mt-3 h-11 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:bg-white/10 disabled:text-white/35">
            {publishing ? 'Publication...' : submitLabel}
          </button>
        </section>
      </form>
    </main>
  );
}
