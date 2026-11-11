# HU — Curador de mallas (Malla Pro V2)

Nov 11, 2026 · @Laura

## Ficha

**Como** curadora de mallas de Malla Pro (sin conocimientos técnicos), **quiero** comparar lado a lado la malla oficial de una carrera con el borrador JSON que generó la IA y corregirlo visualmente, **para** entregar un JSON `mallapro-1` correcto y verificado, sin tener que leer ni escribir JSON.

| Campo | Valor |
| --- | --- |
| ID sugerido | HU-CUR-01 |
| Título | Curador de mallas: revisar y corregir borradores de IA |
| Épica | Carga de mallas para nuevas universidades (V2) |
| Rol | Curadora de mallas (persona interna, no técnica) |
| Prioridad sugerida | Alta: bloquea la expansión a nuevas universidades |
| Estimación sugerida | 8 puntos (HU completa). Se puede dividir en las tareas de la última sección |
| Entregable | Una página estática alojada en Netlify, sin backend |
| Punto de partida | Prototipo funcional `index.html` (v0), ya probado con mallas reales |

## Contexto y problema

Para llegar a nuevas universidades, Malla Pro necesita cargar muchas mallas sin que Laura revise cada ramo a mano. Las mallas oficiales se pasan de PNG o PDF a JSON con IA (Gemini Pro), pero la IA comete errores típicos: ramos en el semestre equivocado, códigos mal leídos, créditos vacíos, prerrequisitos que apuntan a ramos que no existen y requisitos alternativos («A o B») que el formato no sabe representar.

La curación queda a cargo de una persona dedicada que sabe usar IA pero tiene pocos conocimientos informáticos. Por eso la herramienta debe esconder el JSON por completo: ella ve y edita una malla visual, y el JSON se arma por detrás.

Flujo completo:

1. Laura o la curadora obtiene la malla oficial (PNG, JPG o PDF).
2. La IA genera un borrador `mallapro-1` con `advertencias` sobre lo que no pudo leer.
3. La curadora carga ambos en el curador y corrige, ramo por ramo, comparando con el documento.
4. Descarga el JSON final y se lo entrega a Laura.
5. Laura lo valida contra el esquema y lo importa a Malla Pro.

## Alcance

Incluido en esta HU:

- Carga de la malla oficial: imágenes PNG/JPG y PDF de varias páginas, con zoom, desplazamiento, cambio de página y opción de quitarlas.
- Carga del borrador: archivo `.json` o texto pegado desde la respuesta de la IA, en formato `mallapro-1` o en el formato antiguo (`id`, `sct`).
- Edición visual: semestres en columnas, arrastrar ramos entre y dentro de semestres, agregar o eliminar ramos y semestres.
- Edición de cada ramo: nombre, código, créditos, número en el documento, estado de prerrequisitos, prerrequisitos, semestres aprobados requeridos y texto original del requisito.
- Datos generales de la malla, con el año o versión del plan como dato obligatorio.
- Validaciones en lenguaje simple, separadas entre obligatorias y avisos.
- Seguimiento del avance: marcar ramos como revisados y ver el progreso.
- Notas de la IA y de la curadora.
- Guardado automático en el navegador, deshacer y borrador descargable.
- Descarga del JSON final `mallapro-1`.

Fuera de alcance (posibles HU futuras):

- Cuentas de usuario, roles o backend: la herramienta es una página estática.
- Llamar a la IA desde la herramienta. La IA se usa aparte.
- Subir el JSON directo a la base de datos de Malla Pro.
- Requisitos alternativos («A o B»), correquisitos y menciones, hasta que el formato los soporte (ver Decisiones abiertas).
- Trabajo de varias personas a la vez sobre la misma malla.

## Criterios de aceptación

Cada criterio tiene un ID para referenciarlo en Taiga, en commits y en los tests. Todos se pueden verificar con un test automatizado (Playwright) o con una revisión manual guiada.

