/** Páginas del documento oficial: imágenes y PDF. Todo ocurre en el navegador (RNF-2). */

export interface Pagina {
  id: string;
  nombre: string;
  blob: Blob;
}

export const MAX_PAGINAS_PDF = 20;

let n = 0;
const idPagina = () => `p${Date.now().toString(36)}${(n++).toString(36)}`;

export class ErrorDocumento extends Error {}

export async function leerArchivos(archivos: File[]): Promise<Pagina[]> {
  const paginas: Pagina[] = [];
  for (const f of archivos) {
    const esPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (esPdf) {
      paginas.push(...(await paginasDePdf(f)));
    } else if (/^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)) {
      paginas.push({ id: idPagina(), nombre: f.name, blob: f });
    } else {
      throw new ErrorDocumento(`«${f.name}» no es una imagen PNG/JPG ni un PDF.`);
    }
  }
  return paginas;
}

async function paginasDePdf(archivo: File): Promise<Pagina[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
    const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
    const salida: Pagina[] = [];
    for (let i = 1; i <= total; i++) {
      const pag = await doc.getPage(i);
      const vista = pag.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vista.width);
      canvas.height = Math.ceil(vista.height);
      await pag.render({ canvasContext: canvas.getContext("2d")!, viewport: vista }).promise;
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("sin imagen");
      salida.push({ id: idPagina(), nombre: `${archivo.name} · pág. ${i}`, blob });
    }
    return salida;
  } catch (e) {
    if (e instanceof ErrorDocumento) throw e;
    throw new ErrorDocumento(
      `No pude leer el PDF «${archivo.name}». Prueba exportándolo como imágenes PNG o JPG; la herramienta sigue funcionando.`,
    );
  }
}

/* ---------- Persistencia en IndexedDB (las imágenes sobreviven a recargar) ---------- */

const BD = "curador-mallas";
const TABLA = "documento";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

export async function guardarPaginas(paginas: Pagina[]): Promise<boolean> {
  try {
    const db = await abrir();
    await new Promise<void>((ok, mal) => {
      const tx = db.transaction(TABLA, "readwrite");
      tx.objectStore(TABLA).put(paginas, "paginas");
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function cargarPaginas(): Promise<Pagina[]> {
  try {
    const db = await abrir();
    const r = await new Promise<Pagina[] | undefined>((ok, mal) => {
      const req = db.transaction(TABLA).objectStore(TABLA).get("paginas");
      req.onsuccess = () => ok(req.result as Pagina[] | undefined);
      req.onerror = () => mal(req.error);
    });
    db.close();
    return r ?? [];
  } catch {
    return [];
  }
}
