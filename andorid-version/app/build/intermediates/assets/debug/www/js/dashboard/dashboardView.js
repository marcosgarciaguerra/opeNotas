// js/dashboard/dashboardView.js - Renderizado del Dashboard y Biblioteca Digital
import { Icons } from '../icons.js';
import { db } from '../db.js';
import { ContextMenu } from './contextMenu.js';
import { CoverDesigner } from '../editor/coverDesigner.js';

export class DashboardView {
  constructor(options = {}) {
    this.onOpenDoc = options.onOpenDoc || (() => {});
    this.onCreateNotebook = options.onCreateNotebook || (() => {});
    this.onCreateBoard = options.onCreateBoard || (() => {});
    this.onCreateDocOnly = options.onCreateDocOnly || (() => {});
    this.onExportDoc = options.onExportDoc || (() => {});
    this.onOpenSettings = options.onOpenSettings || (() => {});

    this.container = document.getElementById('dashboardView');
    this.currentNav = 'all'; // 'all' | 'recent' | 'favorites' | 'folder_{id}' | 'trash'
    this.currentFilter = 'all'; // 'all' | 'notebook' | 'whiteboard'
    this.currentViewMode = 'grid'; // 'grid' | 'list'
    this.searchQuery = '';

    this.documents = [];
    this.folders = [];
    this.expandedFolderIds = new Set();

    this.contextMenu = new ContextMenu({
      onOpen: (doc) => this.onOpenDoc(doc),
      onRename: (doc) => this.promptRenameDoc(doc),
      onMove: (doc) => this.promptMoveDoc(doc),
      onDuplicate: async (doc) => {
        await db.duplicateDocument(doc.id);
        await this.loadAndRender();
      },
      onToggleFavorite: async (doc) => {
        doc.isFavorite = !doc.isFavorite;
        await db.saveDocument(doc);
        await this.loadAndRender();
      },
      onExport: (doc) => this.onExportDoc(doc),
      onDelete: async (doc) => {
        await db.moveToTrash(doc.id);
        await this.loadAndRender();
      },
      onRestore: async (doc) => {
        await db.restoreFromTrash(doc.id);
        await this.loadAndRender();
      },
      onPermanentDelete: async (doc) => {
        if (confirm(`¿Eliminar definitivamente "${doc.title}"? Esta acción no se puede deshacer.`)) {
          await db.deleteDocumentPermanent(doc.id);
          await this.loadAndRender();
        }
      }
    });

    this.init();
  }

  async init() {
    this.renderStructure();
    this.bindEvents();
    await this.loadAndRender();
  }

