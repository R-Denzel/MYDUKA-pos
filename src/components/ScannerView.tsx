import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { X, Keyboard, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScannerViewProps {
  onClose: () => void;
  onAddNewProduct: (barcode: string) => void;
}

export default function ScannerView({ onClose, onAddNewProduct }: ScannerViewProps) {
  const { getProductByBarcode, addToCart } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(false);
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
      const scanner = new Html5Qrcode('barcode-reader');
      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        {
          fps: 15,
          qrbox: { width: 360, height: 240 },
          aspectRatio: 1.78,
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
        },
        (decodedText) => {
          if (!hasScanned.current) {
            hasScanned.current = true;
            handleLookup(decodedText);
          }
        },
        () => {
          // Ignore scan failures (no barcode in frame)
        }
      );
    } catch {
      setCameraError(true);
      setShowManual(true);
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
          <div id="barcode-reader" className="w-full h-full" />
          <p className="absolute bottom-8 left-0 right-0 text-center text-background/70 text-meta">
            Point camera at barcode
          </p>
        </div>
      )}

      {/* Manual Input */}
      {(showManual || cameraError) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {cameraError && (
            <p className="text-background/60 text-meta mb-4 text-center">
              Camera not available. Enter barcode manually.
            </p>
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
