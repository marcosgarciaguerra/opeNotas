// js/editor/imageTool.js - Importación y manipulación de imágenes locales sobre el lienzo
export class ImageTool {
  constructor(canvasEngine, containerEl) {
    this.engine = canvasEngine;
    this.canvas = canvasEngine.canvas;
    this.container = containerEl;

    this.fileInput = null;
    this.initFileInput();
  }

  setHost(canvasEl, hostContainer) {
    this.canvas = canvasEl;
    this.container = hostContainer;
  }

  initFileInput() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/png, image/jpeg, image/webp, image/svg+xml';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        this.processImageFile(file);
      }
      this.fileInput.value = '';
    });
  }

  triggerUpload() {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        // Calcular tamaño inicial ajustado al lienzo
        const maxInitialDim = Math.min(this.canvas.width * 0.5, 450);
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > maxInitialDim || h > maxInitialDim) {
          const ratio = Math.min(maxInitialDim / w, maxInitialDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        // Posicionar en el centro del lienzo
        const posX = Math.round((this.canvas.width - w) / 2);
        const posY = Math.round((this.canvas.height - h) / 2);

        this.engine.addImage({
          x: posX,
          y: posY,
          width: w,
          height: h,
          dataUrl: dataUrl,
          rotation: 0,
          _element: img
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }
}

