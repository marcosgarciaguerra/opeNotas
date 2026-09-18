// js/editor/toolbar.js - Barra de herramientas simplificada y moderna con mini-menús expansibles
import { Icons } from '../icons.js';

export class Toolbar {
  constructor(canvasEngine, selectionTool, options = {}) {
    this.engine = canvasEngine;
    this.selectionTool = selectionTool;
    this.shapeTool = options.shapeTool || null;
    this.textTool = options.textTool || null;
    this.imageTool = options.imageTool || null;

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
    this.activeMenu = null; // 'pens' | 'eraser' | 'insert' | 'pages' | 'options' | null

    this.favoriteColors = ['#1e293b', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea'];
    this.container = null;
    this.popover = null;
    this.currentPageIndex = 0;
    this.totalContentPages = 1;

    this.init();
  }

  init() {
    this.container = document.getElementById('editorToolbar');
    this.renderToolbar();
    this.createPopover();
    this.bindEvents();
    this.updateActiveButton();
  }

  setTools({ shapeTool, textTool, imageTool }) {
    if (shapeTool) this.shapeTool = shapeTool;
    if (textTool) this.textTool = textTool;
    if (imageTool) this.imageTool = imageTool;
  }

  renderToolbar() {
    const isNotebook = this.engine.format === 'a4';

    this.container.innerHTML = `
      <div class="toolbar-left">
        <button id="btnBackToLibrary" class="tool-btn icon-btn" title="Volver a Documentos">
          ${Icons.back}
          <span class="btn-text">Documentos</span>
        </button>
        <div class="doc-title-container">
          <input type="text" id="docTitleInput" class="doc-title-input" value="Sin Título" />
          <span class="save-status" id="saveStatus">${Icons.check}</span>
        </div>
      </div>

      <div class="toolbar-center">
        <!-- Dock principal simplificado -->
        <div class="main-tool-dock">
          <!-- 1. Menú de Plumas / Trazos -->
          <button class="dock-btn has-dropdown active" id="btnMenuPens" title="Trazos y Plumas (Bolígrafo, Lápiz, Rotulador, Subrayador)">
            <span class="tool-icon-wrapper" id="activePenIcon">${Icons.pen}</span>
            <span class="pen-color-dot" id="activePenColorDot" style="background-color: ${this.engine.strokeColor};"></span>
            <span class="dropdown-chevron">${Icons.chevronDown}</span>
          </button>

          <!-- 2. Menú de Borrador -->
          <button class="dock-btn has-dropdown" id="btnMenuEraser" title="Borrador (Trazo o Área)">
            <span class="tool-icon-wrapper">${Icons.eraser}</span>
            <span class="dropdown-chevron">${Icons.chevronDown}</span>
          </button>

          <!-- 3. Mano / Desplazar por el documento -->
          <button class="dock-btn" id="btnToolHand" title="Mano (Moverse y bajar por el documento)">
            <span class="tool-icon-wrapper">${Icons.hand}</span>
          </button>

          <!-- 4. Menú de Insertar -->
          <button class="dock-btn has-dropdown" id="btnMenuInsert" title="Insertar figuras, texto, imágenes o selección">
            <span class="tool-icon-wrapper">${Icons.plus}</span>
            <span class="btn-text">Insertar</span>
            <span class="dropdown-chevron">${Icons.chevronDown}</span>
          </button>

          <div class="dock-divider"></div>

          <!-- 5. Deshacer / Rehacer -->
          <button class="dock-btn-icon" id="btnUndo" title="Deshacer (Ctrl+Z)">
            ${Icons.undo}
          </button>
          <button class="dock-btn-icon" id="btnRedo" title="Rehacer (Ctrl+Y)">
            ${Icons.redo}
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- 6. Control de Páginas (Cuadernos A4) -->
        <div class="pages-control-group ${isNotebook ? '' : 'hidden'}" id="pagesControlGroup">
          <button class="pages-nav-arrow" id="btnPrevPage" title="Página anterior">
            ${Icons.chevronLeft}
          </button>
          <button class="pages-dropdown-btn" id="btnPagesMenu" title="Menú de Páginas y Pauta">
            <span class="pages-label" id="pagesNavBadge">Pág 1 / 1</span>
            <span class="dropdown-chevron">${Icons.chevronDown}</span>
          </button>
          <button class="pages-nav-arrow" id="btnNextPage" title="Página siguiente">
            ${Icons.chevronRight}
          </button>
        </div>

        <!-- 7. Menú de Configuración -->
        <button class="dock-btn has-dropdown" id="btnMenuSettings" title="Configuración del Sistema y Modo Oscuro">
          <span class="tool-icon-wrapper">${Icons.settings}</span>
          <span class="btn-text">Configuración</span>
          <span class="dropdown-chevron">${Icons.chevronDown}</span>
        </button>
      </div>
    `;
  }

  createPopover() {
    this.popover = document.createElement('div');
    this.popover.className = 'tool-popover mini-menu-popover hidden';
    document.body.appendChild(this.popover);
  }

  bindEvents() {
    // Volver a la biblioteca
    this.container.querySelector('#btnBackToLibrary').addEventListener('click', () => {
      this.closeMenu();
      this.onBack();
    });

    // Edición de título
    const titleInput = this.container.querySelector('#docTitleInput');
    titleInput.addEventListener('change', (e) => {
      this.onTitleChange(e.target.value.trim());
    });

    // 1. Plumas
    const btnMenuPens = this.container.querySelector('#btnMenuPens');
    btnMenuPens.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentPen = ['pen', 'pencil', 'marker', 'highlighter'].includes(this.activeTool);
      if (!isCurrentPen) {
        this.selectTool(this.lastPenTool || 'pen');
      }
      this.toggleMenu('pens', btnMenuPens);
    });

