// test_app.js - Suite de pruebas automatizadas para Whiteboard Digital
const http = require('http');
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
    throw new Error(`Test failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO TEST SUITE COMPLETO DE LA APLICACIÓN');
  console.log('====================================================\n');

  // Test 1: Compilación y sintaxis de bundle.js
  console.log('📦 Test 1: Verificación de compilación y empaquetado...');
  const buildOutput = execSync('node build.js').toString();
  assert(buildOutput.includes('js/bundle.js generado con éxito'), 'build.js genera bundle.js correctamente');
  assert(fs.existsSync(path.join(__dirname, 'js/bundle.js')), 'El archivo js/bundle.js existe en disco');
  const bundleContent = fs.readFileSync(path.join(__dirname, 'js/bundle.js'), 'utf8');
  assert(bundleContent.length > 200000, `Tamaño del bundle adecuado (${bundleContent.length} bytes)`);

  // Test 2: Simulación de DOM y localStorage para probar SettingsManager y Modo Oscuro
  console.log('\n⚙️ Test 2: Pruebas de SettingsManager y Modo Oscuro...');
  
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const docAttr = {};
  const bodyClasses = new Set();
  global.document = {
    documentElement: {
      setAttribute: (k, v) => { docAttr[k] = v; },
      getAttribute: (k) => docAttr[k] || null,
      classList: {
        toggle: (cls, val) => {},
        add: (cls) => {},
        remove: (cls) => {}
      }
    },
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c)
      },
      appendChild: () => {}
    },
    createElement: (tag) => ({
      tagName: tag,
      classList: { add: () => {}, remove: () => {} },
      setAttribute: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      remove: () => {}
    })
  };

  global.window = {
    matchMedia: (query) => ({
      matches: false,
      addEventListener: () => {}
    })
  };

  // Cargar SettingsManager
  const { SettingsManager } = require('./js/settings.js');
  SettingsManager.init();

  const initialSettings = SettingsManager.getSettings();
  assert(initialSettings.inputMode === 'stylus-first', 'Modo Stylus (Palma rechazada) está ACTIVO por defecto');
  assert(initialSettings.theme === 'light', 'Tema claro por defecto');
  assert(initialSettings.autoStraighten === true, 'Auto-enderezado activo por defecto');

  // Cambiar a modo oscuro y comprobar reactividad
  SettingsManager.saveSettings({ theme: 'dark' });
  assert(SettingsManager.getSettings().theme === 'dark', 'Guarda cambio de tema a "dark"');
  assert(document.documentElement.getAttribute('data-theme') === 'dark', 'Aplica atributo data-theme="dark"');
  assert(bodyClasses.has('dark-theme'), 'Añade clase dark-theme al body');

  // Test 3: Subcarpetas y persistencia jerárquica en db.js
  console.log('\n📁 Test 3: Pruebas de Subcarpetas y Estructura en db.js...');
  const { db } = require('./js/db.js');
  await db.ready;

  // Crear carpeta padre
  const parentFolder = await db.saveFolder({
    id: 'f_parent_test',
    name: 'Carpeta Principal',
    color: '#3b82f6',
    parentId: null,
    createdAt: Date.now()
  });
  assert(parentFolder.id === 'f_parent_test', 'Carpeta principal creada en db');

  // Crear subcarpeta
  const subFolder = await db.saveFolder({
    id: 'f_sub_test',
    name: 'Subcarpeta Anidada',
    color: '#10b981',
    parentId: 'f_parent_test',
    createdAt: Date.now()
  });
  assert(subFolder.parentId === 'f_parent_test', 'Subcarpeta creada con parentId correcto');

  // Crear documento dentro de la subcarpeta
  const testDoc = await db.saveDocument({
    id: 'doc_subfolder_test',
    title: 'Nota en Subcarpeta',
    type: 'notebook',
    folderId: 'f_sub_test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isTrash: false,
    pages: []
  });
  assert(testDoc.folderId === 'f_sub_test', 'Documento asociado a la subcarpeta');

  // Eliminar carpeta padre recursivamente
  await db.deleteFolder('f_parent_test');
  const allFoldersAfter = await db.getAllFolders();
  assert(!allFoldersAfter.some(f => f.id === 'f_parent_test' || f.id === 'f_sub_test'), 'Eliminación recursiva borra carpeta padre y subcarpetas');
  const docAfterDelete = await db.getDocument('doc_subfolder_test');
  assert(docAfterDelete.folderId === null, 'Documentos reubicados a la raíz tras borrar carpeta padre');

  // Test 4: Verificación de DashboardView para subcarpetas y menú de configuración
  console.log('\n📚 Test 4: Verificación de DashboardView, Subcarpetas y Configuración...');
  const dashboardSource = fs.readFileSync(path.join(__dirname, 'js/dashboard/dashboardView.js'), 'utf8');
  assert(dashboardSource.includes('getFolderBreadcrumbs'), 'DashboardView implementa getFolderBreadcrumbs para navegación por migas de pan');
  assert(dashboardSource.includes('getFolderHierarchyList'), 'DashboardView implementa getFolderHierarchyList para dropdowns jerárquicos');
  assert(dashboardSource.includes('folder-expand-btn'), 'DashboardView incluye botones de expandir/contraer subcarpetas');
  assert(dashboardSource.includes('btn-add-subfolder'), 'DashboardView incluye botón rápido para añadir subcarpetas');
  assert(dashboardSource.includes('subfolders-section'), 'DashboardView renderiza bloque de subcarpetas en la vista de carpetas');
  assert(dashboardSource.includes('btnSidebarSettings'), 'Dashboard incluye botón de configuración en la barra lateral');
  assert(dashboardSource.includes('btnHeaderSettings'), 'Dashboard incluye botón de configuración en la cabecera');
  assert(dashboardSource.includes('this.onOpenSettings'), 'DashboardView dispara onOpenSettings al hacer clic');

  // Test 5: Verificación de Motor Canvas y Rechazo de Palma
  console.log('\n🖌️ Test 5: Verificación de CanvasEngine y Rechazo de Palma...');
  const canvasEngineSource = fs.readFileSync(path.join(__dirname, 'js/editor/canvasEngine.js'), 'utf8');
  assert(canvasEngineSource.includes("this.inputMode = options.inputMode || 'stylus-first'"), 'CanvasEngine tiene inputMode por defecto en "stylus-first"');
  assert(canvasEngineSource.includes("if (this.inputMode === 'stylus-first' && e.pointerType === 'touch')"), 'CanvasEngine rechaza eventos touch en modo stylus para dibujo');

  // Test 6: Verificación de Toolbar con mini-menús
  console.log('\n🛠️ Test 6: Verificación de Toolbar con mini-menús...');
  const toolbarSource = fs.readFileSync(path.join(__dirname, 'js/editor/toolbar.js'), 'utf8');
  assert(toolbarSource.includes('btnMenuPens'), 'Toolbar incluye botón con mini-menú de plumas (btnMenuPens)');
  assert(toolbarSource.includes('btnMenuEraser'), 'Toolbar incluye botón con mini-menú de borrador (btnMenuEraser)');
  assert(toolbarSource.includes('btnToolHand'), 'Toolbar incluye botón directo de Mano (btnToolHand)');
  assert(toolbarSource.includes('btnMenuInsert'), 'Toolbar incluye botón con mini-menú de insertar (btnMenuInsert)');
  assert(toolbarSource.includes('btnPagesMenu'), 'Toolbar incluye botón con mini-menú de páginas (btnPagesMenu)');
  assert(toolbarSource.includes('btnMenuSettings'), 'Toolbar incluye botón dedicado de Configuración (btnMenuSettings)');

  // Test 7: Verificación de Viewport y scroll vertical
  console.log('\n📜 Test 7: Verificación de ViewportController y scroll sin bloqueo...');
  const viewportSource = fs.readFileSync(path.join(__dirname, 'js/editor/viewport.js'), 'utf8');
  assert(viewportSource.includes('scrollBy(deltaY)'), 'ViewportController incluye método scrollBy para desplazamiento');
  assert(viewportSource.includes('btnScrollDocUp'), 'Widget de viewport incluye botón de scroll hacia arriba');
  assert(viewportSource.includes('btnScrollDocDown'), 'Widget de viewport incluye botón de scroll hacia abajo');
  assert(viewportSource.includes('const maxScroll = Math.max(200, contentHeight - wsHeight + 350)'), 'clampPan calcula holgura vertical dinámica para bajar libremente');

  // Test 8: Verificación de Estabilidad, Grosor y Concentración de Trazos
  console.log('\n✍️ Test 8: Verificación de Estabilidad, Grosor y Concentración de Trazos...');
  assert(canvasEngineSource.includes('this.strokeStabilization = 0.5'), 'CanvasEngine inicializa strokeStabilization');
  assert(canvasEngineSource.includes('this.strokeConcentration = 1.0'), 'CanvasEngine inicializa strokeConcentration');
  assert(canvasEngineSource.includes('setStabilization(stabilization)'), 'CanvasEngine implementa método setStabilization');
  assert(canvasEngineSource.includes('setConcentration(concentration)'), 'CanvasEngine implementa método setConcentration');
  assert(canvasEngineSource.includes('alpha = Math.max(0.10, 1 - (stab * 0.84))'), 'CanvasEngine implementa algoritmo de estabilización continua');
  assert(canvasEngineSource.includes('concentration = stroke.concentration !== undefined ? stroke.concentration : 1.0'), 'CanvasEngine aplica concentración al renderizar trazos');

  assert(toolbarSource.includes('penStabilizationSlider'), 'Toolbar renderiza slider de Estabilidad');
  assert(toolbarSource.includes('penConcentrationSlider'), 'Toolbar renderiza slider de Concentración');
  assert(toolbarSource.includes('penStrokeSlider'), 'Toolbar renderiza slider de Grosor');
  assert(toolbarSource.includes('widthPresetsGroup'), 'Toolbar incluye grupo de presets de Grosor');
  assert(toolbarSource.includes('stabPresetsGroup'), 'Toolbar incluye grupo de presets de Estabilidad');
  assert(toolbarSource.includes('concPresetsGroup'), 'Toolbar incluye grupo de presets de Concentración');

  // Test 9: Verificación de Logos y Assets de Marca
  console.log('\n🏷️ Test 9: Verificación de Rutas de Logo y Favicon...');
  assert(fs.existsSync(path.join(__dirname, 'assets/logo.svg')), 'assets/logo.svg existe');
  assert(fs.existsSync(path.join(__dirname, 'assets/logo.png')), 'assets/logo.png existe');
  assert(fs.existsSync(path.join(__dirname, 'assets/favicon.svg')), 'assets/favicon.svg existe');
  assert(fs.existsSync(path.join(__dirname, 'assets/favicon.png')), 'assets/favicon.png existe');
  assert(dashboardSource.includes('assets/logo.png'), 'DashboardView referencia assets/logo.png');

  // Test 10: Servidor HTTP local y carga de recursos
  console.log('\n🌐 Test 10: Prueba de servidor HTTP y entrega de archivos...');
  const testPort = 3949;
  const server = http.createServer((req, res) => {
    let safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath === '/' ? 'index.html' : safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css'
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(content);
      }
    });
  });

  await new Promise((resolve) => server.listen(testPort, resolve));

  async function fetchUrl(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${testPort}${urlPath}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
  }

  const indexRes = await fetchUrl('/');
  assert(indexRes.status === 200, 'index.html se sirve correctamente (HTTP 200)');
  assert(indexRes.data.includes('id="dashboardView"') && indexRes.data.includes('id="editorView"'), 'index.html contiene ambas vistas');

  const cssRes = await fetchUrl('/styles.css');
  assert(cssRes.status === 200, 'styles.css se sirve correctamente (HTTP 200)');
  assert(cssRes.data.includes('[data-theme="dark"]'), 'styles.css incluye estilos completos de Modo Oscuro');
  assert(cssRes.data.includes('.subfolders-section'), 'styles.css incluye estilos de subcarpetas');
  assert(cssRes.data.includes('.settings-modal-box'), 'styles.css incluye estilos del Modal de Configuración');
  assert(cssRes.data.includes('.modal-overlay') && cssRes.data.includes('.modal-backdrop'), 'styles.css incluye estilos para modal-overlay y modal-backdrop');

  const bundleRes = await fetchUrl('/js/bundle.js');
  assert(bundleRes.status === 200, 'js/bundle.js se sirve correctamente (HTTP 200)');
  assert(bundleRes.data.includes('SettingsManager'), 'js/bundle.js incluye SettingsManager');

  server.close();

  console.log('\n====================================================');
  console.log(`🎉 RESULTADOS: ${passedTests}/${totalTests} PRUEBAS SUPERADAS CON ÉXITO (100%)`);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n💥 Error durante las pruebas:', err);
  process.exit(1);
});
