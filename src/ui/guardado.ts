import type { Malla } from "../core/types";

const CLAVE = "curador-mallas:sesion:v1";

export interface Sesion {
  malla: Malla;
  guardadoEn: number;
}

/** Devuelve false si el navegador no deja guardar (modo privado, almacenamiento lleno): RNF-4. */
export function guardarSesion(malla: Malla): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ malla, guardadoEn: Date.now() } satisfies Sesion));
    return true;
  } catch {
    return false;
  }
}

export function leerSesion(): Sesion | null {
  try {
    const t = localStorage.getItem(CLAVE);
    if (!t) return null;
    const s = JSON.parse(t) as Sesion;
    return s?.malla && Array.isArray(s.malla.ramos) ? s : null;
  } catch {
    return null;
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}

export function leerTema(): "claro" | "oscuro" | null {
  try {
    const t = localStorage.getItem("curador-mallas:tema");
    return t === "claro" || t === "oscuro" ? t : null;
  } catch {
    return null;
  }
}

export function guardarTema(t: "claro" | "oscuro") {
  try {
    localStorage.setItem("curador-mallas:tema", t);
  } catch {
    /* el tema simplemente no se recuerda */
  }
}

export function descargarArchivo(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
