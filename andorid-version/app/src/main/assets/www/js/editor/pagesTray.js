// js/editor/pagesTray.js - Organizador visual de hojas (Thumbnail Tray) para Cuadernos Digitales
import { Icons } from '../icons.js';
import { CoverDesigner } from './coverDesigner.js';

export class PagesTray {
  constructor(options = {}) {
    this.container = options.containerEl || document.body;
    this.onSelectPage = options.onSelectPage || (() => {});
    this.onAddPage = options.onAddPage || (() => {});
    this.onDuplicatePage = options.onDuplicatePage || (() => {});
    this.onDeletePage = options.onDeletePage || (() => {});
    this.onReorderPages = options.onReorderPages || (() => {});
    this.onChangeBackground = options.onChangeBackground || options.onChangePattern || (() => {});
    this.onEditCover = options.onEditCover || options.onSelectCover || (() => {});

    this.isOpen = false;
    this.currentPageIndex = 0; // -1 = Portada, 0 = Página 1, 1 = Página 2...
    this.currentDoc = null;

    this.trayEl = null;
    this.initTray();
  }

  initTray() {
    this.trayEl = document.createElement('div');
    this.trayEl.className = 'pages-tray-container closed hidden';
    this.trayEl.innerHTML = `
      <div class="tray-header">
        <div class="tray-title">
          ${Icons.pagesTray}
          <span>Organizador de Hojas</span>
          <span class="page-badge-count" id="trayPagesCount">1 pág.</span>
        </div>
        <div class="tray-actions">
          <button class="tray-btn primary" id="btnTrayAddPage">
            ${Icons.plus}
            <span>Añadir Hoja</span>
          </button>
          <button class="tray-close-btn" id="btnTrayClose">
            ${Icons.chevronDown}
          </button>
        </div>
      </div>

      <div class="tray-scroll-area" id="trayScrollArea">
        <!-- Miniaturas inyectadas dinámicamente -->
      </div>
    `;

    this.container.appendChild(this.trayEl);
    this.bindEvents();
  }

  bindEvents() {
    this.trayEl.querySelector('#btnTrayClose').addEventListener('click', () => {
      this.toggle(false);
    });

    this.trayEl.querySelector('#btnTrayAddPage').addEventListener('click', () => {
      this.onAddPage();
    });
  }

  toggle(forceState = null) {
    this.isOpen = forceState !== null ? forceState : !this.isOpen;
    if (this.isOpen) {
      this.trayEl.classList.remove('closed');
      this.trayEl.classList.remove('hidden');
      this.renderPages();
    } else {
      this.trayEl.classList.add('closed');
      setTimeout(() => {
        if (!this.isOpen) this.trayEl.classList.add('hidden');
      }, 200);
    }
  }

  open() {
    this.toggle(true);
  }

  close() {
    this.toggle(false);
  }

  setDocument(doc, activePageIndex = 0) {
    this.currentDoc = doc;
    this.currentPageIndex = activePageIndex;

    // Solo visible en cuadernos
    if (doc && doc.type === 'notebook') {
      this.trayEl.classList.remove('hidden');
      this.renderPages();
    } else {
      this.trayEl.classList.add('hidden');
    }
  }

  setCurrentPageIndex(index) {
    this.currentPageIndex = index;
    this.renderPages();
  }

