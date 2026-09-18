// js/dashboard/contextMenu.js - Menú contextual de tres puntos para tarjetas
import { Icons } from '../icons.js';

export class ContextMenu {
  constructor(options = {}) {
    this.onOpen = options.onOpen || (() => {});
    this.onRename = options.onRename || (() => {});
    this.onMove = options.onMove || (() => {});
    this.onDuplicate = options.onDuplicate || (() => {});
    this.onExport = options.onExport || (() => {});
    this.onToggleFavorite = options.onToggleFavorite || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onRestore = options.onRestore || (() => {});
    this.onPermanentDelete = options.onPermanentDelete || (() => {});

    this.menuEl = null;
    this.currentDoc = null;

    this.createMenu();
    this.bindGlobalEvents();
  }

  createMenu() {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'dashboard-context-menu hidden';
    document.body.appendChild(this.menuEl);
  }

  bindGlobalEvents() {
    document.addEventListener('pointerdown', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target) && !e.target.closest('.card-menu-btn')) {
        this.hide();
      }
    });

    window.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
  }

  show(doc, triggerBtn) {
    this.currentDoc = doc;
    const isTrash = Boolean(doc.isTrash);

    if (isTrash) {
      this.menuEl.innerHTML = `
        <button class="ctx-item" id="ctxRestore">
          ${Icons.check} <span>Restaurar documento</span>
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item danger" id="ctxPermDelete">
          ${Icons.trash} <span>Eliminar definitivamente</span>
        </button>
      `;

      this.menuEl.querySelector('#ctxRestore').addEventListener('click', () => {
        this.onRestore(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxPermDelete').addEventListener('click', () => {
        this.onPermanentDelete(this.currentDoc);
        this.hide();
      });
    } else {
      this.menuEl.innerHTML = `
        <button class="ctx-item" id="ctxOpen">
          ${Icons.edit} <span>Abrir</span>
        </button>
        <button class="ctx-item" id="ctxRename">
          ${Icons.edit} <span>Renombrar</span>
        </button>
        <button class="ctx-item" id="ctxFavorite">
          ${doc.isFavorite ? Icons.starFilled : Icons.star}
          <span>${doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span>
        </button>
        <button class="ctx-item" id="ctxMove">
          ${Icons.folder} <span>Mover a carpeta...</span>
        </button>
        <button class="ctx-item" id="ctxDuplicate">
          ${Icons.copy} <span>Duplicar</span>
        </button>
        <button class="ctx-item" id="ctxExport">
          ${Icons.export} <span>Exportar (PDF/PNG)</span>
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item danger" id="ctxDelete">
          ${Icons.trash} <span>Mover a la papelera</span>
        </button>
      `;

      this.menuEl.querySelector('#ctxOpen').addEventListener('click', () => {
        this.onOpen(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxRename').addEventListener('click', () => {
        this.onRename(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxFavorite').addEventListener('click', () => {
        this.onToggleFavorite(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxMove').addEventListener('click', () => {
        this.onMove(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxDuplicate').addEventListener('click', () => {
        this.onDuplicate(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxExport').addEventListener('click', () => {
        this.onExport(this.currentDoc);
        this.hide();
      });

      this.menuEl.querySelector('#ctxDelete').addEventListener('click', () => {
        this.onDelete(this.currentDoc);
        this.hide();
      });
    }

    const rect = triggerBtn.getBoundingClientRect();
    const menuWidth = 210;
    let left = rect.right - menuWidth;
    let top = rect.bottom + 6;

    // Evitar desbordamiento de pantalla
    if (left < 10) left = 10;
    if (top + 280 > window.innerHeight) {
      top = rect.top - 270;
    }

    this.menuEl.style.left = `${left}px`;
    this.menuEl.style.top = `${top}px`;
    this.menuEl.classList.remove('hidden');
  }

  hide() {
    if (this.menuEl) {
      this.menuEl.classList.add('hidden');
    }
  }
}

