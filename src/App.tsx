import { useEffect, useState } from 'react'
import './App.css'
import DefectosList from './DefectosList'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

type HealthResponse = {
  status: string
  database: string
  timestamp: string
}

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error('bad response')
        return res.json() as Promise<HealthResponse>
      })
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="app">
      <h1>Defectos</h1>
      <p>
        API ({API_BASE_URL}):{' '}
        <strong className={`status status--${apiStatus}`}>
          {apiStatus === 'checking' && 'verificando...'}
          {apiStatus === 'online' && 'online'}
          {apiStatus === 'offline' && 'offline'}
        </strong>
      </p>
      <DefectosList />
    </div>
  )
}

export default App
