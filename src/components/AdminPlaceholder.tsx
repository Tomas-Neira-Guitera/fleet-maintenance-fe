export function AdminPlaceholder() {
  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Panel de administración</h1>
        <p className="screen__subtitle">Iniciaste sesión como administrador</p>
      </header>
      <p className="muted">
        El dashboard todavía no está construido (ver CAM-20/37/40 y la visión de referencia en el
        ROADMAP del backend). Por ahora esta pantalla solo confirma que el login te reconoció con
        el rol correcto.
      </p>
    </div>
  );
}
