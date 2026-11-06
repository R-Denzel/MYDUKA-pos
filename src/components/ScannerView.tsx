import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Flashlight,
  FlashlightOff,
  Keyboard,
  PackagePlus,
  RotateCcw,
  ShoppingCart,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  CameraCapabilities,
  CameraDevice,
  Html5Qrcode as Html5QrcodeInstance,
} from 'html5-qrcode';
import { useStore } from '@/store/useStore';
import type { Product, ProductVariant } from '@/types/pos';
import { formatCurrency } from '@/lib/currency';

interface ScannerViewProps {
  onClose: () => void;
  onAddNewProduct?: (barcode: string) => void;
  onBarcodeDetected?: (barcode: string) => void;
}

interface ZoomSettings {
  min: number;
  max: number;
  step: number;
  value: number;
}

const LAST_CAMERA_STORAGE_KEY = 'duka-pos-last-camera-id';
const MISSED_FRAMES_TO_UNLOCK = 8;

async function stopCamera(scanner: Html5QrcodeInstance) {
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
  } catch (error) {
    console.warn('Scanner cleanup warning:', error);
  }
}

function readSavedCameraId() {
  try {
    return window.localStorage.getItem(LAST_CAMERA_STORAGE_KEY) ?? '';
  } catch (error) {
    console.warn('Could not read the saved camera preference:', error);
    return '';
  }
}

function saveCameraId(cameraId: string) {
  try {
    window.localStorage.setItem(LAST_CAMERA_STORAGE_KEY, cameraId);
  } catch (error) {
    console.warn('Could not save the camera preference:', error);
  }
}

