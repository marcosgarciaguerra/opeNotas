/**
 * android-bridge.js - Puente de integración nativa con Android WebView
 * Detecta si la app corre dentro del contenedor nativo de Android y canaliza
 * almacenamiento en Descargas/Galería, respuestas hápticas y el botón atrás físico.
 */
(function() {
  window.isAndroidApp = function() {
    return typeof window.Android !== 'undefined' && typeof window.Android.isAndroidApp === 'function';
  };

  // Notificación Toast nativa o fallback web
  window.showNativeToast = function(message) {
    if (window.isAndroidApp()) {
      try {
        window.Android.showToast(message);
        return;
      } catch (e) {
        console.warn('Error en Android.showToast:', e);
      }
    }
    // Fallback UI para navegador
    const existing = document.getElementById('nativeToastFallback');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'nativeToastFallback';
    toast.className = 'native-toast-fallback';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  };

  // Respuesta háptica nativa al interactuar con herramientas
  window.triggerNativeHaptic = function() {
    if (window.isAndroidApp()) {
      try {
        window.Android.triggerHapticFeedback();
      } catch (e) {}
    } else if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (e) {}
    }
  };

  // Guardado nativo de archivos (PDF en Descargas / Imagen en Galería)
  window.saveNativeFile = function(dataUrl, filename, mimeType) {
    if (window.isAndroidApp()) {
      try {
        if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
          const success = window.Android.savePdfToStorage(dataUrl, filename);
          if (success) return true;
        } else if (mimeType.startsWith('image/') || filename.endsWith('.png') || filename.endsWith('.jpg')) {
          const success = window.Android.saveImageToGallery(dataUrl, filename);
          if (success) return true;
        }
      } catch (e) {
        console.warn('Error al guardar con Android nativo:', e);
      }
    }

    // Fallback estándar en navegador
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return true;
  };

  // Manejador del botón atrás físico de Android invocado desde MainActivity
  window.handleAndroidBackButton = function() {
    // 1. Cerrar modal de configuración si está abierto
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
      settingsModal.remove();
      return 'handled';
    }

    // 2. Cerrar modal de exportación si está abierto
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
      exportModal.remove();
      return 'handled';
    }

    // 3. Cerrar selector de colores / menús emergentes
    const colorPicker = document.getElementById('colorPickerModal');
    if (colorPicker) {
      colorPicker.remove();
      return 'handled';
    }

    // 4. Cerrar menú contextual si está visible
    const contextMenu = document.getElementById('customContextMenu');
    if (contextMenu && contextMenu.style.display !== 'none') {
      contextMenu.style.display = 'none';
      return 'handled';
    }

    // 5. Si está dentro del editor, volver a la biblioteca digital
    const editorView = document.getElementById('editorView');
    if (editorView && !editorView.classList.contains('hidden')) {
      const btnBack = document.getElementById('btnBackToDashboard');
      if (btnBack) {
        btnBack.click();
        return 'handled';
      }
    }

    return 'default';
  };

  console.log('[Android Bridge] Inicializado. Modo nativo:', window.isAndroidApp());
})();

