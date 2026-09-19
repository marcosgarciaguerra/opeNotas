// js/editor/imageTool.js - Importación y manipulación de imágenes y videos locales sobre el lienzo
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
    this.fileInput.accept = 'image/png, image/jpeg, image/webp, image/svg+xml, image/gif, video/mp4, video/webm, video/ogg, video/quicktime';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (file.type.startsWith('video/')) {
          this.processVideoFile(file);
        } else {
          this.processImageFile(file);
        }
      }
      this.fileInput.value = '';
    });
  }

  triggerUpload(acceptTypes = null) {
    if (this.fileInput) {
      if (acceptTypes) {
        this.fileInput.accept = acceptTypes;
      } else {
        this.fileInput.accept = 'image/png, image/jpeg, image/webp, image/svg+xml, image/gif, video/mp4, video/webm, video/ogg, video/quicktime';
      }
      this.fileInput.click();
    }
  }

  triggerImageUpload() {
    this.triggerUpload('image/png, image/jpeg, image/webp, image/svg+xml, image/gif');
  }

  triggerVideoUpload() {
    this.triggerUpload('video/mp4, video/webm, video/ogg, video/quicktime');
  }

  processVideoFile(file) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      const tempCanvas = document.createElement('canvas');
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 360;
      tempCanvas.width = vWidth;
      tempCanvas.height = vHeight;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

      // Dibujar overlay y botón de reproducción estilizado en el póster del video
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(tempCanvas.width / 2, tempCanvas.height / 2, 38, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const cx = tempCanvas.width / 2;
      const cy = tempCanvas.height / 2;
      ctx.moveTo(cx - 10, cy - 16);
      ctx.lineTo(cx + 16, cy);
      ctx.lineTo(cx - 10, cy + 16);
      ctx.closePath();
      ctx.fill();

      const posterDataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
      const img = new Image();
      img.onload = () => {
        const maxInitialDim = Math.min(this.canvas.width * 0.6, 500);
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > maxInitialDim || h > maxInitialDim) {
          const ratio = Math.min(maxInitialDim / w, maxInitialDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const posX = Math.round((this.canvas.width - w) / 2);
        const posY = Math.round((this.canvas.height - h) / 2);

        this.engine.addImage({
          x: posX,
          y: posY,
          width: w,
          height: h,
          dataUrl: posterDataUrl,
          rotation: 0,
          isVideo: true,
          mediaName: file.name,
          _element: img
        });
        URL.revokeObjectURL(url);
      };
      img.src = posterDataUrl;
    };

    video.onerror = () => {
      alert('No se pudo procesar el archivo de video.');
      URL.revokeObjectURL(url);
    };
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

