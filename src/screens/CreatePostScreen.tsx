import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AfriMarketContent, formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { cn } from '../lib/utils';

const hasBusinessAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return false;
  const accounts = [
    profile.businessAccount,
    ...Object.values(profile.businessAccounts || {})
  ].filter(Boolean);

  return Boolean(accounts.length || profile.primaryRole === 'seller' || profile.primaryRole === 'provider' || profile.primaryRole === 'business' || profile.primaryRole === 'creator');
};

const makeFileName = (prefix: string, extension: string) => (
  `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
);

type CameraFacing = 'environment' | 'user';

export default function CreatePostScreen() {
  const navigate = useNavigate();
  const { user, profile } = useFirebaseAuth();
  const { marketProducts, publishContent } = useAfriMarket();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState('Ouverture caméra...');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shouldAssociate, setShouldAssociate] = useState(false);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [status, setStatus] = useState('');
  const [publishing, setPublishing] = useState(false);
  const canAddBusiness = hasBusinessAccess(profile);
  const ownProducts = useMemo(
    () => marketProducts.filter((product) => product.authorId === user?.uid),
    [marketProducts, user?.uid]
  );
  const canAssociate = canAddBusiness && ownProducts.length > 0;
  const selectedProduct = ownProducts.find((product) => product.id === linkedProductId);

  const stopCamera = () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async (facing: CameraFacing = cameraFacing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Caméra indisponible sur ce navigateur. Utilise Galerie ou Mémoire.');
      setCameraReady(false);
      return;
    }

    setCameraStatus(facing === 'user' ? 'Ouverture caméra selfie...' : 'Ouverture caméra arrière...');
    stopCamera();

    const constraintsList: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: facing }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: true },
      { video: { facingMode: facing }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false }
    ];

    for (const constraints of constraintsList) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraFacing(facing);
        setCameraReady(true);
        setCameraStatus('');
        return;
      } catch (error) {
        console.warn('Tentative caméra AfriSell impossible:', error);
      }
    }

    setCameraStatus('Caméra refusée ou indisponible. Tu peux importer depuis Galerie ou Mémoire.');
    setCameraReady(false);
  };

  useEffect(() => {
    void startCamera('environment');

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
    const normalizedFiles = hasVideo ? [mediaFiles.find((file) => file.type.startsWith('video/')) as File] : mediaFiles.slice(0, 8);
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
    void startCamera(nextFacing);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFiles([]);
    setStatus('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFiles.length || publishing) return;
    setPublishing(true);
    setStatus('');
    try {
      await publishContent({
        title,
        description,
        category: 'Partage',
        files: selectedFiles,
        isSellable: shouldAssociate && Boolean(linkedProductId),
        linkedProductId: shouldAssociate ? linkedProductId : undefined
      });
      navigate('/feed');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="relative h-full overflow-hidden bg-black text-white">
      <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
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
            <button type="button" onClick={() => void startCamera(cameraFacing)} className="rounded-full bg-[#15EA3E] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black">
              Réessayer
            </button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/70">
              Galerie
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5">
        <div className="mb-4 flex items-end justify-center gap-5">
          <button type="button" onClick={capturePhoto} disabled={!cameraReady} className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-white/12 shadow-[0_0_22px_rgba(0,0,0,0.42)] backdrop-blur-md disabled:opacity-45" aria-label="Capturer photo">
            <span className="h-9 w-9 rounded-full bg-white" />
          </button>
          <button type="button" onClick={toggleRecording} className={cn('flex h-13 w-13 items-center justify-center rounded-full border border-white/20 backdrop-blur-md', isRecording ? 'bg-red-500 text-white' : 'bg-black/45 text-[#15EA3E]')} aria-label={isRecording ? 'Arrêter vidéo' : 'Enregistrer vidéo'}>
            <AfriSellIcon name={isRecording ? 'close' : 'video'} size={18} />
          </button>
          <button type="button" onClick={() => cameraCaptureInputRef.current?.click()} className="flex h-13 w-13 items-center justify-center rounded-full border border-white/20 bg-black/45 text-[#15EA3E] backdrop-blur-md" aria-label="Caméra native">
            <AfriSellIcon name="camera" size={18} />
          </button>
        </div>

        <section className="rounded-[1.45rem] border border-white/10 bg-black/58 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="grid gap-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" rows={2} className="resize-none rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/62">
              {selectedFiles.length ? `${selectedFiles.length} média` : cameraReady ? 'Caméra active' : 'Galerie disponible'}
            </span>
            {selectedFiles.length > 0 && (
              <button type="button" onClick={clearSelection} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/70">
                Reprendre
              </button>
            )}
            {canAssociate && (
              <label className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/70">
                <input type="checkbox" checked={shouldAssociate} onChange={(event) => setShouldAssociate(event.target.checked)} className="h-3 w-3 accent-[#15EA3E]" />
                Associer
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
              <option value="">Choisir produit/service</option>
              {ownProducts.map((product: AfriMarketContent) => (
                <option key={product.id} value={product.id}>
                  {product.title} - {formatMarketPrice(product.villagePrice || product.price, product.currency)}
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

          <button type="submit" disabled={publishing || !selectedFiles.length} className="mt-3 h-11 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:bg-white/10 disabled:text-white/35">
            {publishing ? 'Publication...' : 'Publier sur ABC'}
          </button>
        </section>
      </form>
    </main>
  );
}
