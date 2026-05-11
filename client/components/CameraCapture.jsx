import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

/**
 * In-app camera capture dialog. Works on mobile (rear camera by default) and
 * desktop. Returns a JPEG data-URL compressed to ≤ 5 MB.
 *
 * Props:
 *   open       : boolean
 *   onClose    : () => void
 *   onCapture  : (dataUrl: string) => void
 *   title?     : string          (default "Take a photo")
 *   preferFacing? : 'environment' | 'user'   (default 'environment' = rear cam)
 */
export default function CameraCapture({
  open,
  onClose,
  onCapture,
  title = 'Take a photo',
  preferFacing = 'environment',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [facing, setFacing] = useState(preferFacing);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (open) {
      startCamera(facing);
    } else {
      stopCamera();
      setSnapshot(null);
      setError(null);
    }
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  async function startCamera(facingMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access. Please use the upload option.');
      return;
    }
    setStarting(true);
    setError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      const msg =
        e.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera in your browser.'
          : e.name === 'NotFoundError'
            ? 'No camera detected on this device.'
            : e.name === 'NotReadableError'
              ? 'Camera is busy — close other apps using it and try again.'
              : e.message || 'Could not start camera.';
      setError(msg);
    } finally {
      setStarting(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function takeSnapshot() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    // Cap the largest dimension to 1280 to keep file size small
    const maxSide = 1280;
    let w = v.videoWidth;
    let h = v.videoHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.82);
    setSnapshot(dataUrl);
  }

  function confirm() {
    if (!snapshot) return;
    onCapture?.(snapshot);
    onClose?.();
  }

  function flipCamera() {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-900 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-2"
                  onClick={() => startCamera(facing)}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            </div>
          )}

          <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
            {snapshot ? (
              <img src={snapshot} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Starting camera…
                  </div>
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!snapshot ? (
            <div className="flex gap-2 justify-between items-center">
              <Button variant="outline" size="sm" onClick={flipCamera} disabled={starting} className="gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Flip
              </Button>
              <Button onClick={takeSnapshot} disabled={starting || !!error} className="gap-2">
                <Camera className="w-4 h-4" /> Capture
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 justify-between">
              <Button variant="outline" onClick={() => setSnapshot(null)} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Retake
              </Button>
              <Button onClick={confirm} className="gap-2">
                <Check className="w-4 h-4" /> Use this photo
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Photos are saved as JPEG, resized to ≤ 1280 px on the long side, and compressed to fit under 5 MB.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
