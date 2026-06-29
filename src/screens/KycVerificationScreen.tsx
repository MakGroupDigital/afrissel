import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import {
  AFRICAN_COUNTRIES_BY_PRIORITY,
  buildInternationalPhone,
  fetchCitiesForCountry,
  getCountryByCode,
  getCountryByName,
  getDefaultCountry,
  getDeviceCityHint,
  getDeviceCountryCode,
  getLocalPhoneFromInternational
} from '../lib/africaLocation';
import { isCloudinaryReady, uploadMediaToCloudinary } from '../lib/cloudinary';
import { realtimeDb } from '../lib/firebase';

type KycFileKey = 'front' | 'back' | 'selfie';
type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
  detect: (source: CanvasImageSource) => Promise<Array<unknown>>;
};
type WindowWithFaceDetector = Window & { FaceDetector?: FaceDetectorConstructor };

const MAX_UPLOAD_BYTES = 9_800_000;

const documentTypes = [
  { id: 'national_id', label: 'Carte nationale ID' },
  { id: 'passport', label: 'Passeport' },
  { id: 'driver_license', label: 'Permis de conduire' },
  { id: 'voter_card', label: 'Carte electeur' }
];

const hashPin = async (pin: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const settingsKey = (uid?: string) => `afrissel:settings:${uid || 'guest'}`;
const credentialKey = (uid?: string) => `afrissel:wallet-biometric:${uid || 'guest'}`;

const arrayBufferToBase64Url = (buffer: ArrayBuffer) => {
  const binary = String.fromCharCode(...Array.from(new Uint8Array(buffer)));
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const imageToCompressedFile = async (file: File, targetBytes = MAX_UPLOAD_BYTES): Promise<File> => {
  if (!file.type.startsWith('image/') || file.size <= targetBytes) return file;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    img.src = url;
  });

  let maxSide = Math.min(1800, Math.max(image.width, image.height));
  let quality = 0.82;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) break;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= targetBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }
    maxSide *= 0.78;
    quality = Math.max(0.55, quality - 0.08);
  }

  throw new Error('Fichier trop lourd. Choisis une image plus légère ou recadre-la.');
};

