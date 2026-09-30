"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { CropArea, cropToJpegBlob } from "@/lib/image";

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  // Defaults crop a book cover; the profile photo passes a round 1:1 crop.
  aspect?: number;
  round?: boolean;
  maxWidth?: number;
  title?: string;
  hint?: string;
  confirmLabel?: string;
}

export default function ImageCropper({
  imageSrc,
  onConfirm,
  onCancel,
  aspect = 2 / 3,
  round = false,
  maxWidth = 600,
  title = "Crop the cover",
  hint = "Drag to position the image; the frame keeps the 2 : 3 cover proportions.",
  confirmLabel = "Use this cover",
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Capture phase + stopPropagation so Escape closes only the cropper,
    // not the form dialog underneath (which listens on window).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const confirm = async () => {
    if (!area || busy) return;
    setBusy(true);
    try {
      onConfirm(await cropToJpegBlob(imageSrc, area, { aspect, maxWidth }));
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="overlay overlay--top" onClick={onCancel}>
      <div
        className="dialog dialog--cropper"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="form-heading">{title}</h2>
        <p className="cropper-hint">{hint}</p>
        <div className="cropper-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={round ? "round" : "rect"}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            style={{ cropAreaStyle: { border: "2px solid #c9a24b", boxShadow: "0 0 0 9999px rgba(38, 26, 14, 0.6)" } }}
          />
        </div>
        <label className="cropper-zoom">
          <span>Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn--primary" onClick={confirm} disabled={!area || busy}>
            {busy ? "Preparing…" : confirmLabel}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
