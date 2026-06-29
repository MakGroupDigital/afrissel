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
  const [cameraStatus, setCameraStatus] = useState('Ouverture camera...');
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

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('Camera indisponible sur ce navigateur.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: true
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('');
      } catch (error) {
        console.error('Camera AfriSell indisponible:', error);
        setCameraStatus('Autorise la camera pour publier directement.');
      }
    };

    void startCamera();

    return () => {
      mounted = false;
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const setFilesForPublish = (files: File[]) => {
    if (!files.length) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFiles(files);
    setPreviewUrl(URL.createObjectURL(files[0]));
    setStatus('');
    if (!title.trim()) {
      setTitle(files[0].name.replace(/\.[^.]+$/, '') || 'Nouvelle publication');
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    setFilesForPublish(Array.from(event.target.files ?? []) as File[]);
    event.target.value = '';
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus('Camera pas encore prete.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFilesForPublish([new File([blob], makeFileName('abc-photo', 'jpg'), { type: 'image/jpeg' })]);
    }, 'image/jpeg', 0.92);
  };

  const toggleRecording = () => {
    const stream = streamRef.current;
    if (!stream) {
      setStatus('Camera pas encore prete.');
      return;
    }

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }

    if (!('MediaRecorder' in window)) {
      setStatus('Enregistrement video indisponible sur ce navigateur.');
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
      <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
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
        <div className="flex items-center gap-1.5 rounded-full bg-black/42 p-1.5 backdrop-blur-md">
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black text-white">
            <AfriSellIcon name="app" size={13} className="text-[#15EA3E]" />
            Galerie
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

      <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />

      {cameraStatus && (
        <div className="absolute inset-x-6 top-24 z-20 rounded-2xl border border-white/10 bg-black/55 p-3 text-center text-xs font-semibold text-white/68 backdrop-blur-md">
          {cameraStatus}
        </div>
      )}

      <form onSubmit={submit} className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5">
        <div className="mb-4 flex items-end justify-center gap-5">
          <button type="button" onClick={capturePhoto} className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-white/12 shadow-[0_0_22px_rgba(0,0,0,0.42)] backdrop-blur-md" aria-label="Capturer photo">
            <span className="h-9 w-9 rounded-full bg-white" />
          </button>
          <button type="button" onClick={toggleRecording} className={cn('flex h-13 w-13 items-center justify-center rounded-full border border-white/20 backdrop-blur-md', isRecording ? 'bg-red-500 text-white' : 'bg-black/45 text-[#15EA3E]')} aria-label={isRecording ? 'Arreter video' : 'Enregistrer video'}>
            <AfriSellIcon name={isRecording ? 'close' : 'video'} size={18} />
          </button>
        </div>

        <section className="rounded-[1.45rem] border border-white/10 bg-black/58 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="grid gap-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" rows={2} className="resize-none rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[9px] font-black text-white/62">
              {selectedFiles.length ? `${selectedFiles.length} media` : 'Camera active'}
            </span>
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
