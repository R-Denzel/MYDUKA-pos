import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { X, Keyboard, Camera, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { CameraDevice, Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode';

interface ScannerViewProps {
  onClose: () => void;
  onAddNewProduct: (barcode: string) => void;
}

const LAST_CAMERA_STORAGE_KEY = 'duka-pos-last-camera-id';

export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraUnsupported, setCameraUnsupported] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const hasScanned = useRef(false);
  const scanCooldownUntilRef = useRef(0);
  const lastDecodedRef = useRef('');
  const lastDecodedAtRef = useRef(0);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Scanner stop warning:', error);
      }
    }

    try {
      scanner.clear();
    } catch {
      // Ignore cleanup errors after stop
    }
  }, []);

  const getPreferredCamera = useCallback((cameras: CameraDevice[], preferredId?: string) => {
    if (!cameras.length) return null;

    if (preferredId) {
      const selected = cameras.find((camera) => camera.id === preferredId);
      if (selected) return selected;
    }

    const savedId = window.localStorage.getItem(LAST_CAMERA_STORAGE_KEY);
    if (savedId) {
      const saved = cameras.find((camera) => camera.id === savedId);
      if (saved) return saved;
    }

    const rearCamera = cameras.find((camera) => /(back|rear|environment)/i.test(camera.label));
    return rearCamera ?? cameras[0];
  }, []);

  const handleLookup = useCallback(
    (code: string) => {
      const cleanedCode = code.trim();
      if (!cleanedCode) return;

      const product = getProductByBarcode(cleanedCode);
      if (product) {
        addToCart({
          productId: product.id,
          name: product.name,
          price: product.basePrice,
          qty: 1,
        });
        toast.success(`${product.name} added to cart`);
        void stopScanner();
        onClose();
        return;
      }

      toast.info('Product not found — add it now');
      void stopScanner();
      onAddNewProduct(cleanedCode);
    },
    [addToCart, getProductByBarcode, onAddNewProduct, onClose, stopScanner],
  );

  const startScanner = useCallback(async () => {
    try {
      hasScanned.current = false;
      setIsLoadingCamera(true);
      setCameraError(false);
      setCameraUnsupported(false);

      const hasCameraSupport =
        typeof window !== 'undefined' &&
        window.isSecureContext &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function';

      if (!hasCameraSupport) {
        setCameraUnsupported(true);
        setCameraError(true);
        setShowManual(true);
        setIsLoadingCamera(false);
        toast.error('Scan unavailable on this browser — switched to manual entry');
        return;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      await stopScanner();

      const cameras = await Html5Qrcode.getCameras();
      setAvailableCameras(cameras);

      const preferredCamera = getPreferredCamera(cameras, selectedCameraId);
      if (preferredCamera) {
        setSelectedCameraId(preferredCamera.id);
        window.localStorage.setItem(LAST_CAMERA_STORAGE_KEY, preferredCamera.id);
      }

      const scanner = new Html5Qrcode('barcode-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(Math.floor(viewfinderWidth * 0.82), 420);
          const height = Math.min(Math.max(Math.floor(viewfinderHeight * 0.18), 120), 180);
          return { width, height };
        },
        disableFlip: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
        ],
      };

      const onScanSuccess = (decodedText: string) => {
        const now = Date.now();
        const cleanedText = decodedText.trim();
        if (!cleanedText) return;
        if (hasScanned.current) return;
        if (now < scanCooldownUntilRef.current) return;
        if (cleanedText === lastDecodedRef.current && now - lastDecodedAtRef.current < 1500) return;

        hasScanned.current = true;
        scanCooldownUntilRef.current = now + 1200;
        lastDecodedRef.current = cleanedText;
        lastDecodedAtRef.current = now;
        navigator.vibrate?.(50);
        handleLookup(cleanedText);
      };

      const onScanFailure = () => {
        // Frame misses are expected during live scanning.
      };

      if (preferredCamera) {
        try {
          await scanner.start(preferredCamera.id, config, onScanSuccess, onScanFailure);
        } catch {
          await scanner.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
        }
      } else {
        await scanner.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
      }

      setIsLoadingCamera(false);
      toast.success('Camera ready - align barcode inside the frame');
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(true);
      setShowManual(true);
      setIsLoadingCamera(false);
      toast.error(err?.message || 'Camera unavailable');
    }
  }, [getPreferredCamera, handleLookup, selectedCameraId, stopScanner]);

  useEffect(() => {
    if (!showManual) {
      void startScanner();
    }

    return () => {
      void stopScanner();
    };
  }, [showManual, startScanner, stopScanner]);

  const handleClose = () => {
    void stopScanner();
    onClose();
  };

  const handleSwitchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((camera) => camera.id === selectedCameraId);
    const nextCamera = availableCameras[(currentIndex + 1 + availableCameras.length) % availableCameras.length];
    setSelectedCameraId(nextCamera.id);
    window.localStorage.setItem(LAST_CAMERA_STORAGE_KEY, nextCamera.id);
    toast.info(`Switched to ${nextCamera.label || 'next camera'}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-foreground/90">
        <button onClick={handleClose} className="touch-target flex items-center justify-center active-scale">
          <X className="w-6 h-6 text-background" />
        </button>
        <div className="text-center">
          <h1 className="text-body font-semibold text-background">Scan Barcode</h1>
          <p className="text-xs text-background/65">Auto scan mode</p>
        </div>
        <button
          onClick={() => {
            if (showManual) {
              setCameraError(false);
              hasScanned.current = false;
            }
            setShowManual(!showManual);
          }}
          className="touch-target flex items-center justify-center active-scale"
        >
          {showManual ? <Camera className="w-5 h-5 text-background" /> : <Keyboard className="w-5 h-5 text-background" />}
        </button>
      </div>

      {!showManual && !cameraError && (
        <div className="flex-1 relative bg-black overflow-hidden">
          <div id="barcode-reader" className="absolute inset-0" />

          {isLoadingCamera && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 text-center px-6">
              <div>
                <p className="text-background text-body font-semibold">Starting camera...</p>
                <p className="text-background/60 text-meta mt-2">Please allow camera access if prompted</p>
              </div>
            </div>
          )}

          {!isLoadingCamera && (
            <>
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                <div className="relative h-36 w-full max-w-sm rounded-2xl border-2 border-accent/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
                </div>
              </div>

              <div className="absolute bottom-6 left-0 right-0 z-20 px-4">
                <div className="bg-black/75 rounded-xl p-4 text-center backdrop-blur-sm">
                  <p className="text-background text-body font-semibold">Align barcode inside the frame</p>
                  <p className="text-background/75 text-meta mt-1">Keep the phone steady and move slightly closer if needed</p>

                  {availableCameras.length > 1 && (
                    <button
                      onClick={handleSwitchCamera}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-background/20 bg-background/10 px-4 py-2 text-xs font-semibold text-background"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Switch camera
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {(showManual || cameraError) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          {cameraUnsupported && (
            <div className="w-full rounded-lg border border-background/20 bg-background/10 px-4 py-3 text-center">
              <p className="text-background text-sm font-semibold">Scan unavailable → using manual entry</p>
              <p className="text-background/60 text-xs mt-1">Use HTTPS (or localhost) and a modern camera-enabled browser for live scan.</p>
            </div>
          )}

          {cameraError && !cameraUnsupported && (
            <>
              <p className="text-background/80 text-body font-semibold text-center">Camera Access Required</p>
              <p className="text-background/60 text-meta text-center">
                Safari needs camera permission. Check Settings &gt; Safari &gt; Camera and allow access, then try again.
              </p>
              <button
                onClick={() => {
                  hasScanned.current = false;
                  setShowManual(false);
                  setCameraError(false);
                }}
                className="flex items-center gap-2 bg-accent text-accent-foreground rounded-lg px-4 py-3 font-semibold active-scale touch-target"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Camera
              </button>
              <p className="text-background/60 text-meta text-center text-xs">Or enter barcode manually below</p>
            </>
          )}

          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter barcode or product name"
            autoFocus
            className="w-full bg-background/10 border border-background/20 rounded-lg px-4 py-4 text-body text-background placeholder:text-background/40 focus:outline-none focus:ring-2 focus:ring-accent text-center tabular-nums"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLookup(manualCode);
            }}
          />
          <button
            onClick={() => handleLookup(manualCode)}
            className="w-full mt-4 bg-accent text-accent-foreground rounded-lg py-4 text-body font-bold active-scale touch-target"
          >
            Look Up
          </button>
        </div>
      )}
    </div>
  );
}
