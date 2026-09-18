# 🎨 Rutas y Guía de Logos del Sitio Web

En esta carpeta (`assets/`) se almacenan el logo, favicon y recursos gráficos de la aplicación web.

---

## 📁 Archivos y Rutas Disponibles

| Archivo | Ruta | Uso / Destino | Dimensiones recomendadas |
| :--- | :--- | :--- | :--- |
| **Logo Vectorial** | [`assets/logo.svg`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/assets/logo.svg) | Logo principal en la cabecera del Dashboard y favicon moderno SVG | Vectorial SVG (escalable) |
| **Logo PNG (Alta Resolución)** | [`assets/logo.png`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/assets/logo.png) | Logo en PNG, Apple Touch Icon y fallback | 512 × 512 px (PNG transparente) |
| **Favicon PNG** | [`assets/favicon.png`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/assets/favicon.png) | Icono de pestaña del navegador | 64 × 64 px o 32 × 32 px |
| **Favicon ICO** | [`assets/favicon.ico`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/assets/favicon.ico) | Compatibilidad navegadores heredados | 32 × 32 px / Multi-size |

---

## 🔄 ¿Cómo cambiar el logo?

1. **Sustituir archivos**:
   - Para cambiar el logo del sitio web, simplemente reemplaza los archivos `assets/logo.svg` y `assets/logo.png` con tu diseño.
   - Para cambiar el icono de la pestaña, reemplaza `assets/favicon.png` o `assets/favicon.svg`.
2. **Sincronizar con la versión Android**:
   - Ejecuta:
     ```bash
     node build.js
     ```
   - Esto sincronizará automáticamente los nuevos archivos de `assets/` hacia la aplicación Android (`andorid-version/app/src/main/assets/www/assets/`).

