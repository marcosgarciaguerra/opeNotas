# 📝 opeNotas

<p align="center">
  <img src="assets/logo.svg" alt="opeNotas Logo" width="180">
</p>

<p align="center">
  <strong>Cuadernos digitales y pizarra interactiva moderna de alto rendimiento para tomar notas, dibujar y estudiar de forma fluida, táctil y organizada.</strong>
</p>

<p align="center">
  <a href="https://github.com/marcosgarciaguerra/opeNotas">
    <img src="https://img.shields.io/github/stars/marcosgarciaguerra/opeNotas?style=for-the-badge&color=2563eb" alt="GitHub Stars">
  </a>
  <a href="https://github.com/marcosgarciaguerra/opeNotas/issues">
    <img src="https://img.shields.io/github/issues/marcosgarciaguerra/opeNotas?style=for-the-badge&color=06b6d4" alt="GitHub Issues">
  </a>
  <img src="https://img.shields.io/badge/Tests-173%2F173%20PASS-10b981?style=for-the-badge" alt="Tests Status">
  <img src="https://img.shields.io/badge/Plataformas-Web%20%7C%20Android-8b5cf6?style=for-the-badge" alt="Platforms">
  <img src="https://img.shields.io/github/license/marcosgarciaguerra/opeNotas?style=for-the-badge&color=64748b" alt="License">
</p>

<p align="center">
  <a href="#-sobre-el-proyecto">Sobre el proyecto</a> •
  <a href="#-características-principales">Características</a> •
  <a href="#-gestos-táctiles-y-atajos">Gestualidad</a> •
  <a href="#-instalación-y-ejecución">Instalación</a> •
  <a href="#-arquitectura-del-sistema">Arquitectura</a> •
  <a href="#-pruebas-y-calidad">Tests</a> •
  <a href="#-soporte-android">Android</a> •
  <a href="#-licencia">Licencia</a>
</p>

---

## 📖 Sobre el proyecto

**opeNotas** es una aplicación de toma de notas manuscritas y pizarra digital construida sobre una arquitectura modular con **HTML5 Canvas 2D acelerado por hardware**. Diseñada específicamente para responder con inmediatez a la interacción mediante **lápiz digital (Stylus / S-Pen)**, **pantallas táctiles multitáctiles** y **ratón**, ofrece una experiencia natural comparable a cuadernos físicos y suites líderes del sector (como Goodnotes, Notability o Samsung Notes).

El proyecto funciona como una aplicación web autónoma sin dependencias externas obligatorias en tiempo de ejecución y se empaqueta de forma transparente en un contenedor nativo de Android mediante un `WebView` de latencia ultra-baja y almacenamiento protegido.

---

## ✨ Características principales

### 🚀 Motor de Dibujo y Rendimiento Vectorial
* **Latencia Ultra-Baja:** Inicialización del contexto gráfico con `desynchronized: true`, garantizando respuesta inmediata de trazo en navegadores modernos y WebView de Android.
* **Curvatura Continua Catmull-Rom:** Algoritmo matemático que convierte los puntos de entrada en **splines cúbicos de Bézier ($C^1$)**, eliminando esquinas angulares, cortes bruscos o temblores en trazos rápidos.
* **Soporte Avanzado para Stylus:** Sensibilidad continua a la presión (`pressure`) y rastreo dinámico del ángulo de inclinación (`tiltX`, `tiltY`) para sombreados realistas.
* **Rechazo de Palma Inteligente (*Palm Rejection*):** Discriminación rigurosa de entradas `pen` frente a `touch`, permitiendo apoyar cómodamente la muñeca sin registrar manchas accidentales.
* **Viewport Culling y Límite de Memoria:** Descarte de renderizado para elementos fuera de la vista y gestión acotada de la pila de Deshacer/Rehacer (`maxUndoSteps = 60`).

