import { useEffect, useState } from 'react'
import './DefectosList.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

type Gravedad = 'bajo' | 'medio' | 'alto'

type Defecto = {
  id: number
  gravedad: Gravedad
  fecha: string
  descripcion: string
  patente: string
}

type State =
  | { status: 'loading' }
  | { status: 'ok'; defectos: Defecto[] }
  | { status: 'error'; message: string }

const GRAVEDAD_LABEL: Record<Gravedad, string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function DefectosList() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/defectos`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Defecto[]>
      })
      .then((defectos) => setState({ status: 'ok', defectos }))
      .catch((err: unknown) =>
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'error desconocido',
        }),
      )
  }, [])

  if (state.status === 'loading') {
    return <p className="defectos-status">Cargando defectos…</p>
  }

  if (state.status === 'error') {
    return (
      <p className="defectos-status defectos-status--error">
        No se pudieron cargar los defectos ({state.message}).
      </p>
    )
  }

  if (state.defectos.length === 0) {
    return <p className="defectos-status">No hay defectos reportados.</p>
  }

  return (
    <ul className="defectos-list">
      {state.defectos.map((defecto) => (
        <li key={defecto.id} className="defecto-card">
          <span className={`defecto-badge defecto-badge--${defecto.gravedad}`}>
            {GRAVEDAD_LABEL[defecto.gravedad]}
          </span>
          <p className="defecto-descripcion">{defecto.descripcion}</p>
          <div className="defecto-meta">
            <span className="defecto-patente">{defecto.patente}</span>
            <span className="defecto-fecha">{formatFecha(defecto.fecha)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default DefectosList