### CA-1 Carga del documento oficial

```gherkin
Escenario: CA-1.1 Cargar imágenes
  Dado que estoy en la pantalla de inicio
  Cuando cargo uno o más archivos PNG o JPG
  Entonces veo "✓ N páginas cargadas" y luego cada imagen en el panel del documento

Escenario: CA-1.2 Cargar un PDF
  Cuando cargo un PDF de hasta 20 páginas
  Entonces cada página aparece como una página navegable
  Y si el PDF no se puede leer, veo un mensaje en español y la app sigue funcionando

Escenario: CA-1.3 Navegar el documento
  Dado que hay un documento cargado
  Entonces puedo acercar, alejar, "Ajustar" al ancho, arrastrar para moverme y cambiar de página
  Y Ctrl + rueda hace zoom centrado en el puntero

Escenario: CA-1.4 Quitar imágenes
  Cuando pulso "Quitar" sobre la página visible
  Entonces esa página desaparece (con confirmación si hay más de una)
  Y "Quitar todas" deja el panel vacío
  Y la malla en edición no cambia

Escenario: CA-1.5 Ajustar el espacio
  Entonces puedo cambiar el ancho del panel arrastrando el divisor y ocultarlo con "Documento"
```

### CA-2 Carga del borrador JSON

````gherkin
Escenario: CA-2.1 Formatos aceptados
  Cuando cargo un .json o pego texto con el formato mallapro-1
  Entonces veo carrera, número de ramos y de semestres antes de empezar
  Y el texto pegado puede venir envuelto en ```json ... ``` o con texto antes y después

Escenario: CA-2.2 Formato antiguo
  Cuando cargo una malla con id numérico, sct y prerrequisitos por id
  Entonces se convierte a mallapro-1 sin perder prerrequisitos
  Y los campos desconocidos (area, linea) se conservan y salen en la exportación

Escenario: CA-2.3 JSON inválido
  Cuando el texto tiene un error de sintaxis o no trae "semestres"
  Entonces veo un mensaje simple que explica qué hacer (pedir a la IA que lo regenere)
  Y no se pierde nada de lo que había

Escenario: CA-2.4 Prerrequisitos que no existen
  Dado un prerrequisito que no coincide con ningún ramo
  Entonces se muestra en rojo como "no existe en la malla" y cuenta como problema obligatorio

Escenario: CA-2.5 Malla vacía
  Cuando elijo "Empezar una malla vacía"
  Entonces parto con 8 semestres vacíos
````

### CA-3 Edición visual

```gherkin
Escenario: CA-3.1 Mover ramos
  Cuando arrastro un ramo a otra columna o a otra posición
  Entonces queda donde lo solté, con una línea que indica dónde caerá
  Y también puedo moverlo eligiendo el semestre en el panel del ramo (alternativa sin arrastre)

Escenario: CA-3.2 Relaciones visibles
  Cuando selecciono un ramo
  Entonces sus prerrequisitos se ven en azul y los ramos que desbloquea en verde

Escenario: CA-3.3 Agregar y eliminar
  Entonces puedo agregar un ramo en cualquier semestre y agregar semestres al final
  Y solo puedo eliminar un semestre vacío
  Y al eliminar un ramo, se quita de los prerrequisitos de otros ramos

Escenario: CA-3.4 Totales por semestre
  Entonces cada columna muestra su cantidad de ramos y créditos, actualizados al instante
```

### CA-4 Edición de un ramo

