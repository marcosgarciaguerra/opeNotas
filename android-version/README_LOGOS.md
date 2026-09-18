# 📱 Guía de Logos e Iconos para la App Android

En este proyecto de Android, el icono de la aplicación (Launcher Icon) y los recursos visuales se organizan en las siguientes carpetas estándar de Android.

---

## 📁 Rutas de Iconos Nativos de la Aplicación Android

### 1. Icono del Lanzador (Launcher Icon) por Densidades (PNG)
Coloca aquí tu logo en formato PNG en las resoluciones estándar de Android:

| Densidad | Ruta | Tamaño Requerido |
| :--- | :--- | :--- |
| **MDPI** | `app/src/main/res/mipmap-mdpi/ic_launcher.png` | 48 × 48 px |
| **HDPI** | `app/src/main/res/mipmap-hdpi/ic_launcher.png` | 72 × 72 px |
| **XHDPI** | `app/src/main/res/mipmap-xhdpi/ic_launcher.png` | 96 × 96 px |
| **XXHDPI** | `app/src/main/res/mipmap-xxhdpi/ic_launcher.png` | 144 × 144 px |
| **XXXHDPI** | `app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | 192 × 192 px |
| **Google Play** | `app/src/main/res/drawable/app_logo.png` | 512 × 512 px (32-bit PNG) |

*(Para el icono redondo `ic_launcher_round.png`, reemplaza los archivos correspondientes en cada carpeta `mipmap-*`).*

---

### 2. Iconos Adaptativos Vectoriales (Android 8.0+ / API 26+)
Si prefieres un icono vectorial XML escalable con fondo y primer plano separados:
- **Primer plano (Logo / Silueta)**: [`app/src/main/res/drawable/ic_launcher_foreground.xml`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/andorid-version/app/src/main/res/drawable/ic_launcher_foreground.xml) (108 × 108 dp)
- **Fondo (Color / Degradado)**: [`app/src/main/res/drawable/ic_launcher_background.xml`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/andorid-version/app/src/main/res/drawable/ic_launcher_background.xml) (108 × 108 dp)
- **Definición del icono adaptativo**: [`app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`](file:///c:/Users/Portatil_Marcos/Documents/Programacion/Whiteboard/andorid-version/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml)

---

### 3. Logo dentro de la interfaz Web en Android
- **Ruta**: `app/src/main/assets/www/assets/logo.svg` y `app/src/main/assets/www/assets/logo.png`

---

## 🛠️ Cómo Generar Todos los Iconos Automáticamente desde Android Studio
1. Abre el proyecto `andorid-version` en **Android Studio**.
2. En el explorador de archivos del proyecto, haz clic derecho sobre la carpeta **`app/src/main/res`**.
3. Selecciona **New > Image Asset**.
4. En **Asset Type**, elige **Image** y selecciona tu archivo `logo.png` (512x512).
5. Ajusta el tamaño y el fondo, y pulsa **Next > Finish**.
   *(Android Studio generará automáticamente todas las densidades de mipmap y los iconos adaptativos).*

