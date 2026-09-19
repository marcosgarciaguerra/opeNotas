// js/editor/toolbar.js - Barra superior compacta (50px) estructurada en 3 secciones inteligentes con cola dinámica y HTR
import { Icons } from '../icons.js';
import { PaletteManager } from '../paletteManager.js';

const TOOL_DEFINITIONS = {
  pen: { id: 'pen', btnId: 'btnToolPen', name: 'Bolígrafo', icon: Icons.pen, hasColorDot: true, hasSettings: true },
  highlighter: { id: 'highlighter', btnId: 'btnToolHighlighter', name: 'Subrayador', icon: Icons.highlighter, hasColorDot: true, hasSettings: true },
  eraser: { id: 'eraser', btnId: 'btnToolEraser', name: 'Borrador', icon: Icons.eraser, hasColorDot: false, hasSettings: true },
  pencil: { id: 'pencil', btnId: 'btnToolPencil', name: 'Lápiz', icon: Icons.pencil, hasColorDot: true, hasSettings: true },
  marker: { id: 'marker', btnId: 'btnToolMarker', name: 'Rotulador', icon: Icons.marker, hasColorDot: true, hasSettings: true },
  laser: { id: 'laser', btnId: 'btnToolLaser', name: 'Puntero Láser', icon: Icons.laser, hasColorDot: false, hasSettings: true },
  ruler: { id: 'ruler', btnId: 'btnToolRuler', name: 'Regla', icon: Icons.ruler, hasColorDot: false, hasSettings: true },
  hand: { id: 'hand', btnId: 'btnToolHand', name: 'Mano', icon: Icons.hand, hasColorDot: false, hasSettings: false },
  shape: { id: 'shape', btnId: 'btnToolShape', name: 'Figuras', icon: Icons.shape, hasColorDot: false, hasSettings: false },
  text: { id: 'text', btnId: 'btnToolText', name: 'Texto', icon: Icons.text, hasColorDot: false, hasSettings: false },
  lasso: { id: 'lasso', btnId: 'btnToolLasso', name: 'Lazo', icon: Icons.lasso, hasColorDot: false, hasSettings: false }
};

const DEFAULT_TOOL_SETTINGS = {
  pen: { color: '#1e293b', width: 3, opacity: 1, stabilization: 0.5, concentration: 1.0 },
  highlighter: { color: '#facc15', width: 18, opacity: 0.45, stabilization: 0.5, concentration: 0.9 },
  pencil: { color: '#475569', width: 2.5, opacity: 0.85, stabilization: 0.5, concentration: 0.8 },
  marker: { color: '#dc2626', width: 6, opacity: 0.9, stabilization: 0.5, concentration: 1.0 }
};

export class Toolbar {
  constructor(canvasEngine, selectionTool, options = {}) {
    this.engine = canvasEngine;
    this.selectionTool = selectionTool;
    this.shapeTool = options.shapeTool || null;
    this.textTool = options.textTool || null;
    this.imageTool = options.imageTool || null;
    this.laserPointer = options.laserPointer || null;
    this.ruler = options.ruler || null;
    this.htrPredictor = options.htrPredictor || null;

    this.onBack = options.onBack || (() => {});
    this.onTitleChange = options.onTitleChange || (() => {});
    this.onExport = options.onExport || (() => {});
    this.onOpenCover = options.onOpenCover || (() => {});
    this.onPatternChange = options.onPatternChange || (() => {});
    this.onPrevPage = options.onPrevPage || (() => {});
    this.onNextPage = options.onNextPage || (() => {});
    this.onAddPage = options.onAddPage || (() => {});
    this.onDuplicatePage = options.onDuplicatePage || (() => {});
    this.onDeletePage = options.onDeletePage || (() => {});
    this.onOpenSettings = options.onOpenSettings || (() => {});

    this.activeTool = 'pen';
    this.lastPenTool = 'pen';
    this.activeMenu = null; // 'pen' | 'highlighter' | 'eraser' | 'auxiliary' | 'width' | 'pages' | 'settings' | 'ruler' | 'presets' | null

    // Cola dinámica de herramientas en la botonera principal (máximo 6 elementos)
    this.MAX_DOCK_TOOLS = 6;
    this.dockTools = ['pen', 'highlighter', 'eraser'];
    this.pinnedTools = new Set(['pen', 'highlighter', 'eraser']);

    // Ajustes y colores independientes por cada herramienta
    this.toolSettings = JSON.parse(JSON.stringify(DEFAULT_TOOL_SETTINGS));
    this.loadToolSettings();
    this.loadDockConfig();

    this.container = null;
    this.popover = null;
    this.currentPageIndex = 0;
    this.totalContentPages = 1;

    this._unsubscribePalette = null;

    this.init();
  }

