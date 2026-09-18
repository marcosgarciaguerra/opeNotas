# 📱 opeNotas - Versión para Android

Proyecto nativo Android para **opeNotas**, optimizado para tabletas y móviles Android con soporte de Stylus / S-Pen (Samsung, Xiaomi, Lenovo), aceleración gráfica por hardware a 120Hz, IndexedDB offline y exportación nativa de PDFs a Descargas y Galería.

---

## 🛠️ Estructura del Proyecto

```
andorid-version/
├── app/
│   ├── build.gradle                  # Configuración de compilación Android (minSdk 24, compileSdk 34)
│   ├── proguard-rules.pro            # Reglas ProGuard (protección de interfaces JS)
│   └── src/main/
│       ├── AndroidManifest.xml       # Permisos, aceleración hardware y configuración de actividades
│       ├── java/com/whiteboard/digital/
│       │   ├── MainActivity.java     # WebView con soporte Stylus, pantalla completa y gestión de botón atrás
│       │   └── WebAppInterface.java  # Puente bidireccional JS-Android (Scoped Storage, Háptica, Toast, Share)
│       ├── res/
│       │   ├── drawable/             # Iconos vectoriales adaptativos del lanzador
│       │   ├── layout/               # activity_main.xml (Lienzo WebView de alto rendimiento)
│       │   ├── values/               # Colores, temas claros y cadenas de texto
│       │   ├── values-night/         # Tema oscuro nativo
│       │   └── xml/                  # Reglas de respaldo, seguridad y FileProvider
│       └── assets/www/               # Aplicación web empaquetada 100% offline
│           ├── index.html            # Entry point con viewport adaptativo
│           ├── styles.css            # Hoja de estilos responsiva
│           └── js/
│               ├── bundle.js         # Código modular unificado
│               ├── android-bridge.js # Conexión con APIs nativas de Android
│               └── lib/              # Librerías locales offline (jsPDF)
├── gradle/wrapper/
│   └── gradle-wrapper.properties     # Gradle 8.5
├── build.gradle                      # Buildscript raíz con repositorios oficiales
├── gradle.properties                 # Configuración de memoria JVM y AndroidX
├── settings.gradle                   # Módulos del proyecto
├── test_android.js                   # Suite de pruebas automatizadas
└── README.md                         # Documentación de instalación y compilación
```

---

## 🚀 Cómo Abrir y Compilar en Android Studio

1. **Abrir Android Studio**:
   - Selecciona **"Open"** o **"Import Project"**.
   - Navega hasta la carpeta `andorid-version` y ábrela.

2. **Sincronización Gradle**:
   - Android Studio descargará automáticamente las dependencias (AndroidX, WebKit) y configurará el proyecto.

3. **Ejecutar en Dispositivo o Emulador**:
   - Conecta tu tablet o móvil Android con depuración USB activada (o usa un emulador).
   - Haz clic en el botón verde **"Run" (Shift + F10)**.

4. **Generar APK / Bundle**:
   - Menú: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - El archivo APK resultante se generará en `app/build/outputs/apk/debug/app-debug.apk`.

---

## ⚡ Características Nativas Integradas

- **Aceleración por Hardware**: `android:hardwareAccelerated="true"` y capa de renderizado `LAYER_TYPE_HARDWARE` en WebView para dibujo a 60–120fps sin latencia.
- **S-Pen y Rechazo de Palma**: El lienzo distingue eventos `pointerType === 'pen'` de `pointerType === 'touch'`, permitiendo apoyar la mano libremente mientras se escribe.
- **Scoped Storage (Android 10+)**: Los PDFs se guardan directamente en `Descargas/PizarraDigital` y las imágenes en `Fotos/PizarraDigital`.
- **Compartir Nativo**: Integración con `FileProvider` e `Intent.ACTION_SEND` para compartir cuadernos por WhatsApp, Gmail, Drive, etc.
- **Respuesta Háptica**: Vibración sutil mediante `Vibrator` nativo al trazar formas o cambiar de herramienta.
- **Botón Atrás Físico**: Control inteligente para cerrar modales o volver de la pizarra a la biblioteca de cuadernos.

---

## 🧪 Ejecutar Tests Automatizados

Para verificar la integridad del proyecto Android en cualquier momento:
```bash
node test_android.js
```
*(40/40 tests automáticos cubriendo estructura Gradle, Java, Manifest, XMLs y Assets).*

