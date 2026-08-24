'use client';

/**
 * components/qr/QRScannerModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live Camera & File QR Code Scanner for Obsidian.
 * Allows scanning paste URLs or Shamir shards using webcam or image upload.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult?: (scannedText: string) => void;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScanResult,
}: QRScannerModalProps) {
  const router = useRouter();
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scannedData, setScannedData] = React.useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);
  const scannerRef = React.useRef<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const readerElementId = 'obsidian-qr-reader';

  const handleSuccessfulScan = React.useCallback(
    (decodedText: string) => {
      setScannedData(decodedText);

      // Stop camera if active
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch {}
      }

      if (onScanResult) {
        onScanResult(decodedText);
      } else {
        // If it's a full URL, navigate to it
        if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
          try {
            const parsed = new URL(decodedText);
            router.push(parsed.pathname + parsed.hash);
            onClose();
          } catch {
            window.location.href = decodedText;
          }
        } else if (decodedText.startsWith('#') || decodedText.startsWith('/')) {
          router.push(decodedText);
          onClose();
        }
      }
    },
    [onScanResult, router, onClose]
  );

  // Initialize camera scanner when modal opens
  React.useEffect(() => {
    let html5QrCode: any = null;

    async function startScanner() {
      if (!isOpen) return;
      setScanError(null);
      setScannedData(null);

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setScanError('No camera found on this device. Please upload an image instead.');
          return;
        }

        const cameraId = cameras[0].id;
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            handleSuccessfulScan(decodedText);
          },
          () => {}
        );
        setIsCameraActive(true);
      } catch (err: unknown) {
        console.warn('Camera scan initialization failed:', err);
        setScanError('Camera permission denied or camera unavailable. Please upload a QR code image.');
        setIsCameraActive(false);
      }
    }

    if (isOpen) {
      // Small timeout to ensure DOM container is mounted
      const t = setTimeout(startScanner, 150);
      return () => {
        clearTimeout(t);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {});
        }
      };
    }
  }, [isOpen, handleSuccessfulScan]);

  // Handle file drop / upload scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('file-scanner-temp');
      const result = await html5QrCode.scanFile(file, true);
      handleSuccessfulScan(result);
    } catch (err: unknown) {
      setScanError('Could not detect a valid QR code in the uploaded image.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 flex flex-col gap-4 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-foreground text-background">
                <QrCode className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Scan Obsidian QR</h3>
                <p className="text-[10px] text-muted-foreground">Camera &amp; File QR Scanner</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scanner Viewport */}
          <div className="relative rounded-xl border border-border bg-background overflow-hidden min-h-[260px] flex flex-col items-center justify-center">
            <div id={readerElementId} className="w-full h-full" />
            <div id="file-scanner-temp" className="hidden" />

            {!isCameraActive && !scannedData && !scanError && (
              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                <span>Initializing camera feed...</span>
              </div>
            )}

            {scanError && !scannedData && (
              <div className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <span>{scanError}</span>
              </div>
            )}

            {scannedData && (
              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <span className="text-xs font-bold text-foreground">QR Code Scanned!</span>
                <code className="p-2 rounded bg-muted text-[10px] text-muted-foreground break-all max-w-xs">
                  {scannedData}
                </code>
              </div>
            )}
          </div>

          {/* File Upload Fallback Action */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="w-full h-9 font-mono text-xs gap-2"
            >
              {isProcessingFile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Upload QR Image File</span>
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default QRScannerModal;