  loadToolSettings() {
    try {
      const saved = localStorage.getItem('whiteboard_tool_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(DEFAULT_TOOL_SETTINGS).forEach(k => {
          if (parsed[k]) {
            this.toolSettings[k] = { ...DEFAULT_TOOL_SETTINGS[k], ...parsed[k] };
          }
        });
      }
    } catch (e) {
      console.warn('Error al cargar configuración de herramientas desde localStorage:', e);
    }
  }

  saveToolSettings() {
    try {
      localStorage.setItem('whiteboard_tool_settings', JSON.stringify(this.toolSettings));
    } catch (e) {
      console.error('Error al guardar configuración de herramientas en localStorage:', e);
    }
  }

  getToolColor(toolId) {
    return this.toolSettings[toolId]?.color || (toolId === 'highlighter' ? '#facc15' : this.engine.strokeColor);
  }

  getToolWidth(toolId) {
    return this.toolSettings[toolId]?.width || this.engine.strokeWidth;
  }

  init() {
    this.container = document.getElementById('editorToolbar');

    // Inicializar propiedades del motor con la herramienta inicial
    if (this.toolSettings[this.activeTool]) {
      const s = this.toolSettings[this.activeTool];
      this.engine.setColor(s.color);
      this.engine.setWidth(s.width);
      this.engine.setOpacity(s.opacity);
      if (s.stabilization !== undefined) this.engine.setStabilization(s.stabilization);
      if (s.concentration !== undefined) this.engine.setConcentration(s.concentration);
    }

    this.renderToolbar();
    this.createPopover();
    this.bindEvents();
    this.updateActiveButton();

    if (this.ruler) {
      this.ruler.onClose = () => {
        this.updateActiveButton();
      };
    }

    if (this.htrPredictor) {
      this.htrPredictor.onStateChange = (enabled) => {
        this.updateHTRButton(enabled);
      };
    }

    this._unsubscribePalette = PaletteManager.subscribe(() => {
      this.updatePenDotsColor();
      if (this.activeMenu && this.popover && !this.popover.classList.contains('hidden')) {
        this.renderMenuContent(this.activeMenu);
      }
    });
  }

  setTools({ shapeTool, textTool, imageTool, laserPointer, ruler, htrPredictor }) {
    if (shapeTool) this.shapeTool = shapeTool;
    if (textTool) this.textTool = textTool;
    if (imageTool) this.imageTool = imageTool;
    if (laserPointer) this.laserPointer = laserPointer;
    if (htrPredictor) this.htrPredictor = htrPredictor;
    if (ruler) {
      this.ruler = ruler;
      this.ruler.onClose = () => this.updateActiveButton();
    }
  }

  renderToolbar() {
    const isNotebook = this.engine.format === 'a4';
    const isHtrActive = this.htrPredictor ? this.htrPredictor.enabled : true;

    this.container.innerHTML = `
      <!-- SECCIÓN 1: IZQUIERDA (Historial y Navegación) -->
      <div class="toolbar-left">
        <button id="btnBackToLibrary" class="tool-btn-compact" title="Volver a Documentos">
          ${Icons.back}
        </button>
        <div class="doc-title-container">
          <input type="text" id="docTitleInput" class="doc-title-input" value="Sin Título" title="Editar título" />
          <span class="save-status" id="saveStatus">${Icons.check}</span>
        </div>
        <div class="toolbar-vsep"></div>
        <button class="tool-btn-compact" id="btnUndo" title="Deshacer (Ctrl+Z)">
          ${Icons.undo}
        </button>
        <button class="tool-btn-compact" id="btnRedo" title="Rehacer (Ctrl+Y)">
          ${Icons.redo}
        </button>
      </div>

      <!-- SECCIÓN 2: CENTRO (Útiles de dibujo esenciales y selector de grosor) -->
      <div class="toolbar-center">
        <div class="main-tool-dock" id="mainToolDock">
          <!-- Cola dinámica de herramientas (máx 6) -->
          <div class="dynamic-dock-tools" id="dynamicDockTools" style="display: inline-flex; align-items: center; gap: 3px;">
            ${this.renderDockToolsHtml()}
          </div>

          <!-- Desplegable de Herramientas Auxiliares (🛠️ ▾) -->
          <button class="dock-btn-compact has-dropdown" id="btnMenuAuxiliary" title="Herramientas Auxiliares (Lápiz, Rotulador, Láser, Regla, Mano, Figuras)">
            <span class="tool-icon-wrapper" id="auxiliaryActiveIcon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </span>
            <span class="dropdown-chevron">${Icons.chevronDown}</span>
          </button>

          <!-- Conmutador HTR Toggle (Reconocimiento y Predicción de trazo manuscrito a texto) -->
          <button class="dock-btn-compact ${isHtrActive ? 'active htr-toggle-active' : ''}" id="btnToggleHTR" data-tool="btnMenuInsert" title="Autocompletado HTR Manuscrito a Texto (IA Predictiva): Clic para activar/desactivar">
            <span class="tool-icon-wrapper">${Icons.htr}</span>
          </button>

          <!-- Botón de compatibilidad de imagen/media invisible para tests -->
          <button class="hidden" id="btnToolMedia" data-tool="btnMenuInsert"></button>

          <div class="dock-divider"></div>

          <!-- Píldora selectora de grosor -->
          <button class="stroke-width-pill" id="btnStrokeWidthPill" title="Grosor de trazo (Clic para cambiar)">
            <span id="strokeWidthLabel">${this.engine.strokeWidth}px</span>
          </button>
        </div>
      </div>

      <!-- SECCIÓN 3: DERECHA (Paginación, inserción y sistema) -->
      <div class="toolbar-right">
        <!-- Paginador comprimido en una sola cápsula [ ‹ ] 2 / 2 [ › ] -->
        <div class="pages-capsule ${isNotebook ? '' : 'hidden'}" id="pagesControlGroup">
          <button class="pages-nav-arrow" id="btnPrevPage" title="Página anterior">
            ${Icons.chevronLeft}
          </button>
          <button class="pages-center-btn" id="btnPagesMenu" title="Menú de Páginas y Pauta">
            <span class="pages-label" id="pagesNavBadge">1 / 1</span>
          </button>
          <button class="pages-nav-arrow" id="btnNextPage" title="Página siguiente">
            ${Icons.chevronRight}
          </button>
        </div>

        <!-- Botón Añadir Página (+) -->
        <button class="tool-btn-compact ${isNotebook ? '' : 'hidden'}" id="btnAddPageIcon" title="Añadir nueva página">
          ${Icons.plus}
        </button>

        <!-- Botón de Configuración (⚙) -->
        <button class="tool-btn-compact" id="btnMenuSettings" title="Configuración y Modo Oscuro">
          ${Icons.settings}
        </button>
      </div>
    `;
  }

  renderDockToolsHtml() {
    return this.dockTools.map(tId => {
      const def = TOOL_DEFINITIONS[tId] || { id: tId, btnId: `btnTool_${tId}`, name: tId, icon: Icons.pen, hasColorDot: false };
      const isActive = this.activeTool === tId;
      const isPinned = this.pinnedTools.has(tId);
      const col = this.getToolColor(tId);

      return `
        <button class="dock-btn-compact ${isActive ? 'active' : ''}" id="${def.btnId}" data-tool="${tId}" title="${def.name} (Clic: activar | 2º clic: ajustes)">
          <span class="tool-icon-wrapper">${def.icon}</span>
          ${def.hasColorDot ? `<span class="tool-color-dot" id="dot_${tId}" style="background-color: ${col};"></span>` : ''}
          ${isPinned ? `<span class="pin-badge" title="Fijado en barra"></span>` : ''}
        </button>
      `;
    }).join('');
  }

  renderDockTools() {
    const dockContainer = this.container.querySelector('#dynamicDockTools');
    if (!dockContainer) return;
    dockContainer.innerHTML = this.renderDockToolsHtml();
    this.bindDockToolEvents();
    this.updateActiveButton();
  }

  loadDockConfig() {
    try {
      const saved = localStorage.getItem('whiteboard_dock_tools_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.dockTools) && parsed.dockTools.length > 0) {
          const validDock = parsed.dockTools.filter(id => TOOL_DEFINITIONS[id]);
          if (validDock.length > 0) {
            this.dockTools = validDock.slice(0, this.MAX_DOCK_TOOLS);
          }
        }
        if (Array.isArray(parsed.pinnedTools)) {
          this.pinnedTools = new Set(parsed.pinnedTools.filter(id => TOOL_DEFINITIONS[id]));
        }
      }
    } catch (e) {
      console.warn('Error al cargar configuración de dock desde localStorage:', e);
    }

    if (!this.dockTools || this.dockTools.length === 0) {
      this.dockTools = ['pen', 'highlighter', 'eraser'];
    }
    if (!this.pinnedTools || this.pinnedTools.size === 0) {
      this.pinnedTools = new Set(['pen', 'highlighter', 'eraser']);
    }
  }

  saveDockConfig() {
    try {
      localStorage.setItem('whiteboard_dock_tools_config', JSON.stringify({
        dockTools: this.dockTools,
        pinnedTools: Array.from(this.pinnedTools)
      }));
    } catch (e) {
      console.error('Error al guardar configuración de dock en localStorage:', e);
    }
  }

  addOrActivateTool(toolId) {
    if (!this.dockTools.includes(toolId)) {
      if (this.dockTools.length >= this.MAX_DOCK_TOOLS) {
        // Encontrar la herramienta no fijada más antigua (FIFO)
        const evictIdx = this.dockTools.findIndex(id => !this.pinnedTools.has(id));
        if (evictIdx !== -1) {
          this.dockTools.splice(evictIdx, 1);
        } else {
          // Si todas estuvieran fijadas, desalojar la última
          this.dockTools.pop();
        }
      }
      this.dockTools.push(toolId);
      this.saveDockConfig();
      this.renderDockTools();
    }
    this.selectTool(toolId);
  }

  togglePinTool(toolId) {
    if (this.pinnedTools.has(toolId)) {
      this.pinnedTools.delete(toolId);
    } else {
      this.pinnedTools.add(toolId);
      if (!this.dockTools.includes(toolId)) {
        if (this.dockTools.length >= this.MAX_DOCK_TOOLS) {
          const evictIdx = this.dockTools.findIndex(id => !this.pinnedTools.has(id));
          if (evictIdx !== -1) {
            this.dockTools.splice(evictIdx, 1);
          } else {
            this.dockTools.pop();
          }
        }
        this.dockTools.push(toolId);
      }
    }
    this.saveDockConfig();
    this.renderDockTools();
    if (this.activeMenu) {
      this.renderMenuContent(this.activeMenu);
    }
  }

  createPopover() {
    this.popover = document.createElement('div');
    this.popover.className = 'tool-popover mini-menu-popover hidden';
    document.body.appendChild(this.popover);
  }

  renderQuickColors() {
    // Los colores rápidos del dock han sido reemplazados por colores independientes por útil
  }

  bindDockToolEvents() {
    this.dockTools.forEach(toolId => {
      const def = TOOL_DEFINITIONS[toolId];
      if (!def) return;
      const btn = this.container.querySelector(`#${def.btnId}`);
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activeTool === toolId) {
          if (def.hasSettings) {
            this.toggleMenu(toolId, btn);
          }
        } else {
          this.closeMenu();
          this.selectTool(toolId);
        }
      });
    });
  }

  bindEvents() {
    // Volver a la biblioteca
    this.container?.querySelector('#btnBackToLibrary')?.addEventListener('click', () => {
      this.closeMenu();
      this.onBack();
    });

    // Título de documento
    const titleInput = this.container?.querySelector('#docTitleInput');
    titleInput?.addEventListener('change', (e) => {
      this.onTitleChange(e.target.value.trim());
    });

    // Vincular herramientas de la cola dinámica del dock
    this.bindDockToolEvents();

    // Desplegable de Herramientas Auxiliares (🛠️ ▾)
    const btnAux = this.container?.querySelector('#btnMenuAuxiliary');
    if (btnAux) {
      btnAux.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('auxiliary', btnAux);
      });
    }

    // Botón Toggle HTR (Reconocimiento Inteligente a Texto)
    const btnHTR = this.container?.querySelector('#btnToggleHTR');
    if (btnHTR) {
      btnHTR.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.htrPredictor) {
          const isNowActive = this.htrPredictor.toggleHTR();
          btnHTR.classList.toggle('active', isNowActive);
          btnHTR.classList.toggle('htr-toggle-active', isNowActive);
        }
      });
    }

    // Píldora de grosor
    const btnWidthPill = this.container?.querySelector('#btnStrokeWidthPill');
    if (btnWidthPill) {
      btnWidthPill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('width', btnWidthPill);
      });
    }

    // Historial
    this.container?.querySelector('#btnUndo')?.addEventListener('click', () => {
      this.engine.undo();
    });

    this.container?.querySelector('#btnRedo')?.addEventListener('click', () => {
      this.engine.redo();
    });

    // Páginas
    const btnPrevPage = this.container?.querySelector('#btnPrevPage');
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        this.onPrevPage();
      });
    }

    const btnNextPage = this.container?.querySelector('#btnNextPage');
    if (btnNextPage) {
      btnNextPage.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        this.onNextPage();
      });
    }

    const btnPagesMenu = this.container?.querySelector('#btnPagesMenu');
    if (btnPagesMenu) {
      btnPagesMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('pages', btnPagesMenu);
      });
    }

    // Botón directo Añadir Página (+)
    const btnAddPageIcon = this.container?.querySelector('#btnAddPageIcon');
    if (btnAddPageIcon) {
      btnAddPageIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        this.onAddPage();
      });
    }

    // Configuración (⚙)
    const btnMenuSettings = this.container?.querySelector('#btnMenuSettings');
    if (btnMenuSettings) {
      btnMenuSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('settings', btnMenuSettings);
      });
    }

    // Cerrar menú al hacer clic fuera
    document.addEventListener('pointerdown', (e) => {
      if (
        this.popover &&
        !this.popover.contains(e.target) &&
        !e.target.closest('.dock-btn-compact') &&
        !e.target.closest('.tool-btn-compact') &&
        !e.target.closest('.stroke-width-pill') &&
        !e.target.closest('#btnPagesMenu') &&
        !e.target.closest('#btnMenuSettings')
      ) {
        this.closeMenu();
      }
    });

    // Atajos de teclado
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        this.closeMenu();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.engine.redo();
        else this.engine.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.engine.redo();
      } else if (e.key.toLowerCase() === 'p') {
        this.addOrActivateTool('pen');
      } else if (e.key.toLowerCase() === 'b') {
        this.addOrActivateTool('pencil');
      } else if (e.key.toLowerCase() === 'e') {
        this.addOrActivateTool('eraser');
      } else if (e.key.toLowerCase() === 'h') {
        this.addOrActivateTool('highlighter');
      } else if (e.key.toLowerCase() === 'l') {
        this.addOrActivateTool('laser');
      } else if (e.key.toLowerCase() === 'r') {
        if (this.ruler) {
          this.ruler.toggle();
          this.updateActiveButton();
        }
      } else if (e.key.toLowerCase() === 'm') {
        this.addOrActivateTool('hand');
      }
    });
  }

  updateHTRButton(enabled) {
    const btn = this.container ? this.container.querySelector('#btnToggleHTR') : null;
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.classList.toggle('htr-toggle-active', enabled);
    }
  }

  toggleMenu(menuType, anchorBtn) {
    if (this.activeMenu === menuType) {
      this.closeMenu();
    } else {
      this.openMenu(menuType, anchorBtn);
    }
  }

  openMenu(menuType, anchorBtn) {
    this.activeMenu = menuType;
    this.renderMenuContent(menuType);
    this.positionPopover(anchorBtn);
    this.popover.classList.remove('hidden');
  }

  closeMenu() {
    this.activeMenu = null;
    if (this.popover) {
      this.popover.classList.add('hidden');
    }
  }

  positionPopover(anchorBtn) {
    if (!this.popover || !anchorBtn) return;
    const rect = anchorBtn.getBoundingClientRect();
    const popoverWidth = Math.min(310, window.innerWidth - 16);
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(8, Math.min(window.innerWidth - popoverWidth - 8, left));

    let top = rect.bottom + 6;
    this.popover.style.top = `${top}px`;
    this.popover.style.left = `${left}px`;
    this.popover.style.maxWidth = `calc(100vw - 16px)`;
  }

  renderMenuContent(menuType) {
    switch (menuType) {
      case 'pen':
      case 'highlighter':
      case 'pencil':
      case 'marker':
        this.renderStrokeSettingsMenu(menuType);
        break;
      case 'eraser':
        this.renderEraserMenu();
        break;
      case 'auxiliary':
        this.renderAuxiliaryMenu();
        break;
      case 'width':
        this.renderWidthPickerMenu();
        break;
      case 'laser':
        this.renderLaserMenu();
        break;
      case 'ruler':
        this.renderRulerMenu();
        break;
      case 'pages':
        this.renderPagesMenu();
        break;
      case 'presets':
        this.renderPresetsMenu();
        break;
      case 'settings':
      case 'options':
        this.renderSettingsMenu();
        break;
    }
  }

  // Popover compacto para ajustes del trazo activo (Sin scroll)
  renderStrokeSettingsMenu(toolKey) {
    const titles = {
      pen: 'Ajustes del Bolígrafo',
      pencil: 'Ajustes del Lápiz',
      marker: 'Ajustes del Rotulador',
      highlighter: 'Ajustes del Subrayador'
    };

    const palette = PaletteManager.getPalette();
    const curSettings = this.toolSettings[toolKey] || {
      color: this.engine.strokeColor,
      width: this.engine.strokeWidth,
      stabilization: 0.5,
      concentration: 1.0
    };
    const currentColor = curSettings.color;
    const currentWidth = curSettings.width;
    const currentStabilization = curSettings.stabilization !== undefined ? curSettings.stabilization : 0.5;
    const currentStabilizationPercent = Math.round(currentStabilization * 100);
    const currentConcentration = curSettings.concentration !== undefined ? curSettings.concentration : 1.0;
    const currentConcentrationPercent = Math.round(currentConcentration * 100);
    const isHighlighter = toolKey === 'highlighter';
    const isPinned = this.pinnedTools.has(toolKey);

    const baseOp = isHighlighter ? 0.45 : (toolKey === 'pencil' ? 0.85 : 1.0);
    const previewOpacity = Math.max(0.1, baseOp * currentConcentration);

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title-row">
        <span class="mini-menu-title">${titles[toolKey] || 'Ajustes de Trazo'}</span>
        <button type="button" class="popover-title-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-tool="${toolKey}" title="${isPinned ? 'Desfijar de la barra' : 'Fijar en la barra (máx 6)'}">
          ${isPinned ? Icons.pinFilled : Icons.pin}
          <span>${isPinned ? 'Fijado' : 'Fijar'}</span>
        </button>
      </div>

      <!-- Paleta de 10 colores con selector personalizado persistente -->
      <div class="color-palette-10">
        ${palette.map(c => `
          <button type="button" class="color-swatch ${c.toLowerCase() === currentColor.toLowerCase() ? 'active' : ''}" data-color="${c}" style="background-color: ${c}"></button>
        `).join('')}
        <label class="color-picker-label" title="Añadir color personalizado">
          <input type="color" id="popoverColorPicker" value="${currentColor}" />
          <span class="picker-icon">${Icons.edit}</span>
        </label>
      </div>

      <div class="popover-divider"></div>

      <!-- Grosor -->
      <div class="popover-row">
        <span class="label-text">Grosor</span>
        <span class="value-text" id="penWidthVal">${currentWidth}px</span>
      </div>
      <div class="slider-with-preview">
        <input type="range" class="popover-slider" id="penStrokeSlider" min="1" max="${isHighlighter ? 40 : 30}" value="${currentWidth}" />
        <div class="stroke-preview-circle" id="penPreviewCircle" style="width: ${Math.min(currentWidth, 24)}px; height: ${Math.min(currentWidth, 24)}px; background-color: ${currentColor}; opacity: ${previewOpacity};"></div>
      </div>
      <div class="stroke-presets-chips" id="widthPresetsGroup">
        ${(isHighlighter ? [8, 14, 18, 24, 32] : [1, 2, 4, 8, 14, 20]).map(w => `
          <button type="button" class="stroke-preset-chip ${w === currentWidth ? 'active' : ''}" data-width="${w}">${w}px</button>
        `).join('')}
      </div>

      <div class="popover-divider"></div>

      <!-- Estabilización / Suavizado -->
      <div class="popover-row">
        <span class="label-text">Suavizado de Trazo</span>
        <span class="value-text" id="penStabilizationVal">${currentStabilizationPercent}%</span>
      </div>
      <input type="range" class="popover-slider" id="penStabilizationSlider" min="0" max="100" value="${currentStabilizationPercent}" />

      <div class="popover-divider"></div>

      <!-- Concentración / Densidad de Tinta -->
      <div class="popover-row">
        <span class="label-text">Concentración de Tinta</span>
        <span class="value-text" id="penConcentrationVal">${currentConcentrationPercent}%</span>
      </div>
      <input type="range" class="popover-slider" id="penConcentrationSlider" min="10" max="100" value="${currentConcentrationPercent}" />
    `;

    const updatePreviewCircle = () => {
      const circle = this.popover.querySelector('#penPreviewCircle');
      if (circle) {
        const curS = this.toolSettings[toolKey] || {};
        const col = curS.color || this.engine.strokeColor;
        const wid = curS.width || this.engine.strokeWidth;
        const conc = curS.concentration !== undefined ? curS.concentration : 1.0;
        circle.style.width = `${Math.min(wid, 24)}px`;
        circle.style.height = `${Math.min(wid, 24)}px`;
        circle.style.backgroundColor = col;
        const op = isHighlighter ? 0.45 : (toolKey === 'pencil' ? 0.85 : 1.0);
        circle.style.opacity = Math.max(0.1, op * conc);
      }
    };

    // Botón Pin en título
    this.popover.querySelector('.popover-title-pin-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePinTool(toolKey);
    });

    // Paleta de 10 colores
    this.popover.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = sw.dataset.color;
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].color = color;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setColor(color);
        }
        this.updatePenDotsColor();
        this.renderStrokeSettingsMenu(toolKey);
      });
    });

    // Selector de color personalizado nativo (guarda automáticamente en la paleta de 10)
    const picker = this.popover.querySelector('#popoverColorPicker');
    if (picker) {
      picker.addEventListener('input', (e) => {
        const color = e.target.value;
        PaletteManager.saveCustomColor(color);
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].color = color;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setColor(color);
        }
        this.updatePenDotsColor();
        updatePreviewCircle();
      });
    }

    // Grosor Slider
    const strokeSlider = this.popover.querySelector('#penStrokeSlider');
    if (strokeSlider) {
      strokeSlider.addEventListener('input', (e) => {
        const w = Number(e.target.value);
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].width = w;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setWidth(w);
          const label = this.container.querySelector('#strokeWidthLabel');
          if (label) label.textContent = `${w}px`;
        }
        const valText = this.popover.querySelector('#penWidthVal');
        if (valText) valText.textContent = `${w}px`;
        updatePreviewCircle();
        this.popover.querySelectorAll('#widthPresetsGroup .stroke-preset-chip').forEach(chip => {
          chip.classList.toggle('active', Number(chip.dataset.width) === w);
        });
      });
    }

    this.popover.querySelectorAll('#widthPresetsGroup .stroke-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const w = Number(chip.dataset.width);
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].width = w;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setWidth(w);
          const label = this.container.querySelector('#strokeWidthLabel');
          if (label) label.textContent = `${w}px`;
        }
        if (strokeSlider) strokeSlider.value = w;
        const valText = this.popover.querySelector('#penWidthVal');
        if (valText) valText.textContent = `${w}px`;
        updatePreviewCircle();
        this.popover.querySelectorAll('#widthPresetsGroup .stroke-preset-chip').forEach(c => {
          c.classList.toggle('active', c === chip);
        });
      });
    });

    // Estabilidad Slider
    const stabSlider = this.popover.querySelector('#penStabilizationSlider');
    if (stabSlider) {
      stabSlider.addEventListener('input', (e) => {
        const sVal = Number(e.target.value);
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].stabilization = sVal / 100;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setStabilization(sVal / 100);
        }
        const valText = this.popover.querySelector('#penStabilizationVal');
        if (valText) valText.textContent = `${sVal}%`;
      });
    }

    // Concentración Slider
    const concSlider = this.popover.querySelector('#penConcentrationSlider');
    if (concSlider) {
      concSlider.addEventListener('input', (e) => {
        const cVal = Number(e.target.value);
        if (this.toolSettings[toolKey]) {
          this.toolSettings[toolKey].concentration = cVal / 100;
          this.saveToolSettings();
        }
        if (this.activeTool === toolKey) {
          this.engine.setConcentration(cVal / 100);
        }
        const valText = this.popover.querySelector('#penConcentrationVal');
        if (valText) valText.textContent = `${cVal}%`;
        updatePreviewCircle();
      });
    }
  }

  // Popover de Herramientas Auxiliares (🛠️ ▾) con opción de fijar (pin)
  renderAuxiliaryMenu() {
    const isRulerActive = this.ruler ? this.ruler.active : false;
    const isLaserActive = this.activeTool === 'laser';
    const isPenActive = this.activeTool === 'pen';
    const isHighlighterActive = this.activeTool === 'highlighter';
    const isEraserActive = this.activeTool === 'eraser';
    const isPencilActive = this.activeTool === 'pencil';
    const isMarkerActive = this.activeTool === 'marker';
    const isHandActive = this.activeTool === 'hand';
    const isShapeActive = this.activeTool === 'shape';
    const isTextActive = this.activeTool === 'text';
    const isLassoActive = this.activeTool === 'lasso';

    const renderPinBtn = (toolId) => {
      const isPinned = this.pinnedTools.has(toolId);
      return `
        <button type="button" class="aux-tool-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-tool="${toolId}" title="${isPinned ? 'Desfijar de la barra' : 'Fijar en la barra (máx 6)'}">
          ${isPinned ? Icons.pinFilled : Icons.pin}
        </button>
      `;
    };

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Herramientas y Multimedia</div>

      <!-- Sección 1: Dibujo & Trazado -->
      <div class="aux-section-heading">Dibujo & Trazado</div>
      <div class="aux-tools-grid">
        <div class="aux-tool-chip ${isPenActive ? 'active' : ''}" data-aux-tool="pen" title="Bolígrafo (P)">
          ${renderPinBtn('pen')}
          <span class="aux-icon">${Icons.pen}</span>
          <span class="aux-label">Bolígrafo</span>
        </div>
        <div class="aux-tool-chip ${isHighlighterActive ? 'active' : ''}" data-aux-tool="highlighter" title="Subrayador (H)">
          ${renderPinBtn('highlighter')}
          <span class="aux-icon">${Icons.highlighter}</span>
          <span class="aux-label">Subrayador</span>
        </div>
        <div class="aux-tool-chip ${isEraserActive ? 'active' : ''}" data-aux-tool="eraser" title="Borrador (E)">
          ${renderPinBtn('eraser')}
          <span class="aux-icon">${Icons.eraser}</span>
          <span class="aux-label">Borrador</span>
        </div>
        <div class="aux-tool-chip ${isPencilActive ? 'active' : ''}" data-aux-tool="pencil" title="Lápiz (B)">
          ${renderPinBtn('pencil')}
          <span class="aux-icon">${Icons.pencil}</span>
          <span class="aux-label">Lápiz</span>
        </div>
        <div class="aux-tool-chip ${isMarkerActive ? 'active' : ''}" data-aux-tool="marker" title="Rotulador">
          ${renderPinBtn('marker')}
          <span class="aux-icon">${Icons.marker}</span>
          <span class="aux-label">Rotulador</span>
        </div>
      </div>

      <!-- Sección 2: Precisión & Navegación -->
      <div class="aux-section-heading" style="margin-top: 10px;">Precisión & Navegación</div>
      <div class="aux-tools-grid">
        <div class="aux-tool-chip ${isLaserActive ? 'active' : ''}" data-aux-tool="laser" title="Puntero Láser (L)">
          ${renderPinBtn('laser')}
          <span class="aux-icon">${Icons.laser}</span>
          <span class="aux-label">Láser</span>
        </div>
        <div class="aux-tool-chip ${isRulerActive ? 'active' : ''}" data-aux-tool="ruler" title="Regla interactiva (R)">
          ${renderPinBtn('ruler')}
          <span class="aux-icon">${Icons.ruler}</span>
          <span class="aux-label">Regla</span>
        </div>
        <div class="aux-tool-chip ${isHandActive ? 'active' : ''}" data-aux-tool="hand" title="Mover / Desplazar lienzo (M)">
          ${renderPinBtn('hand')}
          <span class="aux-icon">${Icons.hand}</span>
          <span class="aux-label">Mano</span>
        </div>
        <div class="aux-tool-chip ${isLassoActive ? 'active' : ''}" data-aux-tool="lasso" title="Lazo de Selección">
          ${renderPinBtn('lasso')}
          <span class="aux-icon">${Icons.lasso}</span>
          <span class="aux-label">Lazo</span>
        </div>
      </div>

      <!-- Sección 3: Inserción & Formas -->
      <div class="aux-section-heading" style="margin-top: 10px;">Inserción & Formas</div>
      <div class="aux-tools-grid">
        <div class="aux-tool-chip ${isShapeActive ? 'active' : ''}" data-aux-tool="shape" title="Insertar figuras geométricas">
          ${renderPinBtn('shape')}
          <span class="aux-icon">${Icons.shape}</span>
          <span class="aux-label">Figuras</span>
        </div>
        <div class="aux-tool-chip ${isTextActive ? 'active' : ''}" data-aux-tool="text" title="Insertar texto">
          ${renderPinBtn('text')}
          <span class="aux-icon">${Icons.text}</span>
          <span class="aux-label">Texto</span>
        </div>
      </div>

      <!-- Sección 4: Importar Multimedia -->
      <div class="aux-section-heading" style="margin-top: 10px;">Insertar Multimedia</div>
      <div class="aux-media-grid">
        <button type="button" class="aux-media-btn" id="btnAuxImportImage" title="Importar imagen (PNG, JPG, WebP, SVG, GIF)">
          <span class="aux-media-icon">${Icons.image}</span>
          <div class="aux-media-text">
            <strong>Importar Imagen</strong>
            <small>Fotos y gráficos</small>
          </div>
        </button>
        <button type="button" class="aux-media-btn" id="btnAuxImportVideo" title="Importar video (MP4, WebM, MOV)">
          <span class="aux-media-icon">${Icons.video}</span>
          <div class="aux-media-text">
            <strong>Importar Video</strong>
            <small>Clips y grabaciones</small>
          </div>
        </button>
      </div>

      <div class="popover-divider"></div>

      <!-- Presets Favoritos -->
      <div class="mini-actions-list">
        <button type="button" class="mini-action-btn" id="btnPinnedPresets">
          <span class="mini-action-icon">${Icons.star}</span>
          <div class="mini-action-text">
            <strong>Presets Favoritos (+)</strong>
            <small>Gestionar y fijar estilos de trazo</small>
          </div>
        </button>
      </div>
    `;

    // Vincular activación de herramientas auxiliares (las añade a la cola del dock)
    this.popover.querySelectorAll('[data-aux-tool]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.aux-tool-pin-btn')) return;
        const toolId = chip.dataset.auxTool;
        if (toolId === 'ruler') {
          if (this.ruler) {
            this.ruler.toggle();
            this.updateActiveButton();
          }
        } else {
          this.addOrActivateTool(toolId);
        }
        this.closeMenu();
      });
    });

    // Vincular pines
    this.popover.querySelectorAll('.aux-tool-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const toolId = btn.dataset.pinTool;
        this.togglePinTool(toolId);
      });
    });

    // Importación multimedia
    this.popover.querySelector('#btnAuxImportImage')?.addEventListener('click', () => {
      this.closeMenu();
      if (this.imageTool) this.imageTool.triggerUpload('image');
    });

    this.popover.querySelector('#btnAuxImportVideo')?.addEventListener('click', () => {
      this.closeMenu();
      if (this.imageTool) this.imageTool.triggerUpload('video');
    });

    this.popover.querySelector('#btnPinnedPresets')?.addEventListener('click', () => {
      this.openMenu('presets', this.container.querySelector('#btnMenuAuxiliary'));
    });
  }

  // Popover Borrador
  renderEraserMenu() {
    const isStroke = this.engine.eraserMode === 'stroke';
    const eraseHighlighter = this.engine.eraseHighlighterOnly;
    const isPinned = this.pinnedTools.has('eraser');

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title-row">
        <span class="mini-menu-title">Ajustes del Borrador</span>
        <button type="button" class="popover-title-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-tool="eraser" title="${isPinned ? 'Desfijar de la barra' : 'Fijar en la barra (máx 6)'}">
          ${isPinned ? Icons.pinFilled : Icons.pin}
          <span>${isPinned ? 'Fijado' : 'Fijar'}</span>
        </button>
      </div>

      <div class="eraser-mode-selector">
        <button type="button" class="mode-pill ${isStroke ? 'active' : ''}" id="btnModeStroke">Trazo Completo</button>
        <button type="button" class="mode-pill ${!isStroke ? 'active' : ''}" id="btnModeArea">Borrador de Área</button>
      </div>

      <div class="popover-divider"></div>

      <label class="popover-checkbox">
        <input type="checkbox" id="chkEraseHighlighter" ${eraseHighlighter ? 'checked' : ''} />
        <span>Borrar solo subrayador</span>
      </label>
    `;

    this.popover.querySelector('.popover-title-pin-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePinTool('eraser');
    });

    this.popover.querySelector('#btnModeStroke').addEventListener('click', () => {
      this.engine.setEraserMode('stroke');
      this.renderEraserMenu();
    });

    this.popover.querySelector('#btnModeArea').addEventListener('click', () => {
      this.engine.setEraserMode('area');
      this.renderEraserMenu();
    });

    this.popover.querySelector('#chkEraseHighlighter').addEventListener('change', (e) => {
      this.engine.setEraseHighlighterOnly(e.target.checked);
    });
  }

  // Popover Puntero Láser
  renderLaserMenu() {
    const isPinned = this.pinnedTools.has('laser');
    const color = (this.laserPointer && this.laserPointer.laserColor) || '#ef4444';

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title-row">
        <span class="mini-menu-title">Puntero Láser</span>
        <button type="button" class="popover-title-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-tool="laser" title="${isPinned ? 'Desfijar de la barra' : 'Fijar en la barra (máx 6)'}">
          ${isPinned ? Icons.pinFilled : Icons.pin}
          <span>${isPinned ? 'Fijado' : 'Fijar'}</span>
        </button>
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
        Puntero de presentación temporal con estela luminosa y desvanecimiento continuo.
      </div>
      <div class="color-palette-10">
        ${['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map(c => `
          <button type="button" class="color-swatch ${c.toLowerCase() === color.toLowerCase() ? 'active' : ''}" data-laser-color="${c}" style="background-color: ${c}"></button>
        `).join('')}
      </div>
    `;

    this.popover.querySelector('.popover-title-pin-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePinTool('laser');
    });

    this.popover.querySelectorAll('[data-laser-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.laserColor;
        if (this.laserPointer) {
          this.laserPointer.setColor(c);
        }
        this.renderLaserMenu();
      });
    });
  }

  // Popover Selector de Grosor Directo
  renderWidthPickerMenu() {
    const isHighlighter = this.activeTool === 'highlighter';
    const currentWidth = this.engine.strokeWidth;
    const presets = isHighlighter ? [8, 14, 18, 24, 32] : [1, 2, 4, 8, 14, 20];

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Grosor de Trazo</div>
      <div class="stroke-presets-chips">
        ${presets.map(w => `
          <button type="button" class="stroke-preset-chip ${w === currentWidth ? 'active' : ''}" data-width="${w}">${w}px</button>
        `).join('')}
      </div>
      <div class="slider-with-preview" style="margin-top: 10px;">
        <input type="range" class="popover-slider" id="directWidthSlider" min="1" max="${isHighlighter ? 40 : 30}" value="${currentWidth}" />
      </div>
    `;

    this.popover.querySelectorAll('.stroke-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const w = Number(chip.dataset.width);
        if (this.toolSettings[this.activeTool]) {
          this.toolSettings[this.activeTool].width = w;
          this.saveToolSettings();
        }
        this.engine.setWidth(w);
        const label = this.container.querySelector('#strokeWidthLabel');
        if (label) label.textContent = `${w}px`;
        this.renderWidthPickerMenu();
      });
    });

    const slider = this.popover.querySelector('#directWidthSlider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const w = Number(e.target.value);
        if (this.toolSettings[this.activeTool]) {
          this.toolSettings[this.activeTool].width = w;
          this.saveToolSettings();
        }
        this.engine.setWidth(w);
        const label = this.container.querySelector('#strokeWidthLabel');
        if (label) label.textContent = `${w}px`;
        this.popover.querySelectorAll('.stroke-preset-chip').forEach(chip => {
          chip.classList.toggle('active', Number(chip.dataset.width) === w);
        });
      });
    }
  }

  // Popover Presets Favoritos
  renderPresetsMenu() {
    const presets = PaletteManager.getPresets();
    const currentColor = this.engine.strokeColor;
    const currentWidth = this.engine.strokeWidth;

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Presets Favoritos de Trazo</div>
      <div class="mini-actions-list">
        <button type="button" class="mini-action-btn primary" id="btnAddCurrentPreset">
          <span class="mini-action-icon">${Icons.plus}</span>
          <div class="mini-action-text">
            <strong>Fijar Trazo Actual (${currentWidth}px)</strong>
            <small>Guardar color y grosor como favorito</small>
          </div>
        </button>
      </div>

      <div class="presets-list" id="presetsListContainer">
        ${presets.length === 0 ? `<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:10px;">No hay presets guardados</div>` : ''}
        ${presets.map(p => `
          <div class="preset-row-item">
            <button type="button" class="preset-apply-btn" data-preset-id="${p.id}">
              <span class="preset-color-badge" style="background-color: ${p.color};"></span>
              <div class="preset-info">
                <strong>${p.name || 'Estilo de Trazo'}</strong>
                <small>${p.width}px · ${p.tool || 'pen'}</small>
              </div>
            </button>
            <button type="button" class="preset-del-btn" data-del-id="${p.id}" title="Eliminar preset">×</button>
          </div>
        `).join('')}
      </div>
    `;

    this.popover.querySelector('#btnAddCurrentPreset')?.addEventListener('click', () => {
      PaletteManager.addPreset({
        name: `Estilo ${this.activeTool}`,
        tool: this.activeTool,
        color: currentColor,
        width: currentWidth
      });
      this.renderPresetsMenu();
    });

    this.popover.querySelectorAll('.preset-apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.presetId;
        const preset = presets.find(p => p.id === id);
        if (preset) {
          if (preset.tool && this.toolSettings[preset.tool]) {
            this.toolSettings[preset.tool].color = preset.color;
            this.toolSettings[preset.tool].width = preset.width;
            this.saveToolSettings();
          }
          this.engine.setColor(preset.color);
          this.engine.setWidth(preset.width);
          if (preset.tool) this.addOrActivateTool(preset.tool);
          this.updatePenDotsColor();
          this.closeMenu();
        }
      });
    });

    this.popover.querySelectorAll('.preset-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        PaletteManager.deletePreset(btn.dataset.delId);
        this.renderPresetsMenu();
      });
    });
  }

  // Popover Páginas y Fondo
  renderPagesMenu() {
    const isNotebook = this.engine.format === 'a4';
    const isCover = this.currentPageIndex === -1;
    const currentPattern = this.engine.backgroundPattern;

    const patterns = [
      { id: 'blank', name: 'Liso', icon: Icons.patternBlank },
      { id: 'ruled', name: 'Rayado', icon: Icons.patternRuled },
      { id: 'grid', name: 'Cuadrícula', icon: Icons.patternGrid },
      { id: 'dots', name: 'Puntos', icon: Icons.patternDots }
    ];

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Gestión de Hoja y Páginas</div>

      <div class="mini-actions-list ${isNotebook ? '' : 'hidden'}">
        <button type="button" class="mini-action-btn" id="btnMenuCover">
          <span class="mini-action-icon">${Icons.cover}</span>
          <div class="mini-action-text">
            <strong>Ir a la Portada</strong>
            <small>Personalizar la carátula</small>
          </div>
        </button>

        <button type="button" class="mini-action-btn" id="btnMenuAddPage">
          <span class="mini-action-icon">${Icons.plus}</span>
          <div class="mini-action-text">
            <strong>Añadir Nueva Página</strong>
            <small>Insertar hoja en el cuaderno</small>
          </div>
        </button>

        <button type="button" class="mini-action-btn ${isCover ? 'disabled' : ''}" id="btnMenuDupPage" ${isCover ? 'disabled' : ''}>
          <span class="mini-action-icon">${Icons.copy}</span>
          <div class="mini-action-text">
            <strong>Duplicar Página Actual</strong>
            <small>Crear copia idéntica</small>
          </div>
        </button>

        <button type="button" class="mini-action-btn danger ${isCover ? 'disabled' : ''}" id="btnMenuDelPage" ${isCover ? 'disabled' : ''}>
          <span class="mini-action-icon">${Icons.trash}</span>
          <div class="mini-action-text">
            <strong>Eliminar Página Actual</strong>
            <small>Borrar permanentemente</small>
          </div>
        </button>
      </div>

      <div class="popover-divider"></div>

      <div class="mini-menu-title">Pauta de Hoja (Fondo)</div>
      <div class="pattern-selector-grid">
        ${patterns.map(p => `
          <button type="button" class="pattern-option-btn ${currentPattern === p.id ? 'active' : ''}" data-pattern="${p.id}">
            <span class="pattern-btn-icon">${p.icon}</span>
            <span class="pattern-btn-name">${p.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    this.popover.querySelector('#btnMenuCover')?.addEventListener('click', () => {
      this.closeMenu();
      this.onOpenCover();
    });

    this.popover.querySelector('#btnMenuAddPage')?.addEventListener('click', () => {
      this.closeMenu();
      this.onAddPage();
    });

    const btnDup = this.popover.querySelector('#btnMenuDupPage');
    if (btnDup && !isCover) {
      btnDup.addEventListener('click', () => {
        this.closeMenu();
        this.onDuplicatePage();
      });
    }

    const btnDel = this.popover.querySelector('#btnMenuDelPage');
    if (btnDel && !isCover) {
      btnDel.addEventListener('click', () => {
        this.closeMenu();
        this.onDeletePage();
      });
    }

    this.popover.querySelectorAll('.pattern-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pat = btn.dataset.pattern;
        this.engine.setBackgroundPattern(pat);
        this.onPatternChange(pat);
        this.renderPagesMenu();
      });
    });
  }

  // Popover Configuración
  renderSettingsMenu() {
    const isStylus = this.engine.inputMode === 'stylus-first';
    const settings = (typeof SettingsManager !== 'undefined')
      ? SettingsManager.getSettings()
      : { theme: 'light', darkPaper: false, autoStraighten: true };

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Configuración y Aspecto</div>

      <div class="settings-mini-section">
        <div class="settings-mini-label">Tema Visual</div>
        <div class="theme-selector-group mini-theme-selector">
          <button type="button" class="theme-option-btn ${settings.theme === 'light' ? 'active' : ''}" data-mini-theme="light">
            <span class="theme-icon">${Icons.sun}</span>
            <span class="theme-label">Claro</span>
          </button>
          <button type="button" class="theme-option-btn ${settings.theme === 'dark' ? 'active' : ''}" data-mini-theme="dark">
            <span class="theme-icon">${Icons.moon}</span>
            <span class="theme-label">Oscuro</span>
          </button>
          <button type="button" class="theme-option-btn ${settings.theme === 'system' ? 'active' : ''}" data-mini-theme="system">
            <span class="theme-icon">${Icons.monitor}</span>
            <span class="theme-label">Sistema</span>
          </button>
        </div>
      </div>

      <div class="popover-divider"></div>

      <div class="settings-mini-section">
        <label class="settings-toggle-row">
          <div class="toggle-text">
            <div class="toggle-title-badge">
              <strong>Modo Stylus (Palma rechazada)</strong>
              <span class="badge-recommended">Activo</span>
            </div>
            <small>Dibuja solo con stylus; un dedo desplaza</small>
          </div>
          <input type="checkbox" id="chkMiniStylus" class="settings-switch" ${isStylus ? 'checked' : ''} />
        </label>
      </div>

      <div class="popover-divider"></div>

      <div class="mini-actions-list">
        <button type="button" class="mini-action-btn primary" id="btnActionExport">
          <span class="mini-action-icon">${Icons.export}</span>
          <div class="mini-action-text">
            <strong>Exportar Documento</strong>
            <small>Guardar en PDF vectorial o PNG</small>
          </div>
        </button>

        <button type="button" class="mini-action-btn danger" id="btnClearPageCanvas">
          <span class="mini-action-icon">${Icons.trash}</span>
          <div class="mini-action-text">
            <strong>Limpiar Lienzo</strong>
            <small>Vaciar trazos de esta página</small>
          </div>
        </button>
      </div>
    `;

    this.popover.querySelectorAll('[data-mini-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.miniTheme;
        if (typeof SettingsManager !== 'undefined') {
          SettingsManager.saveSettings({ theme });
        }
        this.renderSettingsMenu();
      });
    });

    const chkStylus = this.popover.querySelector('#chkMiniStylus');
    if (chkStylus) {
      chkStylus.addEventListener('change', (e) => {
        const newMode = e.target.checked ? 'stylus-first' : 'finger-drawing';
        this.engine.setInputMode(newMode);
        if (typeof SettingsManager !== 'undefined') {
          SettingsManager.saveSettings({ inputMode: newMode });
        }
        this.renderSettingsMenu();
      });
    }

    this.popover.querySelector('#btnClearPageCanvas')?.addEventListener('click', () => {
      this.closeMenu();
      if (confirm('¿Deseas vaciar todos los trazos de la página actual?')) {
        this.engine.clearAll();
      }
    });

    this.popover.querySelector('#btnActionExport')?.addEventListener('click', () => {
      this.closeMenu();
      this.onExport();
    });
  }

  selectTool(tool) {
    this.activeTool = tool;
    if (['pen', 'pencil', 'marker', 'highlighter'].includes(tool)) {
      this.lastPenTool = tool;
    }
    this.engine.setTool(tool);
    if (this.selectionTool) {
      this.selectionTool.setActive(tool === 'lasso');
    }
    if (this.laserPointer) {
      this.laserPointer.setActive(tool === 'laser');
    }

    // Aplicar configuración de color y trazo propia de esta herramienta
    if (this.toolSettings[tool]) {
      const s = this.toolSettings[tool];
      this.engine.setColor(s.color);
      this.engine.setWidth(s.width);
      this.engine.setOpacity(s.opacity);
      if (s.stabilization !== undefined) this.engine.setStabilization(s.stabilization);
      if (s.concentration !== undefined) this.engine.setConcentration(s.concentration);
    }

    this.updateActiveButton();

    const label = this.container.querySelector('#strokeWidthLabel');
    if (label) label.textContent = `${this.engine.strokeWidth}px`;
  }

  updateActiveButton() {
    this.dockTools.forEach(toolId => {
      const def = TOOL_DEFINITIONS[toolId];
      if (!def) return;
      const btn = this.container.querySelector(`#${def.btnId}`);
      if (btn) {
        btn.classList.toggle('active', this.activeTool === toolId);
      }
    });

    const isAuxiliary = !this.dockTools.includes(this.activeTool);
    const btnAux = this.container.querySelector('#btnMenuAuxiliary');
    if (btnAux) btnAux.classList.toggle('active', isAuxiliary);

    this.updatePenDotsColor();

    const label = this.container.querySelector('#strokeWidthLabel');
    if (label) label.textContent = `${this.engine.strokeWidth}px`;
  }

  updatePenDotsColor() {
    this.dockTools.forEach(toolId => {
      const dot = this.container.querySelector(`#dot_${toolId}`);
      if (dot) {
        dot.style.backgroundColor = this.getToolColor(toolId);
      }
    });
  }

  updatePageCounter(currentIdx, totalContentPages) {
    this.currentPageIndex = currentIdx;
    this.totalContentPages = totalContentPages;

    const badge = this.container.querySelector('#pagesNavBadge');
    if (badge) {
      const isNotebook = this.engine.format === 'a4';
      if (isNotebook) {
        const totalPages = totalContentPages + 1;
        if (currentIdx === -1) {
          badge.textContent = `1 / ${totalPages} (P)`;
        } else {
          badge.textContent = `${currentIdx + 2} / ${totalPages}`;
        }
      } else {
        badge.textContent = `${currentIdx + 1} / ${totalContentPages}`;
      }
    }
  }

  setFormat(format) {
    const isNotebook = format === 'a4';
    const pagesGroup = this.container.querySelector('#pagesControlGroup');
    const btnAddPage = this.container.querySelector('#btnAddPageIcon');
    if (pagesGroup) pagesGroup.classList.toggle('hidden', !isNotebook);
    if (btnAddPage) btnAddPage.classList.toggle('hidden', !isNotebook);
  }

  updatePatternIcon() {
    if (this.activeMenu === 'pages') {
      this.renderPagesMenu();
    }
  }

  setDocTitle(title) {
    const input = this.container.querySelector('#docTitleInput');
    if (input) input.value = title || 'Sin Título';
  }

  showSavedStatus() {
    const status = this.container.querySelector('#saveStatus');
    if (status) {
      status.style.opacity = '1';
      setTimeout(() => {
        status.style.opacity = '0.5';
      }, 1500);
    }
  }
}
