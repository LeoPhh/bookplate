"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { CropArea, cropToJpegBlob } from "@/lib/image";

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function CoverCropper({ imageSrc, onConfirm, onCancel }: Props) {
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
      onConfirm(await cropToJpegBlob(imageSrc, area));
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
        aria-label="Crop cover image"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="form-heading">Crop the cover</h2>
        <p className="cropper-hint">Drag to position the image; the frame keeps the 2 : 3 cover proportions.</p>
        <div className="cropper-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={2 / 3}
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
            {busy ? "Preparing…" : "Use this cover"}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
