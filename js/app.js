// js/app.js - Orquestador principal de la aplicación con soporte completo para Cuadernos multi-página y Pizarras
import { db } from './db.js';
import { DashboardView } from './dashboard/dashboardView.js';
import { CanvasEngine } from './editor/canvasEngine.js';
import { SelectionTool } from './editor/selectionTool.js';
import { Toolbar } from './editor/toolbar.js';
import { Exporter } from './editor/exporter.js';
import { ViewportController } from './editor/viewport.js';
import { ShapeTool } from './editor/shapeTool.js';
import { TextTool } from './editor/textTool.js';
import { ImageTool } from './editor/imageTool.js';
import { CoverDesigner } from './editor/coverDesigner.js';
import { LaserPointer } from './editor/laserPointer.js';
import { Ruler } from './editor/ruler.js';
import { HandwritingPredictor } from './editor/HandwritingPredictor.js';
import { PaletteManager } from './paletteManager.js';
import { SettingsManager } from './settings.js';

class App {
  constructor() {
    this.currentDoc = null;
    this.currentPageIndex = 0;
    this.saveTimeout = null;

    this.dashboardEl = document.getElementById('dashboardView');
    this.editorEl = document.getElementById('editorView');
    this.workspaceEl = document.getElementById('editorWorkspace');
    this.paintCanvas = document.getElementById('paintCanvas');
    this.canvasWrapper = document.getElementById('canvasWrapper');

    this.init();
  }

  async init() {
    const settings = SettingsManager.getSettings();

    // 1. Inicializar Motor de Dibujo Vectorial con soporte multi-capa y modo stylus por defecto
    this.canvasEngine = new CanvasEngine(this.paintCanvas, {
      format: 'a4',
      inputMode: settings.inputMode || 'stylus-first',
      onStrokeEnd: () => {
        this.scheduleAutoSave();
        if (this.htrPredictor && this.canvasEngine.strokes.length > 0) {
          const lastStroke = this.canvasEngine.strokes[this.canvasEngine.strokes.length - 1];
          this.htrPredictor.onStrokeFinished(lastStroke);
        }
      }
    });

    // 2. Inicializar Controlador de Zoom y Paneo del Viewport
    this.viewport = new ViewportController(this.workspaceEl, this.canvasWrapper, this.canvasEngine);

    // 3. Inicializar Herramientas de Edición sobre el lienzo
    this.selectionTool = new SelectionTool(this.canvasEngine, this.canvasWrapper);
    this.shapeTool = new ShapeTool(this.canvasEngine, this.canvasWrapper);
    this.textTool = new TextTool(this.canvasEngine, this.canvasWrapper);
    this.imageTool = new ImageTool(this.canvasEngine, this.canvasWrapper);

    // 4. Inicializar Puntero Láser y Regla Interactiva
    this.laserPointer = new LaserPointer(this.canvasWrapper, this.paintCanvas);
    this.ruler = new Ruler(this.canvasWrapper, this.canvasEngine);
    this.canvasEngine.setRuler(this.ruler);
    this.canvasEngine.setLaserPointer(this.laserPointer);

    // 5. Inicializar Reconocedor y Predictor HTR
    this.htrPredictor = new HandwritingPredictor(this.canvasEngine);

    // 6. Inicializar Barra de Herramientas Modular
    this.toolbar = new Toolbar(this.canvasEngine, this.selectionTool, {
      shapeTool: this.shapeTool,
      textTool: this.textTool,
      imageTool: this.imageTool,
      laserPointer: this.laserPointer,
      ruler: this.ruler,
      htrPredictor: this.htrPredictor,
      onBack: () => this.showDashboard(),
      onTitleChange: (newTitle) => {
        if (this.currentDoc) {
          this.currentDoc.title = newTitle;
          this.saveCurrentDocNow();
        }
      },
      onExport: () => {
        if (this.currentDoc) {
          // Guardar cambios pendientes antes de exportar
          if (this.currentPageIndex === -1 && this.currentDoc.cover) {
            const coverData = this.canvasEngine.getPageData();
            this.currentDoc.cover.strokes = coverData.strokes;
            this.currentDoc.cover.shapes = coverData.shapes;
            this.currentDoc.cover.texts = coverData.texts;
            this.currentDoc.cover.images = coverData.images;
          } else if (this.currentDoc.pages && this.currentDoc.pages[this.currentPageIndex]) {
            this.currentDoc.pages[this.currentPageIndex] = this.canvasEngine.getPageData();
          }
          Exporter.showExportModal(this.currentDoc, this.canvasEngine);
        }
      },
      onOpenCover: () => this.switchPage(-1, true),
      onPatternChange: (pattern) => {
        if (this.currentDoc && this.currentDoc.pages) {
          this.changePagePattern(this.currentPageIndex, pattern);
        }
      },
      onPrevPage: () => this.goToPrevPage(),
      onNextPage: () => this.goToNextPage(),
      onAddPage: () => this.addNewPage(),
      onDuplicatePage: () => this.duplicatePage(this.currentPageIndex),
      onDeletePage: () => this.deletePage(this.currentPageIndex),
      onOpenSettings: () => SettingsManager.showSettingsModal()
    });

    // 6. Inicializar Vista de Dashboard (Biblioteca Digital)
    this.dashboardView = new DashboardView({
      onOpenDoc: (doc) => this.openDocument(doc),
      onCreateNotebook: (folderId, title, coverConfig, initialPageConfig, openImmediately) =>
        this.createNotebookWithConfig(folderId, title, coverConfig, initialPageConfig, openImmediately),
      onCreateBoard: (folderId, title) => this.createDocument('whiteboard', folderId, title, true),
      onCreateDocOnly: (type, folderId, title) => this.createDocument(type, folderId, title, false),
      onExportDoc: (doc) => this.exportDirectFromDoc(doc),
      onOpenSettings: () => SettingsManager.showSettingsModal()
    });

    // Sincronizar cambios de configuración en vivo
    SettingsManager.on('change', (newSettings) => {
      if (newSettings.inputMode && this.canvasEngine) {
        this.canvasEngine.setInputMode(newSettings.inputMode);
      }
    });

    // Mostrar Dashboard por defecto
    this.showDashboard();
  }

