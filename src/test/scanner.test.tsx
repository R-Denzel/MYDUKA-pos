import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddProductForm from '@/components/AddProductForm';
import ScannerView from '@/components/ScannerView';

const scannerMocks = vi.hoisted(() => ({
  getCameras: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  torchApply: vi.fn(),
  lastCamera: null as null | string | MediaTrackConstraints,
  nativeDetectorEnabled: true,
  videoConstraints: null as null | MediaTrackConstraints,
  formats: [] as number[],
  onSuccess: null as null | ((barcode: string) => void),
  onFailure: null as null | (() => void),
}));

const storeMocks = vi.hoisted(() => ({
  getProductByBarcode: vi.fn(),
  addToCart: vi.fn(),
  addProduct: vi.fn(),
  cart: [] as Array<{ qty: number }>,
}));

vi.mock('html5-qrcode', () => {
  class Html5Qrcode {
    isScanning = false;

    static getCameras = scannerMocks.getCameras;

    constructor(_elementId: string, config: { useBarCodeDetectorIfSupported?: boolean }) {
      scannerMocks.nativeDetectorEnabled = config.useBarCodeDetectorIfSupported ?? true;
    }

    async start(
      camera: string | MediaTrackConstraints,
      config: { videoConstraints?: MediaTrackConstraints; formatsToSupport?: number[] },
      onSuccess: (barcode: string) => void,
      onFailure: () => void,
    ) {
      scannerMocks.onSuccess = onSuccess;
      scannerMocks.onFailure = onFailure;
      scannerMocks.lastCamera = camera;
      scannerMocks.videoConstraints = config.videoConstraints ?? null;
      scannerMocks.formats = config.formatsToSupport ?? [];
      await scannerMocks.start();
      this.isScanning = true;
      return null;
    }

    async stop() {
      scannerMocks.stop();
      this.isScanning = false;
    }

    clear() {}

    getRunningTrackCameraCapabilities() {
      return {
        torchFeature: () => ({
          isSupported: () => true,
          value: () => false,
          apply: scannerMocks.torchApply,
        }),
        zoomFeature: () => ({
          isSupported: () => false,
          min: () => 1,
          max: () => 1,
          step: () => 1,
          value: () => 1,
          apply: vi.fn(),
        }),
      };
    }
  }

  return {
    Html5Qrcode,
    Html5QrcodeSupportedFormats: {
      QR_CODE: 0,
      EAN_13: 1,
      EAN_8: 2,
      UPC_A: 3,
      UPC_E: 4,
      CODE_128: 5,
      CODE_39: 6,
      CODE_93: 7,
      CODABAR: 8,
      ITF: 9,
    },
  };
});

vi.mock('@/store/useStore', () => ({
  useStore: (selector?: (state: typeof storeMocks) => unknown) =>
    selector ? selector(storeMocks) : storeMocks,
}));

const product = {
  id: 'product-1',
  name: 'Tea',
  basePrice: 2500,
};

function scan(barcode: string) {
  if (!scannerMocks.onSuccess) throw new Error('Scanner has not started');
  act(() => scannerMocks.onSuccess?.(barcode));
}

describe('ScannerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    scannerMocks.onSuccess = null;
    scannerMocks.onFailure = null;
    scannerMocks.lastCamera = null;
    scannerMocks.nativeDetectorEnabled = true;
    scannerMocks.videoConstraints = null;
    scannerMocks.formats = [];
    scannerMocks.getCameras.mockResolvedValue([{ id: 'rear', label: 'Back camera' }]);
    storeMocks.getProductByBarcode.mockReturnValue(product);
    storeMocks.addProduct.mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  it('keeps scanning successive items and ignores repeated frames for the same barcode', async () => {
    const onClose = vi.fn();
    render(<ScannerView onClose={onClose} onAddNewProduct={vi.fn()} />);
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));
    expect(scannerMocks.nativeDetectorEnabled).toBe(false);
    expect(scannerMocks.videoConstraints?.width).toEqual({ ideal: 1280 });
    expect(scannerMocks.formats).toContain(0);

    scan('123456');
    scan('123456');
    scan('654321');

    expect(storeMocks.addToCart).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Tea added')).toBeInTheDocument();
  });

  it('allows the same product to be scanned again after it leaves the frame', async () => {
    render(<ScannerView onClose={vi.fn()} onAddNewProduct={vi.fn()} />);
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));

    scan('123456');
    act(() => {
      for (let frame = 0; frame < 8; frame += 1) {
        scannerMocks.onFailure?.();
      }
    });
    scan('123456');

    expect(storeMocks.addToCart).toHaveBeenCalledTimes(2);
  });

  it('pauses on an unknown barcode and offers an add-to-inventory action', async () => {
    const onAddNewProduct = vi.fn();
    storeMocks.getProductByBarcode.mockReturnValue(undefined);
    render(<ScannerView onClose={vi.fn()} onAddNewProduct={onAddNewProduct} />);
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));

    scan('999999');
    expect(await screen.findByText('Barcode not in inventory')).toBeInTheDocument();
    expect(storeMocks.addToCart).not.toHaveBeenCalled();
    expect(scannerMocks.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(onAddNewProduct).toHaveBeenCalledWith('999999');
  });

  it('restarts on the selected camera and exposes the flashlight when supported', async () => {
    scannerMocks.getCameras.mockResolvedValue([
      { id: 'rear', label: 'Back camera' },
      { id: 'front', label: 'Front camera' },
    ]);
    render(<ScannerView onClose={vi.fn()} onAddNewProduct={vi.fn()} />);
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('combobox', { name: 'Select camera' }), {
      target: { value: 'front' },
    });
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(2));
    expect(scannerMocks.lastCamera).toBe('front');
    expect(scannerMocks.videoConstraints?.deviceId).toEqual({ exact: 'front' });

    fireEvent.click(screen.getByRole('button', { name: 'Turn flashlight on' }));
    await waitFor(() => expect(scannerMocks.torchApply).toHaveBeenCalledWith(true));
  });

  it('falls back to the rear camera when the saved camera cannot start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scannerMocks.start.mockRejectedValueOnce(new Error('Saved camera is unavailable'));

    render(<ScannerView onClose={vi.fn()} onAddNewProduct={vi.fn()} />);
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(2));

    expect(scannerMocks.lastCamera).toEqual(
      expect.objectContaining({ facingMode: 'environment' }),
    );
    expect(scannerMocks.videoConstraints?.facingMode).toBe('environment');
    expect(screen.queryByText('Starting camera...')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('fills the Add Product barcode field when its scan button is used', async () => {
    render(<AddProductForm onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }));
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));

    scan('0123456789012');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Scan Barcode' })).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Scan or enter barcode (optional)')).toHaveValue(
        '0123456789012',
      );
    });
    expect(storeMocks.addToCart).not.toHaveBeenCalled();
  });

  it('can enter a barcode manually from Add Product and fill the form', async () => {
    const onBarcodeDetected = vi.fn();
    const onClose = vi.fn();
    render(
      <ScannerView
        onClose={onClose}
        onBarcodeDetected={onBarcodeDetected}
      />,
    );
    await waitFor(() => expect(scannerMocks.start).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Enter barcode manually' }));
    fireEvent.change(screen.getByPlaceholderText('Enter barcode'), {
      target: { value: '987654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use barcode' }));

    expect(onBarcodeDetected).toHaveBeenCalledWith('987654321');
    expect(onClose).toHaveBeenCalledOnce();
    expect(storeMocks.getProductByBarcode).not.toHaveBeenCalled();
  });
});
