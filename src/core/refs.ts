import type { Malla, Ramo } from "./types";

let contador = 0;
export function nuevoUid(): string {
  contador += 1;
  return `r${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Minúsculas, sin tildes y sin espacios sobrantes: para buscar y comparar. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** RN-2: la referencia de un ramo es su código; si no tiene, su número en el documento. */
export function refBase(r: Pick<Ramo, "codigo" | "numeroEnDocumento">): string {
  const cod = r.codigo?.trim();
  if (cod) return cod;
  if (r.numeroEnDocumento != null) return String(r.numeroEnDocumento);
  return "";
}

/** Referencia exportable. Si el ramo no tiene ni código ni número, se inventa una estable. */
export function refDe(r: Ramo, malla: Malla): string {
  const base = refBase(r);
  if (base) return base;
  return `S${r.semestre}-${malla.ramos.filter((x) => x.semestre === r.semestre).indexOf(r) + 1}`;
}

/** Mapa referencia (sin distinguir mayúsculas) → uid. Gana el primero si hay repetidas. */
export function mapaRefs(malla: Malla): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of malla.ramos) {
    const base = refBase(r);
    if (!base) continue;
    const k = base.toLowerCase();
    if (!m.has(k)) m.set(k, r.uid);
  }
  return m;
}

export function ramoPorUid(malla: Malla, uid: string): Ramo | undefined {
  return malla.ramos.find((r) => r.uid === uid);
}

export function ramosDeSemestre(malla: Malla, semestre: number): Ramo[] {
  return malla.ramos.filter((r) => r.semestre === semestre);
}

/** Etiqueta corta para mostrar un ramo en listas: «MAT101 · Cálculo I». */
export function etiquetaRamo(r: Ramo): string {
  const base = refBase(r);
  return base ? `${base} · ${r.nombre || "Sin nombre"}` : r.nombre || "Sin nombre";
}
