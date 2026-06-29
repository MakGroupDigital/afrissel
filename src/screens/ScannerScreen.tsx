import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';

export default function ScannerScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'blocked'>('starting');
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function startCaméra() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('blocked');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch {
        setStatus('blocked');
      }
    }

    startCaméra();

    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleManualScan = () => {
    const code = manualCode.trim();
    if (!code) return;
    setResult(`Code détecté: ${code}`);
  };

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-80" playsInline muted />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),transparent_30%,transparent_68%,rgba(0,0,0,0.86))]" />

      <header className="relative z-10 flex items-center justify-between px-4 pt-4">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/45 text-white backdrop-blur">
          <AfriSellIcon name="arrow" size={20} className="rotate-180" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Scanner</p>
          <h1 className="text-sm font-black">AfriSell Pay</h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/45 text-white/80 backdrop-blur">
          <AfriSellIcon name="flash" size={18} />
        </button>
      </header>

      <section className="relative z-10 flex h-[440px] items-center justify-center px-8">
        <div className="relative h-64 w-64 rounded-[2rem] border-2 border-[#15EA3E] shadow-[0_0_45px_rgba(21,234,62,0.18)]">
          <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.9)]" />
          <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[2rem] border-l-4 border-t-4 border-white" />
          <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[2rem] border-r-4 border-t-4 border-white" />
          <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[2rem] border-b-4 border-l-4 border-white" />
          <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[2rem] border-b-4 border-r-4 border-white" />
          <AfriSellIcon name="scan" size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30" />
        </div>
      </section>

      <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-[2rem] border-t border-white/10 bg-[#050705]/95 p-5 pb-8 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E]/12 text-[#15EA3E]">
            <AfriSellIcon name="scan" size={19} />
          </div>
          <div>
            <p className="text-sm font-black">
              {status === 'ready' ? 'Caméra active' : status === 'starting' ? 'Ouverture caméra...' : 'Caméra indisponible'}
            </p>
            <p className="text-[11px] font-semibold text-white/45">Scanne un QR paiement ou entre le code.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3">
            <AfriSellIcon name="keyboard" size={16} className="text-white/35" />
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Code marchand"
              className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/28"
            />
          </label>
          <button onClick={handleManualScan} className="h-12 rounded-2xl bg-[#15EA3E] px-4 text-xs font-black uppercase tracking-[0.12em] text-black">
            OK
          </button>
        </div>

        {result && <p className="mt-3 text-center text-xs font-bold text-[#15EA3E]">{result}</p>}
      </section>
    </main>
  );
}
