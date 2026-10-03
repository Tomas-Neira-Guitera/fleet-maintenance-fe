import { useLayoutEffect, useRef, useState } from 'react';

// Limita la altura de un contenedor scrolleable a sus primeros `visibleRows` ítems
// (marcados con data-scroll-item). Se mide en vez de fijar un alto porque las filas varían.
export function useVisibleRows<T extends HTMLElement>(visibleRows: number, itemCount: number) {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    function measure() {
      if (!container) return;
      const items = container.querySelectorAll<HTMLElement>('[data-scroll-item]');
      if (items.length <= visibleRows) {
        setMaxHeight(undefined);
        return;
      }
      const top = container.getBoundingClientRect().top;
      const bottom = items[visibleRows - 1].getBoundingClientRect().bottom;
      setMaxHeight(Math.ceil(bottom - top + container.scrollTop + container.clientTop));
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [visibleRows, itemCount]);

  return { ref, maxHeight };
}
