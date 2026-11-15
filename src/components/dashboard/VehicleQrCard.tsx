import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Vehicle } from '../../types/domain';
import { inspectionUrl } from '../../utils/publicUrl';
import { DownloadIcon } from '../icons';

// CAM-133: el QR se dibuja en el momento a partir del id, así que todo vehículo (nuevo o de antes) tiene el
// suyo sin guardar nada. Corrección "M": aguanta suciedad o un raspón sin hacer el código más denso.
const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 1, color: { dark: '#1F2622', light: '#FFFFFF' } };

/** PNG listo para imprimir y pegar en el camión: QR y, abajo, patente y modelo. */
async function downloadPng(vehicle: Vehicle, url: string) {
  const size = 1000;
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { ...QR_OPTIONS, width: size - 120, margin: 0 });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size + 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qr, 60, 60);
  ctx.fillStyle = '#1F2622';
  ctx.textAlign = 'center';
  ctx.font = '600 96px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText(vehicle.plate, size / 2, size + 60);
  ctx.font = '40px Inter, system-ui, sans-serif';
  ctx.fillText(`${vehicle.brand} ${vehicle.model}`, size / 2, size + 130);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `QR-${vehicle.plate}.png`;
  link.click();
}

/** CAM-133: QR del vehículo para pegar en el camión; lleva directo a su inspección. */
export function VehicleQrCard({ vehicle }: { vehicle: Vehicle }) {
  const url = inspectionUrl(vehicle.id);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        // Sin QR no se muestra nada: no hay nada que el admin pueda hacer al respecto.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!svg) return null;

  return (
    <div className="vehicle-qr" title={url}>
      <span
        className="vehicle-qr__code"
        role="img"
        aria-label={`Código QR de ${vehicle.plate}: abre su inspección`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <button
        type="button"
        className="vehicle-qr__download"
        onClick={() => void downloadPng(vehicle, url)}
        aria-label={`Descargar el QR de ${vehicle.plate}`}
      >
        <DownloadIcon width={16} height={16} aria-hidden="true" />
        Descargar
      </button>
    </div>
  );
}