```gherkin
Escenario: CA-4.1 Campos editables
  Cuando abro un ramo
  Entonces edito nombre, código, créditos, semestre, número en el documento,
    estado (No tiene / Tiene / No sé), semestres aprobados requeridos y texto original

Escenario: CA-4.2 Agregar prerrequisitos
  Entonces puedo buscarlos por código o nombre (sin importar tildes) y elegirlos con el teclado
  Y puedo activar "Elegir haciendo clic en la malla" y marcar o desmarcar ramos con un clic
  Y al agregar uno, el estado pasa a "Tiene"

Escenario: CA-4.3 Cambio de código
  Cuando cambio el código de un ramo
  Entonces los ramos que lo tenían como prerrequisito siguen apuntando a él

Escenario: CA-4.4 Estado "No tiene" con requisitos cargados
  Cuando marco "No tiene" en un ramo con prerrequisitos
  Entonces me pregunta si quiero quitarlos

Escenario: CA-4.5 Revisado y siguiente
  Cuando pulso "Revisado y siguiente"
  Entonces el ramo queda revisado y se abre el siguiente sin revisar
  Y cuando no quedan, veo un aviso de que terminé
```

### CA-5 Validaciones

```gherkin
Escenario: CA-5.1 Contador siempre visible
  Entonces el botón "Problemas" muestra la cantidad de errores (rojo), o de avisos (ámbar), o ✓ (verde)

Escenario: CA-5.2 Panel de problemas
  Cuando abro "Problemas"
  Entonces veo "Debes corregir" y "Conviene revisar" por separado
  Y al hacer clic en uno, se abre el ramo o el campo afectado

Escenario: CA-5.3 Problemas del ramo
  Cuando abro un ramo con problemas
  Entonces los veo arriba de su panel
  Y la tarjeta en la malla muestra "! N" o "Revisar"

Escenario: CA-5.4 Tiempo real
  Cuando corrijo algo
  Entonces los problemas se recalculan sin recargar la página
```

### CA-6 Avance, notas y guardado

```gherkin
Escenario: CA-6.1 Progreso
  Entonces arriba veo "X de N revisados" con una barra de avance

Escenario: CA-6.2 Notas
  Entonces veo las advertencias de la IA, puedo marcarlas como resueltas y agregar mis propias notas

Escenario: CA-6.3 Guardado automático
  Cuando cierro la pestaña y vuelvo a abrir la herramienta en el mismo navegador
  Entonces se me ofrece "Continuar donde quedé" con la malla y el avance intactos

Escenario: CA-6.4 Deshacer
  Entonces puedo deshacer cualquier cambio con el botón ↶ o Ctrl+Z (al menos 100 pasos)

Escenario: CA-6.5 Borrador en archivo
  Cuando descargo un borrador y lo cargo en otro computador
  Entonces recupero los ramos revisados y las notas resueltas
```

### CA-7 Descarga del JSON final

```gherkin
Escenario: CA-7.1 Malla lista
  Dado que no hay problemas obligatorios y todos los ramos están revisados
  Cuando pulso "Descargar JSON final"
  Entonces se descarga universidad_carrera_plan.json

Escenario: CA-7.2 Malla incompleta
  Dado que hay problemas obligatorios o ramos sin revisar
  Cuando pulso "Descargar JSON final"
  Entonces veo cuántos faltan, con las opciones "Ver problemas" o "Descargar igual"

Escenario: CA-7.3 Contenido
  Entonces el archivo cumple el esquema mallapro-1 (ver Reglas)
  Y no incluye datos internos de la herramienta (uid, revisado)
  Y las notas sin resolver salen en "advertencias"

Escenario: CA-7.4 Ida y vuelta
  Cuando cargo un JSON final y lo vuelvo a descargar sin cambios
  Entonces ramos, semestres y prerrequisitos son idénticos
```

## Reglas de negocio y formato

### Reglas

