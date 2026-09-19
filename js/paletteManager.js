// js/paletteManager.js - Gestor centralizado y persistente de la paleta de 10 colores y accesos rápidos
export class PaletteManager {
  static STORAGE_KEY = 'opeNotas_palette_v1';
  static QUICK_KEY = 'opeNotas_quick_colors_v1';
  static PRESETS_KEY = 'opeNotas_pinned_presets_v1';

  static DEFAULT_PALETTE = [
    '#1e293b', // Pizarra oscuro
    '#2563eb', // Azul real
    '#06b6d4', // Cian vibrante
    '#10b981', // Verde esmeralda
    '#84cc16', // Lima brillante
    '#eab308', // Amarillo ámbar
    '#f97316', // Naranja cálido
    '#ef4444', // Rojo rubí
    '#ec4899', // Rosa magenta
    '#8b5cf6'  // Violeta púrpura
  ];

  static DEFAULT_QUICK = ['#1e293b', '#2563eb', '#ef4444'];

  static _listeners = new Set();

  static getPalette() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Asegurar que siempre contenga exactamente 10 colores
          const sanitized = parsed.filter(c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c));
          for (let i = sanitized.length; i < 10; i++) {
            sanitized.push(this.DEFAULT_PALETTE[i % this.DEFAULT_PALETTE.length]);
          }
          return sanitized.slice(0, 10);
        }
      }
    } catch (e) {
      console.warn('Error reading palette from localStorage:', e);
    }
    return [...this.DEFAULT_PALETTE];
  }

  static savePalette(colors) {
    try {
      const sanitized = colors.slice(0, 10);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sanitized));
      this.notify();
    } catch (e) {
      console.warn('Error saving palette to localStorage:', e);
    }
  }

  static addColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return;
    const normalized = hexColor.trim().toLowerCase();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return;

    let palette = this.getPalette();
    // Eliminar si ya existía para ponerlo en primera posición
    palette = palette.filter(c => c.toLowerCase() !== normalized);
    palette.unshift(normalized);
    // Mantener exactamente 10 colores
    palette = palette.slice(0, 10);

    this.savePalette(palette);
    return palette;
  }

  static getQuickColors() {
    try {
      const stored = localStorage.getItem(this.QUICK_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.slice(0, 3);
        }
      }
    } catch (e) {}
    const pal = this.getPalette();
    return [pal[0] || '#1e293b', pal[1] || '#2563eb', pal[7] || '#ef4444'];
  }

  static setQuickColors(colors) {
    try {
      localStorage.setItem(this.QUICK_KEY, JSON.stringify(colors.slice(0, 3)));
      this.notify();
    } catch (e) {}
  }

  static setQuickColorSlot(index, color) {
    const current = this.getQuickColors();
    if (index >= 0 && index < 3) {
      current[index] = color;
      this.setQuickColors(current);
    }
  }

  static getPinnedPresets() {
    try {
      const stored = localStorage.getItem(this.PRESETS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return [
      { id: 'preset_1', name: 'Notas Azul', tool: 'pen', color: '#2563eb', width: 3, opacity: 1, stabilization: 0.5, concentration: 1.0 },
      { id: 'preset_2', name: 'Subrayado Amarillo', tool: 'highlighter', color: '#eab308', width: 18, opacity: 0.45, stabilization: 0.7, concentration: 0.8 },
      { id: 'preset_3', name: 'Corrección Rojo', tool: 'pen', color: '#ef4444', width: 2, opacity: 1, stabilization: 0.4, concentration: 1.0 }
    ];
  }

  static addPinnedPreset(preset) {
    try {
      const presets = this.getPinnedPresets();
      presets.unshift(preset);
      localStorage.setItem(this.PRESETS_KEY, JSON.stringify(presets.slice(0, 8)));
      this.notify();
    } catch (e) {}
  }

  static removePinnedPreset(id) {
    try {
      const presets = this.getPinnedPresets().filter(p => p.id !== id);
      localStorage.setItem(this.PRESETS_KEY, JSON.stringify(presets));
      this.notify();
    } catch (e) {}
  }

  static subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  static notify() {
    for (const fn of this._listeners) {
      try {
        fn();
      } catch (e) {
        console.error('Error in PaletteManager listener:', e);
      }
    }
  }
}