### ✏️ Gestualidad Táctil y Herramientas Inteligentes
* **Gestos Multitáctiles Universales:**
  * Toque con **2 dedos:** Deshacer (*Undo*) instantáneo.
  * Toque con **3 dedos:** Rehacer (*Redo*) instantáneo.
* **Botón Físico de Stylus (S-Pen):** Mantener pulsado el botón lateral conmuta temporalmente a la goma de borrar mientras se presiona.
* **Smart Shapes (*Dibujar y Mantener*):** Trazar a mano alzada y sostener la punta quieta al final (~500 ms) encaja la figura automáticamente en líneas rectas, círculos, elipses, cuadrados, rectángulos o triángulos perfectos, con confirmación háptica.
* **Gesto de Tachar (*Scratch-out to erase*):** Un zigzag rápido sobre un trazo, texto o figura lo borra directamente sin necesidad de cambiar a la herramienta borrador.
* **Puntero Láser Neón:** Trazos fluorescentes con estela luminosa y duración de desvanecimiento configurable (de 0.5s a 5s).
* **Regla Interactiva Métrica:** Regla flotante con marcas métricas en mm y cm, rotación suave y proyección magnética de líneas (*snapping*).
* **Borrador con Cursor Visual:** Indicador circular calibrable que refleja exactamente el área de borrado en tiempo real.

### 📄 Plantillas Ricas y Papeles Personalizables
* **Variedad de Patrones de Fondo:**
  * **Liso (`blank`):** Espacio en blanco libre para bocetos e ideas.
  * **Rayado (`ruled`):** Renglones horizontales uniformes para escritura continua.
  * **Cuadrícula (`grid`):** Retícula clásica para matemáticas y diagramas.
  * **Puntos (`dots`):** Plantilla tipo *Bullet Journal*.
  * **Partitura Musical (`music`):** Pentagramas completos con barras de compás.
  * **Milimetrado Técnico (`millimeter`):** Cuadrícula de ingeniería con jerarquía visual (1 mm, 5 mm y 10 mm).
  * **Método Cornell (`cornell`):** Plantilla estructurada para apuntes con columna de ideas clave (*cue column*) y resumen inferior.
* **Contraste Dinámico de Líneas (`isDarkPaper`):** Ajuste armónico automático del color de guías y patrones para evitar deslumbramientos o falta de contraste.
* **5 Tonos de Papel Prémium:** Blanco puro, Marfil/Crema vintage, Sepia clásico, Pizarra oscura y Negro OLED puro.

### 🎨 Ergonomía, Paleta y Modo Zen
* **Modo Zen / Pantalla Completa:** Botón `#btnZenMode` para ocultar barras de herramientas con una transición fluida hacia arriba, maximizando el 100% de la superficie de trabajo.
* **Dock Modular de Útiles:** Barra compacta que admite hasta 8 útiles fijados, reflejando el color y grosor activo en cada botón.
* **Múltiples Instancias de Herramientas:** Permite anclar en la barra varios bolígrafos o rotuladores con diferentes colores y grosores simultáneamente.
* **Paleta de 10 Colores con Modo Edición (`Editar` / `Listo`):**
  * **Modo Normal:** Selección ágil de tonos preestablecidos y selector de color personalizado nativo.
  * **Modo Edición:** Permite sustituir cualquier casilla individualmente sin desplazar los demás colores en cola.
  * **Botón Restablecer:** Recupera los 10 colores originales predeterminados en cualquier momento.

### 📚 Biblioteca y Gestión Documental (Dashboard)
* **Vistas Alternativas:** Alternancia instantánea entre cuadrícula de tarjetas con vista previa y lista detallada con miniaturas, recuento exacto de páginas y fechas.
* **Búsqueda Profunda:** Filtrado en tiempo real que inspecciona títulos, portadas y el contenido textual manuscrito de las notas.
* **Ordenación Multinivel:** Clasificación por fecha de modificación (reciente/antiguo), alfabética (A-Z / Z-A) o por número de páginas.
* **Carpetas y Favoritos:** Organización jerárquica con carpetas y marcado de documentos con estrella dorada.
* **Diseñador de Portadas (`coverDesigner.js`):** Personalización visual de cuadernos con texturas, tonos y tipografías.
* **Flujo Continuo y Reordenación:** Botones para subir (`▲`) o bajar (`▼`) páginas dentro del flujo de lectura del cuaderno.

