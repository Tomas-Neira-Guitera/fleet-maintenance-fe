interface TechnicianShellProps {
  onLogout: () => void;
}

export function TechnicianShell({ onLogout }: TechnicianShellProps) {
  return (
    <>
      <nav className="top-nav top-nav--tecnico">
        <button type="button" className="top-nav__logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </nav>
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">Taller</h1>
          <p className="screen__subtitle">Vista de técnico — próximamente, defectos abiertos y mantenimientos programados.</p>
        </header>
      </div>
    </>
  );
}
