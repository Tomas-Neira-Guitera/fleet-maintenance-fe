import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Vehicle } from '../../types/domain';
import { inspectionUrl, isLocalUrl } from '../../utils/publicUrl';
import { AlertTriangleIcon, DownloadIcon, PrinterIcon, QrCodeIcon } from '../icons';

// CAM-133: el QR se dibuja en el momento a partir del id, así que todo vehículo (nuevo o de antes) tiene el
// suyo sin guardar nada. Corrección "M": aguanta suciedad o un raspón sin hacer el código más denso.
const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 1, color: { dark: '#1F2622', light: '#FFFFFF' } };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** La hoja para imprimir: QR de 9 cm (se lee desde más de un metro), patente y modelo. */
function printSheet(vehicle: Vehicle, svg: string, url: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR ${escapeHtml(vehicle.plate)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { margin: 0; font-family: 'IBM Plex Mono', ui-monospace, Consolas, monospace; color: #1F2622; }
  .sheet { display: flex; flex-direction: column; align-items: center; gap: 6mm; padding-top: 20mm; text-align: center; }
  .label { border: 0.4mm solid #1F2622; border-radius: 4mm; padding: 8mm 10mm; display: flex; flex-direction: column;
    align-items: center; gap: 4mm; }
  .qr svg { width: 90mm; height: 90mm; display: block; }
  .plate { font-size: 30pt; font-weight: 600; letter-spacing: 1mm; }
  .model { font-family: system-ui, sans-serif; font-size: 14pt; }
  .hint { font-family: system-ui, sans-serif; font-size: 11pt; max-width: 95mm; }
  .url { font-size: 7pt; color: #555; word-break: break-all; max-width: 95mm; }
</style></head><body><div class="sheet"><div class="label">
  <div class="qr">${svg}</div>
  <div class="plate">${escapeHtml(vehicle.plate)}</div>
  <div class="model">${escapeHtml(`${vehicle.brand} ${vehicle.model}`)}</div>
  <div class="hint">Escaneá con el celular para hacer la inspección de este vehículo.</div>
  <div class="url">${escapeHtml(url)}</div>
</div></div></body></html>`;
}

/** PNG listo para mandar a imprimir afuera: QR y, abajo, patente y modelo. */
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

/** Imprime desde un iframe oculto: no lo frena el bloqueo de ventanas emergentes. */
function print(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  // Se saca después: algunos navegadores imprimen de forma asíncrona.
  window.setTimeout(() => frame.remove(), 60_000);
}

interface VehicleQrCardProps {
  vehicle: Vehicle;
}

/** CAM-133: QR para pegar en el camión, que lleva directo a su inspección. */
export function VehicleQrCard({ vehicle }: VehicleQrCardProps) {
  const url = inspectionUrl(vehicle.id);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const local = isLocalUrl(url);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <section className="vehicle-detail__card vehicle-qr">
      <h2 className="vehicle-detail__card-title vehicle-qr__title">
        <QrCodeIcon width={18} height={18} aria-hidden="true" />
        Código QR
      </h2>
      <div className="vehicle-qr__body">
        <div className="vehicle-qr__code" role="img" aria-label={`Código QR de ${vehicle.plate}`}>
          {svg ? (
            <span dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="muted">{failed ? 'No se pudo generar el código.' : 'Generando…'}</span>
          )}
        </div>
        <div className="vehicle-qr__info">
          <p className="vehicle-qr__text">
            Pegalo en el camión: el chofer lo escanea con el celular y entra directo a la inspección de{' '}
            <strong className="vehicle-detail__mono">{vehicle.plate}</strong>, sin buscarlo en la flota.
          </p>
          <p className="vehicle-qr__url vehicle-detail__mono">{url}</p>
          {local && (
            <p className="vehicle-qr__warning">
              <AlertTriangleIcon width={14} height={14} aria-hidden="true" />
              Apunta a esta computadora. Antes de imprimirlo, configurá la dirección pública de la app.
            </p>
          )}
          <div className="vehicle-qr__actions">
            <button
              type="button"
              className="vehicle-detail__action-btn"
              disabled={!svg}
              onClick={() => void downloadPng(vehicle, url)}
            >
              <DownloadIcon width={14} height={14} />
              Descargar
            </button>
            <button
              type="button"
              className="vehicle-detail__action-btn"
              disabled={!svg}
              onClick={() => svg && print(printSheet(vehicle, svg, url))}
            >
              <PrinterIcon width={14} height={14} />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
