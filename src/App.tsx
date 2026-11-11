import { useCallback, useEffect, useState } from "react";
import type { Malla } from "./core/types";
import { cargarPaginas, guardarPaginas, type Pagina } from "./ui/documentos";
import { Editor } from "./ui/Editor";
import { borrarSesion, guardarTema, guardarSesion, leerSesion, leerTema, type Sesion } from "./ui/guardado";
import { Icon } from "./ui/Icon";
import { Inicio } from "./ui/Inicio";

export default function App() {
  const [malla, setMalla] = useState<Malla | null>(null);
  const [claveEditor, setClaveEditor] = useState(0);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());
  const [tema, setTema] = useState<"claro" | "oscuro">(
    () => leerTema() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro"),
  );
  const [fallaGuardado, setFallaGuardado] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    guardarTema(tema);
  }, [tema]);

  // Las imágenes del documento sobreviven a una recarga (IndexedDB).
  useEffect(() => {
    void cargarPaginas().then((p) => p.length && setPaginas(p));
  }, []);

  const cambiarPaginas = useCallback((p: Pagina[]) => {
    setPaginas(p);
    void guardarPaginas(p).then((ok) => ok || setFallaGuardado(true));
  }, []);

  const empezar = (m: Malla) => {
    setMalla(m);
    setClaveEditor((k) => k + 1);
    if (!guardarSesion(m)) setFallaGuardado(true);
  };

  const guardar = useCallback((m: Malla) => {
    const ok = guardarSesion(m);
    setFallaGuardado(!ok);
    return ok;
  }, []);

  const salir = () => {
    setSesion(leerSesion());
    setMalla(null);
  };

  return (
    <div className="app">
      <a className="skip" href="#contenido" onClick={(e) => { e.preventDefault(); document.querySelector<HTMLElement>(".ramo, .inicio button, .inicio input")?.focus(); }}>Saltar al contenido</a>
      <header className="topbar">
        <div className="brand" aria-label="Malla Pro · Curador de mallas">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Malla Pro</span>
          <span className="brand-tag">Curador</span>
        </div>
        <button className="icon-button" onClick={() => setTema(tema === "claro" ? "oscuro" : "claro")} aria-label={tema === "claro" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"} title="Cambiar tema">
          <Icon name={tema === "claro" ? "moon" : "sun"} />
        </button>
      </header>
      {malla ? (
        <Editor
          key={claveEditor}
          inicial={malla}
          paginas={paginas}
          onPaginas={cambiarPaginas}
          onGuardar={guardar}
          fallaGuardado={fallaGuardado}
          onNueva={salir}
        />
      ) : (
        <Inicio
          paginas={paginas}
          onPaginas={cambiarPaginas}
          sesion={sesion}
          onContinuar={() => sesion && empezar(sesion.malla)}
          onEmpezar={(m) => {
            borrarSesion();
            empezar(m);
          }}
          avisoAlmacenamiento={fallaGuardado}
        />
      )}
    </div>
  );
}
