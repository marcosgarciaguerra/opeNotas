// test_android.js - Suite completa de verificación y testeo del proyecto Android
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

console.log('====================================================');
console.log('🚀 INICIANDO TEST SUITE: PROYECTO ANDROID (andorid-version)');
console.log('====================================================\n');

// 1. Verificar Estructura Gradle y Configuración del Proyecto
console.log('📁 Test Grupo 1: Configuración del Proyecto Gradle');
const rootGradle = path.join(__dirname, 'build.gradle');
const settingsGradle = path.join(__dirname, 'settings.gradle');
const gradleProps = path.join(__dirname, 'gradle.properties');
const wrapperProps = path.join(__dirname, 'gradle/wrapper/gradle-wrapper.properties');
const appGradle = path.join(__dirname, 'app/build.gradle');

assert(fs.existsSync(rootGradle), 'build.gradle raíz existe');
assert(fs.existsSync(settingsGradle), 'settings.gradle existe');
assert(fs.existsSync(gradleProps), 'gradle.properties existe');
assert(fs.existsSync(wrapperProps), 'gradle-wrapper.properties existe');
assert(fs.existsSync(appGradle), 'app/build.gradle existe');

const appGradleContent = fs.readFileSync(appGradle, 'utf8');
assert(appGradleContent.includes("namespace 'com.whiteboard.digital'"), 'Namespace correcto com.whiteboard.digital');
assert(appGradleContent.includes('compileSdk 34') && appGradleContent.includes('minSdk 24'), 'SDKs configurados (minSdk 24, compileSdk 34)');
assert(appGradleContent.includes('androidx.webkit:webkit'), 'Dependencia AndroidX WebKit declarada');

// 2. Verificar AndroidManifest.xml y Permisos
console.log('\n📄 Test Grupo 2: AndroidManifest.xml y Permisos');
const manifestPath = path.join(__dirname, 'app/src/main/AndroidManifest.xml');
assert(fs.existsSync(manifestPath), 'AndroidManifest.xml existe');

const manifestContent = fs.readFileSync(manifestPath, 'utf8');
assert(manifestContent.includes('android:name="android.permission.INTERNET"'), 'Permiso INTERNET declarado');
assert(manifestContent.includes('android:name="android.permission.VIBRATE"'), 'Permiso VIBRATE declarado para respuesta háptica');
assert(manifestContent.includes('android:hardwareAccelerated="true"'), 'Aceleración por Hardware habilitada para 120fps en Canvas');
assert(manifestContent.includes('android:name=".MainActivity"'), 'MainActivity registrada como launcher');
assert(manifestContent.includes('androidx.core.content.FileProvider'), 'FileProvider registrado para compartir archivos PDF');

// 3. Verificar Recursos y XMLs
console.log('\n🎨 Test Grupo 3: Recursos Android (Valores, XMLs y Drawables)');
const resDir = path.join(__dirname, 'app/src/main/res');
assert(fs.existsSync(path.join(resDir, 'values/strings.xml')), 'strings.xml existe');
assert(fs.existsSync(path.join(resDir, 'values/colors.xml')), 'colors.xml existe');
assert(fs.existsSync(path.join(resDir, 'values/styles.xml')), 'styles.xml existe');
assert(fs.existsSync(path.join(resDir, 'values-night/styles.xml')), 'Modo oscuro en values-night/styles.xml existe');
assert(fs.existsSync(path.join(resDir, 'layout/activity_main.xml')), 'activity_main.xml layout con WebView existe');
assert(fs.existsSync(path.join(resDir, 'xml/file_paths.xml')), 'file_paths.xml para FileProvider existe');
assert(fs.existsSync(path.join(resDir, 'drawable/ic_launcher_foreground.xml')), 'ic_launcher_foreground.xml icono vectorial existe');

// 4. Verificar Código Fuente Java Nativo
console.log('\n☕ Test Grupo 4: Clases Java y Puente Nativo');
const javaDir = path.join(__dirname, 'app/src/main/java/com/whiteboard/digital');
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const webAppInterfacePath = path.join(javaDir, 'WebAppInterface.java');

assert(fs.existsSync(mainActivityPath), 'MainActivity.java existe');
assert(fs.existsSync(webAppInterfacePath), 'WebAppInterface.java existe');

