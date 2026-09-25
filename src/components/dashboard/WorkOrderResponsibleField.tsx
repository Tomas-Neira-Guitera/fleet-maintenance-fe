import { useEffect, useState } from 'react';
import { getUsers } from '../../services/usersService';
import type { UserSummary, WorkOrderExecutionType } from '../../types/domain';

interface WorkOrderResponsibleFieldProps {
  executionType: WorkOrderExecutionType;
  technicianId: string;
  onTechnicianChange: (technicianId: string) => void;
  assignee: string;
  onAssigneeChange: (assignee: string) => void;
}

/**
 * Campo "a cargo" de una OT (CAM-60): con personal propio, selector de técnicos del
 * sistema; con taller externo, texto libre para el contacto en el proveedor. Lo usan
 * los tres formularios que crean o editan OTs.
 */
export function WorkOrderResponsibleField(props: WorkOrderResponsibleFieldProps) {
  const [technicians, setTechnicians] = useState<UserSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUsers('TECNICO')
      .then((data) => {
        if (!cancelled) setTechnicians(data);
      })
      .catch(() => {
        if (!cancelled) {
          setTechnicians([]);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (props.executionType === 'externo') {
    return (
      <label className="schedule-picker__field">
        Contacto en el taller (opcional)
        <input
          type="text"
          className="schedule-picker__input"
          value={props.assignee}
          onChange={(e) => props.onAssigneeChange(e.target.value)}
          placeholder="Ej: Carlos, del mostrador"
        />
      </label>
    );
  }

  return (
    <label className="schedule-picker__field">
      Técnico a cargo (opcional)
      <select
        className="schedule-picker__input"
        value={props.technicianId}
        onChange={(e) => props.onTechnicianChange(e.target.value)}
        disabled={!technicians}
      >
        <option value="">{technicians ? 'Sin asignar' : 'Cargando técnicos…'}</option>
        {technicians?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.username}
          </option>
        ))}
      </select>
      {loadError && <span className="muted">No se pudieron cargar los técnicos.</span>}
    </label>
  );
}