- **RN-1** Una malla se identifica por universidad + carrera + año o versión del plan. Una carrera puede tener mallas de distintos años, así que `version_plan` es obligatorio.
- **RN-2** La referencia de un ramo (`ref`) es su código. Si no tiene código, es su número en el documento. Los prerrequisitos se exportan como lista de `ref`.
- **RN-3** Internamente cada ramo tiene un identificador propio (`uid`), así que cambiar un código no rompe ninguna relación. El `uid` nunca se exporta.
- **RN-4** Los prerrequisitos de la lista se cumplen todos («Y»). Una alternativa («A o B») se deja en `prereq_texto` y en una nota hasta que el formato la soporte.
- **RN-5** Un prerrequisito debe estar en un semestre anterior al del ramo que lo pide.
- **RN-6** Los campos que la herramienta no conoce se conservan tal cual, a nivel de ramo y de malla.
- **RN-7** Se puede descargar con problemas, pero solo después de una advertencia explícita.

### Formato de salida `mallapro-1`

```json
{
  "formato": "mallapro-1",
  "carrera": "Bioquímica",
  "universidad": "Universidad de Chile",
  "version_plan": "2024",
  "codigo_programa": "BQ-2024",
  "sistema_creditos": "SCT",
  "total_creditos": 330,
  "semestres": [
    {
      "numero": 2,
      "cursos": [
        {
          "ref": "BQ008",
          "codigo": "BQ008",
          "numero_en_documento": 8,
          "nombre": "Laboratorio de Química General",
          "creditos": 3,
          "prereq_estado": "conocido",
          "prerrequisitos": ["BQ001", "BQ002"],
          "semestres_aprobados_requeridos": null,
          "prereq_texto": null
        }
      ]
    }
  ],
  "advertencias": ["Texto de cada nota sin resolver"],
  "curacion": {
    "curador": "Nombre",
    "fecha": "2026-11-11",
    "ramos_revisados": 60,
    "ramos_totales": 60
  }
}
```

`version_plan` y `curacion` son nuevos respecto al formato definido con Gemini (ver Decisiones abiertas). El borrador agrega `_borrador` con las `ref` revisadas y las notas resueltas. El JSON final no lo incluye.

### Validaciones

| ID | Nivel | Regla | Mensaje (resumen) |
| --- | --- | --- | --- |
| V-01 | Obligatoria | Falta universidad, carrera o `version_plan` | «Falta el año o versión del plan» |
| V-02 | Obligatoria | Malla sin ramos | «La malla no tiene ramos» |
| V-03 | Obligatoria | Ramo sin nombre | «Ramo sin nombre» |
| V-04 | Obligatoria | `ref` repetida (sin distinguir mayúsculas) | «Código repetido» |
| V-05 | Obligatoria | Prerrequisito que no existe | «Prerrequisito que no existe» |
| V-06 | Obligatoria | Prerrequisito en el mismo semestre o en uno posterior | «Prerrequisito en el mismo semestre» |
| V-07 | Obligatoria | Ciclo de prerrequisitos | «Requisitos en círculo» |
| V-08 | Aviso | Créditos vacíos | «Créditos sin definir» |
| V-09 | Aviso | Estado «No sé» | «Prerrequisitos desconocidos» |
| V-10 | Aviso | Estado «Tiene» sin ramos ni semestres requeridos | «Dice tener requisitos, pero no hay ninguno» |
| V-11 | Aviso | Estado «No tiene» con requisitos cargados | «Dice sin requisitos pero tiene» |
| V-12 | Aviso | Ramo sin código | «Usará el número N como referencia» |
| V-13 | Aviso | La suma de créditos no coincide con `total_creditos` | «Los créditos no cuadran» |
| V-14 | Aviso | Semestre vacío | «Semestre vacío» |
| V-15 | Aviso | Notas de la IA sin resolver | «Notas de la IA sin revisar» |

## Requisitos no funcionales