    // 2. Borrador
    const btnMenuEraser = this.container.querySelector('#btnMenuEraser');
    btnMenuEraser.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeTool !== 'eraser') {
        this.selectTool('eraser');
      }
      this.toggleMenu('eraser', btnMenuEraser);
    });

    // 3. Mano
    const btnToolHand = this.container.querySelector('#btnToolHand');
    btnToolHand.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenu();
      this.selectTool('hand');
    });

    // 4. Insertar
    const btnMenuInsert = this.container.querySelector('#btnMenuInsert');
    btnMenuInsert.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu('insert', btnMenuInsert);
    });

    // 5. Historial
    this.container.querySelector('#btnUndo').addEventListener('click', () => {
      this.engine.undo();
    });

    this.container.querySelector('#btnRedo').addEventListener('click', () => {
      this.engine.redo();
    });

    // 6. Páginas
    const btnPrevPage = this.container.querySelector('#btnPrevPage');
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        this.onPrevPage();
      });
    }

    const btnNextPage = this.container.querySelector('#btnNextPage');
    if (btnNextPage) {
      btnNextPage.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        this.onNextPage();
      });
    }

    const btnPagesMenu = this.container.querySelector('#btnPagesMenu');
    if (btnPagesMenu) {
      btnPagesMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('pages', btnPagesMenu);
      });
    }

    // 7. Configuración
    const btnMenuSettings = this.container.querySelector('#btnMenuSettings');
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
        !e.target.closest('.has-dropdown') &&
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
        this.selectTool('pen');
      } else if (e.key.toLowerCase() === 'e') {
        this.selectTool('eraser');
      } else if (e.key.toLowerCase() === 'h') {
        this.selectTool('highlighter');
      } else if (e.key.toLowerCase() === 'm') {
        this.selectTool('hand');
      } else if (e.key.toLowerCase() === 'l') {
        this.selectTool('lasso');
      }
    });
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
    const popoverWidth = Math.min(320, window.innerWidth - 20);
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, left));

    let top = rect.bottom + 8;
    this.popover.style.top = `${top}px`;
    this.popover.style.left = `${left}px`;
    this.popover.style.maxWidth = `calc(100vw - 20px)`;
  }

  renderMenuContent(menuType) {
    switch (menuType) {
      case 'pens':
        this.renderPensMenu();
        break;
      case 'eraser':
        this.renderEraserMenu();
        break;
      case 'insert':
        this.renderInsertMenu();
        break;
      case 'pages':
        this.renderPagesMenu();
        break;
      case 'settings':
      case 'options':
        this.renderSettingsMenu();
        break;
    }
  }

  // 1. Mini-menú de Plumas
  renderPensMenu() {
    const penTools = [
      { id: 'pen', name: 'Bolígrafo', icon: Icons.pen, desc: 'Trazo suave continuo' },
      { id: 'pencil', name: 'Lápiz', icon: Icons.pencil, desc: 'Textura de grafito' },
      { id: 'marker', name: 'Rotulador', icon: Icons.marker, desc: 'Tinta densa' },
      { id: 'highlighter', name: 'Subrayador', icon: Icons.highlighter, desc: 'Translúcido con auto-recta' }
    ];

    const currentPenId = ['pen', 'pencil', 'marker', 'highlighter'].includes(this.activeTool)
      ? this.activeTool
      : (this.lastPenTool || 'pen');
    const currentColor = this.engine.strokeColor;
    const currentWidth = this.engine.strokeWidth;
    const isHighlighter = currentPenId === 'highlighter';

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Tipo de Trazo</div>
      <div class="pen-types-grid">
        ${penTools.map(p => `
          <button class="pen-type-chip ${p.id === currentPenId ? 'active' : ''}" data-pentype="${p.id}">
            <span class="pen-chip-icon">${p.icon}</span>
            <span class="pen-chip-name">${p.name}</span>
          </button>
        `).join('')}
      </div>

      <div class="popover-divider"></div>

      <div class="mini-menu-title">Color de Tinta</div>
      <div class="color-palette">
        ${this.favoriteColors.map(c => `
          <button class="color-swatch ${c === currentColor ? 'active' : ''}" data-color="${c}" style="background-color: ${c}"></button>
        `).join('')}
        <label class="color-picker-label" title="Color personalizado">
          <input type="color" id="popoverColorPicker" value="${currentColor}" />
          <span class="picker-icon">${Icons.edit}</span>
        </label>
      </div>

      <div class="popover-divider"></div>

      <div class="popover-row">
        <span class="label-text">Grosor</span>
        <span class="value-text" id="penWidthVal">${currentWidth}px</span>
      </div>
      <div class="slider-with-preview">
        <input type="range" class="popover-slider" id="penStrokeSlider" min="1" max="${isHighlighter ? 40 : 25}" value="${currentWidth}" />
        <div class="stroke-preview-circle" id="penPreviewCircle" style="width: ${Math.min(currentWidth, 28)}px; height: ${Math.min(currentWidth, 28)}px; background-color: ${currentColor};"></div>
      </div>

      ${isHighlighter ? `
        <div class="popover-hint">
          💡 <strong>Tip:</strong> Mantén pulsado 450ms al final para enderezar automáticamente la línea.
        </div>
      ` : ''}
    `;

    // Eventos de selección de tipo de pluma
    this.popover.querySelectorAll('[data-pentype]').forEach(btn => {
      btn.addEventListener('click', () => {
        const penId = btn.dataset.pentype;
        this.selectTool(penId);
        this.renderPensMenu();
      });
    });

    // Eventos de paleta de colores
    this.popover.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this.engine.setColor(color);
        this.updatePenIconColor();
        this.renderPensMenu();
      });
    });

    // Color picker
    const picker = this.popover.querySelector('#popoverColorPicker');
    if (picker) {
      picker.addEventListener('input', (e) => {
        const color = e.target.value;
        this.engine.setColor(color);
        this.updatePenIconColor();
        const circle = this.popover.querySelector('#penPreviewCircle');
        if (circle) circle.style.backgroundColor = color;
      });
    }

    // Grosor
    const slider = this.popover.querySelector('#penStrokeSlider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const w = Number(e.target.value);
        this.engine.setWidth(w);
        const valText = this.popover.querySelector('#penWidthVal');
        if (valText) valText.textContent = `${w}px`;
        const circle = this.popover.querySelector('#penPreviewCircle');
        if (circle) {
          circle.style.width = `${Math.min(w, 28)}px`;
          circle.style.height = `${Math.min(w, 28)}px`;
        }
      });
    }
  }

  // 2. Mini-menú de Borrador
  renderEraserMenu() {
    const isStroke = this.engine.eraserMode === 'stroke';
    const radius = this.engine.eraserRadius || 16;
    const highlighterOnly = Boolean(this.engine.eraseHighlighterOnly);

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Modo del Borrador</div>
      <div class="eraser-mode-selector">
        <button class="mode-pill ${isStroke ? 'active' : ''}" id="btnModeStroke">
          Trazo Completo
        </button>
        <button class="mode-pill ${!isStroke ? 'active' : ''}" id="btnModeArea">
          Área Circular
        </button>
      </div>

      <div class="popover-divider"></div>

      <label class="popover-checkbox">
        <input type="checkbox" id="chkHighlighterOnly" ${highlighterOnly ? 'checked' : ''} />
        <span>Solo borrar subrayador</span>
      </label>

      <div class="popover-divider"></div>

      <div class="popover-row">
        <span class="label-text">Radio de borrado</span>
        <span class="value-text" id="eraserSizeVal">${radius}px</span>
      </div>
      <input type="range" class="popover-slider" id="sliderEraserRadius" min="6" max="40" value="${radius}" />
    `;

    this.popover.querySelector('#btnModeStroke').addEventListener('click', () => {
      this.engine.setEraserMode('stroke');
      this.renderEraserMenu();
    });

    this.popover.querySelector('#btnModeArea').addEventListener('click', () => {
      this.engine.setEraserMode('area');
      this.renderEraserMenu();
    });

    this.popover.querySelector('#chkHighlighterOnly').addEventListener('change', (e) => {
      this.engine.setEraseHighlighterOnly(e.target.checked);
    });

    const radiusSlider = this.popover.querySelector('#sliderEraserRadius');
    radiusSlider.addEventListener('input', (e) => {
      const r = Number(e.target.value);
      this.engine.eraserRadius = r;
      const sizeVal = this.popover.querySelector('#eraserSizeVal');
      if (sizeVal) sizeVal.textContent = `${r}px`;
    });
  }

  // 3. Mini-menú de Insertar (Figuras, Texto, Imagen, Lazo)
  renderInsertMenu() {
    const isShape = this.activeTool === 'shape';
    const activeShapeType = this.shapeTool ? this.shapeTool.shapeType : 'rectangle';
    const shapeColor = this.shapeTool ? this.shapeTool.strokeColor : this.engine.strokeColor;
    const fillColor = this.shapeTool ? this.shapeTool.fillColor : 'transparent';
    const shapeWidth = this.shapeTool ? this.shapeTool.strokeWidth : 3;

    const fillColors = [
      { label: 'Ninguno', val: 'transparent' },
      { label: 'Blanco', val: '#ffffff' },
      { label: 'Amarillo', val: '#fef3c7' },
      { label: 'Azul', val: '#dbeafe' },
      { label: 'Verde', val: '#dcfce7' },
      { label: 'Rojo', val: '#fee2e2' }
    ];

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Insertar Elemento</div>
      <div class="insert-tools-grid">
        <button class="insert-item-btn ${isShape ? 'active' : ''}" id="btnInsertShape">
          <span class="insert-icon">${Icons.shape}</span>
          <span class="insert-name">Figuras</span>
        </button>
        <button class="insert-item-btn ${this.activeTool === 'text' ? 'active' : ''}" id="btnInsertText">
          <span class="insert-icon">${Icons.text}</span>
          <span class="insert-name">Texto</span>
        </button>
        <button class="insert-item-btn" id="btnInsertImage">
          <span class="insert-icon">${Icons.image}</span>
          <span class="insert-name">Imagen</span>
        </button>
        <button class="insert-item-btn ${this.activeTool === 'lasso' ? 'active' : ''}" id="btnInsertLasso">
          <span class="insert-icon">${Icons.lasso}</span>
          <span class="insert-name">Lazo</span>
        </button>
      </div>

      <div id="shapeSubOptions" class="${isShape ? '' : 'hidden'}">
        <div class="popover-divider"></div>
        <div class="mini-menu-title">Tipo de Figura</div>
        <div class="shape-type-selector">
          <button class="mode-pill ${activeShapeType === 'rectangle' ? 'active' : ''}" data-shape="rectangle">
            ${Icons.rectangle} Rectángulo
          </button>
          <button class="mode-pill ${activeShapeType === 'circle' ? 'active' : ''}" data-shape="circle">
            ${Icons.circle} Círculo
          </button>
          <button class="mode-pill ${activeShapeType === 'line' ? 'active' : ''}" data-shape="line">
            ${Icons.line} Línea
          </button>
          <button class="mode-pill ${activeShapeType === 'arrow' ? 'active' : ''}" data-shape="arrow">
            ${Icons.arrow} Flecha
          </button>
        </div>

        <div class="popover-divider"></div>

        <div class="mini-menu-title">Color de Borde</div>
        <div class="color-palette">
          ${this.favoriteColors.map(c => `
            <button class="color-swatch ${c === shapeColor ? 'active' : ''}" data-shape-color="${c}" style="background-color: ${c}"></button>
          `).join('')}
        </div>

        <div class="popover-divider"></div>

        <div class="mini-menu-title">Relleno</div>
        <div class="fill-palette">
          ${fillColors.map(f => `
            <button class="fill-swatch ${f.val === fillColor ? 'active' : ''}" data-fill="${f.val}" style="background-color: ${f.val === 'transparent' ? '#f1f5f9' : f.val}" title="${f.label}">
              ${f.val === 'transparent' ? '✕' : ''}
            </button>
          `).join('')}
        </div>

        <div class="popover-divider"></div>

        <div class="popover-row">
          <span class="label-text">Grosor de borde</span>
          <span class="value-text" id="shapeWidthVal">${shapeWidth}px</span>
        </div>
        <input type="range" class="popover-slider" id="shapeStrokeSlider" min="1" max="15" value="${shapeWidth}" />
      </div>
    `;

    // Eventos de botones
    this.popover.querySelector('#btnInsertShape').addEventListener('click', () => {
      this.selectTool('shape');
      this.renderInsertMenu();
    });

    this.popover.querySelector('#btnInsertText').addEventListener('click', () => {
      this.selectTool('text');
      this.closeMenu();
    });

    this.popover.querySelector('#btnInsertImage').addEventListener('click', () => {
      this.closeMenu();
      if (this.imageTool) this.imageTool.triggerUpload();
    });

    this.popover.querySelector('#btnInsertLasso').addEventListener('click', () => {
      this.selectTool('lasso');
      this.closeMenu();
    });

    if (isShape) {
      this.popover.querySelectorAll('[data-shape]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.shapeTool) this.shapeTool.setShapeType(btn.dataset.shape);
          this.renderInsertMenu();
        });
      });

      this.popover.querySelectorAll('[data-shape-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.shapeTool) this.shapeTool.setStrokeColor(btn.dataset.shapeColor);
          this.renderInsertMenu();
        });
      });

      this.popover.querySelectorAll('[data-fill]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.shapeTool) this.shapeTool.setFillColor(btn.dataset.fill);
          this.renderInsertMenu();
        });
      });

      const slider = this.popover.querySelector('#shapeStrokeSlider');
      if (slider) {
        slider.addEventListener('input', (e) => {
          const w = Number(e.target.value);
          if (this.shapeTool) this.shapeTool.setStrokeWidth(w);
          const valText = this.popover.querySelector('#shapeWidthVal');
          if (valText) valText.textContent = `${w}px`;
        });
      }
    }
  }

  // 4. Mini-menú de Páginas (Navegación, Añadir, Duplicar, Pauta)
  renderPagesMenu() {
    const isCover = this.currentPageIndex === -1;
    const currentPattern = this.engine.backgroundPattern;

    const patterns = [
      { id: 'grid', name: 'Cuadrícula 5mm', icon: Icons.patternGrid },
      { id: 'ruled', name: 'Rayado Clásico', icon: Icons.patternRuled },
      { id: 'dots', name: 'Puntos Bullet', icon: Icons.patternDots },
      { id: 'blank', name: 'Blanco Liso', icon: Icons.patternBlank }
    ];

    this.popover.innerHTML = `
      <div class="popover-arrow"></div>
      <div class="mini-menu-title">Páginas del Cuaderno</div>
      <div class="mini-actions-list">
        <button class="mini-action-btn ${isCover ? 'active' : ''}" id="btnMenuCover">
          <span class="mini-action-icon">${Icons.cover}</span>
          <div class="mini-action-text">
            <strong>Ir a la Portada</strong>
            <small>Personalizar la carátula</small>
          </div>
        </button>

        <button class="mini-action-btn" id="btnMenuAddPage">
          <span class="mini-action-icon">${Icons.plus}</span>
          <div class="mini-action-text">
            <strong>Añadir Nueva Página</strong>
            <small>Insertar hoja en el cuaderno</small>
          </div>
        </button>

        <button class="mini-action-btn ${isCover ? 'disabled' : ''}" id="btnMenuDupPage" ${isCover ? 'disabled' : ''}>
          <span class="mini-action-icon">${Icons.copy}</span>
          <div class="mini-action-text">
            <strong>Duplicar Página Actual</strong>
            <small>Crear copia idéntica</small>
          </div>
        </button>

        <button class="mini-action-btn danger ${isCover ? 'disabled' : ''}" id="btnMenuDelPage" ${isCover ? 'disabled' : ''}>
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
          <button class="pattern-option-btn ${currentPattern === p.id ? 'active' : ''}" data-pattern="${p.id}">
            <span class="pattern-btn-icon">${p.icon}</span>
            <span class="pattern-btn-name">${p.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Eventos
    this.popover.querySelector('#btnMenuCover').addEventListener('click', () => {
      this.closeMenu();
      this.onOpenCover();
    });

    this.popover.querySelector('#btnMenuAddPage').addEventListener('click', () => {
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

  // 5. Mini-menú de Configuración (Tema, Stylus, Opciones)
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
            <small>Dibuja solo con stylus; un dedo o mano desplaza</small>
          </div>
          <input type="checkbox" id="chkMiniStylus" class="settings-switch" ${isStylus ? 'checked' : ''} />
        </label>

        <label class="settings-toggle-row mt-2">
          <div class="toggle-text">
            <strong>Papel oscuro en modo noche</strong>
            <small>Fondo de hoja oscuro para descansar la vista</small>
          </div>
          <input type="checkbox" id="chkMiniDarkPaper" class="settings-switch" ${settings.darkPaper ? 'checked' : ''} />
        </label>
      </div>

      <div class="popover-divider"></div>

      <div class="mini-actions-list">
        <button class="mini-action-btn primary" id="btnActionExport">
          <span class="mini-action-icon">${Icons.export}</span>
          <div class="mini-action-text">
            <strong>Exportar Documento</strong>
            <small>Guardar en PDF vectorial o imagen PNG</small>
          </div>
        </button>

        <button class="mini-action-btn danger" id="btnClearPageCanvas">
          <span class="mini-action-icon">${Icons.trash}</span>
          <div class="mini-action-text">
            <strong>Limpiar Lienzo</strong>
            <small>Vaciar trazos y notas de esta página</small>
          </div>
        </button>

        <button class="mini-action-btn" id="btnOpenSettingsFromEditor">
          <span class="mini-action-icon">${Icons.settings}</span>
          <div class="mini-action-text">
            <strong>Panel Completo de Ajustes</strong>
            <small>Pautas por defecto y datos locales</small>
          </div>
        </button>
      </div>
    `;

    // Eventos de Tema
    this.popover.querySelectorAll('[data-mini-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.miniTheme;
        if (typeof SettingsManager !== 'undefined') {
          SettingsManager.saveSettings({ theme });
        }
        this.renderSettingsMenu();
      });
    });

    // Toggle Modo Stylus
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

    // Toggle Papel Oscuro
    const chkDarkPaper = this.popover.querySelector('#chkMiniDarkPaper');
    if (chkDarkPaper) {
      chkDarkPaper.addEventListener('change', (e) => {
        if (typeof SettingsManager !== 'undefined') {
          SettingsManager.saveSettings({ darkPaper: e.target.checked });
        }
      });
    }

    this.popover.querySelector('#btnClearPageCanvas').addEventListener('click', () => {
      this.closeMenu();
      if (confirm('¿Deseas vaciar todos los trazos y elementos de la página actual?')) {
        this.engine.clearAll();
      }
    });

    this.popover.querySelector('#btnActionExport').addEventListener('click', () => {
      this.closeMenu();
      this.onExport();
    });

    const btnSettings = this.popover.querySelector('#btnOpenSettingsFromEditor');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.closeMenu();
        this.onOpenSettings();
      });
    }
  }

  // Compatibilidad
  renderOptionsMenu() {
    this.renderSettingsMenu();
  }

  selectTool(tool) {
    this.activeTool = tool;
    if (['pen', 'pencil', 'marker', 'highlighter'].includes(tool)) {
      this.lastPenTool = tool;
    }
    this.engine.setTool(tool);
    this.selectionTool.setActive(tool === 'lasso');
    this.updateActiveButton();

    if (tool === 'highlighter') {
      this.engine.setWidth(18);
      this.engine.setOpacity(0.45);
    } else if (tool === 'pen') {
      this.engine.setWidth(3);
      this.engine.setOpacity(1);
    } else if (tool === 'pencil') {
      this.engine.setWidth(2.5);
      this.engine.setOpacity(0.85);
    } else if (tool === 'marker') {
      this.engine.setWidth(6);
      this.engine.setOpacity(0.9);
    }
  }

  updateActiveButton() {
    const isPen = ['pen', 'pencil', 'marker', 'highlighter'].includes(this.activeTool);
    const isEraser = this.activeTool === 'eraser';
    const isHand = this.activeTool === 'hand';
    const isInsert = ['shape', 'text', 'image', 'lasso'].includes(this.activeTool);

    const btnPens = this.container.querySelector('#btnMenuPens');
    const btnEraser = this.container.querySelector('#btnMenuEraser');
    const btnHand = this.container.querySelector('#btnToolHand');
    const btnInsert = this.container.querySelector('#btnMenuInsert');

    if (btnPens) btnPens.classList.toggle('active', isPen);
    if (btnEraser) btnEraser.classList.toggle('active', isEraser);
    if (btnHand) btnHand.classList.toggle('active', isHand);
    if (btnInsert) btnInsert.classList.toggle('active', isInsert);

    // Actualizar icono de la pluma activa
    const iconSpan = this.container.querySelector('#activePenIcon');
    if (iconSpan && isPen) {
      iconSpan.innerHTML = Icons[this.activeTool] || Icons.pen;
    }

    this.updatePenIconColor();
  }

  updatePenIconColor() {
    const dot = this.container.querySelector('#activePenColorDot');
    if (dot) {
      dot.style.backgroundColor = this.engine.strokeColor;
    }
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
          badge.textContent = `Pág 1 / ${totalPages} (Portada)`;
        } else {
          badge.textContent = `Pág ${currentIdx + 2} / ${totalPages}`;
        }
      } else {
        badge.textContent = `Pág ${currentIdx + 1} / ${totalContentPages}`;
      }
    }
  }

  setFormat(format) {
    const isNotebook = format === 'a4';
    const pagesGroup = this.container.querySelector('#pagesControlGroup');
    if (pagesGroup) {
      pagesGroup.classList.toggle('hidden', !isNotebook);
    }
  }

  updatePatternIcon() {
    // Pauta se actualiza dentro del mini-menú de páginas si está abierto
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