  showDashboard() {
    if (this.currentDoc) {
      this.saveCurrentDocNow();
      this.currentDoc = null;
    }

    this.dashboardEl.classList.remove('hidden');
    this.editorEl.classList.add('hidden');
    this.dashboardView.loadAndRender();
  }

  async showEditor() {
    this.dashboardEl.classList.add('hidden');
    this.editorEl.classList.remove('hidden');
    this.selectionTool.syncDimensions();
    this.shapeTool.syncDimensions();
  }

  async openDocument(doc) {
    this.currentDoc = doc;
    this.currentPageIndex = 0;

    const isNotebook = doc.type === 'notebook';

    // Asegurar estructura de la portada si es un cuaderno
    if (isNotebook && this.currentDoc.cover) {
      this.currentDoc.cover.isCover = true;
      this.currentDoc.cover.strokes = this.currentDoc.cover.strokes || [];
      this.currentDoc.cover.shapes = this.currentDoc.cover.shapes || [];
      this.currentDoc.cover.texts = this.currentDoc.cover.texts || [];
      this.currentDoc.cover.images = this.currentDoc.cover.images || [];
    }

    // Asegurar pauta por defecto del cuaderno
    if (isNotebook) {
      this.currentDoc.defaultPattern = this.currentDoc.defaultPattern || (this.currentDoc.pages && this.currentDoc.pages[0]?.backgroundPattern) || 'grid';
      this.currentDoc.defaultPaperColor = this.currentDoc.defaultPaperColor || (this.currentDoc.pages && this.currentDoc.pages[0]?.paperColor) || '#ffffff';
    }

    // Asegurar estructura multi-página con pauta unificada
    if (!this.currentDoc.pages || this.currentDoc.pages.length === 0) {
      this.currentDoc.pages = [
        {
          id: 'page_1',
          backgroundPattern: isNotebook ? this.currentDoc.defaultPattern : 'dots',
          paperColor: isNotebook ? this.currentDoc.defaultPaperColor : '#ffffff',
          strokes: [],
          shapes: [],
          texts: [],
          images: []
        }
      ];
    } else if (isNotebook) {
      // Unificar la pauta en todas las hojas existentes del cuaderno (excepto portada y páginas con fondo PDF)
      this.currentDoc.pages.forEach(p => {
        if (!p.backgroundImage) {
          p.backgroundPattern = this.currentDoc.defaultPattern;
          p.paperColor = this.currentDoc.defaultPaperColor;
        }
      });
    }

    const format = doc.pageFormat || (isNotebook ? 'a4' : 'board');
    this.canvasEngine.setFormat(format);
    this.toolbar.setFormat(format);

    if (isNotebook) {
      this.canvasEngine.setBackgroundPattern(this.currentDoc.defaultPattern);
      this.canvasEngine.setPaperColor(this.currentDoc.defaultPaperColor);
      this.renderNotebookStream();
    } else {
      this.renderWhiteboardCanvas();
    }

    // Configurar título y herramienta inicial
    this.toolbar.setDocTitle(doc.title);
    this.toolbar.selectTool('pen');
    this.toolbar.updatePatternIcon();

    if (isNotebook) {
      this.toolbar.updatePageCounter(this.currentPageIndex, this.currentDoc.pages.length);
    }

    await this.showEditor();
    requestAnimationFrame(() => {
      this.viewport.centerContent();
    });
  }

