import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Icon from '../icons/Icon';

interface QrScannerModalProps {
    onDetected: (text: string) => void;
    onClose: () => void;
}

/**
 * Live camera QR scanner, used by the Asset Tag & QR Lookup page.
 *
 * Before this, the lookup page's "Scan a QR code with your device camera" line was
 * aspirational — there was no actual scanning in the app itself. A printed asset label's QR
 * code encodes a full URL (lib/qr.ts's assetLookupUrl: .../#lookup/<tag>), so scanning it with
 * a phone's own native camera app happened to work by opening that link in the browser — but
 * there was no way to scan from *inside* the app (useful on a laptop with a webcam, or when the
 * phone's camera app isn't the one in hand), and nothing on this page actually read a QR code
 * via getUserMedia.
 *
 * This component opens the device camera, continuously decodes frames with jsQR, and reports
 * the first successfully decoded string back to the caller — which can be either a bare asset
 * tag/serial number, or a full lookup URL (the caller is responsible for pulling the tag out of
 * either shape; see parseScannedValue in AssetLookup.tsx).
 *
 * It also supports a USB/Bluetooth handheld barcode/QR scanner — the kind most PCs and laptops
 * actually have, instead of (or in addition to) a webcam. Those devices don't involve
 * getUserMedia at all: to the browser they're indistinguishable from a keyboard that "types"
 * the decoded text extremely fast and then presses Enter (the standard "keyboard wedge" mode
 * almost every such scanner ships in). So rather than anything camera-related, support for them
 * is just a text input that stays focused and submits on Enter — it works identically whether
 * or not the camera succeeded, which is why it's always rendered below, not only in the error
 * state.
 */
const QrScannerModal: React.FC<QrScannerModalProps> = ({ onDetected, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const detectedRef = useRef(false);
    const hwInputRef = useRef<HTMLInputElement>(null);
    const stopCameraRef = useRef<() => void>(() => { });

    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(true);
    const [hwValue, setHwValue] = useState('');

    useEffect(() => {
        let cancelled = false;

        const stop = () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
        stopCameraRef.current = stop;

        const tick = () => {
            if (cancelled || detectedRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                    if (result && result.data) {
                        detectedRef.current = true;
                        stop();
                        onDetected(result.data);
                        return;
                    }
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        (async () => {
            try {
                // Prefer the rear camera on phones/tablets, which is what you'd actually point at a
                // printed asset label; browsers that only have one camera (laptops) ignore this hint.
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setStarting(false);
                rafRef.current = requestAnimationFrame(tick);
            } catch (err: any) {
                if (cancelled) return;
                setStarting(false);
                if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                    setError('Camera access was denied. Allow camera permission for this site and try again, or type the tag in manually.');
                } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                    setError('No camera was found on this device. Type the tag or serial number in manually instead.');
                } else {
                    setError(err?.message || 'Could not start the camera. Type the tag in manually instead.');
                }
            }
        })();

        return () => {
            cancelled = true;
            stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the hardware-scanner field focused so a scan "types" into it no matter what — on open,
    // and again any time it loses focus (e.g. the admin clicked elsewhere in the modal first).
    useEffect(() => {
        hwInputRef.current?.focus();
    }, []);

    const submitHwScan = () => {
        const value = hwValue.trim();
        if (!value || detectedRef.current) return;
        detectedRef.current = true;
        stopCameraRef.current();
        onDetected(value);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">Scan Asset QR Code</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {error ? (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                            <Icon name="alert" className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-square">
                            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                            {/* Scan frame overlay */}
                            <div className="pointer-events-none absolute inset-6 border-2 border-white/70 rounded-xl" />
                            {starting && (
                                <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm bg-slate-900/40">
                                    Starting camera…
                                </div>
                            )}
                        </div>
                    )}
                    {!error && (
                        <p className="text-xs text-text-light mt-3 text-center">
                            Point your camera at the QR code on an asset label — it'll be detected automatically.
                        </p>
                    )}

                    {/* Handheld USB/Bluetooth barcode & QR scanners — the kind most PCs and laptops
              actually have — don't use the camera at all. To the browser they just look like a
              keyboard typing very fast, so this field stays focused the whole time the modal is
              open and submits as soon as the scanner sends its trailing Enter. It's shown in
              every state, not only when the camera fails, since it's equally the right tool on a
              desktop with no webcam at all. */}
                    <div className={error ? '' : 'mt-4 pt-4 border-t border-slate-100'}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Or scan with a barcode / QR scanner
                        </label>
                        <input
                            ref={hwInputRef}
                            type="text"
                            value={hwValue}
                            onChange={e => setHwValue(e.target.value)}
                            onBlur={() => {
                                // Scanners just type into whatever has focus — if it slips away (a stray click
                                // elsewhere in the modal), pull it straight back so the next scan still lands.
                                if (!detectedRef.current) setTimeout(() => hwInputRef.current?.focus(), 0);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submitHwScan();
                                }
                            }}
                            placeholder="Click here, then scan — the code will be read automatically"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm font-mono"
                            autoFocus
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">
                            Connect it like a keyboard (most ship already set up this way) — scanning a label fills this box and looks it up instantly.
                        </p>
                    </div>
                </div>
            </div>
            {/* Offscreen canvas used purely for frame decoding, never shown */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default QrScannerModal;