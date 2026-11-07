import { useRef, useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { importVehicles } from '../../services/vehiclesService';
import { downloadCsv } from '../../utils/expensesCsv';
import { buildImportTemplate, readImportFile, type ImportRow } from '../../utils/vehicleImportFile';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface ImportVehiclesModalProps {
  onClose: () => void;
  /** Se crearon vehículos: el listado se tiene que recargar. */
  onImported: () => void;
}

/** Una fila del archivo con lo que dijo la vista previa. */
interface PreviewRow extends ImportRow {
  errors: string[];
}

const ACCEPTED_FILES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * CAM-154: alta de la flota desde un CSV o un Excel. Se lee el archivo, el backend valida cada fila igual que
 * el alta manual (vista previa) y al confirmar se crean solo las filas sin errores.
 */
export function ImportVehiclesModal({ onClose, onImported }: ImportVehiclesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validRows = preview?.filter((row) => row.errors.length === 0) ?? [];
  const importLabel =
    validRows.length === 0
      ? 'Importar'
      : `Importar ${validRows.length} ${validRows.length === 1 ? 'vehículo' : 'vehículos'}`;

  async function handleFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      const parsed = await readImportFile(file);
      if (parsed.missingColumns.length > 0) {
        setError(`Al archivo le faltan las columnas: ${parsed.missingColumns.join(', ')}. Usá la planilla de ejemplo.`);
        return;
      }
      if (parsed.rows.length === 0) {
        setError('El archivo no tiene vehículos debajo del encabezado.');
        return;
      }
      const result = await importVehicles(parsed.rows.map((row) => row.data), true);
      setPreview(
        parsed.rows.map((row, index) => ({
          ...row,
          errors: [...row.parseErrors, ...(result.rows[index]?.errors.map((e) => e.message) ?? [])],
        })),
      );
    } catch (err) {
      setError(describeApiError(err, 'No se pudo leer el archivo. Revisá que sea un CSV o un Excel (.xlsx).'));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await importVehicles(validRows.map((row) => row.data), false);
      setCreated(result.created);
      if (result.created > 0) onImported();
    } catch (err) {
      setError(describeApiError(err, 'No se pudo importar la flota. Intentá de nuevo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-vehicles-title">
      <div className="modal modal--wide">
        <header className="modal__header">
          <h2 className="modal__title" id="import-vehicles-title">
            Importar vehículos
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {created !== null ? (
            <p className="vehicle-import__done">
              {created === 1 ? 'Se importó 1 vehículo.' : `Se importaron ${created} vehículos.`}
            </p>
          ) : (
            <>
              <p className="muted">
                Subí un CSV o un Excel (.xlsx) con una fila por vehículo. Patente, marca y modelo son obligatorios; año,
                número de chasis, tipo y km actual, opcionales.{' '}
                <button
                  type="button"
                  className="vehicle-import__template-link"
                  onClick={() => downloadCsv('planilla-vehiculos.csv', buildImportTemplate())}
                >
                  Descargar planilla de ejemplo
                </button>
              </p>

              <div className="vehicle-import__picker">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  {fileName ? 'Elegir otro archivo' : 'Elegir archivo'}
                </button>
                {fileName && <span className="muted">{busy && !preview ? `Leyendo ${fileName}…` : fileName}</span>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="visually-hidden"
                  aria-label="Archivo de vehículos"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </div>

              {preview && (
                <>
                  <p className="vehicle-import__summary">
                    {preview.length} {preview.length === 1 ? 'fila' : 'filas'}: {validRows.length} para importar
                    {preview.length > validRows.length && `, ${preview.length - validRows.length} con errores`}.
                  </p>
                  <div className="vehicle-import__table-wrap">
                    <table className="vehicle-import__table">
                      <thead>
                        <tr>
                          <th>Fila</th>
                          <th>Patente</th>
                          <th>Vehículo</th>
                          <th>Año</th>
                          <th>Km</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.line} className={row.errors.length > 0 ? 'vehicle-import__row--error' : undefined}>
                            <td>{row.line}</td>
                            <td>{row.data.plate || '—'}</td>
                            <td>{[row.data.brand, row.data.model].filter(Boolean).join(' ') || '—'}</td>
                            <td>{row.data.year ?? ''}</td>
                            <td>{row.data.odometerKm ?? ''}</td>
                            <td>
                              {row.errors.length === 0 ? (
                                <span className="vehicle-import__ok">Lista</span>
                              ) : (
                                <ul className="vehicle-import__errors">
                                  {row.errors.map((message) => (
                                    <li key={message}>{message}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          {created !== null ? (
            <button type="button" className="primary-btn" onClick={onClose}>
              Listo
            </button>
          ) : (
            <>
              <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleImport}
                disabled={busy || validRows.length === 0}
              >
                {busy && preview ? 'Importando…' : importLabel}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
