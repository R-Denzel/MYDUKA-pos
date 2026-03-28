import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { X, Keyboard, Camera, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';

interface ScannerViewProps {
  onClose: () => void;
  onAddNewProduct: (barcode: string) => void;
}

export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraLabel, setCameraLabel] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

  const handleLookup = useCallback(
    (code: string) => {
      if (!code.trim()) return;
      const product = getProductByBarcode(code.trim());
      if (product) {
        addToCart({
          productId: product.id,
          name: product.name,
          price: product.basePrice,
          qty: 1,
        });
        toast.success(`${product.name} added to cart`);
        stopScanner();
        onClose();
      } else {
        toast.info('Product not found — add it now');
        stopScanner();
        onAddNewProduct(code.trim());
      }
    },
    [addToCart, getProductByBarcode, onAddNewProduct, onClose],
  );

  const startScanner = useCallback(async () => {
    try {
      setIsLoadingCamera(true);
      setCameraError(false);

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      // Enumerate cameras
      let cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found on device');
      }

      // Find rear/environment camera
      const envCamera = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
      setCameraLabel(envCamera.label);

      const scanner = new Html5Qrcode('barcode-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 320, height: 200 },
        aspectRatio: 1.78,
        facingMode: 'environment',
        rememberLastUsedCamera: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      };

      await scanner.start(
        envCamera.id,
        config,
        (decodedText: string) => {
          if (!hasScanned.current) {
            hasScanned.current = true;
            handleLookup(decodedText);
          }
        },
        () => {
          // Ignore frame failures
        }
      );
      setIsLoadingCamera(false);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(true);
      setShowManual(true);
      setIsLoadingCamera(false);
      toast.error('Camera unavailable. Using manual entry.');
    }
  }, [handleLookup]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {
      // Ignore cleanup errors
    }
  };

  useEffect(() => {
    if (!showManual) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [showManual, startScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-foreground/90">
        <button onClick={handleClose} className="touch-target flex items-center justify-center active-scale">
          <X className="w-6 h-6 text-background" />
        </button>
        <h1 className="text-body font-semibold text-background">Scan Barcode</h1>
        <button
          onClick={() => setShowManual(!showManual)}
          className="touch-target flex items-center justify-center active-scale"
        >
          {showManual ? (
            <Camera className="w-5 h-5 text-background" />
          ) : (
            <Keyboard className="w-5 h-5 text-background" />
          )}
        </button>
      </div>

      {/* Camera View */}
      {!showManual && !cameraError && (
        <div className="flex-1 relative flex items-center justify-center bg-black">
          {isLoadingCamera && (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-background/70 text-body">
              Loading camera...
            </p>
          )}
          <div id="barcode-reader" className="w-full h-full" />
          {!isLoadingCamera && (
            <p className="absolute bottom-8 left-0 right-0 text-center text-background/70 text-meta">
              Point camera at barcode
            </p>
          )}
        </div>
      )}

      {/* Manual Input */}
      {(showManual || cameraError) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          {cameraError && (
            <>
              <p className="text-background/80 text-body font-semibold text-center">
                Camera Access Required
              </p>
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
              <p className="text-background/60 text-meta text-center text-xs">
                Or enter barcode manually below
              </p>
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
