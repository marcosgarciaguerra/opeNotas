# 📝 opeNotas

<p align="center">
  <img src="assets/logo.svg" alt="opeNotas" width="180">
</p>

<p align="center">
  <strong>Cuadernos digitales y pizarra interactiva para tomar apuntes de forma rápida, cómoda y organizada.</strong>
</p>

<p align="center">
  <a href="https://github.com/marcosgarciaguerra/opeNotas">
    <img src="https://img.shields.io/github/stars/marcosgarciaguerra/opeNotas?style=for-the-badge" alt="GitHub Stars">
  </a>
  <a href="https://github.com/marcosgarciaguerra/opeNotas/issues">
    <img src="https://img.shields.io/github/issues/marcosgarciaguerra/opeNotas?style=for-the-badge" alt="GitHub Issues">
  </a>
  <img src="https://img.shields.io/github/license/marcosgarciaguerra/opeNotas?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/github/languages/top/marcosgarciaguerra/opeNotas?style=for-the-badge" alt="Top Language">
</p>

<p align="center">
  <a href="#-características">Características</a> •
  <a href="#-instalación">Instalación</a> •
  <a href="#-uso">Uso</a> •
  <a href="#-arquitectura">Arquitectura</a> •
  <a href="#-contribuir">Contribuir</a>
</p>

---

## 📖 Sobre el proyecto

**opeNotas** es una aplicación web de notas manuscritas basada en HTML5 Canvas.

Está pensada para trabajar con **ratón, pantalla táctil o lápiz digital**, permitiendo crear cuadernos, organizar páginas y carpetas, escribir y dibujar libremente y exportar los apuntes a PDF.

El proyecto busca proporcionar una alternativa sencilla y flexible para tomar apuntes digitales, especialmente en dispositivos con soporte para stylus.

---

## ✨ Características

* 📚 **Cuadernos y carpetas** para organizar los apuntes.
* ✍️ **Escritura manuscrita** mediante Canvas.
* 🖊️ **Soporte para stylus** y dispositivos táctiles.
* 🧹 **Borrador y selección** de elementos.
* 🔤 **Texto** directamente sobre el documento.
* 🔷 **Formas geométricas**.
* 🖼️ **Inserción de imágenes**.
* 🤚 **Desplazamiento del lienzo**.
* 📄 **Formatos A4 y pizarra**.
* 📤 **Exportación a PDF**.
* 🌙 **Tema claro y oscuro**.
* 💾 **Persistencia local**.
* 📱 **Soporte para versión Android**.
* 🧪 **Suite de tests automatizados**.

---

## 🖥️ Capturas

> Las capturas de pantalla ayudan a entender rápidamente el proyecto antes de instalarlo.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard de opeNotas" width="800">
</p>

<p align="center">
  <img src="docs/screenshots/editor.png" alt="Editor de opeNotas" width="800">
</p>

> **Nota:** sustituye estas imágenes por capturas reales del proyecto y crea el directorio `docs/screenshots/`.

---

## 🚀 Instalación

### Requisitos

* [Node.js](https://nodejs.org/) 18 o superior.
* npm.

### Clonar el repositorio

```bash
git clone https://github.com/marcosgarciaguerra/opeNotas.git
cd opeNotas
```

### Generar el bundle

```bash
npm run build
```

### Ejecutar

```bash
npm start
```

Abre posteriormente:

```text
http://localhost:3000
```

---

## 🧑‍💻 Desarrollo

Durante el desarrollo puedes regenerar el bundle con:

```bash
npm run build
```

Y ejecutar la suite de pruebas mediante:

```bash
npm test
```

Flujo recomendado:

```bash
npm run build
npm test
npm start
```

---

## 🧪 Tests

El proyecto incluye pruebas automatizadas para comprobar diferentes partes de la aplicación.

Entre ellas:

* Generación del bundle.
* Sintaxis JavaScript.
* Dashboard.
* Persistencia de datos.
* Creación y eliminación de carpetas.
* Navegación.
* Editor Canvas.
* Herramientas de dibujo.
* Stylus.
* Viewport.
* Configuración.
* Assets.
* Servidor HTTP.

Ejecuta:

```bash
npm test
```

---

## 🏗️ Arquitectura

La aplicación está dividida principalmente en tres áreas:

```text
                         ┌──────────────────┐
                         │    index.html    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    js/bundle.js  │
                         └────────┬─────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
                  ▼               ▼               ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │   Dashboard  │ │    Editor    │ │  Settings    │
          └──────┬───────┘ └──────┬───────┘ └──────────────┘
                 │                │
                 ▼                ▼
          ┌──────────────┐ ┌──────────────┐
          │      DB      │ │    Canvas    │
          └──────────────┘ └──────────────┘
```

### Principales módulos

```text
js/
├── dashboard/
│   ├── contextMenu.js
│   └── dashboardView.js
│
├── editor/
│   ├── canvasEngine.js
│   ├── coverDesigner.js
│   ├── exporter.js
│   ├── imageTool.js
│   ├── selectionTool.js
│   ├── shapeTool.js
│   ├── textTool.js
│   ├── toolbar.js
│   └── viewport.js
│
├── app.js
├── db.js
├── icons.js
└── settings.js
```

---

## 🔄 Flujo de datos

```text
Usuario
   │
   ▼
Dashboard
   │
   ├── Crear cuaderno
   ├── Crear carpeta
   └── Abrir documento
          │
          ▼
       Editor
          │
          ├── Canvas
          ├── Texto
          ├── Formas
          ├── Imágenes
          └── Selección
          │
          ▼
      Persistencia
          │
          ▼
      Exportación PDF
```

---

## 🛠️ Tecnologías

| Tecnología | Uso                              |
| ---------- | -------------------------------- |
| HTML5      | Estructura de la aplicación      |
| CSS3       | Interfaz y estilos               |
| JavaScript | Lógica de aplicación             |
| Canvas API | Escritura y dibujo               |
| Node.js    | Servidor y herramientas de build |
| jsPDF      | Exportación a PDF                |
| IndexedDB  | Persistencia local               |
| Android    | Distribución móvil               |

---

## 📦 Scripts

| Comando         | Descripción              |
| --------------- | ------------------------ |
| `npm start`     | Inicia el servidor local |
| `npm run build` | Genera el bundle         |
| `npm test`      | Ejecuta los tests        |

---

## ⚙️ Configuración

El puerto utilizado por el servidor puede modificarse mediante la variable de entorno `PORT`.

### Linux / macOS

```bash
PORT=8080 npm start
```

### Windows PowerShell

```powershell
$env:PORT=8080
npm start
```

---

## 📱 Android

El proyecto incluye soporte para una versión Android.

El proceso de build puede sincronizar automáticamente los recursos web necesarios con la estructura Android cuando esta se encuentra disponible.

```bash
npm run build
```

---

## 🗺️ Roadm