  renderStructure() {
    this.container.innerHTML = `
      <div class="dashboard-layout">
        <!-- Panel Lateral Izquierdo -->
        <aside class="dashboard-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-header-top">
              <div class="app-brand">
                <span class="brand-logo">${Icons.notebook}</span>
                <span class="brand-title">opeNotas</span>
              </div>
              <button class="btn-icon-ghost mobile-sidebar-close" id="btnCloseMobileSidebar" title="Cerrar menú">
                ${Icons.close}
              </button>
            </div>
            
            <!-- Botón de Acción Rápida (+ Crear) -->
            <div class="create-btn-dropdown">
              <button class="btn-primary btn-create" id="btnCreateDropdown">
                ${Icons.plus}
                <span>Crear nuevo</span>
                ${Icons.chevronDown}
              </button>
              <div class="create-menu hidden" id="createMenu">
                <button class="create-menu-item" id="btnCreateNotebook">
                  <span class="menu-icon notebook-color">${Icons.notebook}</span>
                  <div class="menu-text">
                    <strong>Nuevo Cuaderno</strong>
                    <small>Páginas estándar A4 pautadas</small>
                  </div>
                </button>
                <button class="create-menu-item" id="btnCreateBoard">
                  <span class="menu-icon board-color">${Icons.whiteboard}</span>
                  <div class="menu-text">
                    <strong>Nueva Pizarra</strong>
                    <small>Lienzo amplio para bocetos e ideas</small>
                  </div>
                </button>
                <div class="menu-divider"></div>
                <button class="create-menu-item" id="btnCreateFolder">
                  <span class="menu-icon folder-color">${Icons.folder}</span>
                  <div class="menu-text">
                    <strong>Nueva Carpeta</strong>
                    <small>Organiza tus documentos</small>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Navegación Estructural -->
          <nav class="sidebar-nav">
            <div class="nav-section-title">Biblioteca</div>
            <button class="nav-item active" data-nav="all">
              <span class="nav-icon">${Icons.allDocs}</span>
              <span class="nav-label">Todos los archivos</span>
              <span class="nav-count" id="countAll">0</span>
            </button>
            <button class="nav-item" data-nav="recent">
              <span class="nav-icon">${Icons.recent}</span>
              <span class="nav-label">Recientes</span>
            </button>
            <button class="nav-item" data-nav="favorites">
              <span class="nav-icon">${Icons.star}</span>
              <span class="nav-label">Favoritos</span>
              <span class="nav-count" id="countFav">0</span>
            </button>

            <div class="nav-section-header">
              <span class="nav-section-title">Carpetas</span>
              <button class="btn-icon-ghost" id="btnAddFolderQuick" title="Nueva Carpeta">
                ${Icons.plus}
              </button>
            </div>
            <div class="folder-tree" id="folderTree">
              <!-- Árbol de carpetas generado dinámicamente -->
            </div>

            <div class="nav-divider"></div>
            <button class="nav-item trash-item" data-nav="trash">
              <span class="nav-icon">${Icons.trash}</span>
              <span class="nav-label">Papelera</span>
              <span class="nav-count" id="countTrash">0</span>
            </button>

            <div class="nav-divider"></div>
            <div class="nav-section-title">Copia de Seguridad</div>
            <button class="nav-item" id="btnExportBackup" title="Descargar copia de seguridad completa en JSON">
              <span class="nav-icon">${Icons.backupExport}</span>
              <span class="nav-label">Exportar Backup</span>
            </button>
            <button class="nav-item" id="btnImportBackup" title="Restaurar documentos desde un archivo JSON">
              <span class="nav-icon">${Icons.backupImport}</span>
              <span class="nav-label">Restaurar Backup</span>
            </button>
            <input type="file" id="backupFileInput" accept=".json" style="display:none;" />

            <div class="nav-divider"></div>
            <button class="nav-item" id="btnSidebarSettings" title="Configuración del Sistema">
              <span class="nav-icon">${Icons.settings}</span>
              <span class="nav-label">Configuración</span>
            </button>
          </nav>
        </aside>

        <!-- Área Principal de Contenido -->
        <main class="dashboard-main">
          <!-- Barra de Control Superior -->
          <header class="control-header">
            <button class="btn-icon-ghost mobile-menu-btn" id="btnToggleMobileSidebar" title="Abrir menú de navegación">
              ${Icons.menu}
            </button>
            <div class="search-box">
              <span class="search-icon">${Icons.search}</span>
              <input type="text" id="searchInput" placeholder="Buscar documentos por nombre o tema..." />
            </div>

            <div class="header-actions">
              <!-- Filtros tipo píldora -->
              <div class="filter-pills">
                <button class="pill active" data-filter="all">Todos</button>
                <button class="pill" data-filter="notebook">Cuadernos</button>
                <button class="pill" data-filter="whiteboard">Pizarras</button>
              </div>

              <div class="header-divider"></div>

              <!-- Selector de vista Cuadrícula / Lista -->
              <div class="view-switcher">
                <button class="view-btn active" id="btnViewGrid" title="Vista en Cuadrícula">
                  ${Icons.grid}
                </button>
                <button class="view-btn" id="btnViewList" title="Vista en Lista">
                  ${Icons.list}
                </button>
              </div>

              <div class="header-divider"></div>

              <!-- Botón de Configuración -->
              <button class="view-btn" id="btnHeaderSettings" title="Configuración del Sistema">
                ${Icons.settings}
              </button>
            </div>
          </header>

          <!-- Título y contador de la sección activa -->
          <div class="section-title-bar">
            <div>
              <h2 class="section-heading" id="sectionTitle">Todos los archivos</h2>
              <p class="section-subtext" id="sectionSubtext">Explora y gestiona tus notas y pizarras</p>
            </div>
            <div id="sectionActionContainer"></div>
          </div>

          <!-- Cuadrícula / Lista de documentos -->
          <div class="documents-container" id="documentsContainer">
            <!-- Tarjetas inyectadas dinámicamente -->
          </div>
        </main>
      </div>

      <!-- Backdrop para sidebar móvil -->
      <div class="sidebar-backdrop hidden" id="sidebarBackdrop"></div>

      <!-- Botón Flotante de Creación Rápida para Móviles -->
      <button class="mobile-fab-create" id="btnMobileFabCreate" title="Crear nuevo documento">
        ${Icons.plus}
        <span>Crear</span>
      </button>

      <!-- Diálogo modal genérico (Crear/Renombrar carpeta, etc.) -->
      <div class="modal-backdrop hidden" id="dashboardModal">
        <div class="modal-box">
          <h3 class="modal-title" id="modalTitle">Nueva Carpeta</h3>
          <div class="modal-body" id="modalBody">
            <input type="text" id="modalInput" class="modal-input" placeholder="Nombre..." />
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
            <button class="btn-primary" id="btnModalConfirm">Aceptar</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Menú Crear
    const btnCreate = this.container.querySelector('#btnCreateDropdown');
    const createMenu = this.container.querySelector('#createMenu');

    btnCreate.addEventListener('click', (e) => {
      e.stopPropagation();
      createMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      createMenu.classList.add('hidden');
    });

    this.container.querySelector('#btnCreateNotebook').addEventListener('click', () => {
      createMenu.classList.add('hidden');
      this.closeMobileSidebar();
      const activeFolderId = this.currentNav.startsWith('folder_') ? this.currentNav.replace('folder_', '') : null;
      this.promptCreateDocument('notebook', activeFolderId);
    });

    this.container.querySelector('#btnCreateBoard').addEventListener('click', () => {
      createMenu.classList.add('hidden');
      this.closeMobileSidebar();
      const activeFolderId = this.currentNav.startsWith('folder_') ? this.currentNav.replace('folder_', '') : null;
      this.promptCreateDocument('whiteboard', activeFolderId);
    });

    this.container.querySelector('#btnCreateFolder').addEventListener('click', () => {
      createMenu.classList.add('hidden');
      this.closeMobileSidebar();
      this.promptCreateFolder();
    });

    this.container.querySelector('#btnAddFolderQuick').addEventListener('click', () => {
      this.closeMobileSidebar();
      this.promptCreateFolder();
    });

    // Sidebar móvil (Abrir / Cerrar / Backdrop)
    const btnToggleSidebar = this.container.querySelector('#btnToggleMobileSidebar');
    const btnCloseSidebar = this.container.querySelector('#btnCloseMobileSidebar');
    const sidebarBackdrop = this.container.querySelector('#sidebarBackdrop');

    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        this.openMobileSidebar();
      });
    }

    if (btnCloseSidebar) {
      btnCloseSidebar.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Botón Flotante Móvil (+ Crear)
    const btnMobileFab = this.container.querySelector('#btnMobileFabCreate');
    if (btnMobileFab) {
      btnMobileFab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMobileSidebar();
        createMenu.classList.remove('hidden');
      });
    }

    // Navegación lateral
    this.container.querySelectorAll('.nav-item[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectNav(btn.dataset.nav);
      });
    });

    // Configuración del Sistema
    const btnSidebarSettings = this.container.querySelector('#btnSidebarSettings');
    if (btnSidebarSettings) {
      btnSidebarSettings.addEventListener('click', () => {
        this.closeMobileSidebar();
        this.onOpenSettings();
      });
    }

    const btnHeaderSettings = this.container.querySelector('#btnHeaderSettings');
    if (btnHeaderSettings) {
      btnHeaderSettings.addEventListener('click', () => {
        this.onOpenSettings();
      });
    }

    // Filtros de píldora
    this.container.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderDocuments();
      });
    });

    // Selector de vista
    const btnGrid = this.container.querySelector('#btnViewGrid');
    const btnList = this.container.querySelector('#btnViewList');

    btnGrid.addEventListener('click', () => {
      this.currentViewMode = 'grid';
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
      this.renderDocuments();
    });

    btnList.addEventListener('click', () => {
      this.currentViewMode = 'list';
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
      this.renderDocuments();
    });

    // Buscador
    const searchInput = this.container.querySelector('#searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderDocuments();
    });

    // Accion Copia de Seguridad: Descarga JSON
    const btnExportBackup = this.container.querySelector('#btnExportBackup');
    if (btnExportBackup) {
      btnExportBackup.addEventListener('click', async () => {
        try {
          await db.exportFullBackup();
        } catch (err) {
          alert('Error al exportar copia de seguridad: ' + err.message);
        }
      });
    }

    // Backup import
    const btnImportBackup = this.container.querySelector('#btnImportBackup');
    const backupFileInput = this.container.querySelector('#backupFileInput');
    if (btnImportBackup && backupFileInput) {
      btnImportBackup.addEventListener('click', () => {
        backupFileInput.click();
      });

      backupFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('¿Deseas restaurar esta copia de seguridad? Se integrará con tus documentos actuales.')) {
          backupFileInput.value = '';
          return;
        }

        try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const json = JSON.parse(ev.target.result);
              const count = await db.restoreFullBackup(json);
              await this.loadAndRender();
              alert(`Copia de seguridad restaurada con éxito: ${count} documentos importados.`);
            } catch (parseErr) {
              alert('El archivo seleccionado no es un JSON de copia de seguridad válido.');
            }
          };
          reader.readAsText(file);
        } catch (err) {
          alert('Error al leer el archivo: ' + err.message);
        } finally {
          backupFileInput.value = '';
        }
      });
    }
  }

  selectNav(navKey) {
    this.currentNav = navKey;
    this.container.querySelectorAll('.nav-item').forEach(b => {
      if (b.dataset.nav === navKey) b.classList.add('active');
      else b.classList.remove('active');
    });
    this.updateSectionHeader();
    this.renderDocuments();
    this.closeMobileSidebar();
  }

  openMobileSidebar() {
    const sidebar = this.container.querySelector('.dashboard-sidebar');
    const backdrop = this.container.querySelector('#sidebarBackdrop');
    if (sidebar) sidebar.classList.add('sidebar-open');
    if (backdrop) backdrop.classList.remove('hidden');
  }

  closeMobileSidebar() {
    const sidebar = this.container.querySelector('.dashboard-sidebar');
    const backdrop = this.container.querySelector('#sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.add('hidden');
  }

  async loadAndRender() {
    this.documents = await db.getAllDocuments();
    this.folders = await db.getAllFolders();

    this.updateCounts();
    this.renderFolderTree();
    this.updateSectionHeader();
    this.renderDocuments();
  }

  updateCounts() {
    const nonTrash = this.documents.filter(d => !d.isTrash);
    const trash = this.documents.filter(d => d.isTrash);
    const favs = nonTrash.filter(d => d.isFavorite);

    this.container.querySelector('#countAll').textContent = nonTrash.length;
    this.container.querySelector('#countFav').textContent = favs.length;
    this.container.querySelector('#countTrash').textContent = trash.length;
  }

  getFolderBreadcrumbs(folder) {
    if (!folder) return [];
    const crumbs = [folder];
    let curr = folder;
    const visited = new Set([curr.id]);
    while (curr.parentId) {
      const parent = this.folders.find(f => f.id === curr.parentId);
      if (parent && !visited.has(parent.id)) {
        visited.add(parent.id);
        crumbs.unshift(parent);
        curr = parent;
      } else {
        break;
      }
    }
    return crumbs;
  }

  getFolderHierarchyList() {
    const result = [];
    const buildTree = (parentId, depth) => {
      const children = this.folders.filter(f => (f.parentId || null) === parentId);
      for (const child of children) {
        result.push({ folder: child, depth });
        buildTree(child.id, depth + 1);
      }
    };
    buildTree(null, 0);
    for (const f of this.folders) {
      if (!result.some(r => r.folder.id === f.id)) {
        result.push({ folder: f, depth: 0 });
      }
    }
    return result;
  }

  renderFolderTree() {
    const treeEl = this.container.querySelector('#folderTree');
    if (this.folders.length === 0) {
      treeEl.innerHTML = `<div class="folder-empty">Sin carpetas creadas</div>`;
      return;
    }

    const renderNode = (folder, depth) => {
      const children = this.folders.filter(f => f.parentId === folder.id);
      const hasChildren = children.length > 0;
      const isSelected = this.currentNav === `folder_${folder.id}`;
      const isExpanded = this.expandedFolderIds.has(folder.id) || isSelected;
      const docCount = this.documents.filter(d => !d.isTrash && d.folderId === folder.id).length;
      const folderColor = folder.color || '#3b82f6';
      const indentPx = 6 + depth * 14;

      let html = `
        <div class="folder-tree-node depth-${depth}" style="padding-left: ${indentPx}px;">
          <div class="folder-item ${isSelected ? 'active' : ''}" data-nav="folder_${folder.id}" data-folder-id="${folder.id}">
            ${hasChildren ? `
              <button type="button" class="folder-expand-btn ${isExpanded ? 'expanded' : ''}" data-toggle-folder="${folder.id}" title="${isExpanded ? 'Contraer' : 'Expandir'}">
                ${isExpanded ? Icons.chevronDown : Icons.chevronRight}
              </button>
            ` : `<span class="folder-expand-spacer"></span>`}
            <span class="folder-color-dot" style="background-color: ${folderColor};"></span>
            <span class="folder-icon" style="color: ${folderColor};">${Icons.folder}</span>
            <span class="folder-name" title="${this.escapeHtml(folder.name)}">${this.escapeHtml(folder.name)}</span>
            <span class="folder-badge">${docCount}</span>
            <button type="button" class="btn-icon-mini btn-add-subfolder" data-parent-id="${folder.id}" title="Añadir subcarpeta">
              ${Icons.plus}
            </button>
          </div>
        </div>
      `;

      if (hasChildren && isExpanded) {
        html += `<div class="folder-children">`;
        for (const child of children) {
          html += renderNode(child, depth + 1);
        }
        html += `</div>`;
      }

      return html;
    };

    const rootFolders = this.folders.filter(f => !f.parentId);
    let fullHtml = '';
    for (const root of rootFolders) {
      fullHtml += renderNode(root, 0);
    }
    for (const f of this.folders) {
      if (f.parentId && !this.folders.some(p => p.id === f.parentId)) {
        fullHtml += renderNode(f, 0);
      }
    }

    treeEl.innerHTML = fullHtml;

    // Expandir / contraer subcarpetas
    treeEl.querySelectorAll('.folder-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = btn.dataset.toggleFolder;
        if (this.expandedFolderIds.has(fId)) {
          this.expandedFolderIds.delete(fId);
        } else {
          this.expandedFolderIds.add(fId);
        }
        this.renderFolderTree();
      });
    });

    // Botón rápido + para crear subcarpeta
    treeEl.querySelectorAll('.btn-add-subfolder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptCreateFolder(btn.dataset.parentId);
      });
    });

    // Clic para seleccionar carpeta
    treeEl.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.folder-expand-btn') || e.target.closest('.btn-add-subfolder')) return;
        this.selectNav(item.dataset.nav);
      });

      // Drag and drop: soltar documento en carpeta o subcarpeta
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const docId = e.dataTransfer.getData('text/plain');
        if (docId) {
          const doc = await db.getDocument(docId);
          if (doc) {
            doc.folderId = item.dataset.folderId;
            await db.saveDocument(doc);
            await this.loadAndRender();
          }
        }
      });
    });
  }

  updateSectionHeader() {
    const heading = this.container.querySelector('#sectionTitle');
    const subtext = this.container.querySelector('#sectionSubtext');
    const actionContainer = this.container.querySelector('#sectionActionContainer');
    actionContainer.innerHTML = '';

    if (this.currentNav === 'all') {
      heading.textContent = 'Todos los archivos';
      subtext.textContent = 'Todos los cuadernos y pizarras disponibles';
    } else if (this.currentNav === 'recent') {
      heading.textContent = 'Recientes';
      subtext.textContent = 'Documentos abiertos o modificados recientemente';
    } else if (this.currentNav === 'favorites') {
      heading.textContent = 'Favoritos';
      subtext.textContent = 'Tus documentos destacados con estrella';
    } else if (this.currentNav === 'trash') {
      heading.textContent = 'Papelera';
      subtext.textContent = 'Documentos eliminados. Puedes restaurarlos o borrarlos para siempre.';
      actionContainer.innerHTML = `
        <button class="btn-secondary danger-text" id="btnEmptyTrash">
          ${Icons.trash} Vaciar Papelera
        </button>
      `;
      actionContainer.querySelector('#btnEmptyTrash')?.addEventListener('click', async () => {
        if (confirm('¿Vaciar toda la papelera definitivamente?')) {
          const trashDocs = this.documents.filter(d => d.isTrash);
          for (const d of trashDocs) {
            await db.deleteDocumentPermanent(d.id);
          }
          await this.loadAndRender();
        }
      });
    } else if (this.currentNav.startsWith('folder_')) {
      const fId = this.currentNav.replace('folder_', '');
      const folder = this.folders.find(f => f.id === fId);
      if (folder) {
        const breadcrumbs = this.getFolderBreadcrumbs(folder);
        const breadcrumbHtml = `
          <div class="folder-breadcrumb-trail">
            <button type="button" class="breadcrumb-btn" data-nav="all">Biblioteca</button>
            ${breadcrumbs.map((b, i) => `
              <span class="breadcrumb-sep">${Icons.chevronRight}</span>
              <button type="button" class="breadcrumb-btn ${i === breadcrumbs.length - 1 ? 'current' : ''}" data-nav="folder_${b.id}">
                <span class="folder-color-dot" style="background-color: ${b.color || '#3b82f6'}; width: 8px; height: 8px;"></span>
                <span>${this.escapeHtml(b.name)}</span>
              </button>
            `).join('')}
          </div>
        `;

        heading.innerHTML = `
          <div class="folder-header-title-group">
            <span class="folder-color-dot header-dot" style="background-color: ${folder.color || '#3b82f6'};"></span>
            <span>${this.escapeHtml(folder.name)}</span>
          </div>
        `;
        subtext.innerHTML = breadcrumbHtml;

        subtext.querySelectorAll('.breadcrumb-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.selectNav(btn.dataset.nav);
          });
        });

        actionContainer.innerHTML = `
          <button class="btn-secondary" id="btnAddSubfolderHere">
            ${Icons.plus} Nueva Subcarpeta
          </button>
          <button class="btn-icon-ghost danger-text" id="btnDeleteFolder" title="Eliminar carpeta">
            ${Icons.trash}
          </button>
        `;

        actionContainer.querySelector('#btnAddSubfolderHere')?.addEventListener('click', () => {
          this.promptCreateFolder(folder.id);
        });

        actionContainer.querySelector('#btnDeleteFolder')?.addEventListener('click', async () => {
          if (confirm(`¿Eliminar la carpeta "${folder?.name}" y sus subcarpetas? Los documentos se moverán a la raíz.`)) {
            await db.deleteFolder(fId);
            this.currentNav = folder.parentId ? `folder_${folder.parentId}` : 'all';
            await this.loadAndRender();
          }
        });
      } else {
        heading.textContent = 'Carpeta';
        subtext.textContent = 'Documentos contenidos';
      }
    }
  }

  getFilteredDocuments() {
    let list = [...this.documents];

    // Filtro por sección lateral
    if (this.currentNav === 'trash') {
      list = list.filter(d => d.isTrash);
    } else {
      list = list.filter(d => !d.isTrash);

      if (this.currentNav === 'recent') {
        list.sort((a, b) => b.updatedAt - a.updatedAt);
      } else if (this.currentNav === 'favorites') {
        list = list.filter(d => d.isFavorite);
      } else if (this.currentNav.startsWith('folder_')) {
        const folderId = this.currentNav.replace('folder_', '');
        list = list.filter(d => d.folderId === folderId);
      }
    }

    // Filtro por tipo de documento (Píldoras)
    if (this.currentFilter !== 'all') {
      list = list.filter(d => d.type === this.currentFilter);
    }

    // Filtro por buscador de texto
    if (this.searchQuery) {
      list = list.filter(d => d.title.toLowerCase().includes(this.searchQuery));
    }

    return list;
  }

  renderDocuments() {
    const container = this.container.querySelector('#documentsContainer');
    const docs = this.getFilteredDocuments();

    // Subcarpetas si estamos dentro de una carpeta
    let subfoldersHtml = '';
    if (this.currentNav.startsWith('folder_')) {
      const currentFolderId = this.currentNav.replace('folder_', '');
      const subfolders = this.folders.filter(f => f.parentId === currentFolderId);

      if (subfolders.length > 0) {
        subfoldersHtml = `
          <div class="subfolders-section">
            <div class="subfolders-section-title">
              <span class="subfolder-section-icon">${Icons.folder}</span>
              <span>Subcarpetas (${subfolders.length})</span>
            </div>
            <div class="subfolders-grid">
              ${subfolders.map(sub => {
                const subDocCount = this.documents.filter(d => !d.isTrash && d.folderId === sub.id).length;
                return `
                  <div class="subfolder-card" data-nav="folder_${sub.id}" data-folder-id="${sub.id}">
                    <span class="subfolder-color-bar" style="background-color: ${sub.color || '#3b82f6'};"></span>
                    <div class="subfolder-card-main">
                      <span class="subfolder-card-icon" style="color: ${sub.color || '#3b82f6'};">${Icons.folder}</span>
                      <div class="subfolder-card-info">
                        <h5 class="subfolder-card-title">${this.escapeHtml(sub.name)}</h5>
                        <span class="subfolder-card-count">${subDocCount} doc${subDocCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
              <button type="button" class="subfolder-card-add" id="btnAddSubfolderChip">
                ${Icons.plus}
                <span>Nueva subcarpeta</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    container.className = `documents-container view-${this.currentViewMode}`;

    if (docs.length === 0 && !subfoldersHtml) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${Icons.notebook}</div>
          <h3>No se encontraron documentos</h3>
          <p>Crea un nuevo cuaderno o pizarra para empezar a plasmar tus ideas.</p>
        </div>
      `;
      return;
    }

    let docsHtml = '';
    if (this.currentViewMode === 'grid') {
      docsHtml = `<div class="docs-grid-wrapper">${docs.map(doc => this.renderCardHtml(doc)).join('')}</div>`;
    } else {
      docsHtml = `
        <div class="docs-list-table">
          <div class="list-header-row">
            <div class="col-name">Nombre</div>
            <div class="col-type">Tipo</div>
            <div class="col-date">Modificado</div>
            <div class="col-actions"></div>
          </div>
          ${docs.map(doc => this.renderListRowHtml(doc)).join('')}
        </div>
      `;
    }

    container.innerHTML = subfoldersHtml + docsHtml;

    // Vincular clic a las tarjetas de subcarpetas
    container.querySelectorAll('.subfolder-card[data-nav]').forEach(card => {
      card.addEventListener('click', () => {
        this.selectNav(card.dataset.nav);
      });

      // Drag and drop a subcarpetas
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const docId = e.dataTransfer.getData('text/plain');
        if (docId) {
          const doc = await db.getDocument(docId);
          if (doc) {
            doc.folderId = card.dataset.folderId;
            await db.saveDocument(doc);
            await this.loadAndRender();
          }
        }
      });
    });

    const btnAddSubfolderChip = container.querySelector('#btnAddSubfolderChip');
    if (btnAddSubfolderChip && this.currentNav.startsWith('folder_')) {
      btnAddSubfolderChip.addEventListener('click', () => {
        const currentFolderId = this.currentNav.replace('folder_', '');
        this.promptCreateFolder(currentFolderId);
      });
    }

    // Vincular eventos a las tarjetas/filas
    docs.forEach(doc => {
      const cardEl = container.querySelector(`[data-doc-id="${doc.id}"]`);
      if (!cardEl) return;

      // Abrir documento al hacer clic
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.card-menu-btn') || e.target.closest('.btn-fav-star')) return;
        this.onOpenDoc(doc);
      });

      // Menú de 3 puntos
      const menuBtn = cardEl.querySelector('.card-menu-btn');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.contextMenu.show(doc, menuBtn);
        });
      }

      // Estrella de favorito
      const favBtn = cardEl.querySelector('.btn-fav-star');
      if (favBtn) {
        favBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          doc.isFavorite = !doc.isFavorite;
          await db.saveDocument(doc);
          await this.loadAndRender();
        });
      }

      // Drag and drop para arrastrar tarjeta a carpetas
      cardEl.setAttribute('draggable', 'true');
      cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', doc.id);
      });
    });
  }

  renderCardHtml(doc) {
    const isNotebook = doc.type === 'notebook';
    const typeLabel = isNotebook ? 'Cuaderno' : 'Pizarra';
    const typeBadgeClass = isNotebook ? 'badge-notebook' : 'badge-board';
    const cardDesignClass = isNotebook ? 'card-notebook' : 'card-whiteboard';
    const formattedDate = new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let previewContent = '';
    if (isNotebook && doc.cover) {
      const thumb = doc.thumbnail || CoverDesigner.generateCoverThumbnail(doc.cover);
      previewContent = `<img src="${thumb}" class="card-thumb-img cover-thumb-img" alt="Portada de ${this.escapeHtml(doc.title)}" />`;
    } else if (doc.thumbnail) {
      previewContent = `<img src="${doc.thumbnail}" class="card-thumb-img" alt="Previsualización" />`;
    } else {
      previewContent = `<div class="card-empty-thumb">
           <span class="preview-symbol">${isNotebook ? Icons.notebook : Icons.whiteboard}</span>
         </div>`;
    }

    return `
      <div class="doc-card ${cardDesignClass}" data-doc-id="${doc.id}">
        <!-- Detalle de Lomo de Cuaderno o Marco Abierto -->
        <div class="card-spine-indicator"></div>

        <div class="card-preview-box">
          ${previewContent}
          <span class="card-type-badge ${typeBadgeClass}">
            ${isNotebook ? Icons.notebook : Icons.whiteboard}
            ${typeLabel}
          </span>
          <button class="btn-fav-star ${doc.isFavorite ? 'active' : ''}" title="Marcar favorito">
            ${doc.isFavorite ? Icons.starFilled : Icons.star}
          </button>
        </div>

        <div class="card-footer">
          <div class="card-info">
            <h4 class="card-title" title="${this.escapeHtml(doc.title)}">${this.escapeHtml(doc.title)}</h4>
            <span class="card-date">${formattedDate}</span>
          </div>
          <button class="card-menu-btn" title="Opciones de documento">
            ${Icons.moreVertical}
          </button>
        </div>
      </div>
    `;
  }

  renderListRowHtml(doc) {
    const isNotebook = doc.type === 'notebook';
    const formattedDate = new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="doc-list-row" data-doc-id="${doc.id}">
        <div class="col-name">
          <span class="row-icon ${isNotebook ? 'notebook-color' : 'board-color'}">
            ${isNotebook ? Icons.notebook : Icons.whiteboard}
          </span>
          <span class="row-title">${this.escapeHtml(doc.title)}</span>
          ${doc.isFavorite ? `<span class="row-fav">${Icons.starFilled}</span>` : ''}
        </div>
        <div class="col-type">
          <span class="card-type-badge ${isNotebook ? 'badge-notebook' : 'badge-board'}">
            ${isNotebook ? 'Cuaderno' : 'Pizarra'}
          </span>
        </div>
        <div class="col-date">${formattedDate}</div>
        <div class="col-actions">
          <button class="card-menu-btn" title="Opciones">
            ${Icons.moreVertical}
          </button>
        </div>
      </div>
    `;
  }

  // Modales interactivos de creación y gestión
  promptCreateDocument(type, folderId) {
    if (type === 'notebook') {
      this.openNotebookCreationModal(folderId);
    } else {
      this.openWhiteboardCreationModal(folderId);
    }
  }

  openNotebookCreationModal(folderId) {
    const existingCount = this.documents.filter(d => d.type === 'notebook' && !d.isTrash).length;
    const defaultTitle = `Cuaderno ${existingCount + 1}`;
    const defaultSubtitle = 'Notas y Reflexiones';

    let selectedTemplate = 'moleskine';
    let selectedColor = '#0f172a';
    let selectedPattern = 'grid'; // Cuadrícula por defecto
    let selectedPaperColor = '#ffffff';
    let activePreviewTab = 'cover'; // 'cover' | 'paper'

    const modalEl = this.container.querySelector('#dashboardModal');
    const modalBox = modalEl.querySelector('.modal-box');
    modalBox.classList.add('modal-box-large');

    const titleEl = this.container.querySelector('#modalTitle');
    const bodyEl = this.container.querySelector('#modalBody');
    const actionsEl = modalEl.querySelector('.modal-actions');

    titleEl.textContent = 'Crear Nuevo Cuaderno';

    const colors = [
      { hex: '#0f172a', name: 'Azul Noche' },
      { hex: '#1e40af', name: 'Azul Real' },
      { hex: '#065f46', name: 'Verde Bosque' },
      { hex: '#881337', name: 'Borgoña' },
      { hex: '#78350f', name: 'Cuero / Ámbar' },
      { hex: '#334155', name: 'Gris Pizarra' },
      { hex: '#581c87', name: 'Púrpura Noble' },
      { hex: '#9a3412', name: 'Terracota' }
    ];

    const patterns = [
      { id: 'grid', name: 'Cuadrícula 5mm', desc: 'Pauta cuadriculada para dibujo y notas' },
      { id: 'ruled', name: 'Rayado Horizontal', desc: 'Pauta escolar para escritura guiada' },
      { id: 'dots', name: 'Puntos (Bullet)', desc: 'Trama de puntos para diagramas y bocetos' },
      { id: 'blank', name: 'Blanco Liso', desc: 'Lienzo libre sin marcas' }
    ];

    const paperTones = [
      { hex: '#ffffff', name: 'Blanco Puro' },
      { hex: '#fdfbf7', name: 'Marfil / Crema' },
      { hex: '#f6f0e2', name: 'Sepia Suave' },
      { hex: '#1e293b', name: 'Pizarra Oscura' }
    ];

    bodyEl.innerHTML = `
      <div class="nb-creation-container">
        <div class="nb-creation-form">
          <!-- Datos básicos -->
          <div class="form-group-row">
            <div class="form-group" style="flex: 2;">
              <label class="form-label">Título del Cuaderno</label>
              <input type="text" id="nbInputTitle" class="modal-input" value="${this.escapeHtml(defaultTitle)}" />
            </div>
            <div class="form-group" style="flex: 2;">
              <label class="form-label">Subtítulo / Tema</label>
              <input type="text" id="nbInputSubtitle" class="modal-input" value="${this.escapeHtml(defaultSubtitle)}" />
            </div>
          </div>

          <!-- Estilo de Portada -->
          <div class="form-section-header">1. Estilo y Portada</div>
          <div class="template-selector-cards">
            <button type="button" class="tmpl-card active" data-tmpl="moleskine">
              <span class="tmpl-icon">📓</span>
              <span class="tmpl-name">Moleskine</span>
            </button>
            <button type="button" class="tmpl-card" data-tmpl="leather">
              <span class="tmpl-icon">📔</span>
              <span class="tmpl-name">Cuero</span>
            </button>
            <button type="button" class="tmpl-card" data-tmpl="minimal">
              <span class="tmpl-icon">📄</span>
              <span class="tmpl-name">Minimal</span>
            </button>
            <button type="button" class="tmpl-card" data-tmpl="pastel">
              <span class="tmpl-icon">🎨</span>
              <span class="tmpl-name">Pastel</span>
            </button>
          </div>

          <!-- Color de Portada -->
          <div class="color-palette-label">Color de Portada:</div>
          <div class="nb-color-palette">
            ${colors.map((c, i) => `
              <button type="button" class="nb-color-btn ${i === 0 ? 'active' : ''}" data-color="${c.hex}" style="background-color: ${c.hex};" title="${c.name}"></button>
            `).join('')}
            <label class="nb-custom-color-label" title="Color personalizado">
              <input type="color" id="nbCustomColor" value="${selectedColor}" />
              <span>+</span>
            </label>
          </div>

          <!-- Tipo de Cuadrícula / Pauta -->
          <div class="form-section-header" style="margin-top: 14px;">2. Tipo de Cuadrícula y Hoja Interior</div>
          <div class="pattern-selector-grid">
            ${patterns.map((p) => `
              <button type="button" class="pattern-option-card ${p.id === selectedPattern ? 'active' : ''}" data-pattern="${p.id}">
                <strong>${p.name}</strong>
                <small>${p.desc}</small>
              </button>
            `).join('')}
          </div>

          <!-- Tono de Papel -->
          <div class="color-palette-label" style="margin-top: 10px;">Tono del Papel Interior:</div>
          <div class="paper-tones-palette">
            ${paperTones.map((pt, i) => `
              <button type="button" class="paper-tone-btn ${i === 0 ? 'active' : ''}" data-tone="${pt.hex}" style="background-color: ${pt.hex}; border: 1px solid ${pt.hex === '#ffffff' ? '#cbd5e1' : pt.hex};" title="${pt.name}">
                <span class="paper-tone-name" style="color: ${pt.hex === '#1e293b' ? '#ffffff' : '#0f172a'};">${pt.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Columna de Previsualización en Vivo -->
        <div class="nb-creation-preview-col">
          <div class="preview-tabs-switcher">
            <button type="button" class="prev-tab-btn active" id="btnTabCover">Portada</button>
            <button type="button" class="prev-tab-btn" id="btnTabPaper">Hoja / Cuadrícula</button>
          </div>

          <div class="preview-canvas-container">
            <canvas id="nbPreviewCanvas" width="280" height="390" class="live-preview-canvas"></canvas>
          </div>
          <span class="preview-caption" id="previewCaption">Vista previa de la Portada</span>
        </div>
      </div>
    `;

    actionsEl.innerHTML = `
      <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
      <button class="btn-secondary" id="btnModalCreateOnly">Solo Crear</button>
      <button class="btn-primary" id="btnModalCreateOpen">Crear y Abrir</button>
    `;

    modalEl.classList.remove('hidden');

    const titleInput = bodyEl.querySelector('#nbInputTitle');
    const subtitleInput = bodyEl.querySelector('#nbInputSubtitle');
    const previewCanvas = bodyEl.querySelector('#nbPreviewCanvas');
    const previewCtx = previewCanvas.getContext('2d');
    const previewCaption = bodyEl.querySelector('#previewCaption');

    const updatePreview = () => {
      const curTitle = titleInput.value.trim() || defaultTitle;
      const curSubtitle = subtitleInput.value.trim() || defaultSubtitle;

      if (activePreviewTab === 'cover') {
        CoverDesigner.renderCover(previewCtx, 280, 390, {
          template: selectedTemplate,
          title: curTitle,
          subtitle: curSubtitle,
          date: new Date().getFullYear().toString(),
          color: selectedColor
        });
        previewCaption.textContent = `Portada: ${selectedTemplate.toUpperCase()} (${selectedColor})`;
      } else {
        CoverDesigner.renderPaperPreview(previewCtx, 280, 390, selectedPattern, selectedPaperColor);
        const pName = patterns.find(p => p.id === selectedPattern)?.name || 'Rayado';
        previewCaption.textContent = `Página Interior: ${pName}`;
      }
    };

    // Actualizar vista inicial
    updatePreview();

    // Eventos de inputs
    titleInput.addEventListener('input', updatePreview);
    subtitleInput.addEventListener('input', updatePreview);

    // Eventos de plantilla
    bodyEl.querySelectorAll('.tmpl-card').forEach(btn => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.tmpl-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTemplate = btn.dataset.tmpl;
        activePreviewTab = 'cover';
        bodyEl.querySelector('#btnTabCover').classList.add('active');
        bodyEl.querySelector('#btnTabPaper').classList.remove('active');
        updatePreview();
      });
    });

    // Eventos de colores de portada
    bodyEl.querySelectorAll('.nb-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.nb-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
        activePreviewTab = 'cover';
        bodyEl.querySelector('#btnTabCover').classList.add('active');
        bodyEl.querySelector('#btnTabPaper').classList.remove('active');
        updatePreview();
      });
    });

    const customColorInput = bodyEl.querySelector('#nbCustomColor');
    if (customColorInput) {
      customColorInput.addEventListener('input', (e) => {
        selectedColor = e.target.value;
        bodyEl.querySelectorAll('.nb-color-btn').forEach(b => b.classList.remove('active'));
        activePreviewTab = 'cover';
        bodyEl.querySelector('#btnTabCover').classList.add('active');
        bodyEl.querySelector('#btnTabPaper').classList.remove('active');
        updatePreview();
      });
    }

    // Eventos de patrón de cuadrícula
    bodyEl.querySelectorAll('.pattern-option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.pattern-option-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPattern = btn.dataset.pattern;
        activePreviewTab = 'paper';
        bodyEl.querySelector('#btnTabPaper').classList.add('active');
        bodyEl.querySelector('#btnTabCover').classList.remove('active');
        updatePreview();
      });
    });

    // Eventos de tono de papel
    bodyEl.querySelectorAll('.paper-tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.paper-tone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPaperColor = btn.dataset.tone;
        activePreviewTab = 'paper';
        bodyEl.querySelector('#btnTabPaper').classList.add('active');
        bodyEl.querySelector('#btnTabCover').classList.remove('active');
        updatePreview();
      });
    });

    // Pestañas de previsualización
    const tabCoverBtn = bodyEl.querySelector('#btnTabCover');
    const tabPaperBtn = bodyEl.querySelector('#btnTabPaper');

    tabCoverBtn.addEventListener('click', () => {
      activePreviewTab = 'cover';
      tabCoverBtn.classList.add('active');
      tabPaperBtn.classList.remove('active');
      updatePreview();
    });

    tabPaperBtn.addEventListener('click', () => {
      activePreviewTab = 'paper';
      tabPaperBtn.classList.add('active');
      tabCoverBtn.classList.remove('active');
      updatePreview();
    });

    const cleanup = () => {
      modalEl.classList.add('hidden');
      modalBox.classList.remove('modal-box-large');
      actionsEl.innerHTML = `
        <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
        <button class="btn-primary" id="btnModalConfirm">Aceptar</button>
      `;
    };

    const handleCreate = async (openImmediately) => {
      const title = titleInput.value.trim() || defaultTitle;
      const subtitle = subtitleInput.value.trim() || defaultSubtitle;
      const coverConfig = {
        template: selectedTemplate,
        title: title,
        subtitle: subtitle,
        date: new Date().getFullYear().toString(),
        color: selectedColor
      };
      const initialPageConfig = {
        backgroundPattern: selectedPattern,
        paperColor: selectedPaperColor
      };

      cleanup();

      if (openImmediately) {
        await this.onCreateNotebook(folderId, title, coverConfig, initialPageConfig, true);
      } else {
        await this.onCreateNotebook(folderId, title, coverConfig, initialPageConfig, false);
        await this.loadAndRender();
      }
    };

    actionsEl.querySelector('#btnModalCreateOpen').addEventListener('click', () => handleCreate(true));
    actionsEl.querySelector('#btnModalCreateOnly').addEventListener('click', () => handleCreate(false));
    actionsEl.querySelector('#btnModalCancel').addEventListener('click', cleanup);
  }

  openWhiteboardCreationModal(folderId) {
    const existingCount = this.documents.filter(d => d.type === 'whiteboard' && !d.isTrash).length;
    const defaultTitle = `Pizarra ${existingCount + 1}`;

    this.openDocumentModal('Crear Nueva Pizarra', defaultTitle, false, async (title, openImmediately) => {
      const docTitle = title || defaultTitle;
      if (openImmediately) {
        await this.onCreateBoard(folderId, docTitle);
      } else {
        await this.onCreateDocOnly('whiteboard', folderId, docTitle);
        await this.loadAndRender();
      }
    });
  }

  promptCreateFolder(defaultParentId = null) {
    const existingFolders = this.folders.length;
    const defaultName = `Carpeta ${existingFolders + 1}`;
    const colors = [
      { hex: '#3b82f6', name: 'Azul' },
      { hex: '#10b981', name: 'Verde' },
      { hex: '#f59e0b', name: 'Ámbar' },
      { hex: '#ef4444', name: 'Rojo' },
      { hex: '#8b5cf6', name: 'Púrpura' },
      { hex: '#ec4899', name: 'Rosa' },
      { hex: '#64748b', name: 'Gris' },
      { hex: '#06b6d4', name: 'Cian' }
    ];
    let selectedColor = colors[0].hex;

    // Si no se pasó defaultParentId pero estamos dentro de una carpeta, pre-seleccionarla
    if (!defaultParentId && this.currentNav.startsWith('folder_')) {
      defaultParentId = this.currentNav.replace('folder_', '');
    }

    const modalEl = this.container.querySelector('#dashboardModal');
    const titleEl = this.container.querySelector('#modalTitle');
    const bodyEl = this.container.querySelector('#modalBody');
    const actionsEl = modalEl.querySelector('.modal-actions');

    const hierarchy = this.getFolderHierarchyList();

    titleEl.textContent = defaultParentId ? 'Crear Nueva Subcarpeta' : 'Crear Nueva Carpeta';
    bodyEl.innerHTML = `
      <div style="margin-bottom: 6px; font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">Nombre:</div>
      <input type="text" id="modalInput" class="modal-input" value="${defaultName}" />

      <div style="margin-top: 14px; margin-bottom: 6px; font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">Carpeta contenedora:</div>
      <select id="modalParentSelect" class="modal-input form-select">
        <option value="" ${!defaultParentId ? 'selected' : ''}>[Ninguna - Carpeta Principal / Raíz]</option>
        ${hierarchy.map(item => {
          const indent = '　'.repeat(item.depth) + (item.depth > 0 ? '↳ ' : '');
          return `<option value="${item.folder.id}" ${defaultParentId === item.folder.id ? 'selected' : ''}>${indent}${this.escapeHtml(item.folder.name)}</option>`;
        }).join('')}
      </select>

      <div style="margin-top: 14px; margin-bottom: 6px; font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">Etiqueta de color:</div>
      <div class="folder-color-selector">
        ${colors.map((c, idx) => `
          <button type="button" class="folder-color-btn ${idx === 0 ? 'active' : ''}" data-color="${c.hex}" style="background-color: ${c.hex};" title="${c.name}"></button>
        `).join('')}
      </div>
    `;

    actionsEl.innerHTML = `
      <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
      <button class="btn-primary" id="btnModalConfirm">Crear</button>
    `;

    modalEl.classList.remove('hidden');
    const input = bodyEl.querySelector('#modalInput');
    const selectParent = bodyEl.querySelector('#modalParentSelect');
    input.focus();
    input.select();

    const colorBtns = bodyEl.querySelectorAll('.folder-color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
      });
    });

    const btnConfirm = actionsEl.querySelector('#btnModalConfirm');
    const btnCancel = actionsEl.querySelector('#btnModalCancel');

    const close = () => {
      modalEl.classList.add('hidden');
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', close);
    };

    const onConfirm = async () => {
      const folderName = input.value.trim() || defaultName;
      const parentId = selectParent.value || null;
      const newFolder = {
        id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: folderName,
        color: selectedColor,
        parentId: parentId,
        createdAt: Date.now()
      };
      await db.saveFolder(newFolder);
      if (parentId) {
        this.expandedFolderIds.add(parentId);
      }
      close();
      await this.loadAndRender();
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onConfirm();
      if (e.key === 'Escape') close();
    });
  }

  promptRenameDoc(doc) {
    this.openModal('Renombrar Documento', doc.title, async (newTitle) => {
      if (!newTitle) return;
      doc.title = newTitle;
      await db.saveDocument(doc);
      await this.loadAndRender();
    });
  }

  promptMoveDoc(doc) {
    const modalEl = this.container.querySelector('#dashboardModal');
    const titleEl = this.container.querySelector('#modalTitle');
    const bodyEl = this.container.querySelector('#modalBody');
    const actionsEl = modalEl.querySelector('.modal-actions');

    const hierarchy = this.getFolderHierarchyList();

    titleEl.textContent = 'Mover Documento';
    bodyEl.innerHTML = `
      <p style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-secondary);">Selecciona la carpeta o subcarpeta de destino:</p>
      <select id="selectFolderTarget" class="modal-input form-select">
        <option value="" ${!doc.folderId ? 'selected' : ''}>[Raíz - Sin Carpeta]</option>
        ${hierarchy.map(item => {
          const indent = '　'.repeat(item.depth) + (item.depth > 0 ? '↳ ' : '');
          return `<option value="${item.folder.id}" ${doc.folderId === item.folder.id ? 'selected' : ''}>${indent}${this.escapeHtml(item.folder.name)}</option>`;
        }).join('')}
      </select>
    `;

    actionsEl.innerHTML = `
      <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
      <button class="btn-primary" id="btnModalConfirm">Mover</button>
    `;

    modalEl.classList.remove('hidden');

    const btnConfirm = actionsEl.querySelector('#btnModalConfirm');
    const btnCancel = actionsEl.querySelector('#btnModalCancel');

    const close = () => {
      modalEl.classList.add('hidden');
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', close);
    };

    const onConfirm = async () => {
      const select = bodyEl.querySelector('#selectFolderTarget');
      doc.folderId = select.value || null;
      await db.saveDocument(doc);
      close();
      await this.loadAndRender();
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', close);
  }

  openDocumentModal(title, defaultTitle, isNotebook, onConfirmCallback) {
    const modalEl = this.container.querySelector('#dashboardModal');
    const titleEl = this.container.querySelector('#modalTitle');
    const bodyEl = this.container.querySelector('#modalBody');
    const actionsEl = modalEl.querySelector('.modal-actions');

    titleEl.textContent = title;
    bodyEl.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 0.88rem; color: #64748b;">
        Introduce el título para ${isNotebook ? 'tu nuevo cuaderno' : 'tu nueva pizarra'}:
      </div>
      <input type="text" id="modalInput" class="modal-input" value="${this.escapeHtml(defaultTitle)}" />
    `;

    // Botones con opción dual: "Crear y Abrir" o "Solo Crear"
    actionsEl.innerHTML = `
      <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
      <button class="btn-secondary" id="btnModalCreateOnly">Solo Crear</button>
      <button class="btn-primary" id="btnModalCreateOpen">Crear y Abrir</button>
    `;

    modalEl.classList.remove('hidden');

    const input = bodyEl.querySelector('#modalInput');
    const btnCancel = actionsEl.querySelector('#btnModalCancel');
    const btnCreateOnly = actionsEl.querySelector('#btnModalCreateOnly');
    const btnCreateOpen = actionsEl.querySelector('#btnModalCreateOpen');

    input.focus();
    input.select();

    const cleanup = () => {
      modalEl.classList.add('hidden');
      // Restaurar acciones por defecto
      actionsEl.innerHTML = `
        <button class="btn-secondary" id="btnModalCancel">Cancelar</button>
        <button class="btn-primary" id="btnModalConfirm">Aceptar</button>
      `;
    };

    const handleCreateOpen = async () => {
      const val = input.value.trim() || defaultTitle;
      cleanup();
      await onConfirmCallback(val, true);
    };

    const handleCreateOnly = async () => {
      const val = input.value.trim() || defaultTitle;
      cleanup();
      await onConfirmCallback(val, false);
    };

    btnCreateOpen.addEventListener('click', handleCreateOpen);
    btnCreateOnly.addEventListener('click', handleCreateOnly);
    btnCancel.addEventListener('click', cleanup);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCreateOpen();
      if (e.key === 'Escape') cleanup();
    });
  }

  openModal(title, defaultValue, onConfirmCallback) {
    const modalEl = this.container.querySelector('#dashboardModal');
    const titleEl = this.container.querySelector('#modalTitle');
    const bodyEl = this.container.querySelector('#modalBody');
    const btnConfirm = this.container.querySelector('#btnModalConfirm');
    const btnCancel = this.container.querySelector('#btnModalCancel');

    titleEl.textContent = title;
    bodyEl.innerHTML = `<input type="text" id="modalInput" class="modal-input" value="${this.escapeHtml(defaultValue)}" />`;
    modalEl.classList.remove('hidden');

    const input = bodyEl.querySelector('#modalInput');
    input.focus();
    input.select();

    const handleConfirm = async () => {
      const val = input.value.trim();
      close();
      await onConfirmCallback(val);
    };

    const handleKey = (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') close();
    };

    const close = () => {
      modalEl.classList.add('hidden');
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', close);
      input.removeEventListener('keydown', handleKey);
    };

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', close);
    input.addEventListener('keydown', handleKey);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