export default function KycVerificationScreen() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useFirebaseAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialCountry = getCountryByCode(profile?.countryCode) || getCountryByName(profile?.country) || getDefaultCountry();
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [countryCode, setCountryCode] = useState(initialCountry.code);
  const [phoneLocal, setPhoneLocal] = useState(profile?.phoneLocal || getLocalPhoneFromInternational(profile?.phone || '', initialCountry.dialCode));
  const [cityOptions, setCityOptions] = useState(initialCountry.fallbackCities);
  const [cityChoice, setCityChoice] = useState(profile?.city || initialCountry.fallbackCities[0] || '');
  const [customCity, setCustomCity] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const [address, setAddress] = useState('');
  const [documentType, setDocumentType] = useState(documentTypes[0].id);
  const [documentNumber, setDocumentNumber] = useState('');
  const [files, setFiles] = useState<Partial<Record<KycFileKey, File>>>({});
  const [pin, setPin] = useState('');
  const [biometricWanted, setBiometricWanted] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState('');
  const [caméraStatus, setCameraStatus] = useState('');
  const [faceStatus, setFaceStatus] = useState('Selfie requis: visage visible, sans lunettes, masque, casquette ou reflet.');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedCountry = getCountryByCode(countryCode) || getDefaultCountry();
  const selectedCity = cityChoice === 'other' ? customCity.trim() : cityChoice.trim();
  const phone = buildInternationalPhone(selectedCountry.dialCode, phoneLocal);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (profile?.kycStatus === 'pending' || profile?.kycStatus === 'verified') {
      navigate('/wallet', { replace: true });
    }
  }, [navigate, profile?.kycStatus]);

  useEffect(() => {
    const country = getCountryByCode(countryCode) || getDefaultCountry();
    setCityOptions(country.fallbackCities);
    setLocationStatus('');
    if (!profile?.city) {
      setCityChoice(country.fallbackCities[0] || '');
      setCustomCity('');
    }

    let active = true;
    void fetchCitiesForCountry(country)
      .then((cities) => {
        if (!active || !cities.length) return;
        setCityOptions(cities);
        setCityChoice((current) => {
          if (current === 'other' || cities.includes(current)) return current;
          return cities[0] || current;
        });
      })
      .catch(() => {
        if (active) setLocationStatus('Villes chargées depuis la liste locale AfriSell.');
      });

    return () => {
      active = false;
    };
  }, [countryCode, profile?.city]);

  useEffect(() => {
    if (profile?.country || profile?.countryCode || profile?.city) return;
    const deviceCountryCode = getDeviceCountryCode();
    const deviceCountry = getCountryByCode(deviceCountryCode) || getDefaultCountry();
    const deviceCity = getDeviceCityHint();

    setCountryCode(deviceCountry.code);
    if (deviceCity) {
      const knownCity = deviceCountry.fallbackCities.find((city) => city.toLowerCase() === deviceCity.toLowerCase());
      if (knownCity) {
        setCityChoice(knownCity);
      } else {
        setCityChoice('other');
        setCustomCity(deviceCity);
      }
      setLocationStatus(`Ville détectée par le navigateur: ${deviceCity}.`);
    } else {
      setLocationStatus('Ville non détectée automatiquement. Choisis ta ville dans la liste.');
    }
  }, [profile?.city, profile?.country, profile?.countryCode]);

  useEffect(() => {
    if (!profile) return;
    const nextCountry = getCountryByCode(profile.countryCode) || getCountryByName(profile.country) || selectedCountry;
    setCountryCode(nextCountry.code);
    setPhoneLocal(profile.phoneLocal || getLocalPhoneFromInternational(profile.phone || '', nextCountry.dialCode));
    if (profile.city) {
      if (nextCountry.fallbackCities.includes(profile.city)) {
        setCityChoice(profile.city);
        setCustomCity('');
      } else {
        setCityChoice('other');
        setCustomCity(profile.city);
      }
    }
  // Profile sync must run only when Firebase profile changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.country, profile?.countryCode, profile?.phone, profile?.phoneLocal, profile?.city]);

  const selectCountry = (nextCode: string) => {
    const nextCountry = getCountryByCode(nextCode) || getDefaultCountry();
    setCountryCode(nextCountry.code);
    setCityOptions(nextCountry.fallbackCities);
    setCityChoice(nextCountry.fallbackCities[0] || '');
    setCustomCity('');
    setLocationStatus('Indicatif téléphone mis à jour automatiquement.');
  };

  const updateFile = async (key: KycFileKey, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus('Compression du fichier...');
    try {
      const compressed = await imageToCompressedFile(file);
      setFiles((current) => ({ ...current, [key]: compressed }));
      setStatus(compressed.size < file.size ? 'Image compressee pour respecter la limite Cloudinary.' : '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Fichier impossible à préparer.');
    }
  };

  const startSelfieCaméra = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Caméra indisponible sur ce navigateur.');
      return;
    }

    setCameraStatus('Ouverture caméra...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus('Caméra active.');
      setFaceStatus('Regarde la caméra. Retire lunettes, masque, casquette ou tout accessoire qui cache le visage.');

      const FaceDetector = (window as WindowWithFaceDetector).FaceDetector;
      if (FaceDetector && videoRef.current) {
        const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        window.setTimeout(() => {
          const video = videoRef.current;
          if (!video) return;
          void detector.detect(video).then((faces) => {
            setFaceStatus(faces.length ? 'Visage détecté. Assure-toi que le visage est nu et bien éclairé.' : 'Aucun visage détecté. Centre ton visage dans le cadre.');
          }).catch(() => undefined);
        }, 1200);
      }
    } catch {
      setCameraStatus('Autorise la caméra pour capturer ton selfie.');
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setStatus('Caméra pas encore prête.');
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) return;
    const selfie = await imageToCompressedFile(new File([blob], 'selfie-kyc.jpg', { type: 'image/jpeg' }));
    setFiles((current) => ({ ...current, selfie }));
    setStatus('Selfie capture.');
  };

  const enableBiometric = async () => {
    if (!user) return;
    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      setStatus('Biométrie indisponible sur cet appareil.');
      return;
    }
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'AfriSell' },
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email || user.uid,
            displayName: displayName || user.displayName || 'AfriSell'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none'
        }
      }) as PublicKeyCredential | null;
      if (!credential?.rawId) throw new Error('Biométrie non activée.');
      const id = arrayBufferToBase64Url(credential.rawId);
      window.localStorage.setItem(credentialKey(user.uid), id);
      setBiometricCredentialId(id);
      setBiometricWanted(true);
      setStatus('Biométrie activée.');
    } catch {
      setStatus('Activation biométrie annulée ou indisponible.');
    }
  };

  const submitKyc = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!displayName.trim() || !phone.trim() || !selectedCountry.name.trim() || !selectedCity || !address.trim()) {
      setStatus('Complète nom, téléphone, pays, ville et adresse complète.');
      return;
    }
    if (!documentNumber.trim()) {
      setStatus('Entre le numéro de ta pièce.');
      return;
    }
    if (!files.front || !files.selfie) {
      setStatus('Ajoute au minimum le recto de la pièce et le selfie de vérification.');
      return;
    }
    if (pin.length < 4) {
      setStatus('Définis un PIN AfriSpay de 4 chiffres minimum.');
      return;
    }

    setBusy(true);
    setStatus('Preparation KYC...');
    try {
      const requestRef = push(ref(realtimeDb, `kycRequests/${user.uid}`));
      const uploadedFiles: Record<string, unknown> = {};

      if (isCloudinaryReady()) {
        const entries = Object.entries(files) as Array<[KycFileKey, File]>;
        for (const [key, file] of entries) {
          const safeFile = await imageToCompressedFile(file);
          const upload = await uploadMediaToCloudinary(safeFile, user.uid);
          uploadedFiles[key] = {
            url: upload.secureUrl || upload.mediaUrl,
            publicId: upload.publicId,
            resourceType: upload.resourceType,
            fileName: safeFile.name,
            bytes: safeFile.size
          };
        }
      } else {
        (Object.entries(files) as Array<[KycFileKey, File | undefined]>).forEach(([key, file]) => {
          uploadedFiles[key] = { fileName: file?.name, bytes: file?.size, pendingUpload: true };
        });
      }

      const pinHash = await hashPin(pin);
      const savedSettings = window.localStorage.getItem(settingsKey(user.uid));
      const parsedSettings = savedSettings ? JSON.parse(savedSettings) as Record<string, unknown> : {};
      const nextSettings = {
        ...parsedSettings,
        account: {
          ...((parsedSettings.account as Record<string, unknown> | undefined) || {}),
          pinEnabled: true,
          pinHash,
          biometricEnabled: biometricWanted,
          biometricCredentialId: biometricCredentialId || undefined
        }
      };
      window.localStorage.setItem(settingsKey(user.uid), JSON.stringify(nextSettings));

      await update(ref(realtimeDb), {
        [`kycRequests/${user.uid}/${requestRef.key}`]: {
          id: requestRef.key,
          userId: user.uid,
          displayName: displayName.trim(),
          email: profile?.email || user.email || '',
          phone: phone.trim(),
          phoneLocal: phoneLocal.trim(),
          dialCode: selectedCountry.dialCode,
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          city: selectedCity,
          address: address.trim(),
          documentType,
          documentNumber: documentNumber.trim(),
          files: uploadedFiles,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        },
        [`users/${user.uid}/displayName`]: displayName.trim(),
        [`users/${user.uid}/phone`]: phone.trim(),
        [`users/${user.uid}/phoneLocal`]: phoneLocal.trim(),
        [`users/${user.uid}/dialCode`]: selectedCountry.dialCode,
        [`users/${user.uid}/country`]: selectedCountry.name,
        [`users/${user.uid}/countryCode`]: selectedCountry.code,
        [`users/${user.uid}/city`]: selectedCity,
        [`users/${user.uid}/address`]: address.trim(),
        [`users/${user.uid}/kycStatus`]: 'pending',
        [`users/${user.uid}/kycSubmittedAt`]: serverTimestamp(),
        [`userSettings/${user.uid}/account/pinEnabled`]: true,
        [`userSettings/${user.uid}/account/pinHash`]: pinHash,
        [`userSettings/${user.uid}/account/biometricEnabled`]: biometricWanted,
        [`userSettings/${user.uid}/account/biometricCredentialId`]: biometricCredentialId || '',
        [`userSettings/${user.uid}/updatedAt`]: serverTimestamp()
      });

      await refreshProfile();
      setStatus('Vérification envoyée. Ce KYC servira pour tous les modules AfriSell qui exigent une vérification.');
      window.setTimeout(() => navigate('/wallet'), 1400);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Envoi vérification impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full bg-black px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/wallet" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriSell ID</p>
          <h1 className="text-sm font-black">Vérification KYC</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]">
          <AfriSellIcon name="shield" size={18} />
        </div>
      </header>

      <section className="mt-6 rounded-[2rem] border border-[#15EA3E]/20 bg-[#071007] p-5">
        <h2 className="text-xl font-black leading-tight">Complète ton identité une seule fois</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/52">
          Ce KYC active AfriSpay et tous les modules AfriSell qui demandent une vérification.
        </p>
      </section>

      <form onSubmit={submitKyc} className="mt-5 space-y-4">
        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Informations personnelles</p>
          <div className="mt-3 grid gap-2">
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nom d'utilisateur" className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            <select value={countryCode} onChange={(event) => selectCountry(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50">
              {AFRICAN_COUNTRIES_BY_PRIORITY.map((item) => (
                <option key={item.code} value={item.code}>{item.name} ({item.dialCode})</option>
              ))}
            </select>
            <div className="grid grid-cols-[5.25rem_1fr] gap-2">
              <div className="flex h-12 items-center justify-center rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-sm font-black text-[#15EA3E]">
                {selectedCountry.dialCode}
              </div>
              <input value={phoneLocal} onChange={(event) => setPhoneLocal(event.target.value.replace(/[^\d\s]/g, ''))} inputMode="tel" placeholder="Numéro de téléphone" className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={cityChoice} onChange={(event) => setCityChoice(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50">
                {cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                <option value="other">Autre ville</option>
              </select>
              {cityChoice === 'other' && (
                <input value={customCity} onChange={(event) => setCustomCity(event.target.value)} placeholder="Écrire la ville" className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
              )}
            </div>
            {locationStatus && <p className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-[10px] font-semibold leading-relaxed text-white/45">{locationStatus}</p>}
            {phone && <p className="px-1 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]/80">Numéro final: {phone}</p>}
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} placeholder="Adresse complète" className="resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Pièce ID</p>
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50">
            {documentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Numéro de la pièce" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
          <div className="mt-3 grid gap-2">
            {[
              { key: 'front' as const, label: 'Recto pièce ID' },
              { key: 'back' as const, label: 'Verso pièce ID' }
            ].map((item) => (
              <label key={item.key} className="flex h-12 cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-black px-4">
                <span className="truncate text-xs font-black text-white/70">{files[item.key]?.name || item.label}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Choisir</span>
                <input type="file" accept="image/*" onChange={(event) => void updateFile(item.key, event)} className="hidden" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Selfie vérification</p>
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/50">{faceStatus}</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} muted playsInline className="h-52 w-full -scale-x-100 object-cover" />
          </div>
          <p className="mt-2 text-[10px] font-semibold text-white/42">{caméraStatus}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void startSelfieCaméra()} className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-[10px] font-black uppercase tracking-wider text-white/70">Caméra</button>
            <button type="button" onClick={() => void captureSelfie()} className="rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black">Capturer</button>
          </div>
          {files.selfie && <p className="mt-3 text-[10px] font-black text-[#15EA3E]">Selfie prêt: {files.selfie.name}</p>}
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Sécurité AfriSpay</p>
          <input value={pin} onChange={(event) => setPin(event.target.value.replace(/[^\d]/g, '').slice(0, 8))} type="password" inputMode="numeric" placeholder="Définir PIN AfriSpay" className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
          <button type="button" onClick={() => void enableBiometric()} className="mt-3 w-full rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 py-3 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
            {biometricWanted ? 'Biométrie activée' : 'Activer acces biométrie'}
          </button>
        </section>

        {status && <p className="rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-2 text-center text-[10px] font-semibold leading-relaxed text-[#15EA3E]">{status}</p>}

        <button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:bg-gray-800 disabled:text-gray-500">
          {busy ? 'Envoi...' : 'Envoyer pour vérification'}
        </button>
      </form>
    </main>
  );
}
