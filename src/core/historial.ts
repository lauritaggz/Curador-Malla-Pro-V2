/** Deshacer/rehacer genérico (CA-6.4). Los estados son inmutables, así que guardar copias es barato. */

export const MAX_PASOS = 200;

export interface Historial<T> {
  pasado: T[];
  presente: T;
  futuro: T[];
}

export const crearHistorial = <T,>(inicial: T): Historial<T> => ({ pasado: [], presente: inicial, futuro: [] });

export function aplicar<T>(h: Historial<T>, siguiente: T): Historial<T> {
  if (siguiente === h.presente) return h;
  return {
    pasado: [...h.pasado, h.presente].slice(-MAX_PASOS),
    presente: siguiente,
    futuro: [],
  };
}

/** Cambia el presente sin crear un paso: para fusionar ediciones seguidas del mismo campo. */
export function fusionar<T>(h: Historial<T>, siguiente: T): Historial<T> {
  if (siguiente === h.presente) return h;
  return { ...h, presente: siguiente, futuro: [] };
}

/** Reemplaza el presente sin crear un paso (p. ej. al cargar una malla nueva). */
export const reiniciar = <T,>(valor: T): Historial<T> => crearHistorial(valor);

export function deshacer<T>(h: Historial<T>): Historial<T> {
  if (!h.pasado.length) return h;
  return {
    pasado: h.pasado.slice(0, -1),
    presente: h.pasado[h.pasado.length - 1],
    futuro: [h.presente, ...h.futuro],
  };
}

export function rehacer<T>(h: Historial<T>): Historial<T> {
  if (!h.futuro.length) return h;
  return {
    pasado: [...h.pasado, h.presente],
    presente: h.futuro[0],
    futuro: h.futuro.slice(1),
  };
}
