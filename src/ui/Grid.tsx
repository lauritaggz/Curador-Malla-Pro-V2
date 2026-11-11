import { memo, useMemo, useRef, useState } from "react";
import type { Malla, Problema, Ramo } from "../core/types";
import { refBase } from "../core/refs";
import { Icon } from "./Icon";

type Relacion = "" | "prerequisito" | "desbloquea" | "elegible" | "elegido";

interface TarjetaProps {
  ramo: Ramo;
  seleccionado: boolean;
  relacion: Relacion;
  problemas: Problema[];
  arrastrando: boolean;
  onSelect: (uid: string) => void;
  onMoverTeclado: (uid: string, dx: -1 | 0 | 1, dy: -1 | 0 | 1) => void;
  onNavegar: (uid: string, dx: -1 | 0 | 1, dy: -1 | 0 | 1) => void;
  onDragStart: (uid: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, uid: string) => void;
}

const Tarjeta = memo(function Tarjeta({ ramo, seleccionado, relacion, problemas, arrastrando, onSelect, onMoverTeclado, onNavegar, onDragStart, onDragEnd, onDragOver }: TarjetaProps) {
  const obligatorios = problemas.filter((p) => p.nivel === "obligatoria").length;
  const estado =
    ramo.prereqEstado === "desconocido" ? "No sé los prerrequisitos"
    : ramo.prereqEstado === "ninguno" ? "Sin prerrequisitos"
    : `Prerrequisitos: ${ramo.prereqs.length + ramo.prereqsRotos.length}${ramo.semestresAprobados ? ` + ${ramo.semestresAprobados} sem.` : ""}`;
  const base = refBase(ramo);
  return (
    <article
      className={`ramo ${seleccionado ? "sel" : ""} ${relacion} ${ramo.revisado ? "revisado" : ""} ${arrastrando ? "arrastrando" : ""}`}
      tabIndex={0}
      role="button"
      aria-pressed={seleccionado}
      aria-label={`${ramo.nombre || "Ramo sin nombre"}, ${base || "sin código"}, semestre ${ramo.semestre}. ${ramo.revisado ? "Revisado." : "Sin revisar."} ${problemas.length ? `${problemas.length} problemas.` : ""} Alt más flechas para mover.`}
      draggable
      data-uid={ramo.uid}
      onClick={() => onSelect(ramo.uid)}
      onKeyDown={(e) => {
        if (e.altKey && e.key.startsWith("Arrow")) {
          e.preventDefault();
          onMoverTeclado(ramo.uid, e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(ramo.uid);
        } else if (e.key.startsWith("Arrow") && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onNavegar(ramo.uid, e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
        }
      }}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ramo.uid); onDragStart(ramo.uid); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, ramo.uid)}
    >
      <div className="ramo-top">
        <span className="grip" aria-hidden="true"><Icon name="grip" size={15} /></span>
        {ramo.revisado && <span className="chip ok" title="Revisado"><Icon name="check" size={11} /> Revisado</span>}
        {obligatorios > 0 ? <span className="chip bad">! {obligatorios}</span>
          : problemas.length > 0 ? <span className="chip warn">Revisar</span> : null}
      </div>
      <h4>{ramo.nombre || "Ramo sin nombre"}</h4>
      <p className="meta"><span className="mono">{base || "Sin código"}</span> · {ramo.creditos != null ? `${ramo.creditos} cr.` : "? cr."}</p>
      <div className={`req ${ramo.prereqEstado}`}><Icon name={ramo.prereqEstado === "desconocido" ? "warning" : ramo.prereqEstado === "conocido" ? "link" : "check"} size={12} /> <span>{estado}</span></div>
    </article>
  );
});