const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');
assert(mainActivityContent.includes('addJavascriptInterface(new WebAppInterface(this), "Android")'), 'Puente JavaScriptInterface "Android" registrado en WebView');
assert(mainActivityContent.includes('setupFullscreen()'), 'Modo pantalla completa inmersiva configurado');
assert(mainActivityContent.includes('file:///android_asset/www/index.html'), 'URL inicial apunta a assets empaquetados');
assert(mainActivityContent.includes('handleOnBackPressed'), 'Manejo del botón atrás físico integrado');

const webAppInterfaceContent = fs.readFileSync(webAppInterfacePath, 'utf8');
assert(webAppInterfaceContent.includes('@JavascriptInterface') && webAppInterfaceContent.includes('showToast'), 'Método showToast anotado con @JavascriptInterface');
assert(webAppInterfaceContent.includes('savePdfToStorage'), 'Método savePdfToStorage con Scoped Storage implementado');
assert(webAppInterfaceContent.includes('saveImageToGallery'), 'Método saveImageToGallery implementado');
assert(webAppInterfaceContent.includes('triggerHapticFeedback'), 'Método triggerHapticFeedback implementado');
assert(webAppInterfaceContent.includes('shareFile'), 'Método shareFile para compartir con Apps externas implementado');

// 5. Verificar Web Assets Empaquetados en www/ y Logos
console.log('\n🌐 Test Grupo 5: Assets Web Offline y Logos en assets/www/');
const wwwDir = path.join(__dirname, 'app/src/main/assets/www');
assert(fs.existsSync(path.join(wwwDir, 'index.html')), 'assets/www/index.html existe');
assert(fs.existsSync(path.join(wwwDir, 'styles.css')), 'assets/www/styles.css existe');
assert(fs.existsSync(path.join(wwwDir, 'js/bundle.js')), 'assets/www/js/bundle.js existe');
assert(fs.existsSync(path.join(wwwDir, 'js/android-bridge.js')), 'assets/www/js/android-bridge.js existe');
assert(fs.existsSync(path.join(wwwDir, 'js/lib/jspdf.umd.min.js')), 'assets/www/js/lib/jspdf.umd.min.js empaquetado offline existe');
assert(fs.existsSync(path.join(wwwDir, 'assets/logo.svg')), 'assets/www/assets/logo.svg existe');
assert(fs.existsSync(path.join(wwwDir, 'assets/logo.png')), 'assets/www/assets/logo.png existe');
assert(fs.existsSync(path.join(wwwDir, 'assets/favicon.png')), 'assets/www/assets/favicon.png existe');
assert(fs.existsSync(path.join(__dirname, 'app/src/main/res/drawable/logo.png')), 'res/drawable/logo.png nativo existe');
assert(fs.existsSync(path.join(__dirname, 'app/src/main/res/drawable/app_logo.png')), 'res/drawable/app_logo.png nativo existe');

const bundleContent = fs.readFileSync(path.join(wwwDir, 'js/bundle.js'), 'utf8');
assert(bundleContent.length > 50000, `Tamaño del bundle JS verificado (${bundleContent.length} bytes)`);

// 6. Verificación de Integridad Sintáctica JS
console.log('\n🔍 Test Grupo 6: Sintaxis y Ejecución de Scripts');
try {
  execSync('node --check app/src/main/assets/www/js/bundle.js', { cwd: __dirname });
  assert(true, 'Verificación sintáctica de bundle.js superada sin errores');
} catch (e) {
  assert(false, 'Error en bundle.js: ' + e.message);
}

try {
  execSync('node --check app/src/main/assets/www/js/android-bridge.js', { cwd: __dirname });
  assert(true, 'Verificación sintáctica de android-bridge.js superada sin errores');
} catch (e) {
  assert(false, 'Error en android-bridge.js: ' + e.message);
}

// Resumen Final
console.log('\n====================================================');
console.log(`📊 RESULTADO DE TESTS: ${passedTests}/${totalTests} superados (${Math.round(passedTests/totalTests*100)}%)`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('🎉 ¡TODOS LOS TESTS DE ANDROID HAN PASADO CON ÉXITO!');
  process.exit(0);
} else {
  console.error('⚠️ ALGUNOS TESTS FALLARON.');
  process.exit(1);
}