export default function ScannerView({
  onClose,
  onAddNewProduct,
  onBarcodeDetected,
}: ScannerViewProps) {
  const getProductByBarcode = useStore((state) => state.getProductByBarcode);
  const addToCart = useStore((state) => state.addToCart);
  const cartCount = useStore((state) =>
    state.cart.reduce((count, item) => count + item.qty, 0),
  );
  const displayCurrency = useStore((state) => state.displayCurrency);
  const exchangeRates = useStore((state) => state.exchangeRates);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraUnsupported, setCameraUnsupported] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(readSavedCameraId);
  const [scannerStartKey, setScannerStartKey] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomSettings, setZoomSettings] = useState<ZoomSettings | null>(null);
  const [lastScan, setLastScan] = useState<{ code: string; name?: string } | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const cameraCapabilitiesRef = useRef<CameraCapabilities | null>(null);
  const pendingCameraStopRef = useRef<Promise<void>>(Promise.resolve());
  const selectedCameraIdRef = useRef(selectedCameraId);
  const lockedBarcodeRef = useRef('');
  const missedFramesRef = useRef(0);
  const unknownBarcodeRef = useRef(unknownBarcode);
  const addNewProductRef = useRef(onAddNewProduct);
  unknownBarcodeRef.current = unknownBarcode;
  addNewProductRef.current = onAddNewProduct;

  const getPreferredCamera = useCallback((cameras: CameraDevice[], preferredId: string) => {
    if (!cameras.length) return null;

    const preferred = cameras.find((camera) => camera.id === preferredId);
    if (preferred) return preferred;

    const savedId = readSavedCameraId();
    const saved = cameras.find((camera) => camera.id === savedId);
    if (saved) return saved;

    return cameras.find((camera) => /(back|rear|environment)/i.test(camera.label)) ?? cameras[0];
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    cameraCapabilitiesRef.current = null;

    if (scanner) {
      await stopCamera(scanner);
    }
  }, []);

  const handleLookup = useCallback(
    (code: string) => {
      const cleanedCode = code.trim();
      if (!cleanedCode) return;

      if (onBarcodeDetected) {
        onBarcodeDetected(cleanedCode);
        toast.success('Barcode added to product details');
        onClose();
        return;
      }

      const product = getProductByBarcode(cleanedCode);
      if (product) {
        if (product.hasVariants && product.variants.length > 0) {
          setVariantProduct(product);
          setLastScan({ code: cleanedCode, name: product.name });
          setUnknownBarcode('');
          setManualCode('');
          return;
        }

        addToCart({
          productId: product.id,
          name: product.name,
          price: product.basePrice,
          qty: 1,
        });
        setLastScan({ code: cleanedCode, name: product.name });
        setUnknownBarcode('');
        setManualCode('');
        toast.success(`${product.name} added to cart`);
        return;
      }

      setLastScan({ code: cleanedCode });
      setUnknownBarcode(cleanedCode);
      toast.info('Product not found — add it to inventory');
    },
    [addToCart, getProductByBarcode, onBarcodeDetected, onClose],
  );

  const addVariantToCart = (product: Product, variant: ProductVariant) => {
    addToCart({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      price: variant.price,
      qty: 1,
    });
    setVariantProduct(null);
    toast.success(`${product.name} (${variant.name}) added to cart`);
  };

  useEffect(() => {
    if (showManual) {
      void stopScanner();
      return;
    }

    let cancelled = false;
    let activeScanner: Html5QrcodeInstance | null = null;
    let pendingStart: Promise<null> | null = null;

    const startCamera = async () => {
      setIsLoadingCamera(true);
      setCameraError(null);
      setCameraUnsupported(false);
      setTorchAvailable(false);
      setTorchEnabled(false);
      setZoomSettings(null);
      cameraCapabilitiesRef.current = null;

      try {
        const cameraIsSupported =
          typeof window !== 'undefined' &&
          window.isSecureContext &&
          !!navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === 'function';

        if (!cameraIsSupported) {
          setCameraUnsupported(true);
          setCameraError('Live scanning requires camera access on HTTPS or localhost.');
          return;
        }

        await pendingCameraStopRef.current;
        if (cancelled) return;
        await stopScanner();
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;

        setAvailableCameras(cameras);
        const preferredCamera = getPreferredCamera(cameras, selectedCameraIdRef.current);
        if (preferredCamera) {
          selectedCameraIdRef.current = preferredCamera.id;
          setSelectedCameraId(preferredCamera.id);
          saveCameraId(preferredCamera.id);
        }

        const scanner = new Html5Qrcode('barcode-reader', {
          verbose: false,
          useBarCodeDetectorIfSupported: false,
        });
        activeScanner = scanner;
        scannerRef.current = scanner;

        const cameraConstraints: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(preferredCamera
            ? { deviceId: { exact: preferredCamera.id } }
            : { facingMode: 'environment' }),
        };
        const config = {
          fps: 10,
          videoConstraints: cameraConstraints,
          disableFlip: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
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
          const barcode = decodedText.trim();
          if (!barcode || barcode === lockedBarcodeRef.current) return;

          lockedBarcodeRef.current = barcode;
          missedFramesRef.current = 0;
          if (unknownBarcodeRef.current) return;

          navigator.vibrate?.(35);
          handleLookup(barcode);
        };

        const onScanFailure = () => {
          if (!lockedBarcodeRef.current || unknownBarcodeRef.current) return;

          missedFramesRef.current += 1;
          if (missedFramesRef.current >= MISSED_FRAMES_TO_UNLOCK) {
            lockedBarcodeRef.current = '';
            missedFramesRef.current = 0;
          }
        };

        const rearCameraConstraints: MediaTrackConstraints = {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
        const startOn = (camera: string | MediaTrackConstraints) => {
          pendingStart = scanner.start(camera, config, onScanSuccess, onScanFailure);
          return pendingStart;
        };

        try {
          await startOn(preferredCamera?.id ?? rearCameraConstraints);
        } catch (error) {
          if (!preferredCamera) throw error;

          console.warn('Preferred camera failed; trying the rear camera:', error);
          config.videoConstraints = rearCameraConstraints;
          await startOn(rearCameraConstraints);
        }

        if (cancelled) return;

        scannerRef.current = scanner;
        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities();
          cameraCapabilitiesRef.current = capabilities;

          const torch = capabilities.torchFeature();
          setTorchAvailable(torch.isSupported());
          setTorchEnabled(torch.value() ?? false);

          const zoom = capabilities.zoomFeature();
          if (zoom.isSupported()) {
            setZoomSettings({
              min: zoom.min(),
              max: zoom.max(),
              step: zoom.step() || 0.1,
              value: zoom.value() ?? zoom.min(),
            });
          }
        } catch (error) {
          console.warn('Could not read camera capabilities:', error);
        }
      } catch (error) {
        if (cancelled) return;

        console.error('Camera error:', error);
        setCameraError(error instanceof Error ? error.message : 'Camera unavailable.');
        toast.error('Camera unavailable — use manual entry or retry');
      } finally {
        if (!cancelled) setIsLoadingCamera(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      const scannerToStop = activeScanner;
      if (scannerToStop) {
        if (scannerRef.current === scannerToStop) scannerRef.current = null;
        pendingCameraStopRef.current = (async () => {
          if (pendingStart) await pendingStart.catch(() => null);
          await stopCamera(scannerToStop);
        })();
      }
    };
  }, [
    getPreferredCamera,
    handleLookup,
    scannerStartKey,
    showManual,
    stopScanner,
  ]);

  const handleClose = () => {
    onClose();
  };

  const handleCameraChange = (cameraId: string) => {
    selectedCameraIdRef.current = cameraId;
    setSelectedCameraId(cameraId);
    saveCameraId(cameraId);
    lockedBarcodeRef.current = '';
    setScannerStartKey((key) => key + 1);
  };

  const handleTorchToggle = async () => {
    const torch = cameraCapabilitiesRef.current?.torchFeature();
    if (!torch?.isSupported()) return;

    try {
      const nextValue = !torchEnabled;
      await torch.apply(nextValue);
      setTorchEnabled(nextValue);
    } catch (error) {
      console.error('Could not toggle the camera light:', error);
      toast.error('The camera light could not be changed');
    }
  };

  const handleZoomChange = async (value: number) => {
    const zoom = cameraCapabilitiesRef.current?.zoomFeature();
    if (!zoom?.isSupported()) return;

    setZoomSettings((current) => (current ? { ...current, value } : current));
    try {
      await zoom.apply(value);
    } catch (error) {
      console.error('Could not change camera zoom:', error);
      toast.error('Camera zoom could not be changed');
    }
  };

  const handleContinueScanning = () => {
    lockedBarcodeRef.current = '';
    missedFramesRef.current = 0;
    setUnknownBarcode('');
  };

  const cameraReady = !showManual && !isLoadingCamera && !cameraError;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground">
      <header className="flex items-center justify-between gap-3 bg-foreground/95 px-4 py-3 text-background">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close scanner"
          className="touch-target flex items-center justify-center rounded-full hover:bg-background/10"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="text-body font-semibold">Scan Barcode</h1>
          <p className="text-xs text-background/65">{onBarcodeDetected
            ? 'Scan to fill in the product barcode'
            : `${cartCount} item${cartCount === 1 ? '' : 's'} in cart`}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowManual((manual) => !manual)}
          aria-label={showManual ? 'Use camera scanner' : 'Enter barcode manually'}
          className="touch-target flex items-center justify-center rounded-full hover:bg-background/10"
        >
          {showManual ? <Camera className="h-5 w-5" /> : <Keyboard className="h-5 w-5" />}
        </button>
      </header>

      {!showManual && (
        <div className="relative flex-1 overflow-hidden bg-black">
          <div id="barcode-reader" className="absolute inset-0" />

          {isLoadingCamera && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6 text-center">
              <div>
                <p className="font-semibold text-background">Starting camera...</p>
                <p className="mt-2 text-sm text-background/65">Allow camera access to scan products</p>
              </div>
            </div>
          )}

          {cameraError && !isLoadingCamera && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
              <Camera className="h-10 w-10 text-background/70" />
              <p className="font-semibold text-background">
                {cameraUnsupported ? 'Camera scanning is not available here' : 'Camera access is unavailable'}
              </p>
              <p className="text-sm text-background/65">{cameraError}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {!cameraUnsupported && (
                  <button
                    type="button"
                    onClick={() => setScannerStartKey((key) => key + 1)}
                    className="touch-target inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry camera
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="touch-target rounded-lg border border-background/30 px-4 py-2 font-semibold text-background"
                >
                  Enter barcode
                </button>
              </div>
            </div>
          )}

          {cameraReady && (
            <>
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                <div className="relative h-40 w-full max-w-sm rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.44)]">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
                </div>
              </div>

              <div className="absolute left-0 right-0 top-4 z-20 flex items-center justify-center gap-2 px-4">
                {availableCameras.length > 1 && (
                  <label className="flex min-w-0 items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-sm text-background backdrop-blur">
                    <Camera className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Camera</span>
                    <select
                      aria-label="Select camera"
                      value={selectedCameraId}
                      onChange={(event) => handleCameraChange(event.target.value)}
                      className="max-w-48 bg-transparent outline-none"
                    >
                      {availableCameras.map((camera, index) => (
                        <option key={camera.id} value={camera.id} className="text-foreground">
                          {camera.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {torchAvailable && (
                  <button
                    type="button"
                    onClick={() => void handleTorchToggle()}
                    aria-label={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                    className="touch-target flex items-center justify-center rounded-lg bg-black/70 p-2 text-background backdrop-blur"
                  >
                    {torchEnabled ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                  </button>
                )}
              </div>

              {zoomSettings && zoomSettings.max > zoomSettings.min && (
                <label className="absolute right-4 top-16 z-20 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs text-background backdrop-blur">
                  <span>Zoom</span>
                  <input
                    aria-label="Camera zoom"
                    type="range"
                    min={zoomSettings.min}
                    max={zoomSettings.max}
                    step={zoomSettings.step}
                    value={zoomSettings.value}
                    onChange={(event) => void handleZoomChange(Number(event.target.value))}
                  />
                </label>
              )}

              <div className="absolute bottom-5 left-0 right-0 z-20 px-4">
                <div className="rounded-xl bg-black/75 p-4 text-center text-background backdrop-blur-sm">
                  {unknownBarcode ? (
                    <>
                      <p className="font-semibold">Barcode not in inventory</p>
                      <p className="mt-1 break-all font-mono text-sm text-background/75">{unknownBarcode}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => addNewProductRef.current?.(unknownBarcode)}
                          className="touch-target flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground"
                        >
                          <PackagePlus className="h-4 w-4" />
                          Add product
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueScanning}
                          className="touch-target flex-1 rounded-lg border border-background/30 px-3 py-2 font-semibold"
                        >
                          Keep scanning
                        </button>
                      </div>
                    </>
                  ) : lastScan?.name ? (
                    <div className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-400" />
                      <div className="min-w-0 text-left">
                        <p className="truncate font-semibold">{lastScan.name} added</p>
                        <p className="font-mono text-xs text-background/65">{lastScan.code}</p>
                      </div>
                    </div>
                  ) : lastScan && onBarcodeDetected ? (
                    <div className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-400" />
                      <p className="font-mono text-sm">{lastScan.code}</p>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">Align the barcode in the frame</p>
                      <p className="mt-1 text-sm text-background/75">
                        {onBarcodeDetected
                          ? 'Hold one clear barcode flat anywhere in the camera view'
                          : 'Hold one clear barcode flat in the camera view; matching items go straight to your cart'}
                      </p>
                    </>
                  )}
                  {zoomSettings && (
                    <p className="mt-2 text-xs text-background/55">Adjust zoom for small or distant barcodes</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showManual && (
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 px-6">
          <div className="text-center text-background">
            <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-background/70" />
            <p className="font-semibold">Manual barcode entry</p>
            <p className="mt-1 text-sm text-background/65">
              {onBarcodeDetected
                ? 'Enter a product barcode and press Use barcode'
                : 'Enter a product barcode and press Look up'}
            </p>
          </div>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleLookup(manualCode);
            }}
            placeholder="Enter barcode"
            autoFocus
            className="w-full rounded-lg border border-background/20 bg-background/10 px-4 py-4 text-center text-body text-background placeholder:text-background/40 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => handleLookup(manualCode)}
            disabled={!manualCode.trim()}
            className="touch-target w-full rounded-lg bg-accent py-4 font-bold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {onBarcodeDetected ? 'Use barcode' : 'Look up'}
          </button>
          {unknownBarcode && (
            <div className="w-full rounded-lg border border-background/20 bg-background/10 p-4 text-center text-background">
              <p className="font-semibold">Barcode not in inventory</p>
              <p className="mt-1 break-all font-mono text-sm text-background/65">{unknownBarcode}</p>
              <button
                type="button"
                onClick={() => addNewProductRef.current?.(unknownBarcode)}
                className="touch-target mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground"
              >
                <PackagePlus className="h-4 w-4" />
                Add product
              </button>
            </div>
          )}
        </div>
      )}
      {variantProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="variant-choice-title"
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-card p-5 text-foreground shadow-modal"
          >
            <h2 id="variant-choice-title" className="text-lg font-bold">
              Choose {variantProduct.name} option
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each package is tracked using its own stock count.
            </p>
            <div className="mt-4 space-y-2">
              {variantProduct.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={variant.stock <= 0}
                  onClick={() => addVariantToCart(variantProduct, variant)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left disabled:opacity-40"
                >
                  <span>
                    <span className="block font-semibold">{variant.name}</span>
                    <span className="text-xs text-muted-foreground">{variant.stock} available</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatCurrency(variant.price, displayCurrency, exchangeRates)}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setVariantProduct(null)}
              className="mt-4 min-h-11 w-full rounded-xl border border-border font-semibold"
            >
              Cancel
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