export function Grid({
  malla, sel, problemasPorRamo, modoClic, onSelect, onMover, onAgregar, onAgregarSemestre, onEliminarSemestre, onAlternarPrereq,
}: {
  malla: Malla;
  sel: string | null;
  problemasPorRamo: Map<string, Problema[]>;
  modoClic: boolean;
  onSelect: (uid: string) => void;
  onMover: (uid: string, semestre: number, indice: number) => void;
  onAgregar: (semestre: number) => void;
  onAgregarSemestre: () => void;
  onEliminarSemestre: (semestre: number) => void;
  onAlternarPrereq: (uid: string) => void;
}) {
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [destino, setDestino] = useState<{ sem: number; idx: number } | null>(null);
  const arrastradoRef = useRef<string | null>(null);

  const columnas = useMemo(() => {
    const m = new Map<number, Ramo[]>();
    for (let s = 1; s <= malla.numSemestres; s++) m.set(s, []);
    for (const r of malla.ramos) m.get(r.semestre)?.push(r);
    return m;
  }, [malla.ramos, malla.numSemestres]);

  const seleccionado = sel ? malla.ramos.find((r) => r.uid === sel) : undefined;
  const prereqs = useMemo(() => new Set(seleccionado?.prereqs ?? []), [seleccionado]);
  const desbloquea = useMemo(() => new Set(seleccionado ? malla.ramos.filter((r) => r.prereqs.includes(seleccionado.uid)).map((r) => r.uid) : []), [malla.ramos, seleccionado]);

  const relacionDe = (r: Ramo): Relacion => {
    if (modoClic && seleccionado) return r.uid === seleccionado.uid ? "" : prereqs.has(r.uid) ? "elegido" : "elegible";
    return prereqs.has(r.uid) ? "prerequisito" : desbloquea.has(r.uid) ? "desbloquea" : "";
  };

  const soltar = (sem: number, idx: number) => {
    const uid = arrastradoRef.current;
    arrastradoRef.current = null;
    setArrastrado(null);
    setDestino(null);
    if (!uid) return;
    const origen = malla.ramos.find((r) => r.uid === uid);
    if (!origen) return;
    let i = idx;
    if (origen.semestre === sem) {
      const pos = columnas.get(sem)!.findIndex((r) => r.uid === uid);
      if (pos < idx) i = idx - 1;
    }
    onMover(uid, sem, i);
  };

  const sobreTarjeta = (e: React.DragEvent, uid: string) => {
    if (!arrastradoRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const r = malla.ramos.find((x) => x.uid === uid);
    if (!r) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const abajo = e.clientY > caja.top + caja.height / 2;
    const pos = columnas.get(r.semestre)!.findIndex((x) => x.uid === uid);
    const idx = pos + (abajo ? 1 : 0);
    setDestino((d) => (d && d.sem === r.semestre && d.idx === idx ? d : { sem: r.semestre, idx }));
  };

  const moverTeclado = (uid: string, dx: -1 | 0 | 1, dy: -1 | 0 | 1) => {
    const r = malla.ramos.find((x) => x.uid === uid);
    if (!r) return;
    if (dx !== 0) {
      const sem = Math.min(malla.numSemestres, Math.max(1, r.semestre + dx));
      if (sem !== r.semestre) onMover(uid, sem, columnas.get(sem)!.length);
    } else {
      const lista = columnas.get(r.semestre)!;
      const i = lista.findIndex((x) => x.uid === uid) + dy;
      if (i >= 0 && i < lista.length) onMover(uid, r.semestre, i);
    }
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-uid="${uid}"]`)?.focus());
  };

  /** Flechas sin Alt: mueven el foco entre tarjetas (arriba/abajo en el semestre, izquierda/derecha entre semestres). */
  const navegar = (uid: string, dx: -1 | 0 | 1, dy: -1 | 0 | 1) => {
    const r = malla.ramos.find((x) => x.uid === uid);
    if (!r) return;
    let destino: Ramo | undefined;
    if (dx === 0) {
      const lista = columnas.get(r.semestre)!;
      destino = lista[lista.findIndex((x) => x.uid === uid) + dy];
    } else {
      const pos = columnas.get(r.semestre)!.findIndex((x) => x.uid === uid);
      for (let s = r.semestre + dx; s >= 1 && s <= malla.numSemestres && !destino; s += dx) {
        const l = columnas.get(s)!;
        if (l.length) destino = l[Math.min(pos, l.length - 1)];
      }
    }
    if (destino) document.querySelector<HTMLElement>(`[data-uid="${destino.uid}"]`)?.focus();
  };

  return (
    <div className="malla-scroll">
      <div className="columnas">
        {[...columnas.entries()].map(([sem, ramos]) => {
          const cred = ramos.reduce((a, r) => a + (r.creditos ?? 0), 0);
          return (
            <section
              className={`columna ${destino?.sem === sem ? "destino" : ""}`}
              key={sem}
              aria-label={`Semestre ${sem}`}
              onDragOver={(e) => {
                if (!arrastradoRef.current) return;
                e.preventDefault();
                setDestino((d) => (d && d.sem === sem ? d : { sem, idx: ramos.length }));
              }}
              onDrop={(e) => { e.preventDefault(); if (destino) soltar(destino.sem, destino.idx); }}
            >
              <header>
                <span className="num mono">{String(sem).padStart(2, "0")}</span>
                <h3>Semestre {sem}</h3>
                {ramos.length === 0 && malla.numSemestres > 1 && (
                  <button className="icon-button" onClick={() => onEliminarSemestre(sem)} aria-label={`Eliminar semestre ${sem} (está vacío)`} title="Eliminar semestre vacío"><Icon name="trash" size={15} /></button>
                )}
              </header>
              <p className="total" aria-live="polite">{ramos.length} {ramos.length === 1 ? "ramo" : "ramos"} · {cred} créditos</p>
              <div className="lista">
                {ramos.map((r, i) => (
                  <div key={r.uid} className="slot">
                    {arrastrado && destino?.sem === sem && destino.idx === i && <div className="drop-linea" />}
                    <div onClickCapture={modoClic && seleccionado && r.uid !== seleccionado.uid ? (e) => { e.stopPropagation(); onAlternarPrereq(r.uid); } : undefined}>
                      <Tarjeta
                        ramo={r}
                        seleccionado={r.uid === sel}
                        relacion={relacionDe(r)}
                        problemas={problemasPorRamo.get(r.uid) ?? []}
                        arrastrando={arrastrado === r.uid}
                        onSelect={onSelect}
                        onMoverTeclado={moverTeclado}
                        onNavegar={navegar}
                        onDragStart={(uid) => { arrastradoRef.current = uid; setArrastrado(uid); }}
                        onDragEnd={() => { arrastradoRef.current = null; setArrastrado(null); setDestino(null); }}
                        onDragOver={sobreTarjeta}
                      />
                    </div>
                  </div>
                ))}
                {arrastrado && destino?.sem === sem && destino.idx >= ramos.length && <div className="drop-linea" />}
                {ramos.length === 0 && !arrastrado && <div className="vacio-col"><span>Semestre vacío</span></div>}
              </div>
              <button className="agregar" onClick={() => onAgregar(sem)}><Icon name="plus" size={15} /> Agregar ramo</button>
            </section>
          );
        })}
        <button className="agregar-semestre" onClick={onAgregarSemestre}><Icon name="plus" /><span>Agregar semestre</span></button>
      </div>
    </div>
  );
}
