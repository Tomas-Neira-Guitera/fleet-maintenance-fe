import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';

interface PhotoViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Foto a pantalla completa sobre la misma página, sin abrir otra pestaña (CAM-53). Se
 * cierra con la ✕, tocando el fondo o con Escape. Reutilizable: hoy lo usa la vista
 * del técnico; sirve igual para las fotos del admin y del chofer.
 */
export function PhotoViewer({ src, alt, onClose }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // En una ref para que el efecto corra una sola vez aunque el padre pase una función nueva en cada render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Al cerrar, el foco vuelve a lo que abrió el visor (ej. la miniatura dentro de un modal).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    // Que la página de atrás no se desplace mientras se mira la foto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
      // La ✕ es lo único enfocable: Tab no puede irse a la pantalla tapada de atrás.
      if (e.key === 'Tab') {
        e.preventDefault();
        closeRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(e) => {
        // Solo el fondo: los clicks de la ✕ o de la foto no deben cerrar por acá.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className="photo-viewer__close" onClick={onClose} aria-label="Cerrar foto">
        <CloseIcon width={22} height={22} />
      </button>
      {/* El click en la foto no cierra: solo el fondo y la ✕. */}
      <img src={src} alt={alt} className="photo-viewer__img" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