- **RNF-1 Usabilidad:** todos los textos en español simple, sin términos técnicos (JSON, ref, uid) en la interfaz salvo donde sea inevitable. Una persona sin formación técnica debe curar una malla sin ayuda después de leer la guía de inicio.
- **RNF-2 Privacidad:** nada sale del navegador. Sin backend, sin analíticas que envíen contenido y sin llamadas externas, salvo las fuentes tipográficas y el lector de PDF.
- **RNF-3 Rendimiento:** con una malla de 80 ramos y 12 semestres, cualquier edición se refleja en menos de 100 ms y el arrastre se siente fluido.
- **RNF-4 Robustez:** si falla el guardado en el navegador (modo privado o almacenamiento lleno), la app avisa y sugiere descargar un borrador. Nunca pierde datos de forma silenciosa.
- **RNF-5 Accesibilidad:** todo se puede hacer con teclado, incluido mover ramos de semestre, con foco visible y contraste AA en modo claro y oscuro.
- **RNF-6 Navegadores:** Chrome, Edge, Firefox y Safari en sus versiones actuales, en computador. En celular basta con poder revisar, no con editar cómodamente.
- **RNF-7 Despliegue:** se publica en Netlify como sitio estático, en un dominio o subdominio no indexado (`noindex`). Idealmente con contraseña.
- **RNF-8 Mantenibilidad:** la lógica (importar, validar, exportar) vive separada de la interfaz y tiene tests unitarios. El esquema `mallapro-1` vive como JSON Schema compartido con el repositorio de la V2.

## Estado actual del prototipo (v0)

El prototipo `index.html` ya cumple casi todos los criterios funcionales. Lo pendiente es sobre todo calidad: tests, estructura del código, accesibilidad y pruebas con la curadora real. Hasta ahora solo se probó en Chromium, con `BioquimicaUCH.json` y `malla-ejemplo.json`.

| Área | Estado | Qué falta |
| --- | --- | --- |
| CA-1 Documento oficial | Parcial | Probar con PDF reales de varias universidades. Las imágenes no sobreviven a una recarga; se podrían guardar en IndexedDB |
| CA-2 Carga del JSON | Hecho en v0 | Tests con JSON malformados y con mallas grandes |
| CA-3 Edición visual | Hecho en v0 | Arrastre en pantallas táctiles |
| CA-4 Edición de un ramo | Hecho en v0 | CA-4.4 usa el `confirm()` nativo del navegador; cambiarlo por el modal propio |
| CA-5 Validaciones | Hecho en v0 | Tests unitarios por cada regla V-01 a V-15 |
| CA-6 Avance y guardado | Hecho en v0 | Test de recuperación con «Continuar donde quedé» y con borrador |
| CA-7 Descarga | Parcial | Test de ida y vuelta (CA-7.4) y validación contra un JSON Schema |
| RNF-1 Usabilidad | Pendiente | Sesión de prueba con la curadora curando una malla completa |
| RNF-3 Rendimiento | Parcial | Hoy se redibuja la malla entera en cada tecla; medir con 80 ramos |
| RNF-5 Accesibilidad | Parcial | Mover ramos con teclado directo en la tarjeta y revisar contraste |
| RNF-6 Navegadores | Parcial | Probar en Firefox, Safari y Edge |
| RNF-7 Despliegue | Pendiente | Publicar en Netlify con `noindex` y, si se puede, contraseña |
| RNF-8 Mantenibilidad | Pendiente | Todo vive en un archivo, sin tests ni esquema; separar en módulos |

## Decisiones abiertas

Hay que resolverlas antes de pedirle cambios a Claude Code, porque varias afectan el formato de datos de la V2 y no solo al curador.

