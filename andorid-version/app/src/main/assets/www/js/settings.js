// js/settings.js - Administrador de Configuración y Preferencias del Sistema
import { Icons } from './icons.js';

const STORAGE_KEY = 'whiteboard_system_settings';

const DEFAULT_SETTINGS = {
  theme: 'light', // 'light' | 'dark' | 'system'
  inputMode: 'stylus-first', // 'stylus-first' (Modo Stylus / Rechazo de palma) | 'finger-drawing'
  darkPaper: false, // Invertir papel a tonos oscuros en modo noche
  defaultPattern: 'grid', // 'grid' | 'ruled' | 'dots' | 'blank'
  autoStraighten: true // Auto-enderezado inteligente de trazos
};

export class SettingsManager {
  static settings = null;
  static listeners = new Map();
  static modalEl = null;

  static init() {
    this.loadSettings();
    this.applyCurrentTheme();
    this.listenSystemThemeChange();
  }

  static getSettings() {
    if (!this.settings) {
      this.loadSettings();
    }
    return { ...this.settings };
  }

  static loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (e) {
      console.warn('Error al cargar configuración de localStorage:', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this.settings;
  }

  static saveSettings(newValues) {
    this.settings = { ...this.settings, ...newValues };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Error al guardar configuración en localStorage:', e);
    }

    this.applyCurrentTheme();
    this.applyDarkPaper();
    this.notifyChange(this.settings);
  }

  static on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  static notifyChange(settings) {
    if (this.listeners.has('change')) {
      this.listeners.get('change').forEach(cb => {
        try {
          cb(settings);
        } catch (err) {
          console.error('Error en listener de settings:', err);
        }
      });
    }
  }