### 📤 Exportación y Persistencia
* **Exportación a PDF Vectorial:** Generación de documentos PDF de alta calidad página a página mediante `jsPDF`.
* **Copias de Seguridad Completas:** Exportación e importación en formato JSON para respaldar toda la biblioteca con un solo clic.
* **Persistencia Local Segura:** Almacenamiento en IndexedDB con transacciones atómicas.

---

## 🖐️ Gestos táctiles y atajos

| Gesto / Atajo | Acción | Descripción |
| :--- | :--- | :--- |
| **Toque con 2 dedos** | Deshacer (*Undo*) | Revierte la última acción en el lienzo. |
| **Toque con 3 dedos** | Rehacer (*Redo*) | Recupera la acción deshecha. |
| **Botón de Stylus (S-Pen)** | Borrador temporal | Activa la goma mientras el botón lateral esté presionado. |
| **Mantener trazo ~500 ms** | Smart Shapes | Convierte trazos manuales en figuras geométricas limpias. |
| **Zigzag sobre trazo** | Scratch-out | Tachar de forma rápida sobre un elemento lo borra al instante. |
| `Ctrl + Z` / `Cmd + Z` | Deshacer | Atajo de teclado estándar. |
| `Ctrl + Y` / `Cmd + Shift + Z` | Rehacer | Atajo de teclado estándar. |
| `Ctrl + +` / `Ctrl + -` | Zoom | Amplía o reduce el espacio de trabajo. |
| `Ctrl + 0` | Restablecer Zoom | Ajusta la visualización al 100%. |
| `Espacio + Arrastrar` | Desplazamiento | Paneo libre del lienzo. |

---

## 🏗️ Arquitectura del sistema

La aplicación está diseñada bajo el patrón de componentes modulares en JavaScript ES6 vanilla, asegurando máxima velocidad de carga sin sobrecarga de frameworks externos:

```text
opeNotas/
├── assets/                          # Logotipos, favicons e iconos gráficos
├── docs/                            # Documentación y capturas
├── js/
│   ├── app.js                       # Coordinador principal de la aplicación y ciclo de vida
│   ├── db.js                        # Capa de almacenamiento y migraciones en IndexedDB
│   ├── icons.js                     # Repositorio de iconos vectoriales SVG
│   ├── paletteManager.js            # Gestor reactivo de paleta de colores y persistencia
│   ├── settings.js                  # Preferencias globales y sincronización de tema
│   ├── dashboard/
│   │   ├── contextMenu.js           # Menús contextuales del explorador de documentos
│   │   └── dashboardView.js         # Vista de biblioteca (cuadrícula, lista, búsqueda y filtros)
│   └── editor/
│       ├── canvasEngine.js          # Motor 2D de renderizado, trazo Bézier y gestos táctiles
│       ├── coverDesigner.js         # Diseñador y renderizador de portadas para cuadernos
│       ├── exporter.js              # Exportación de notas a PDF y formatos ráster
│       ├── handwritingPredictor.js  # Integración y soporte para reconocimiento HTR
│       ├── imageTool.js             # Inserción, transformación y anclaje de imágenes
│       ├── laserPointer.js          # Puntero láser interactivo con desvanecimiento temporal
│       ├── pagesTray.js             # Bandeja y carrusel de miniaturas de páginas
│       ├── ruler.js                 # Regla métrica con rotación y proyección magnética
│       ├── selectionTool.js         # Herramienta de lazo, transformación y selección
│       ├── shapeTool.js             # Generador de figuras vectoriales (rectángulos, círculos, etc.)
│       ├── textTool.js              # Cuadros de texto enriquecido sobre el lienzo
│       ├── toolbar.js               # Barra de herramientas ergonómica, menús y Modo Zen
│       └── viewport.js              # Controlador de paneo, zoom continuo y soporte multitáctil
├── android-version/                 # Contenedor nativo Android (Gradle, WebView, SAF)
├── build.js                         # Empaquetador modular y sincronizador con Android
├── server.js                        # Servidor HTTP local de desarrollo ligero (Node.js nativo)
├── test_app.js                      # Suite exhaustiva de pruebas unitarias y de integración
├── package.json                     # Metadatos del proyecto y scripts
└── styles.css                       # Sistema de diseño, temas claro/oscuro y componentes UI
```

