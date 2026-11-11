import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Diálogo propio (reemplaza a confirm() del navegador). Esc cierra; el foco queda dentro. */
export function Modal({
  titulo,
  onClose,
  children,
  acciones,
  ancho,
}: {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  acciones?: ReactNode;
  ancho?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const foco = ref.current?.querySelector<HTMLElement>("[data-foco], button.primary, button");
    foco?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled"));
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("keydown", tecla, true);
      previo?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} ref={ref} style={ancho ? { width: ancho } : undefined}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        <h2>{titulo}</h2>
        <div className="modal-body">{children}</div>
        {acciones && <div className="modal-actions">{acciones}</div>}
      </div>
    </div>
  );
}

/** Panel lateral deslizante (problemas, notas, datos). */
export function Drawer({ titulo, kicker, onClose, children }: { titulo: string; kicker: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      previo?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="panel-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <header>
          <div>
            <span className="kicker">{kicker}</span>
            <h2>{titulo}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar panel"><Icon name="close" /></button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