  static getEffectiveTheme() {
    const theme = this.settings?.theme || 'light';
    if (theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return theme;
  }

  static applyCurrentTheme() {
    const effective = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effective);
    if (effective === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  static applyDarkPaper() {
    const effectiveTheme = this.getEffectiveTheme();
    const shouldDarken = effectiveTheme === 'dark' && Boolean(this.settings?.darkPaper);
    document.documentElement.classList.toggle('dark-paper-mode', shouldDarken);
  }

  static listenSystemThemeChange() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.settings?.theme === 'system') {
          this.applyCurrentTheme();
          this.applyDarkPaper();
        }
      });
    }
  }

  static showSettingsModal(onSaved) {
    if (this.modalEl) {
      this.modalEl.remove();
    }

    const current = this.getSettings();

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop modal-overlay';
    this.modalEl.id = 'settingsModal';

    this.modalEl.innerHTML = `
      <div class="modal-box settings-modal-box">
        <div class="modal-header">
          <div class="settings-modal-title">
            <span class="settings-title-icon">${Icons.settings}</span>
            <h3 class="modal-title">Configuración del Sistema</h3>
          </div>
          <button type="button" class="btn-icon-ghost" id="btnCloseSettingsModal" title="Cerrar">
            ${Icons.close}
          </button>
        </div>

        <div class="modal-body settings-modal-body">
          <!-- 1. Sección: Apariencia y Tema -->
          <div class="settings-section">
            <h4 class="settings-section-heading">
              <span class="section-icon">${Icons.sun}</span>
              <span>Apariencia y Tema</span>
            </h4>
            <div class="theme-selector-group">
              <button type="button" class="theme-option-btn ${current.theme === 'light' ? 'active' : ''}" data-set-theme="light">
                <span class="theme-icon">${Icons.sun}</span>
                <span class="theme-label">Claro</span>
              </button>
              <button type="button" class="theme-option-btn ${current.theme === 'dark' ? 'active' : ''}" data-set-theme="dark">
                <span class="theme-icon">${Icons.moon}</span>
                <span class="theme-label">Oscuro</span>
              </button>
              <button type="button" class="theme-option-btn ${current.theme === 'system' ? 'active' : ''}" data-set-theme="system">
                <span class="theme-icon">${Icons.monitor}</span>
                <span class="theme-label">Sistema</span>
              </button>
            </div>

            <label class="settings-toggle-row mt-3">
              <div class="toggle-text">
                <strong>Papel oscuro en modo noche</strong>
                <small>Adapta el fondo blanco de las hojas a un tono oscuro para descansar la vista</small>
              </div>
              <input type="checkbox" id="chkDarkPaper" class="settings-switch" ${current.darkPaper ? 'checked' : ''} />
            </label>
          </div>

          <div class="settings-divider"></div>

          <!-- 2. Sección: Entrada y Lápiz (Stylus y Rechazo de Palma) -->
          <div class="settings-section">
            <h4 class="settings-section-heading">
              <span class="section-icon">${Icons.stylus}</span>
              <span>Lápiz Táctil y Rechazo de Palma</span>
            </h4>

            <label class="settings-toggle-row">
              <div class="toggle-text">
                <div class="toggle-title-badge">
                  <strong>Modo Stylus (Palma rechazada)</strong>
                  <span class="badge-recommended">Recomendado</span>
                </div>
                <small>Solo dibuja con la punta del lápiz óptico o cursor. Los toques de mano o dedos desplazan y navegan el cuaderno sin manchar.</small>
              </div>
              <input type="checkbox" id="chkStylusMode" class="settings-switch" ${current.inputMode === 'stylus-first' ? 'checked' : ''} />
            </label>

            <label class="settings-toggle-row mt-2">
              <div class="toggle-text">
                <strong>Auto-enderezado inteligente</strong>
                <small>Mantén pulsado 450ms al final del trazo para convertirlo automáticamente en una línea recta perfecta (regla virtual).</small>
              </div>
              <input type="checkbox" id="chkAutoStraighten" class="settings-switch" ${current.autoStraighten ? 'checked' : ''} />
            </label>
          </div>

          <div class="settings-divider"></div>

          <!-- 3. Sección: Cuadernos y Pauta por Defecto -->
          <div class="settings-section">
            <h4 class="settings-section-heading">
              <span class="section-icon">${Icons.notebook}</span>
              <span>Cuadernos y Documentos</span>
            </h4>

            <div class="form-group mb-0">
              <label class="form-label">Pauta predeterminada para nuevas hojas:</label>
              <div class="pattern-chips-group">
                <button type="button" class="pattern-chip ${current.defaultPattern === 'grid' ? 'active' : ''}" data-def-pat="grid">
                  <span>${Icons.patternGrid}</span>
                  <span>Cuadrícula</span>
                </button>
                <button type="button" class="pattern-chip ${current.defaultPattern === 'ruled' ? 'active' : ''}" data-def-pat="ruled">
                  <span>${Icons.patternRuled}</span>
                  <span>Rayado</span>
                </button>
                <button type="button" class="pattern-chip ${current.defaultPattern === 'dots' ? 'active' : ''}" data-def-pat="dots">
                  <span>${Icons.patternDots}</span>
                  <span>Puntos</span>
                </button>
                <button type="button" class="pattern-chip ${current.defaultPattern === 'blank' ? 'active' : ''}" data-def-pat="blank">
                  <span>${Icons.patternBlank}</span>
                  <span>Blanco</span>
                </button>
              </div>
            </div>
          </div>

          <div class="settings-divider"></div>

          <!-- 4. Sección: Acerca de y Almacenamiento -->
          <div class="settings-section">
            <div class="settings-info-card">
              <div class="info-card-text">
                <strong>Pizarra Digital & Cuadernos Vectoriales v2.5</strong>
                <small>100% Offline • Almacenamiento Seguro Local IndexedDB</small>
              </div>
              <button type="button" class="btn-ghost btn-sm" id="btnResetSettings" title="Restablecer ajustes a valores predeterminados">
                Restablecer
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-primary" id="btnSaveCloseSettings">
            Aceptar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Eventos del modal
    let selectedTheme = current.theme;
    let selectedPattern = current.defaultPattern;

    // Selector de tema en vivo
    this.modalEl.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTheme = btn.dataset.setTheme;
        this.modalEl.querySelectorAll('[data-set-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Previsualizar tema inmediatamente
        this.saveSettings({ theme: selectedTheme });
      });
    });

    // Selector de pauta por defecto
    this.modalEl.querySelectorAll('[data-def-pat]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPattern = btn.dataset.defPat;
        this.modalEl.querySelectorAll('[data-def-pat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.saveSettings({ defaultPattern: selectedPattern });
      });
    });

    // Dark paper toggle
    const chkDarkPaper = this.modalEl.querySelector('#chkDarkPaper');
    chkDarkPaper.addEventListener('change', (e) => {
      this.saveSettings({ darkPaper: e.target.checked });
    });

    // Stylus Mode toggle
    const chkStylusMode = this.modalEl.querySelector('#chkStylusMode');
    chkStylusMode.addEventListener('change', (e) => {
      const mode = e.target.checked ? 'stylus-first' : 'finger-drawing';
      this.saveSettings({ inputMode: mode });
    });

    // Auto straighten toggle
    const chkAutoStraighten = this.modalEl.querySelector('#chkAutoStraighten');
    chkAutoStraighten.addEventListener('change', (e) => {
      this.saveSettings({ autoStraighten: e.target.checked });
    });

    // Restablecer
    this.modalEl.querySelector('#btnResetSettings').addEventListener('click', () => {
      if (confirm('¿Deseas restablecer las preferencias a los valores originales?')) {
        this.saveSettings({ ...DEFAULT_SETTINGS });
        this.showSettingsModal(onSaved);
      }
    });

    // Cerrar modal
    const closeModal = () => {
      if (this.modalEl) {
        this.modalEl.remove();
        this.modalEl = null;
      }
      if (typeof onSaved === 'function') {
        onSaved(this.getSettings());
      }
    };

    this.modalEl.querySelector('#btnCloseSettingsModal').addEventListener('click', closeModal);
    this.modalEl.querySelector('#btnSaveCloseSettings').addEventListener('click', closeModal);
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        closeModal();
      }
    });
  }
}

// Inicialización automática de la configuración al cargar el script
SettingsManager.init();
