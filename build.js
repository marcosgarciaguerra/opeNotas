// build.js - Genera js/bundle.js para soporte nativo offline y ejecución directa sin CORS
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function cleanCode(code) {
  // Elimina imports
  let cleaned = code.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  cleaned = cleaned.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  // Convierte exports al principio de línea en declaraciones normales (sin comerse comentarios)
  cleaned = cleaned.replace(/^\s*export\s+const\s+/gm, 'const ');
  cleaned = cleaned.replace(/^\s*export\s+let\s+/gm, 'let ');
  cleaned = cleaned.replace(/^\s*export\s+var\s+/gm, 'var ');
  cleaned = cleaned.replace(/^\s*export\s+class\s+/gm, 'class ');
  cleaned = cleaned.replace(/^\s*export\s+function\s+/gm, 'function ');
  cleaned = cleaned.replace(/^\s*export\s+default\s+/gm, '');
  cleaned = cleaned.replace(/^\s*export\s+\{[\s\S]*?\};?\s*$/gm, '');
  return cleaned;
}

const files = [
  'js/icons.js',
  'js/settings.js',
  'js/db.js',
  'js/editor/coverDesigner.js',
  'js/editor/canvasEngine.js',
  'js/editor/shapeTool.js',
  'js/editor/textTool.js',
  'js/editor/imageTool.js',
  'js/editor/selectionTool.js',
  'js/editor/toolbar.js',
  'js/editor/viewport.js',
  'js/editor/exporter.js',
  'js/dashboard/contextMenu.js',
  'js/dashboard/dashboardView.js',
  'js/app.js'
];

let bundle = '// js/bundle.js - Auto-generated combined bundle for browser and offline file:// support\n(function() {\n';
for (const f of files) {
  bundle += '\n// === File: ' + f + ' ===\n';
  bundle += cleanCode(fs.readFileSync(path.join(__dirname, f), 'utf8')) + '\n';
}
bundle += '\n})();\n';

fs.writeFileSync(path.join(__dirname, 'js/bundle.js'), bundle, 'utf8');
console.log('js/bundle.js generado con éxito. Tamaño:', bundle.length, 'bytes');

execSync('node --check js/bundle.js');
console.log('Verificación sintáctica de js/bundle.js: CORRECTO.');

// Sincronización automática con assets de Android si el directorio existe
const androidWww = path.join(__dirname, 'andorid-version/app/src/main/assets/www');
const androidRes = path.join(__dirname, 'andorid-version/app/src/main/res');

if (fs.existsSync(androidWww)) {
  fs.mkdirSync(path.join(androidWww, 'js'), { recursive: true });
  fs.mkdirSync(path.join(androidWww, 'assets'), { recursive: true });

  fs.copyFileSync(path.join(__dirname, 'js/bundle.js'), path.join(androidWww, 'js/bundle.js'));
  fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(androidWww, 'styles.css'));

  const assetsDir = path.join(__dirname, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const af of assetFiles) {
      const src = path.join(assetsDir, af);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(androidWww, 'assets', af));
      }
    }
  }

  // Sincronizar logos con res/drawable para Android nativo
  if (fs.existsSync(androidRes)) {
    const drawableDir = path.join(androidRes, 'drawable');
    fs.mkdirSync(drawableDir, { recursive: true });
    if (fs.existsSync(path.join(assetsDir, 'logo.png'))) {
      fs.copyFileSync(path.join(assetsDir, 'logo.png'), path.join(drawableDir, 'logo.png'));
      fs.copyFileSync(path.join(assetsDir, 'logo.png'), path.join(drawableDir, 'app_logo.png'));
      
      const psScript = path.join(__dirname, 'generate_android_icons.ps1');
      if (fs.existsSync(psScript) && process.platform === 'win32') {
        try {
          execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: 'pipe' });
        } catch (err) {}
      }
    }
  }

  console.log('Sincronización con andorid-version (assets/www, res/drawable y mipmaps): COMPLETADA.');
}
