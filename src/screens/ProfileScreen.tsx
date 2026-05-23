import { ChangeEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { uploadMediaToCloudinary, isCloudinaryReady } from '../lib/cloudinary';
import { saveAfriSellMediaRecord, updateAfriSellUserPhoto, useFirebaseAuth } from '../hooks/useFirebaseAuth';

type ProfileAction = {
  title: string;
  description: string;
  icon: AfriSellIconName;
  action?: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useFirebaseAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const handleLogout = async () => {
    window.localStorage.setItem('afrissel:lastLogout', new Date().toISOString());
    await logout();
    navigate('/login');
  };

  const handleProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    setBusy(true);
    setStatus('Upload Cloudinary en cours...');

    try {
      const upload = await uploadMediaToCloudinary(file, user.uid);
      await saveAfriSellMediaRecord(user, upload, file);

      if (upload.resourceType === 'image') {
        await updateAfriSellUserPhoto(user, upload.secureUrl);
        await refreshProfile();
        setStatus('Photo de profil mise a jour dans Cloudinary et Firestore.');
      } else {
        setStatus('Video enregistree dans Cloudinary et Firestore.');
      }
    } catch (error) {
      console.error('Upload profil AfriSell impossible:', error);
      setStatus(error instanceof Error ? error.message : 'Upload impossible.');
    } finally {
      setBusy(false);
    }
  };

  const displayName = profile?.displayName || user?.displayName || 'Utilisateur AfriSell';
  const email = profile?.email || user?.email || 'Compte Firebase';
  const photoURL = profile?.photoURL || user?.photoURL || '/afrissel-icon.jpeg';

  const actions: ProfileAction[] = [
    {
      title: 'Profil',
      description: 'Identite, photo, telephone et adresse.',
      icon: 'profile',
    },
    {
      title: 'Gerer le compte',
      description: 'Securite, code PIN, appareils et preferences.',
      icon: 'account',
    },
    {
      title: 'Gerer l app',
      description: 'Langue, cache, mode leger et donnees hors ligne.',
      icon: 'app',
    },
    {
      title: 'Notifications',
      description: 'Commandes, messages, paiements et alertes.',
      icon: 'notifications',
    },
    {
      title: 'Confidentialite',
      description: 'Autorisations, camera, contacts et donnees.',
      icon: 'shield',
    },
    {
      title: 'Deconnexion',
      description: 'Fermer la session sur cet appareil.',
      icon: 'logout',
      action: () => void handleLogout(),
      danger: true,
    },
  ];

  return (
    <div className="min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Profil</p>
        <div className="h-10 w-10" />
      </header>

      <section className="mt-6 flex flex-col items-center text-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-[2rem] border border-[#15EA3E]/25 bg-black">
          <img src={photoURL} alt="Profil AfriSell" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-normal">{displayName}</h1>
        <p className="mt-1 text-xs font-semibold text-white/45">{email}</p>
        <div className="mt-4 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">
          Firebase connecte
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/8 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <AfriSellIcon name="profile" size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">Medias Cloudinary</h2>
            <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-white/48">
              Images et videos sont stockees sur Cloudinary puis referencees dans Firestore.
            </p>
          </div>
        </div>

        {!isCloudinaryReady() && (
          <p className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-[10px] font-bold leading-relaxed text-yellow-100">
            Configure VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET pour activer l upload.
          </p>
        )}

        <label className={`mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl text-xs font-black uppercase tracking-[0.13em] active:scale-[0.98] ${
          busy || !isCloudinaryReady()
            ? 'bg-white/8 text-white/35'
            : 'bg-[#15EA3E] text-black'
        }`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AfriSellIcon name="profile" size={16} />}
          Uploader photo/video
          <input
            type="file"
            accept="image/*,video/*"
            disabled={busy || !isCloudinaryReady()}
            onChange={handleProfilePhoto}
            className="hidden"
          />
        </label>

        {status && (
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-white/62">{status}</p>
        )}
      </section>

      <section className="mt-7 flex flex-col gap-2.5">
        {actions.map((item) => (
          <button
            key={item.title}
            onClick={item.action}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] ${
              item.danger
                ? 'border-red-500/20 bg-red-500/10 text-red-100'
                : 'border-white/10 bg-white/[0.04] text-white'
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              item.danger ? 'bg-red-500/10 text-red-200' : 'bg-[#15EA3E]/10 text-[#15EA3E]'
            }`}>
              <AfriSellIcon name={item.icon} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black">{item.title}</h2>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-white/42">{item.description}</p>
            </div>
            <AfriSellIcon name="arrow" size={15} className={item.danger ? 'text-red-200/60' : 'text-white/25'} />
          </button>
        ))}
      </section>
    </div>
  );
}