- [ ] **D-1 ¿Aceptamos `version_plan` y `curacion` en `mallapro-1`?** Si sí, el prompt de Gemini también debería pedir `version_plan`. Si no, el curador no debe exportarlos.
- [ ] **D-2 ¿Cómo se representa «A o B»?** Por ejemplo, grupos de requisitos `[["MAT101"], ["MAT102"]]` o un árbol `{y: [...], o: [...]}`. Esto define CA nuevos para el curador.
- [ ] **D-3 ¿Entran correquisitos y menciones en esta versión?** El prototipo de Figma Make los mostraba, pero el formato no los tiene.
- [ ] **D-4 ¿Un prerrequisito en el mismo semestre es siempre un error?** Hoy es obligatorio corregirlo; si alguna universidad lo permite, debería bajar a aviso.
- [ ] **D-5 ¿Seguimos en HTML y JavaScript sin framework, o migramos a React + Vite como el resto de Malla Pro?** React facilita reutilizar componentes en el editor de mallas de la V2. JavaScript puro mantiene un solo archivo fácil de desplegar.
- [ ] **D-6 ¿Cómo protegemos el sitio?** Opciones: contraseña de Netlify (plan pagado), una URL difícil de adivinar o, más adelante, el login de Firebase de la V2.
- [ ] **D-7 ¿El curador se convierte después en la «Vista curador» de la V2?** Si es así, conviene escribir la lógica pensando en reutilizarla desde ya.

## Tareas y forma de trabajo

### Tareas sugeridas para Taiga

El orden importa: primero se fija el formato y se escriben tests sobre el comportamiento actual, y recién después se reestructura. Así cualquier regresión salta sola.

| # | Tarea | Cubre | Depende de |
| --- | --- | --- | --- |
| T1 | Resolver D-1 a D-5 y escribir `mallapro-1.schema.json` | RN-1 a RN-6, CA-7.3 | — |
| T2 | Montar el repo: Vite, Vitest, Playwright y el prototipo v0 como punto de partida | RNF-8 | T1 |
| T3 | Tests end to end del comportamiento actual (CA-1 a CA-7) contra v0 | Todos los CA | T2 |
| T4 | Separar la lógica en módulos puros: `import.js`, `validate.js`, `export.js`, `state.js` | RNF-8 | T3 |
| T5 | Tests unitarios de V-01 a V-15 y de ida y vuelta | CA-5, CA-7.4 | T4 |
| T6 | Validar la exportación contra el JSON Schema | CA-7.3 | T1, T4 |
| T7 | Guardar las imágenes en IndexedDB | CA-1, CA-6.3 | T4 |
| T8 | Accesibilidad: mover con teclado, modal propio en lugar de `confirm()`, contraste | RNF-5, CA-4.4 | T3 |
| T9 | Rendimiento: redibujar solo lo que cambia, medido con 80 ramos | RNF-3 | T4 |
| T10 | Probar en Firefox, Safari y Edge | RNF-6 | T3 |
| T11 | Desplegar en Netlify con `noindex` y la protección elegida en D-6 | RNF-7 | T10 |
| T12 | Prueba con la curadora sobre una malla real y ajustes | RNF-1 | T11 |

### Cómo trabajarla con Claude Code

1. Guarda esta HU en el repo como `docs/HU-CUR-01.md` y el prototipo como `src/v0/index.html`.
2. En `CLAUDE.md`, indícale que cada cambio cite los IDs que cubre (CA, RN, RNF, V) y que no cambie el formato sin una decisión D cerrada.
3. Trabaja una tarea por sesión. Pide primero un plan y apruébalo antes de que escriba código.
4. Exige que los tests pasen antes de cada commit y que cada PR diga qué criterios verificó.
5. Usa un agente auditor que revise el diff contra esta HU, sin haber visto cómo se escribió.
6. Después de cada tarea, actualiza la tabla de estado de esta HU.

### Definición de terminado

- [ ] Todos los escenarios CA-1 a CA-7 tienen un test que pasa.
- [ ] La exportación de `BioquimicaUCH.json` y `malla-ejemplo.json` valida contra el JSON Schema.
- [ ] La ida y vuelta (CA-7.4) da un archivo idéntico.
- [ ] Sin errores en la consola en Chrome, Firefox, Safari y Edge.
- [ ] Desplegado en Netlify con `noindex`.
- [ ] La curadora curó una malla real completa sin ayuda, y sus observaciones están resueltas o convertidas en HU nuevas.
- [ ] Laura importó ese JSON a Malla Pro V2 sin editarlo a mano.
