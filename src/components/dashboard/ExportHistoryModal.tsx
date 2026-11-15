import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ApiError, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getExpenses } from '../../services/expensesService';
import { getVehicle, getVehicleHistory } from '../../services/vehiclesService';
import { getWorkOrders } from '../../services/workOrdersService';
import type { Vehicle } from '../../types/domain';
import { periodParams, type Period } from '../../utils/period';
import {
  buildVehicleHistoryReport,
  lastTwelveMonths,
  reportFilename,
  type VehicleHistoryReport,
} from '../../utils/vehicleHistoryReport';
import { CloseIcon } from '../icons';
import { PeriodFilter } from './PeriodFilter';
import { VehicleHistoryPrint } from './VehicleHistoryPrint';
import '../../styles/dashboard.css';

interface ExportHistoryModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

/**
 * Exportar el historial de un vehículo a PDF (CAM-130), con la impresión del navegador: "Guardar como
 * PDF" no suma dependencias. Los datos se piden de nuevo al exportar, para que el documento no salga
 * con lo que la pantalla cargó hace un rato.
 */
export function ExportHistoryModal({ vehicle, onClose }: ExportHistoryModalProps) {
  const [period, setPeriod] = useState<Period>(() => lastTwelveMonths());
  const [report, setReport] = useState<VehicleHistoryReport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  // El título es el nombre que propone "Guardar como PDF". Se devuelve al cerrar y no con `afterprint`,
  // que en algunos navegadores se dispara antes de que se abra el diálogo.
  useEffect(() => {
    mountedRef.current = true;
    const previousTitle = document.title;
    return () => {
      mountedRef.current = false;
      document.title = previousTitle;
    };
  }, []);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const [freshVehicle, history, workOrders, expenses] = await Promise.all([
        getVehicle(vehicle.id),
        getVehicleHistory(vehicle.id),
        getWorkOrders({ vehicleId: vehicle.id }),
        getExpenses(periodParams(period), vehicle.id),
      ]);
      // El botón atrás del navegador desmonta el modal igual: sin esto se imprimiría la app.
      if (!mountedRef.current) return;
      // print() fotografía el DOM en el momento: el documento tiene que estar ya dibujado.
      flushSync(() => setReport(buildVehicleHistoryReport(freshVehicle, history, workOrders, expenses, period)));
      document.title = reportFilename(vehicle.plate, period);
      window.print();
    } catch (err) {
      if (isSessionExpired(err)) {
        setError(SESSION_EXPIRED_MESSAGE);
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo armar el historial. Intentá de nuevo.');
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="export-history-title">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="export-history-title">
              Exportar historial
            </h2>
            <p className="modal__subtitle">{vehicle.plate}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} disabled={exporting} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <PeriodFilter period={period} onChange={setPeriod} label="Período:" />
          <p className="muted">Se abre la ventana de impresión: elegí "Guardar como PDF" como destino.</p>
          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={exporting}>
            Cerrar
          </button>
          <button type="button" className="primary-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Armando…' : 'Exportar'}
          </button>
        </footer>
      </div>

      {report && <VehicleHistoryPrint report={report} />}
    </div>
  );
}
