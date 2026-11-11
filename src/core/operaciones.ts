import { nuevoUid, ramosDeSemestre } from "./refs";
import type { Malla, Nota, PrereqEstado, Ramo } from "./types";

/** Todas las ediciones son funciones puras: devuelven una malla nueva (facilita deshacer). */

export function actualizarRamo(malla: Malla, uid: string, cambios: Partial<Ramo>): Malla {
  return { ...malla, ramos: malla.ramos.map((r) => (r.uid === uid ? { ...r, ...cambios } : r)) };
}

export function actualizarMalla(malla: Malla, cambios: Partial<Malla>): Malla {
  return { ...malla, ...cambios };
}

/** CA-3.1: coloca el ramo en `semestre`, en la posición `indice` dentro de ese semestre. */
export function moverRamo(malla: Malla, uid: string, semestre: number, indice: number): Malla {
  const ramo = malla.ramos.find((r) => r.uid === uid);
  if (!ramo) return malla;
  const sin = malla.ramos.filter((r) => r.uid !== uid);
  const movido: Ramo = { ...ramo, semestre };
  const destino = sin.filter((r) => r.semestre === semestre);
  const i = Math.max(0, Math.min(indice, destino.length));
  let pos: number;
  if (destino.length === 0) {
    // Antes del primer ramo de un semestre posterior, o al final.
    const siguiente = sin.findIndex((r) => r.semestre > semestre);
    pos = siguiente === -1 ? sin.length : siguiente;
  } else if (i >= destino.length) {
    pos = sin.indexOf(destino[destino.length - 1]) + 1;
  } else {
    pos = sin.indexOf(destino[i]);
  }
  const ramos = [...sin.slice(0, pos), movido, ...sin.slice(pos)];
  return { ...malla, ramos };
}

/** Mover una posición hacia arriba/abajo dentro del semestre (alternativa de teclado). */
export function moverDentro(malla: Malla, uid: string, delta: -1 | 1): Malla {
  const ramo = malla.ramos.find((r) => r.uid === uid);
  if (!ramo) return malla;
  const lista = ramosDeSemestre(malla, ramo.semestre);
  const i = lista.findIndex((r) => r.uid === uid);
  const j = i + delta;
  if (j < 0 || j >= lista.length) return malla;
  return moverRamo(malla, uid, ramo.semestre, j);
}

export function ramoNuevo(semestre: number): Ramo {
  return {
    uid: nuevoUid(),
    nombre: "",
    codigo: null,
    creditos: null,
    numeroEnDocumento: null,
    semestre,
    prereqEstado: "desconocido",
    prereqs: [],
    prereqsRotos: [],
    semestresAprobados: null,
    prereqTexto: null,
    revisado: false,
    extra: {},
  };
}

export function agregarRamo(malla: Malla, semestre: number): { malla: Malla; uid: string } {
  const r = ramoNuevo(semestre);
  // Se inserta tras el último ramo de ese semestre (o de uno anterior).
  let pos = 0;
  malla.ramos.forEach((x, i) => {
    if (x.semestre <= semestre) pos = i + 1;
  });
  const ramos = [...malla.ramos.slice(0, pos), r, ...malla.ramos.slice(pos)];
  return { malla: { ...malla, ramos }, uid: r.uid };
}

/** CA-3.3: al eliminar un ramo se quita de los prerrequisitos de otros. */
export function eliminarRamo(malla: Malla, uid: string): Malla {
  return {
    ...malla,
    ramos: malla.ramos
      .filter((r) => r.uid !== uid)
      .map((r) => (r.prereqs.includes(uid) ? { ...r, prereqs: r.prereqs.filter((p) => p !== uid) } : r)),
  };
}

export function agregarSemestre(malla: Malla): Malla {
  return { ...malla, numSemestres: malla.numSemestres + 1 };
}

/** CA-3.3: solo se elimina un semestre vacío. Los posteriores se renumeran. */
export function eliminarSemestre(malla: Malla, semestre: number): Malla {
  if (ramosDeSemestre(malla, semestre).length > 0 || malla.numSemestres <= 1) return malla;
  return {
    ...malla,
    numSemestres: malla.numSemestres - 1,
    ramos: malla.ramos.map((r) => (r.semestre > semestre ? { ...r, semestre: r.semestre - 1 } : r)),
  };
}

/** CA-4.2: al agregar un prerrequisito el estado pasa a «Tiene». */
export function agregarPrereq(malla: Malla, uid: string, prereqUid: string): Malla {
  if (uid === prereqUid) return malla;
  return {
    ...malla,
    ramos: malla.ramos.map((r) =>
      r.uid === uid && !r.prereqs.includes(prereqUid)
        ? { ...r, prereqs: [...r.prereqs, prereqUid], prereqEstado: "conocido" }
        : r,
    ),
  };
}

export function quitarPrereq(malla: Malla, uid: string, prereqUid: string): Malla {
  return {
    ...malla,
    ramos: malla.ramos.map((r) =>
      r.uid === uid ? { ...r, prereqs: r.prereqs.filter((p) => p !== prereqUid) } : r,
    ),
  };
}

export function quitarPrereqRoto(malla: Malla, uid: string, ref: string): Malla {
  return {
    ...malla,
    ramos: malla.ramos.map((r) =>
      r.uid === uid ? { ...r, prereqsRotos: r.prereqsRotos.filter((p) => p !== ref) } : r,
    ),
  };
}

/** CA-4.4: cambiar a «No tiene» limpia los requisitos solo si la curadora lo confirma. */
export function cambiarEstado(
  malla: Malla,
  uid: string,
  estado: PrereqEstado,
  quitarRequisitos = false,
): Malla {
  return {
    ...malla,
    ramos: malla.ramos.map((r) => {
      if (r.uid !== uid) return r;
      if (estado === "ninguno" && quitarRequisitos) {
        return { ...r, prereqEstado: estado, prereqs: [], prereqsRotos: [], semestresAprobados: null };
      }
      return { ...r, prereqEstado: estado };
    }),
  };
}

export function tieneRequisitos(r: Ramo): boolean {
  return r.prereqs.length > 0 || r.prereqsRotos.length > 0 || r.semestresAprobados != null;
}

/** Ramos que dependen de `uid` (los que desbloquea). */
export function desbloquea(malla: Malla, uid: string): Ramo[] {
  return malla.ramos.filter((r) => r.prereqs.includes(uid));
}

export function agregarNota(malla: Malla, texto: string): Malla {
  const t = texto.trim();
  if (!t) return malla;
  const nota: Nota = { id: nuevoUid(), texto: t, origen: "curadora", resuelta: false };
  return { ...malla, notas: [...malla.notas, nota] };
}

export function alternarNota(malla: Malla, id: string): Malla {
  return { ...malla, notas: malla.notas.map((n) => (n.id === id ? { ...n, resuelta: !n.resuelta } : n)) };
}

export function eliminarNota(malla: Malla, id: string): Malla {
  return { ...malla, notas: malla.notas.filter((n) => n.id !== id) };
}

/** Siguiente ramo sin revisar, en el orden de la malla, después de `desdeUid` (CA-4.5). */
export function siguienteSinRevisar(malla: Malla, desdeUid?: string): Ramo | undefined {
  const orden = [...malla.ramos].sort((a, b) => a.semestre - b.semestre);
  const sin = (r: Ramo) => !r.revisado && r.uid !== desdeUid;
  if (!desdeUid) return orden.find(sin);
  const i = orden.findIndex((r) => r.uid === desdeUid);
  return orden.slice(i + 1).find(sin) ?? orden.slice(0, i + 1).find(sin);
}