  renderWhiteboardCanvas() {
    this.canvasWrapper.className = 'canvas-wrapper wrapper-board';
    this.canvasWrapper.innerHTML = `<canvas id="paintCanvas" width="1800" height="1200"></canvas>`;
    this.paintCanvas = this.canvasWrapper.querySelector('#paintCanvas');

    const initialPage = this.currentDoc.pages[0];
    this.canvasEngine.attachCanvas(this.paintCanvas, initialPage);
    this.selectionTool.setHost(this.paintCanvas, this.canvasWrapper);
    this.shapeTool.setHost(this.paintCanvas, this.canvasWrapper);
    this.textTool.setHost(this.paintCanvas, this.canvasWrapper);
    this.imageTool.setHost(this.paintCanvas, this.canvasWrapper);
    if (this.laserPointer) this.laserPointer.setHost(this.paintCanvas, this.canvasWrapper);
  }

  renderNotebookStream() {
    this.canvasWrapper.className = 'canvas-wrapper wrapper-notebook notebook-stream-view';

    const hasCover = Boolean(this.currentDoc.cover);
    const totalPages = this.currentDoc.pages.length + (hasCover ? 1 : 0);

    const coverHtml = hasCover ? `
      <div class="notebook-page-wrapper notebook-cover-wrapper ${this.currentPageIndex === -1 ? 'active-page-wrapper' : ''}" id="pageWrapper_cover" data-page-index="-1">
        <div class="page-top-bar cover-top-bar">
          <span class="page-top-pill cover-pill">Página 1 (Portada) de ${totalPages}</span>
        </div>
        <div class="page-canvas-host cover-canvas-host" id="pageCanvasHost_cover">
          <canvas id="pageCanvas_cover" class="notebook-page-canvas notebook-cover-canvas" data-page-index="-1" width="794" height="1123"></canvas>
        </div>
      </div>
    ` : '';
    
    const pagesHtml = this.currentDoc.pages.map((p, idx) => {
      const pageNum = hasCover ? idx + 2 : idx + 1;
      return `
        <div class="notebook-page-wrapper ${idx === this.currentPageIndex ? 'active-page-wrapper' : ''}" id="pageWrapper_${idx}" data-page-index="${idx}">
          <div class="page-top-bar">
            <span class="page-top-pill">Página ${pageNum} de ${totalPages}</span>
            <div class="page-top-actions">
              <button type="button" class="page-top-btn btn-pattern-page" data-page-idx="${idx}" title="Cambiar pauta de todo el cuaderno">
                Pauta: ${this.getPatternLabel(this.currentDoc.defaultPattern || p.backgroundPattern)}
              </button>
              <button type="button" class="page-top-btn btn-dup-page" data-page-idx="${idx}" title="Duplicar esta página">
                Duplicar
              </button>
              <button type="button" class="page-top-btn btn-del-page" data-page-idx="${idx}" title="Eliminar esta página" ${this.currentDoc.pages.length <= 1 ? 'disabled style="opacity:0.4;"' : ''}>
                Eliminar
              </button>
            </div>
          </div>
          <div class="page-canvas-host" id="pageCanvasHost_${idx}">
            <canvas id="pageCanvas_${idx}" class="notebook-page-canvas" data-page-index="${idx}" width="794" height="1123"></canvas>
          </div>
        </div>
      `;
    }).join('');

    this.canvasWrapper.innerHTML = `
      <div class="notebook-stream-container" id="notebookStreamContainer">
        ${coverHtml}
        ${pagesHtml}
        <div class="notebook-stream-footer">
          <button type="button" class="btn-add-page-stream" id="btnAddPageStream">
            ${Icons.plus}
            <span>Añadir Nueva Página</span>
          </button>
        </div>
      </div>
    `;

    // Renderizar Portada si procede
    if (hasCover) {
      const coverCanvas = this.canvasWrapper.querySelector('#pageCanvas_cover');
      if (coverCanvas) {
        this.currentDoc.cover.isCover = true;
        this.canvasEngine.renderPageToCanvas(coverCanvas, this.currentDoc.cover);
        coverCanvas.addEventListener('pointerdown', () => {
          if (this.currentPageIndex !== -1) {
            this.switchPage(-1, false);
          }
        }, { capture: true });
      }
    }

    // Renderizar contenidos de cada página en su canvas con la pauta unificada
    this.currentDoc.pages.forEach((pageData, idx) => {
      if (!pageData.backgroundImage) {
        pageData.backgroundPattern = this.currentDoc.defaultPattern || pageData.backgroundPattern || 'grid';
        pageData.paperColor = this.currentDoc.defaultPaperColor || pageData.paperColor || '#ffffff';
      }
      const cEl = this.canvasWrapper.querySelector(`#pageCanvas_${idx}`);
      if (cEl) {
        this.canvasEngine.renderPageToCanvas(cEl, pageData);
      }
    });

    // Conectar motor a la página activa (incluyendo portada si está seleccionada)
    this.attachActivePage(this.currentPageIndex, false);

    // Eventos de clic / toque en cada página para activarla
    this.currentDoc.pages.forEach((_, idx) => {
      const cEl = this.canvasWrapper.querySelector(`#pageCanvas_${idx}`);
      if (cEl) {
        cEl.addEventListener('pointerdown', () => {
          if (this.currentPageIndex !== idx) {
            this.switchPage(idx, false);
          }
        }, { capture: true });
      }
    });

    // Eventos en botones de cabecera de página
    this.canvasWrapper.querySelectorAll('.btn-pattern-page').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pIdx = Number(btn.dataset.pageIdx);
        this.promptChangePagePattern(pIdx, btn);
      });
    });

    this.canvasWrapper.querySelectorAll('.btn-dup-page').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pIdx = Number(btn.dataset.pageIdx);
        this.duplicatePage(pIdx);
      });
    });

    this.canvasWrapper.querySelectorAll('.btn-del-page').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pIdx = Number(btn.dataset.pageIdx);
        this.deletePage(pIdx);
      });
    });

    const addBtn = this.canvasWrapper.querySelector('#btnAddPageStream');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addNewPage();
      });
    }
  }

  attachActivePage(pageIndex, syncData = true) {
    // Si la página activa es la portada
    if (pageIndex === -1) {
      this.canvasWrapper.querySelectorAll('.notebook-page-wrapper').forEach(el => {
        el.classList.remove('active-page-wrapper');
      });
      const coverWrapper = this.canvasWrapper.querySelector('#pageWrapper_cover');
      if (coverWrapper) {
        coverWrapper.classList.add('active-page-wrapper');
      }
      const coverCanvas = this.canvasWrapper.querySelector('#pageCanvas_cover');
      const coverHost = this.canvasWrapper.querySelector('#pageCanvasHost_cover');
      if (coverCanvas && coverHost && this.currentDoc.cover) {
        this.currentDoc.cover.isCover = true;
        this.canvasEngine.attachCanvas(coverCanvas, this.currentDoc.cover);
        this.selectionTool.setHost(coverCanvas, coverHost);
        this.shapeTool.setHost(coverCanvas, coverHost);
        this.textTool.setHost(coverCanvas, coverHost);
        this.imageTool.setHost(coverCanvas, coverHost);
        if (this.laserPointer) this.laserPointer.setHost(coverCanvas, coverHost);
      }
      return;
    }

    const activeCanvas = this.canvasWrapper.querySelector(`#pageCanvas_${pageIndex}`);
    const activeHost = this.canvasWrapper.querySelector(`#pageCanvasHost_${pageIndex}`);
    if (!activeCanvas || !activeHost) return;

    // Actualizar estilo visual activo
    this.canvasWrapper.querySelectorAll('.notebook-page-wrapper').forEach(el => {
      const pIdx = el.dataset.pageIndex !== undefined ? Number(el.dataset.pageIndex) : null;
      if (pIdx === pageIndex) {
        el.classList.add('active-page-wrapper');
      } else {
        el.classList.remove('active-page-wrapper');
      }
    });

    const pageData = this.currentDoc.pages[pageIndex];
    this.canvasEngine.attachCanvas(activeCanvas, pageData);
    this.selectionTool.setHost(activeCanvas, activeHost);
    this.shapeTool.setHost(activeCanvas, activeHost);
    this.textTool.setHost(activeCanvas, activeHost);
    this.imageTool.setHost(activeCanvas, activeHost);
    if (this.laserPointer) this.laserPointer.setHost(activeCanvas, activeHost);
  }

  getPatternLabel(pat) {
    switch (pat) {
      case 'grid': return 'Cuadrícula 5mm';
      case 'ruled': return 'Rayado';
      case 'dots': return 'Puntos';
      case 'blank': return 'Liso';
      default: return 'Rayado';
    }
  }

  async createNotebookWithConfig(folderId, title, coverConfig, initialPageConfig, openImmediately = true) {
    const docTitle = title || 'Nuevo Cuaderno';
    const defaultPattern = (initialPageConfig && initialPageConfig.backgroundPattern) || 'grid';
    const defaultPaperColor = (initialPageConfig && initialPageConfig.paperColor) || '#ffffff';

    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: docTitle,
      type: 'notebook',
      pageFormat: 'a4',
      folderId: folderId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
      isTrash: false,
      defaultPattern: defaultPattern,
      defaultPaperColor: defaultPaperColor,
      cover: coverConfig ? Object.assign(coverConfig, {
        isCover: true,
        strokes: coverConfig.strokes || [],
        shapes: coverConfig.shapes || [],
        texts: coverConfig.texts || [],
        images: coverConfig.images || []
      }) : {
        isCover: true,
        template: 'moleskine',
        title: docTitle,
        subtitle: 'Notas y Reflexiones',
        date: new Date().getFullYear().toString(),
        color: '#0f172a',
        strokes: [],
        shapes: [],
        texts: [],
        images: []
      },
      pages: [
        {
          id: 'page_' + Date.now(),
          backgroundPattern: defaultPattern,
          paperColor: defaultPaperColor,
          strokes: [],
          shapes: [],
          texts: [],
          images: []
        }
      ],
      thumbnail: ''
    };

    if (newDoc.cover) {
      newDoc.thumbnail = CoverDesigner.generateCoverThumbnail(newDoc.cover);
    }

    await db.saveDocument(newDoc);
    await this.dashboardView.loadAndRender();

    if (openImmediately) {
      await this.openDocument(newDoc);
    }
  }

  async createDocument(type, folderId = null, title = null, openImmediately = true) {
    const isNotebook = type === 'notebook';
    const docTitle = title || (isNotebook ? 'Nuevo Cuaderno' : 'Nueva Pizarra');
    const defaultPattern = isNotebook ? 'grid' : 'dots';

    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: docTitle,
      type: type,
      pageFormat: isNotebook ? 'a4' : 'board',
      folderId: folderId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
      isTrash: false,
      defaultPattern: defaultPattern,
      defaultPaperColor: '#ffffff',
      cover: isNotebook ? {
        isCover: true,
        template: 'moleskine',
        title: docTitle,
        subtitle: 'Notas y Reflexiones',
        date: new Date().getFullYear().toString(),
        color: '#0f172a',
        strokes: [],
        shapes: [],
        texts: [],
        images: []
      } : null,
      pages: [
        {
          id: 'page_' + Date.now(),
          backgroundPattern: defaultPattern,
          paperColor: '#ffffff',
          strokes: [],
          shapes: [],
          texts: [],
          images: []
        }
      ],
      thumbnail: ''
    };

    if (isNotebook && newDoc.cover) {
      newDoc.thumbnail = CoverDesigner.generateCoverThumbnail(newDoc.cover);
    }

    await db.saveDocument(newDoc);
    await this.dashboardView.loadAndRender();

    if (openImmediately) {
      await this.openDocument(newDoc);
    }
  }

  goToPrevPage() {
    if (!this.currentDoc) return;
    if (this.currentDoc.type === 'notebook') {
      if (this.currentPageIndex > 0) {
        this.switchPage(this.currentPageIndex - 1, true);
      } else if (this.currentPageIndex === 0 && this.currentDoc.cover) {
        this.switchPage(-1, true);
      }
    } else {
      if (this.currentPageIndex > 0) {
        this.switchPage(this.currentPageIndex - 1, true);
      }
    }
  }

  goToNextPage() {
    if (!this.currentDoc || !this.currentDoc.pages) return;
    if (this.currentDoc.type === 'notebook') {
      if (this.currentPageIndex === -1) {
        this.switchPage(0, true);
      } else if (this.currentPageIndex < this.currentDoc.pages.length - 1) {
        this.switchPage(this.currentPageIndex + 1, true);
      }
    } else {
      if (this.currentPageIndex < this.currentDoc.pages.length - 1) {
        this.switchPage(this.currentPageIndex + 1, true);
      }
    }
  }

  switchPage(newIndex, smoothScroll = true) {
    if (!this.currentDoc) return;
    if (newIndex < -1 || newIndex >= this.currentDoc.pages.length) return;
    if (newIndex === -1 && !this.currentDoc.cover) return;

    // Guardar estado actual de la página antes de cambiar
    if (this.currentPageIndex >= 0 && this.currentDoc.pages[this.currentPageIndex]) {
      this.currentDoc.pages[this.currentPageIndex] = this.canvasEngine.getPageData();
    }

    this.currentPageIndex = newIndex;

    if (this.currentDoc.type === 'notebook') {
      this.attachActivePage(this.currentPageIndex);
      if (smoothScroll) {
        this.scrollToPage(this.currentPageIndex);
      }
    } else {
      if (newIndex >= 0) {
        const targetPage = this.currentDoc.pages[this.currentPageIndex];
        this.canvasEngine.loadPage(targetPage);
      }
    }

    this.toolbar.updatePatternIcon();
    this.toolbar.updatePageCounter(this.currentPageIndex, this.currentDoc.pages.length);
    this.scheduleAutoSave();
  }

  scrollToPage(pageIndex) {
    if (pageIndex === -1) {
      const coverEl = this.canvasWrapper.querySelector('#pageWrapper_cover');
      if (coverEl) {
        const topOffset = coverEl.offsetTop || 0;
        this.viewport.panY = -(topOffset * this.viewport.zoom) + 24;
        this.viewport.clampPan();
        this.viewport.applyTransform();
      }
      return;
    }

    const wrapperEl = this.canvasWrapper.querySelector(`#pageWrapper_${pageIndex}`);
    if (wrapperEl) {
      const hasCover = Boolean(this.currentDoc && this.currentDoc.cover);
      const topOffset = wrapperEl.offsetTop || ((pageIndex + (hasCover ? 1 : 0)) * 1200);
      this.viewport.panY = -(topOffset * this.viewport.zoom) + 24;
      this.viewport.clampPan();
      this.viewport.applyTransform();
    }
  }

  addNewPage() {
    if (!this.currentDoc) return;
    // Guardar página actual si es válida
    if (this.currentPageIndex >= 0 && this.currentDoc.pages[this.currentPageIndex]) {
      this.currentDoc.pages[this.currentPageIndex] = this.canvasEngine.getPageData();
    }

    const currentPattern = this.currentDoc.defaultPattern || 'grid';
    const currentPaper = this.currentDoc.defaultPaperColor || '#ffffff';

    const newPage = {
      id: 'page_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      backgroundPattern: currentPattern,
      paperColor: currentPaper,
      strokes: [],
      shapes: [],
      texts: [],
      images: []
    };

    const insertIdx = this.currentPageIndex >= 0 ? this.currentPageIndex + 1 : this.currentDoc.pages.length;
    this.currentDoc.pages.splice(insertIdx, 0, newPage);
    this.currentPageIndex = insertIdx;

    if (this.currentDoc.type === 'notebook') {
      this.renderNotebookStream();
      this.scrollToPage(this.currentPageIndex);
    } else {
      this.switchPage(this.currentPageIndex, true);
    }

    this.toolbar.updatePageCounter(this.currentPageIndex, this.currentDoc.pages.length);
    this.scheduleAutoSave();
  }

  duplicatePage(idx) {
    if (!this.currentDoc || !this.currentDoc.pages[idx]) return;
    if (idx === this.currentPageIndex) {
      this.currentDoc.pages[this.currentPageIndex] = this.canvasEngine.getPageData();
    }

    const pageToDup = this.currentDoc.pages[idx];
    const dup = JSON.parse(JSON.stringify(pageToDup));
    dup.id = 'page_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    dup.backgroundPattern = this.currentDoc.defaultPattern || dup.backgroundPattern || 'grid';
    dup.paperColor = this.currentDoc.defaultPaperColor || dup.paperColor || '#ffffff';

    this.currentDoc.pages.splice(idx + 1, 0, dup);
    this.currentPageIndex = idx + 1;

    if (this.currentDoc.type === 'notebook') {
      this.renderNotebookStream();
      this.scrollToPage(this.currentPageIndex);
    } else {
      this.switchPage(this.currentPageIndex, true);
    }

    this.toolbar.updatePageCounter(this.currentPageIndex, this.currentDoc.pages.length);
    this.scheduleAutoSave();
  }

  deletePage(idx) {
    if (!this.currentDoc || !this.currentDoc.pages) return;
    if (this.currentDoc.pages.length <= 1) {
      alert('Un cuaderno debe tener al menos una página de contenido.');
      return;
    }

    if (confirm(`¿Eliminar la página ${idx + 2}?`)) {
      this.currentDoc.pages.splice(idx, 1);
      this.currentPageIndex = Math.min(idx, this.currentDoc.pages.length - 1);

      if (this.currentDoc.type === 'notebook') {
        this.renderNotebookStream();
      } else {
        this.switchPage(this.currentPageIndex, true);
      }

      this.toolbar.updatePageCounter(this.currentPageIndex, this.currentDoc.pages.length);
      this.scheduleAutoSave();
    }
  }

  promptChangePagePattern(idx, triggerBtn) {
    const patterns = [
      { id: 'grid', name: 'Cuadrícula 5mm' },
      { id: 'ruled', name: 'Rayado' },
      { id: 'dots', name: 'Puntos' },
      { id: 'blank', name: 'Liso' }
    ];

    const currentPat = this.currentDoc.defaultPattern || this.currentDoc.pages[idx]?.backgroundPattern || 'grid';
    const nextPatIdx = (patterns.findIndex(p => p.id === currentPat) + 1) % patterns.length;
    const nextPat = patterns[nextPatIdx].id;

    this.changePagePattern(idx, nextPat);
  }

  changePagePattern(idx, pattern) {
    if (!this.currentDoc) return;
    
    // Unificar la pauta para todo el cuaderno (salvo la portada)
    this.currentDoc.defaultPattern = pattern;
    if (this.currentDoc.pages) {
      this.currentDoc.pages.forEach(p => {
        p.backgroundPattern = pattern;
      });
    }

    this.canvasEngine.setBackgroundPattern(pattern);
    this.toolbar.updatePatternIcon();

    // Actualizar todos los canvas de las páginas en el flujo del DOM
    if (this.currentDoc.pages) {
      this.currentDoc.pages.forEach((pData, i) => {
        const cEl = this.canvasWrapper.querySelector(`#pageCanvas_${i}`);
        if (cEl) {
          this.canvasEngine.renderPageToCanvas(cEl, pData);
        }
        const pBtn = this.canvasWrapper.querySelector(`.btn-pattern-page[data-page-idx="${i}"]`);
        if (pBtn) {
          pBtn.textContent = `Pauta: ${this.getPatternLabel(pattern)}`;
        }
      });
    }

    this.scheduleAutoSave();
  }

  scheduleAutoSave() {
    if (!this.currentDoc) return;

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentDocNow();
    }, 600);
  }

  async saveCurrentDocNow() {
    if (!this.currentDoc) return;

    // Actualizar página activa (incluyendo portada si está seleccionada)
    if (this.currentPageIndex === -1 && this.currentDoc.cover) {
      const coverData = this.canvasEngine.getPageData();
      this.currentDoc.cover.strokes = coverData.strokes;
      this.currentDoc.cover.shapes = coverData.shapes;
      this.currentDoc.cover.texts = coverData.texts;
      this.currentDoc.cover.images = coverData.images;
    } else if (this.currentDoc.pages && this.currentDoc.pages[this.currentPageIndex]) {
      this.currentDoc.pages[this.currentPageIndex] = this.canvasEngine.getPageData();
    }

    // Miniatura representativa para el Dashboard
    if (this.currentDoc.type === 'notebook') {
      if (this.currentPageIndex === -1) {
        this.currentDoc.thumbnail = this.canvasEngine.generateThumbnail();
      } else if (this.currentDoc.cover) {
        this.currentDoc.thumbnail = CoverDesigner.generateCoverThumbnail(this.currentDoc.cover);
      } else {
        this.currentDoc.thumbnail = this.canvasEngine.generateThumbnail();
      }
    } else {
      this.currentDoc.thumbnail = this.canvasEngine.generateThumbnail();
    }

    this.currentDoc.updatedAt = Date.now();
    await db.saveDocument(this.currentDoc);
    this.toolbar.showSavedStatus();
  }

  openCoverEditor() {
    if (!this.currentDoc || this.currentDoc.type !== 'notebook') return;

    const existingModal = document.getElementById('coverEditorModal');
    if (existingModal) existingModal.remove();

    const coverData = JSON.parse(JSON.stringify(this.currentDoc.cover || {
      template: 'moleskine',
      title: this.currentDoc.title,
      subtitle: 'Notas y Reflexiones',
      date: new Date().getFullYear().toString(),
      color: '#0f172a',
      customImage: null
    }));

    const modal = document.createElement('div');
    modal.id = 'coverEditorModal';
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
      <div class="modal-box cover-modal-box">
        <h3 class="modal-title">Personalizar Portada del Cuaderno</h3>
        
        <div class="cover-editor-layout">
          <!-- Vista previa en vivo -->
          <div class="cover-preview-panel">
            <canvas id="coverLiveCanvas" width="280" height="390" class="cover-live-canvas"></canvas>
          </div>

          <!-- Controles de edición -->
          <div class="cover-form-panel">
            <label class="form-label">Plantilla de estilo:</label>
            <div class="template-chips-grid">
              ${Object.entries(CoverDesigner.TEMPLATES).map(([k, t]) => `
                <button type="button" class="template-chip ${coverData.template === k ? 'active' : ''}" data-template="${k}">
                  ${t.name}
                </button>
              `).join('')}
            </div>

            <label class="form-label" style="margin-top: 14px;">Título del cuaderno:</label>
            <input type="text" id="coverTitleInput" class="modal-input" value="${this.escapeHtml(coverData.title)}" />

            <label class="form-label" style="margin-top: 10px;">Subtítulo / Autor:</label>
            <input type="text" id="coverSubtitleInput" class="modal-input" value="${this.escapeHtml(coverData.subtitle)}" />

            <label class="form-label" style="margin-top: 10px;">Fecha / Año:</label>
            <input type="text" id="coverDateInput" class="modal-input" value="${this.escapeHtml(coverData.date)}" />

            <div class="color-palette-label" style="margin-top: 12px;">Color de Portada:</div>
            <div class="nb-color-palette" style="margin-top: 4px; margin-bottom: 8px;">
              ${[
                { hex: '#0f172a', name: 'Azul Noche' },
                { hex: '#1e40af', name: 'Azul Real' },
                { hex: '#065f46', name: 'Verde Bosque' },
                { hex: '#881337', name: 'Borgoña' },
                { hex: '#78350f', name: 'Cuero' },
                { hex: '#334155', name: 'Gris Pizarra' },
                { hex: '#581c87', name: 'Púrpura' },
                { hex: '#9a3412', name: 'Terracota' }
              ].map(c => `
                <button type="button" class="nb-color-btn ${c.hex === (coverData.color || '#0f172a') ? 'active' : ''}" data-color="${c.hex}" style="background-color: ${c.hex};" title="${c.name}"></button>
              `).join('')}
              <label class="nb-custom-color-label" title="Color personalizado">
                <input type="color" id="coverColorInput" value="${coverData.color || '#0f172a'}" />
                <span>+</span>
              </label>
              <button type="button" class="btn-secondary" id="btnUploadCoverImg" style="margin-left: auto; font-size: 0.8rem; padding: 5px 10px;">
                Foto de fondo...
              </button>
              <input type="file" id="coverImgFileInput" accept="image/*" style="display:none;" />
            </div>
          </div>
        </div>

        <div class="modal-actions" style="margin-top: 20px;">
          <button class="btn-secondary" id="btnCloseCoverModal">Cancelar</button>
          <button class="btn-primary" id="btnSaveCoverModal">Guardar Portada</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const canvas = modal.querySelector('#coverLiveCanvas');
    const ctx = canvas.getContext('2d');

    const updatePreview = () => {
      CoverDesigner.renderCover(ctx, canvas.width, canvas.height, coverData);
    };

    updatePreview();

    // Eventos de selección de plantilla
    modal.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('[data-template]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        coverData.template = btn.dataset.template;
        const tmpl = CoverDesigner.TEMPLATES[coverData.template];
        if (tmpl) {
          coverData.color = tmpl.bg;
          modal.querySelector('#coverColorInput').value = tmpl.bg;
          modal.querySelectorAll('.nb-color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === tmpl.bg);
          });
        }
        updatePreview();
      });
    });

    // Eventos de colores
    modal.querySelectorAll('.nb-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.nb-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        coverData.color = btn.dataset.color;
        modal.querySelector('#coverColorInput').value = coverData.color;
        updatePreview();
      });
    });

    const titleIn = modal.querySelector('#coverTitleInput');
    titleIn.addEventListener('input', (e) => {
      coverData.title = e.target.value;
      updatePreview();
    });

    const subIn = modal.querySelector('#coverSubtitleInput');
    subIn.addEventListener('input', (e) => {
      coverData.subtitle = e.target.value;
      updatePreview();
    });

    const dateIn = modal.querySelector('#coverDateInput');
    dateIn.addEventListener('input', (e) => {
      coverData.date = e.target.value;
      updatePreview();
    });

    const colIn = modal.querySelector('#coverColorInput');
    colIn.addEventListener('input', (e) => {
      coverData.color = e.target.value;
      modal.querySelectorAll('.nb-color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === coverData.color);
      });
      updatePreview();
    });

    const fileIn = modal.querySelector('#coverImgFileInput');
    modal.querySelector('#btnUploadCoverImg').addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          coverData.customImage = ev.target.result;
          const img = new Image();
          img.onload = () => {
            coverData._imgElement = img;
            updatePreview();
          };
          img.src = coverData.customImage;
        };
        reader.readAsDataURL(file);
      }
    });

    const close = () => modal.remove();
    modal.querySelector('#btnCloseCoverModal').addEventListener('click', close);

    modal.querySelector('#btnSaveCoverModal').addEventListener('click', async () => {
      this.currentDoc.cover = coverData;
      if (coverData.title && coverData.title.trim()) {
        this.currentDoc.title = coverData.title.trim();
        this.toolbar.setDocTitle(this.currentDoc.title);
      }

      // Re-renderizar portada en el flujo continuo del editor si existe
      const streamCoverCanvas = this.canvasWrapper.querySelector('#streamCoverCanvas');
      if (streamCoverCanvas) {
        const coverCtx = streamCoverCanvas.getContext('2d');
        CoverDesigner.renderCover(coverCtx, 794, 1123, coverData);
      }

      close();
      await this.saveCurrentDocNow();
    });
  }

  async exportDirectFromDoc(doc) {
    if (doc.type === 'notebook') {
      const tempCanvas = document.createElement('canvas');
      const tempEngine = new CanvasEngine(tempCanvas, { format: 'a4' });
      await Exporter.exportNotebookPdf(doc, tempEngine);
    } else {
      const tempCanvas = document.createElement('canvas');
      const tempEngine = new CanvasEngine(tempCanvas, { format: 'board' });
      const strokes = (doc.pages && doc.pages[0] && doc.pages[0].strokes) || [];
      tempEngine.loadPage(doc.pages ? doc.pages[0] : { strokes });
      Exporter.exportWhiteboardImage(tempEngine, doc.title, 'png');
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}

// Inicializar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