  renderPages() {
    if (!this.currentDoc || this.currentDoc.type !== 'notebook') return;

    const scrollArea = this.trayEl.querySelector('#trayScrollArea');
    const countEl = this.trayEl.querySelector('#trayPagesCount');
    const pages = this.currentDoc.pages || [];

    countEl.textContent = `${pages.length + 1} pág${pages.length === 0 ? '' : 's'} (Portada + ${pages.length} hoja${pages.length === 1 ? '' : 's'})`;

    let html = '';

    // 1. Tarjeta de Portada (Página 1)
    const isCoverActive = this.currentPageIndex === -1;
    const coverData = this.currentDoc.cover || { template: 'moleskine', title: this.currentDoc.title };
    const coverThumb = CoverDesigner.generateCoverThumbnail(coverData, 90, 127);

    html += `
      <div class="tray-card ${isCoverActive ? 'active' : ''}" data-index="-1">
        <div class="tray-thumb-box">
          <img src="${coverThumb}" class="tray-thumb-img" alt="Portada" />
          <span class="tray-page-num">1</span>
          <span class="tray-pattern-badge">Portada</span>
        </div>
        <div class="tray-card-footer">
          <button class="tray-mini-btn" id="btnEditCoverMini" title="Editar Portada">
            ${Icons.edit}
          </button>
        </div>
      </div>
    `;

    // 2. Tarjetas de cada página de contenido (Página 2, 3...)
    pages.forEach((page, index) => {
      const isActive = this.currentPageIndex === index;
      const thumb = page.thumbnail || '';
      const patternName = {
        blank: 'Liso',
        ruled: 'Rayado',
        grid: 'Cuadrícula',
        dots: 'Puntos'
      }[page.backgroundPattern || 'grid'];

      html += `
        <div class="tray-card ${isActive ? 'active' : ''}" data-index="${index}">
          <div class="tray-thumb-box">
            ${thumb ? `<img src="${thumb}" class="tray-thumb-img" alt="Pág ${index + 2}" />` : `<div class="tray-empty-thumb">${Icons.notebook}</div>`}
            <span class="tray-page-num">${index + 2}</span>
            <span class="tray-pattern-badge">${patternName}</span>
          </div>

          <div class="tray-card-footer">
            <button class="tray-mini-btn" data-action="duplicate" data-index="${index}" title="Duplicar hoja">
              ${Icons.copy}
            </button>
            <button class="tray-mini-btn" data-action="pattern" data-index="${index}" title="Cambiar pauta de todo el cuaderno">
              ${Icons.patternGrid}
            </button>
            <button class="tray-mini-btn danger" data-action="delete" data-index="${index}" title="Eliminar hoja" ${pages.length <= 1 ? 'disabled style="opacity:0.3"' : ''}>
              ${Icons.trash}
            </button>
          </div>
        </div>
      `;
    });

    scrollArea.innerHTML = html;

    // Vincular clics de selección
    scrollArea.querySelectorAll('.tray-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.tray-mini-btn')) return;
        const idx = Number(card.dataset.index);
        this.currentPageIndex = idx;
        this.renderPages();
        this.onSelectPage(idx);
      });
    });

    // Vincular botones de acción por tarjeta
    scrollArea.querySelector('#btnEditCoverMini')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onEditCover();
    });

    scrollArea.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onDuplicatePage(Number(btn.dataset.index));
      });
    });

    scrollArea.querySelectorAll('[data-action="pattern"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPatternPicker(Number(btn.dataset.index), btn);
      });
    });

    scrollArea.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onDeletePage(Number(btn.dataset.index));
      });
    });
  }

  openPatternPicker(pageIndex, triggerBtn) {
    const existing = document.querySelector('.pattern-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.className = 'pattern-popover';
    popover.innerHTML = `
      <div class="popover-title">Fondo de la Hoja ${pageIndex + 1}</div>
      <button class="pattern-item" data-pat="ruled">${Icons.patternRuled} <span>Rayado horizontal clásico</span></button>
      <button class="pattern-item" data-pat="grid">${Icons.patternGrid} <span>Cuadrícula técnica (5 mm)</span></button>
      <button class="pattern-item" data-pat="dots">${Icons.patternDots} <span>Trama de puntos (Bullet)</span></button>
      <button class="pattern-item" data-pat="blank">${Icons.patternBlank} <span>Blanco liso</span></button>
    `;

    document.body.appendChild(popover);

    const rect = triggerBtn.getBoundingClientRect();
    popover.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popover.style.left = `${Math.max(10, rect.left - 80)}px`;

    const close = () => {
      popover.remove();
      document.removeEventListener('pointerdown', outsideClick);
    };

    const outsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        close();
      }
    };

    setTimeout(() => {
      document.addEventListener('pointerdown', outsideClick);
    }, 50);

    popover.querySelectorAll('.pattern-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const pat = btn.dataset.pat;
        close();
        this.onChangeBackground(pageIndex, pat);
      });
    });
  }
}

