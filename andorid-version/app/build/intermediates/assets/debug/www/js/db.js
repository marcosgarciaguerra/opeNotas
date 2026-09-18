// js/db.js - Capa de persistencia local con IndexedDB, soporte multifolio, portadas, carpetas cromáticas y Backup completo
const DB_NAME = 'WhiteboardAppDB';
const DB_VERSION = 2;

class WhiteboardDB {
  constructor() {
    this.db = null;
    this.useLocalStorageFallback = false;
    this.ready = this.init();
  }

  async init() {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB no está disponible en este entorno. Usando LocalStorage fallback.');
      this.useLocalStorageFallback = true;
      this.initFallbackData();
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('documents')) {
            const docStore = db.createObjectStore('documents', { keyPath: 'id' });
            docStore.createIndex('folderId', 'folderId', { unique: false });
            docStore.createIndex('type', 'type', { unique: false });
            docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            docStore.createIndex('isFavorite', 'isFavorite', { unique: false });
            docStore.createIndex('isTrash', 'isTrash', { unique: false });
          }

          if (!db.objectStoreNames.contains('folders')) {
            const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
            folderStore.createIndex('parentId', 'parentId', { unique: false });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          await this.seedInitialDataDirect();
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.warn('Error al abrir IndexedDB, usando fallback LocalStorage:', event.target.error);
          this.useLocalStorageFallback = true;
          this.initFallbackData();
          resolve(null);
        };
      } catch (err) {
        console.warn('Excepción con IndexedDB, usando fallback:', err);
        this.useLocalStorageFallback = true;
        this.initFallbackData();
        resolve(null);
      }
    });
  }

  // Siembra directa sin llamadas que requieran this.ready (evita deadlock)
  async seedInitialDataDirect() {
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['documents', 'folders'], 'readwrite');
        const docStore = tx.objectStore('documents');
        const folderStore = tx.objectStore('folders');

        const countReq = docStore.count();
        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            // Carpetas de muestra con código cromático
            folderStore.put({
              id: 'folder_general',
              name: 'Mis Proyectos',
              color: '#3b82f6', // azul
              parentId: null,
              createdAt: Date.now()
            });

            folderStore.put({
              id: 'folder_estudios',
              name: 'Apuntes Académicos',
              color: '#10b981', // verde esmeralda
              parentId: null,
              createdAt: Date.now() - 1000
            });

            // Cuaderno multifolio de muestra con portada
            docStore.put({
              id: 'doc_notebook_demo',
              title: 'Cuaderno de Bienvenida',
              type: 'notebook',
              folderId: 'folder_general',
              createdAt: Date.now() - 7200000,
              updatedAt: Date.now() - 3600000,
              isFavorite: true,
              isTrash: false,
              pageFormat: 'a4',
              cover: {
                template: 'moleskine',
                title: 'Cuaderno de Bienvenida',
                subtitle: 'Apuntes y Notas Rápidas',
                date: new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
                color: '#1e293b'
              },
              pages: [
                {
                  id: 'page_1',
                  backgroundPattern: 'ruled',
                  strokes: [
                    {
                      id: 's1',
                      tool: 'pen',
                      color: '#1e293b',
                      width: 4,
                      opacity: 1,
                      isHighlighter: false,
                      isStraight: false,
                      points: [{ x: 120, y: 140 }, { x: 340, y: 140 }, { x: 230, y: 140 }, { x: 230, y: 220 }],
                      roughBox: { minX: 120, minY: 140, maxX: 340, maxY: 220 }
                    },
                    {
                      id: 's2',
                      tool: 'highlighter',
                      color: '#facc15',
                      width: 24,
                      opacity: 0.5,
                      isHighlighter: true,
                      isStraight: true,
                      points: [{ x: 90, y: 175 }, { x: 370, y: 175 }],
                      roughBox: { minX: 90, minY: 165, maxX: 370, maxY: 185 }
                    }
                  ],
                  shapes: [],
                  texts: [],
                  images: []
                },
                {
                  id: 'page_2',
                  backgroundPattern: 'grid',
                  strokes: [],
                  shapes: [],
                  texts: [],
                  images: []
                }
              ],
              thumbnail: ''
            });

            // Pizarra libre continua de muestra
            docStore.put({
              id: 'doc_board_demo',
              title: 'Lienzo de Lluvia de Ideas',
              type: 'whiteboard',
              folderId: null,
              createdAt: Date.now() - 10800000,
              updatedAt: Date.now() - 1800000,
              isFavorite: false,
              isTrash: false,
              pageFormat: 'board',
              pages: [
                {
                  id: 'page_1',
                  backgroundPattern: 'dots',
                  strokes: [],
                  shapes: [
                    {
                      id: 'sh1',
                      type: 'rectangle',
                      x: 200,
                      y: 150,
                      width: 240,
                      height: 120,
                      strokeColor: '#2563eb',
                      strokeWidth: 3,
                      fillColor: 'rgba(37, 99, 235, 0.08)'
                    }
                  ],
                  texts: [
                    {
                      id: 'txt1',
                      x: 220,
                      y: 190,
                      text: '¡Lienzo libre de ideas!',
                      fontSize: 18,
                      fontFamily: 'sans-serif',
                      color: '#1e293b'
                    }
                  ],
                  images: []
                }
              ],
              thumbnail: ''
            });
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        console.error('Error al sembrar datos:', e);
        resolve();
      }
    });
  }

  // --- Operaciones de Documentos ---

  async getAllDocuments() {
    await this.ready;

    if (this.useLocalStorageFallback) {
      return this.fallbackGetDocs();
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('documents', 'readonly');
        const store = tx.objectStore('documents');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(this.fallbackGetDocs());
      } catch (e) {
        resolve(this.fallbackGetDocs());
      }
    });
  }

  async getDocument(id) {
    await this.ready;

    if (this.useLocalStorageFallback) {
      const docs = this.fallbackGetDocs();
      return docs.find(d => d.id === id) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('documents', 'readonly');
        const store = tx.objectStore('documents');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async saveDocument(doc) {
    await this.ready;
    doc.updatedAt = Date.now();

    if (this.useLocalStorageFallback) {
      const docs = this.fallbackGetDocs();
      const idx = docs.findIndex(d => d.id === doc.id);
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      this.fallbackSaveDocs(docs);
      return doc;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('documents', 'readwrite');
        const store = tx.objectStore('documents');
        const req = store.put(doc);
        req.onsuccess = () => resolve(doc);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        this.fallbackSaveDocSingle(doc);
        resolve(doc);
      }
    });
  }

  async moveToTrash(id) {
    const doc = await this.getDocument(id);
    if (!doc) return null;
    doc.isTrash = true;
    return this.saveDocument(doc);
  }

  async restoreFromTrash(id) {
    const doc = await this.getDocument(id);
    if (!doc) return null;
    doc.isTrash = false;
    return this.saveDocument(doc);
  }

  async deleteDocumentPermanent(id) {
    await this.ready;

    if (this.useLocalStorageFallback) {
      let docs = this.fallbackGetDocs();
      docs = docs.filter(d => d.id !== id);
      this.fallbackSaveDocs(docs);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('documents', 'readwrite');
        const store = tx.objectStore('documents');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async duplicateDocument(id) {
    const original = await this.getDocument(id);
    if (!original) return null;

    const copy = JSON.parse(JSON.stringify(original));
    copy.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    copy.title = `${original.title} (Copia)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.isTrash = false;

    await this.saveDocument(copy);
    return copy;
  }

  // --- Operaciones de Carpetas con Color ---

  async getAllFolders() {
    await this.ready;

    if (this.useLocalStorageFallback) {
      return this.fallbackGetFolders();
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('folders', 'readonly');
        const store = tx.objectStore('folders');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(this.fallbackGetFolders());
      } catch (e) {
        resolve(this.fallbackGetFolders());
      }
    });
  }

  async saveFolder(folder) {
    await this.ready;

    if (!folder.color) {
      folder.color = '#3b82f6';
    }

    if (this.useLocalStorageFallback) {
      const folders = this.fallbackGetFolders();
      const idx = folders.findIndex(f => f.id === folder.id);
      if (idx >= 0) folders[idx] = folder;
      else folders.push(folder);
      this.fallbackSaveFolders(folders);
      return folder;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('folders', 'readwrite');
        const store = tx.objectStore('folders');
        const req = store.put(folder);
        req.onsuccess = () => resolve(folder);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        resolve(folder);
      }
    });
  }

  async deleteFolder(folderId) {
    await this.ready;

    // Recoger todos los IDs de carpetas que pertenecen a este subárbol
    const allFolders = await this.getAllFolders();
    const folderIdsToDelete = new Set([folderId]);
    
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id);
          added = true;
        }
      }
    }

    // Mover documentos de esas carpetas a la raíz
    const docs = await this.getAllDocuments();
    for (const d of docs) {
      if (folderIdsToDelete.has(d.folderId)) {
        d.folderId = null;
        await this.saveDocument(d);
      }
    }

    if (this.useLocalStorageFallback) {
      let folders = this.fallbackGetFolders();
      folders = folders.filter(f => !folderIdsToDelete.has(f.id));
      this.fallbackSaveFolders(folders);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('folders', 'readwrite');
        const store = tx.objectStore('folders');
        for (const fId of folderIdsToDelete) {
          store.delete(fId);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // --- Sistema de Copia de Seguridad Integral (Exportar / Restaurar Backup) ---

  async exportFullBackup() {
    const documents = await this.getAllDocuments();
    const folders = await this.getAllFolders();

    const backupData = {
      app: 'SuiteNotasPizarra',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      folders: folders,
      documents: documents
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_pizarra_cuadernos_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { docsCount: documents.length, foldersCount: folders.length };
  }

  async restoreFullBackup(jsonContent) {
    let data;
    try {
      data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    } catch (e) {
      throw new Error('El archivo de copia de seguridad no contiene un formato JSON válido.');
    }

    if (!data.documents || !Array.isArray(data.documents)) {
      throw new Error('Formato de respaldo no reconocido: falta lista de documentos.');
    }

    const folders = Array.isArray(data.folders) ? data.folders : [];
    const documents = data.documents;

    // Restaurar carpetas
    for (const folder of folders) {
      await this.saveFolder(folder);
    }

    // Restaurar documentos
    for (const doc of documents) {
      await this.saveDocument(doc);
    }

    return {
      docsCount: documents.length,
      foldersCount: folders.length
    };
  }

  // --- Implementación de Respaldo LocalStorage / Memoria ---
  initFallbackData() {
    this._memDocs = this._memDocs || [];
    this._memFolders = this._memFolders || [];

    const defaultDocs = [
      {
        id: 'doc_notebook_demo',
        title: 'Cuaderno de Bienvenida',
        type: 'notebook',
        folderId: 'folder_general',
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 3600000,
        isFavorite: true,
        isTrash: false,
        pageFormat: 'a4',
        cover: {
          template: 'moleskine',
          title: 'Cuaderno de Bienvenida',
          subtitle: 'Apuntes y Notas Rápidas',
          date: new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
          color: '#1e293b'
        },
        pages: [{ id: 'page_1', backgroundPattern: 'ruled', strokes: [], shapes: [], texts: [], images: [] }],
        thumbnail: ''
      },
      {
        id: 'doc_board_demo',
        title: 'Lienzo de Lluvia de Ideas',
        type: 'whiteboard',
        folderId: null,
        createdAt: Date.now() - 10800000,
        updatedAt: Date.now() - 1800000,
        isFavorite: false,
        isTrash: false,
        pageFormat: 'board',
        pages: [{ id: 'page_1', backgroundPattern: 'dots', strokes: [], shapes: [], texts: [], images: [] }],
        thumbnail: ''
      }
    ];

    const defaultFolders = [
      { id: 'folder_general', name: 'Mis Proyectos', color: '#3b82f6', parentId: null, createdAt: Date.now() }
    ];

    if (typeof localStorage !== 'undefined') {
      try {
        if (!localStorage.getItem('whiteboard_docs')) {
          localStorage.setItem('whiteboard_docs', JSON.stringify(defaultDocs));
        }
        if (!localStorage.getItem('whiteboard_folders')) {
          localStorage.setItem('whiteboard_folders', JSON.stringify(defaultFolders));
        }
      } catch (e) {
        this._memDocs = defaultDocs;
        this._memFolders = defaultFolders;
      }
    } else {
      this._memDocs = defaultDocs;
      this._memFolders = defaultFolders;
    }
  }

  fallbackGetDocs() {
    if (typeof localStorage !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('whiteboard_docs') || '[]');
      } catch (e) {
        return this._memDocs || [];
      }
    }
    return this._memDocs || [];
  }

  fallbackSaveDocs(docs) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('whiteboard_docs', JSON.stringify(docs));
      } catch (e) {
        this._memDocs = docs;
      }
    } else {
      this._memDocs = docs;
    }
  }

  fallbackSaveDocSingle(doc) {
    const docs = this.fallbackGetDocs();
    const idx = docs.findIndex(d => d.id === doc.id);
    if (idx >= 0) docs[idx] = doc;
    else docs.push(doc);
    this.fallbackSaveDocs(docs);
  }

  fallbackGetFolders() {
    if (typeof localStorage !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('whiteboard_folders') || '[]');
      } catch (e) {
        return this._memFolders || [];
      }
    }
    return this._memFolders || [];
  }

  fallbackSaveFolders(folders) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('whiteboard_folders', JSON.stringify(folders));
      } catch (e) {
        this._memFolders = folders;
      }
    } else {
      this._memFolders = folders;
    }
  }
}

export const db = new WhiteboardDB();
