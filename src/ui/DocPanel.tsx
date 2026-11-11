import { useCallback, useEffect, useRef, useState } from "react";
import type { Pagina } from "./documentos";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

const ZMIN = 0.1;
const ZMAX = 5;

/** CA-1.3 / CA-1.4: visor del documento oficial con zoom, desplazamiento y cambio de página. */
export function DocPanel({ paginas, onPaginas }: { paginas: Pagina[]; onPaginas: (p: Pagina[]) => void }) {
  const [idx, setIdx] = useState(0);
  const [z, setZ] = useState(1);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [confirmar, setConfirmar] = useState<null | "una" | "todas">(null);
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const zRef = useRef(z);
  zRef.current = z;

  const actual = paginas[Math.min(idx, paginas.length - 1)];
  // El URL se crea y se libera en el mismo efecto (seguro con StrictMode).
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!actual) { setUrl(""); return; }
    const u = URL.createObjectURL(actual.blob);
    setUrl(u);
    setNat(null);
    return () => URL.revokeObjectURL(u);
  }, [actual]);
  useEffect(() => { if (idx > paginas.length - 1) setIdx(Math.max(0, paginas.length - 1)); }, [paginas.length, idx]);

  const ajustar = useCallback(() => {
    if (!caja.current || !nat) return;
    setZ(Math.min(ZMAX, Math.max(ZMIN, (caja.current.clientWidth - 24) / nat.w)));
    caja.current.scrollTo({ left: 0, top: 0 });
  }, [nat]);
  useEffect(ajustar, [ajustar]);

  const zoom = useCallback((factor: number, px?: number, py?: number) => {
    const c = caja.current;
    if (!c) return;
    const antes = zRef.current;
    const nuevo = Math.min(ZMAX, Math.max(ZMIN, antes * factor));
    const x = px ?? c.clientWidth / 2;
    const y = py ?? c.clientHeight / 2;
    const k = nuevo / antes;
    setZ(nuevo);
    requestAnimationFrame(() => {
      c.scrollLeft = (c.scrollLeft + x) * k - x;
      c.scrollTop = (c.scrollTop + y) * k - y;
    });
  }, []);

  // Ctrl + rueda: zoom centrado en el puntero. Debe ser un listener no pasivo para poder frenar el zoom del navegador.
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const rueda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("wheel", rueda, { passive: false });
    return () => c.removeEventListener("wheel", rueda);
  }, [zoom, actual]);

  if (!actual) {
    return (
      <section className="doc-panel vacio" aria-label="Documento oficial">
        <Icon name="image" size={28} />
        <b>No hay documento cargado</b>
        <p>Puedes volver al inicio para subir la malla oficial y compararla aquí.</p>
      </section>
    );
  }

  const quitarActual = () => {
    onPaginas(paginas.filter((p) => p.id !== actual.id));
    setConfirmar(null);
  };

  return (
    <section className="doc-panel" aria-label="Documento oficial">
      <div className="doc-toolbar">
        <div className="grupo">
          <button className="icon-button" onClick={() => zoom(1 / 1.25)} aria-label="Alejar"><Icon name="zoomout" /></button>
          <span className="zoom-val" aria-live="polite">{Math.round(z * 100)}%</span>
          <button className="icon-button" onClick={() => zoom(1.25)} aria-label="Acercar"><Icon name="zoomin" /></button>
          <button className="secondary mini" onClick={ajustar}><Icon name="fit" size={15} /> Ajustar</button>
        </div>
        <div className="grupo">
          <button className="icon-button" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Página anterior"><Icon name="chevleft" /></button>
          <span>Página {idx + 1} de {paginas.length}</span>
          <button className="icon-button" disabled={idx >= paginas.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Página siguiente"><Icon name="chevright" /></button>
        </div>
        <div className="grupo">
          <button className="text-link peligro" onClick={() => (paginas.length > 1 ? setConfirmar("una") : quitarActual())}>Quitar</button>
          {paginas.length > 1 && <button className="text-link peligro" onClick={() => setConfirmar("todas")}>Quitar todas</button>}
        </div>
      </div>
      <div
        className="doc-stage"
        ref={caja}
        tabIndex={0}
        aria-label="Documento: arrastra para moverte, Ctrl y rueda para acercar"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const c = caja.current!;
          arrastre.current = { x: e.clientX, y: e.clientY, sx: c.scrollLeft, sy: c.scrollTop };
          c.setPointerCapture(e.pointerId);
          c.classList.add("grabbing");
        }}
        onPointerMove={(e) => {
          const a = arrastre.current;
          if (!a) return;
          caja.current!.scrollLeft = a.sx - (e.clientX - a.x);
          caja.current!.scrollTop = a.sy - (e.clientY - a.y);
        }}
        onPointerUp={() => { arrastre.current = null; caja.current?.classList.remove("grabbing"); }}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") zoom(1.25);
          else if (e.key === "-") zoom(1 / 1.25);
          else if (e.key === "0") ajustar();
        }}
      >
        {url && <img src={url} alt={`Documento oficial, ${actual.nombre}`} draggable={false} style={nat ? { width: nat.w * z } : undefined} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />}
      </div>
      {confirmar && (
        <Modal
          titulo={confirmar === "una" ? "¿Quitar esta página?" : "¿Quitar todas las páginas?"}
          onClose={() => setConfirmar(null)}
          acciones={<>
            <button className="secondary" onClick={() => setConfirmar(null)}>Cancelar</button>
            <button className="primary" onClick={confirmar === "una" ? quitarActual : () => { onPaginas([]); setConfirmar(null); }}>Sí, quitar</button>
          </>}
        >
          <p>La malla que estás editando no cambia; solo se quita el documento de este panel.</p>
        </Modal>
      )}
    </section>
  );
}