---

## 🚀 Instalación y ejecución

### Prerrequisitos
* [Node.js](https://nodejs.org/) (versión 18 o superior).
* Gestor de paquetes `npm`.

### 1. Clonar el repositorio
```bash
git clone https://github.com/marcosgarciaguerra/opeNotas.git
cd opeNotas
```

### 2. Construir el paquete
El script de build compila los módulos en `js/bundle.js` y sincroniza automáticamente los activos con el contenedor de Android si está presente:
```bash
npm run build
```

### 3. Iniciar el servidor local
```bash
npm start
```

La aplicación quedará disponible de inmediato en tu navegador en:
```text
http://localhost:3000
```

> **Configuración de puerto personalizada:**
> Puedes definir un puerto alternativo mediante la variable de entorno `PORT`:
> ```bash
> # Linux / macOS
> PORT=8080 npm start
>
> # Windows PowerShell
> $env:PORT=8080; npm start
> ```

---

## 🧪 Pruebas y calidad

El proyecto dispone de un arnés de pruebas automatizadas en `test_app.js` que verifica de forma integral todos los subsistemas sin dependencias de terceros pesadas:

```bash
npm test
```

### Cobertura de la suite de pruebas:
* **Integridad y sintaxis:** Empaquetado `build.js` y validación sintáctica de código.
* **Almacenamiento y base de datos:** Esquemas de IndexedDB, migraciones y serialización JSON.
* **Canvas Engine:** Catmull-Rom a Bézier, Smart Shapes, Scratch-out, Palm Rejection y culling de viewport.
* **Herramientas de dibujo:** Puntero láser, regla interactiva métrica, figuras y cursor de borrado.
* **Gestión de color:** `PaletteManager`, paleta de 10 muestras, modo edición y persistencia.
* **Biblioteca:** Vistas cuadrícula/lista, ordenación, filtrado y búsqueda en profundidad.
* **Seguridad:** Aislamiento de orígenes, sanitización de rutas y políticas CSP.
* **Integración Android:** Detección de modo oscuro de sistema (`FORCE_DARK`) y métodos del puente nativo.

> **Estado actual:** **173 / 173 pruebas superadas con éxito (100% PASS)**.

---

## 📱 Soporte Android

**opeNotas** cuenta con un proyecto Android nativo ubicado en el directorio `android-version/`:

* **Arquitectura:** Aplicación Java basada en `WebView` acelerado por hardware con puente bidireccional `@JavascriptInterface` (`WebAppInterface.java`).
* **Sincronización en caliente de Modo Oscuro:** Compatible con `FORCE_DARK` de Android; detecta cambios de tema del sistema sin reiniciar la aplicación ni interrumpir la sesión de escritura.
* **Copias de Seguridad Seguras:** Los respaldos generados se guardan de forma segura en el almacenamiento accesible en la carpeta dedicada `/openotas`.
* **Sincronización Automática:** Al ejecutar `npm run build`, los archivos estáticos optimizados (`bundle.js`, `styles.css`, `index.html`, imágenes) se copian automáticamente en `android-version/app/src/main/assets/www`.

Para compilar el APK o instalarlo en un dispositivo o emulador:
```bash
cd android-version
./gradlew assembleDebug
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información. Desarróllalo, amplíalo y adáptalo libremente para tus necesidades de estudio y trabajo.
