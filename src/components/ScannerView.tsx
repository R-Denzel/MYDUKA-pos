import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { X, Keyboard, Camera, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';

interface ScannerViewProps {
  onClose: () => void;
  onAddNewProduct: (barcode: string) => void;
}

const LAST_CAMERA_STORAGE_KEY = 'duka-pos-last-camera-id';
const SCAN_AREA_STORAGE_KEY = 'duka-pos-scan-area-ratio';
const SCAN_MODE_STORAGE_KEY = 'duka-pos-scan-mode';

export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isAutoScan, setIsAutoScan] = useState(() => {
    const stored = window.localStorage.getItem(SCAN_MODE_STORAGE_KEY);
    return stored !== 'tap';
  });
  const [isTapScanArmed, setIsTapScanArmed] = useState(false);
  const [scanAreaRatio, setScanAreaRatio] = useState(() => {
    const stored = window.localStorage.getItem(SCAN_AREA_STORAGE_KEY);
    const parsed = stored ? Number.parseFloat(stored) : 0.6;
    if (Number.isNaN(parsed)) return 0.6;
    return Math.min(0.9, Math.max(0.4, parsed));
  });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {
      // Ignore cleanup errors
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
      if (!code.trim()) return;

      const cleanedCode = code.trim();
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

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      await stopScanner();

      const cameras = await Html5Qrcode.getCameras();
      setAvailableCameras(cameras);

      const preferredCamera = getPreferredCamera(cameras, selectedCameraId);
      if (preferredCamera) {
        setSelectedCameraId(preferredCamera.id);
        window.localStorage.setItem(LAST_CAMERA_STORAGE_KEY, preferredCamera.id);
      }

      const viewportBase = Math.min(window.innerWidth, window.innerHeight);
      const qrboxSize = Math.min(420, Math.max(180, Math.round(viewportBase * scanAreaRatio)));

      const scanner = new Html5Qrcode('barcode-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: {
          width: qrboxSize,
          height: qrboxSize,
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
        if (!isAutoScan && !isTapScanArmed) return;
        if (hasScanned.current) return;
        hasScanned.current = true;
        if (!isAutoScan) {
          setIsTapScanArmed(false);
        }
        navigator.vibrate?.(50);
        handleLookup(decodedText);
      };

      const onScanFailure = () => {
        // Ignore frame-by-frame scanning failures - these are normal
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
      toast.success('Camera ready - hold steady');
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(true);
      setShowManual(true);
      setIsLoadingCamera(false);
      toast.error(err?.message || 'Camera unavailable');
    }
  }, [
    getPreferredCamera,
    handleLookup,
    isAutoScan,
    isTapScanArmed,
    scanAreaRatio,
    selectedCameraId,
    stopScanner,
  ]);

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

  const handleCameraSelection = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    window.localStorage.setItem(LAST_CAMERA_STORAGE_KEY, cameraId);
  };

  const handleScanAreaChange = (value: number) => {
    setScanAreaRatio(value);
    window.localStorage.setItem(SCAN_AREA_STORAGE_KEY, value.toString());
  };

  const handleScanModeChange = (nextMode: 'auto' | 'tap') => {
    const nextIsAuto = nextMode === 'auto';
    setIsAutoScan(nextIsAuto);
    setIsTapScanArmed(false);
    window.localStorage.setItem(SCAN_MODE_STORAGE_KEY, nextMode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-foreground/90">
        <button onClick={handleClose} className="touch-target flex items-center justify-center active-scale">
          <X className="w-6 h-6 text-background" />
        </button>
        <h1 className="text-body font-semibold text-background">Scan Barcode</h1>
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
          {showManual ? (
            <Camera className="w-5 h-5 text-background" />
          ) : (
            <Keyboard className="w-5 h-5 text-background" />
          )}
        </button>
      </div>

      {!showManual && !cameraError && (
        <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
          {isLoadingCamera && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-background text-body font-semibold">Starting camera...</p>
              <p className="text-background/60 text-meta mt-2">Please allow camera access if prompted</p>
            </div>
          )}

          <div id="barcode-reader" className="w-full h-full" />

          {!isLoadingCamera && (
            <div className="absolute bottom-8 left-0 right-0 px-4">
              <div className="bg-black/80 rounded-lg p-4 text-center">
                <p className="text-background text-body font-semibold mb-1">Hold phone 10-15cm from barcode</p>
                <p className="text-background/80 text-meta">Keep steady • Good lighting • Center the barcode • Wait for beep</p>
                <p className="text-background/60 text-xs mt-2">Scanned number may differ from printed text - this is normal</p>

                <div className="mt-3 text-left">
                  <div className="block text-background/70 text-xs mb-1">Scan mode</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleScanModeChange('auto')}
                      className={`rounded-md px-3 py-2 text-xs font-semibold border ${
                        isAutoScan
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-background/10 text-background border-background/20'
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => handleScanModeChange('tap')}
                      className={`rounded-md px-3 py-2 text-xs font-semibold border ${
                        !isAutoScan
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-background/10 text-background border-background/20'
                      }`}
                    >
                      Tap to scan
                    </button>
                  </div>

                  {!isAutoScan && (
                    <button
                      onClick={() => {
                        hasScanned.current = false;
                        setIsTapScanArmed(true);
                        toast.info('Scanner armed for one barcode');
                      }}
                      className="mt-2 w-full rounded-md px-3 py-2 text-xs font-semibold border border-background/20 bg-background/10 text-background"
                    >
                      {isTapScanArmed ? 'Ready: point at barcode' : 'Arm scanner'}
                    </button>
                  )}
                </div>

                {availableCameras.length > 1 && (
                  <div className="mt-3 text-left">
                    <label className="block text-background/70 text-xs mb-1">Camera</label>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => handleCameraSelection(e.target.value)}
                      className="w-full bg-background/10 border border-background/20 rounded-md px-3 py-2 text-sm text-background"
                    >
                      {availableCameras.map((camera) => (
                        <option key={camera.id} value={camera.id} className="text-foreground bg-background">
                          {camera.label || `Camera ${camera.id.slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3 text-left">
                  <div className="flex items-center justify-between text-xs text-background/70 mb-1">
                    <span>Scan area</span>
                    <span>{Math.round(scanAreaRatio * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={0.9}
                    step={0.05}
                    value={scanAreaRatio}
                    onChange={(e) => handleScanAreaChange(Number.parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(showManual || cameraError) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          {cameraError && (
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
