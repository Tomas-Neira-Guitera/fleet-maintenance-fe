import { useState, type ReactNode } from 'react';
import {
  ClipboardListIcon,
  CloseIcon,
  LayoutGridIcon,
  LogOutIcon,
  MenuIcon,
  TruckIcon,
  UsersIcon,
  WrenchIcon,
} from '../icons';
import '../../styles/dashboard.css';

export type AdminTab = 'resumen' | 'vehiculos' | 'planes' | 'ordenes-trabajo' | 'usuarios';

interface AdminShellProps {
  activeTab: AdminTab;
  /** Cambia con cada pantalla (la URL, CAM-82); al cambiar se cierra el menú. */
  locationKey: string;
  onSelectTab: (tab: AdminTab) => void;
  onLogout: () => void;
  children: ReactNode;
}

const TABS: { id: AdminTab; label: string; icon: ReactNode }[] = [
  { id: 'resumen', label: 'Resumen', icon: <LayoutGridIcon /> },
  { id: 'vehiculos', label: 'Vehículos', icon: <TruckIcon /> },
  { id: 'planes', label: 'Planes de Mantenimiento', icon: <WrenchIcon /> },
  { id: 'ordenes-trabajo', label: 'Órdenes de trabajo', icon: <ClipboardListIcon /> },
  { id: 'usuarios', label: 'Usuarios', icon: <UsersIcon /> },
];

export function AdminShell({ activeTab, locationKey, onSelectTab, onLogout, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Con atrás/adelante del navegador (CAM-82) la pantalla cambia sin pasar por selectTab: el menú
  // no tiene que quedar abierto encima de la nueva. Ajuste durante el render, sin efecto.
  const [lastLocationKey, setLastLocationKey] = useState(locationKey);
  if (locationKey !== lastLocationKey) {
    setLastLocationKey(locationKey);
    setDrawerOpen(false);
  }

  function selectTab(tab: AdminTab) {
    onSelectTab(tab);
    setDrawerOpen(false);
  }

  return (
    <div className="admin-shell">
      <div className="admin-shell__topbar">
        <button
          type="button"
          className="admin-shell__menu-toggle"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
        >
          <MenuIcon width={18} height={18} />
        </button>
      </div>

      {drawerOpen && (
        <div className="admin-shell__overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <nav className={`admin-shell__drawer${drawerOpen ? ' admin-shell__drawer--open' : ''}`} aria-label="Navegación de administración">
        <div className="admin-shell__drawer-header">
          <h2 className="admin-shell__drawer-title">FleetGuard</h2>
          <button
            type="button"
            className="admin-shell__drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        <div className="admin-shell__nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-shell__nav-item${activeTab === tab.id ? ' admin-shell__nav-item--active' : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <button type="button" className="admin-shell__logout" onClick={onLogout}>
          <LogOutIcon />
          Cerrar sesión
        </button>
      </nav>

      <div className="admin-shell__main">{children}</div>
    </div>
  );
}
