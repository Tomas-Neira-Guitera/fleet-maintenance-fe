import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/datetime.css';

const GAP = 6;
const MARGIN = 8;

interface PopoverProps {
  /** El botón que abre el panel: se ubica debajo (o arriba, si no entra) y recupera el foco al cerrar. */
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  /** `refocus` es true cuando hay que devolver el foco al botón (Escape), false con un click afuera. */
  onClose: (refocus: boolean) => void;
  children: ReactNode;
}

/**
 * Panel flotante de los selectores de fecha y hora (CAM-65). Va en un portal con posición fija porque
 * los modales recortan lo que sobresale (`overflow: hidden`), algo que el selector nativo del
 * navegador no sufría. Se cierra con Escape, con un click afuera o al sacar el foco con Tab.
 */
export function Popover({ anchorRef, label, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // La posición se escribe directo en el estilo: depende del tamaño ya renderizado del panel.
  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current;
      const el = ref.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      // Si el botón salió de la vista (se scrolleó el modal o la página), el panel no queda flotando solo.
      if (a.bottom < 0 || a.top > window.innerHeight) {
        onClose(false);
        return;
      }
      const { offsetWidth: width, offsetHeight: height } = el;
      const below = a.bottom + GAP;
      const above = a.top - GAP - height;
      let top = below;
      if (below + height > window.innerHeight - MARGIN) {
        // Si no entra abajo, arriba; si tampoco, pegado al borde inferior de la pantalla.
        top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - height - MARGIN);
      }
      const left = Math.max(MARGIN, Math.min(a.left, window.innerWidth - width - MARGIN));
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.visibility = 'visible';
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={ref}
      className="dt-popover"
      role="dialog"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Hoy ningún modal se cierra con Escape; si alguno empieza a hacerlo, este Escape cierra solo el panel.
        e.stopPropagation();
        onClose(true);
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !ref.current?.contains(next) && !anchorRef.current?.contains(next)) onClose(false);
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
