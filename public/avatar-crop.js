(function () {
  function createCropModal({
    imageSrc,
    aspectRatio = 1,
    title = "Обрезка",
    subtitle = "Перетащите рамку и при необходимости увеличьте масштаб",
    onConfirm,
    onCancel,
  }) {
    const overlay = document.createElement("div");
    overlay.className = "crop-modal";
    overlay.innerHTML = `
      <div class="crop-modal__card panel" role="dialog" aria-modal="true">
        <p class="panel__title">${title}</p>
        <p class="panel__subtitle">${subtitle}</p>
        <div class="crop-modal__viewport">
          <div class="crop-modal__stage">
            <canvas class="crop-modal__canvas"></canvas>
            <div class="crop-modal__shade crop-modal__shade--top"></div>
            <div class="crop-modal__shade crop-modal__shade--bottom"></div>
            <div class="crop-modal__shade crop-modal__shade--left"></div>
            <div class="crop-modal__shade crop-modal__shade--right"></div>
            <div class="crop-modal__frame" tabindex="0" aria-label="Область обрезки"></div>
          </div>
        </div>
        <label class="crop-modal__zoom">
          <span>Масштаб</span>
          <input type="range" data-crop-zoom min="100" max="300" value="100" step="5">
        </label>
        <div class="crop-modal__actions">
          <button type="button" class="btn" data-crop-cancel>Отмена</button>
          <button type="button" class="btn btn--amber" data-crop-ok>Сохранить</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const stage = overlay.querySelector(".crop-modal__stage");
    const canvas = overlay.querySelector(".crop-modal__canvas");
    const ctx = canvas.getContext("2d");
    const frame = overlay.querySelector(".crop-modal__frame");
    const viewport = overlay.querySelector(".crop-modal__viewport");
    const zoomInput = overlay.querySelector("[data-crop-zoom]");
    const shades = {
      top: overlay.querySelector(".crop-modal__shade--top"),
      bottom: overlay.querySelector(".crop-modal__shade--bottom"),
      left: overlay.querySelector(".crop-modal__shade--left"),
      right: overlay.querySelector(".crop-modal__shade--right"),
    };

    const img = new Image();
    let frameW = 200;
    let frameH = 200;
    let frameX = 0;
    let frameY = 0;
    let imgDrawW = 0;
    let imgDrawH = 0;
    let imgOffsetX = 0;
    let imgOffsetY = 0;
    let baseFitScale = 1;
    let zoom = 1;
    let dragging = false;
    let dragStart = { x: 0, y: 0, fx: 0, fy: 0 };

    function close() {
      overlay.remove();
    }

    function redrawImage() {
      const scale = baseFitScale * zoom;
      imgDrawW = img.width * scale;
      imgDrawH = img.height * scale;
      imgOffsetX = (canvas.width - imgDrawW) / 2;
      imgOffsetY = (canvas.height - imgDrawH) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, imgOffsetX, imgOffsetY, imgDrawW, imgDrawH);
      clampFrame();
    }

    function layout() {
      const vw = viewport.clientWidth;
      const vh = Math.min(360, Math.max(240, viewport.clientWidth * 0.75));
      viewport.style.height = `${vh}px`;

      const sx = vw / img.width;
      const sy = vh / img.height;
      baseFitScale = Math.min(sx, sy);
      canvas.width = Math.floor(img.width * baseFitScale);
      canvas.height = Math.floor(img.height * baseFitScale);

      stage.style.width = `${canvas.width}px`;
      stage.style.height = `${canvas.height}px`;

      if (aspectRatio >= 1) {
        frameW = Math.min(canvas.width * 0.92, canvas.height * 0.85 * aspectRatio);
        frameH = frameW / aspectRatio;
      } else {
        frameH = Math.min(canvas.height * 0.85, canvas.width * 0.92 / aspectRatio);
        frameW = frameH * aspectRatio;
      }
      frameX = Math.max(0, (canvas.width - frameW) / 2);
      frameY = Math.max(0, (canvas.height - frameH) / 2);

      redrawImage();
    }

    function updateFrame() {
      frame.style.width = `${frameW}px`;
      frame.style.height = `${frameH}px`;
      frame.style.left = `${frameX}px`;
      frame.style.top = `${frameY}px`;

      shades.top.style.height = `${frameY}px`;
      shades.left.style.top = `${frameY}px`;
      shades.left.style.width = `${frameX}px`;
      shades.left.style.height = `${frameH}px`;
      shades.right.style.left = `${frameX + frameW}px`;
      shades.right.style.top = `${frameY}px`;
      shades.right.style.width = `${canvas.width - frameX - frameW}px`;
      shades.right.style.height = `${frameH}px`;
      shades.bottom.style.top = `${frameY + frameH}px`;
      shades.bottom.style.height = `${canvas.height - frameY - frameH}px`;
    }

    function clampFrame() {
      frameX = Math.max(0, Math.min(canvas.width - frameW, frameX));
      frameY = Math.max(0, Math.min(canvas.height - frameH, frameY));
      updateFrame();
    }

    function getCropNormalized() {
      const x = (frameX - imgOffsetX) / imgDrawW;
      const y = (frameY - imgOffsetY) / imgDrawH;
      const w = frameW / imgDrawW;
      const h = frameH / imgDrawH;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0.05, Math.min(1, w)),
        h: Math.max(0.05, Math.min(1, h)),
      };
    }

    frame.addEventListener("pointerdown", (e) => {
      dragging = true;
      frame.setPointerCapture(e.pointerId);
      dragStart = { x: e.clientX, y: e.clientY, fx: frameX, fy: frameY };
    });

    frame.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      frameX = dragStart.fx + (e.clientX - dragStart.x);
      frameY = dragStart.fy + (e.clientY - dragStart.y);
      clampFrame();
    });

    frame.addEventListener("pointerup", () => {
      dragging = false;
    });

    zoomInput.addEventListener("input", () => {
      zoom = Number(zoomInput.value) / 100;
      redrawImage();
    });

    overlay.querySelector("[data-crop-cancel]").addEventListener("click", () => {
      onCancel?.();
      close();
    });

    overlay.querySelector("[data-crop-ok]").addEventListener("click", () => {
      onConfirm?.(getCropNormalized());
      close();
    });

    img.onload = () => layout();
    img.src = imageSrc;

    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    overlay.addEventListener("remove", () => window.removeEventListener("resize", onResize));
  }

  function pickImageFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("cancel"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve({ file, dataUrl: reader.result });
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      input.click();
    });
  }

  function pickWithAspect(aspectRatio, title, subtitle) {
    return pickImageFile().then(
      ({ dataUrl }) =>
        new Promise((resolve, reject) => {
          createCropModal({
            imageSrc: dataUrl,
            aspectRatio,
            title,
            subtitle,
            onConfirm: (crop) => resolve({ dataUrl, crop }),
            onCancel: () => reject(new Error("cancel")),
          });
        })
    );
  }

  async function pickAndCrop() {
    return pickWithAspect(
      1,
      "Обрезка аватарки",
      "Перетащите рамку и увеличьте масштаб ползунком"
    );
  }

  async function pickAndCropBanner() {
    return pickWithAspect(
      3,
      "Обрезка баннера",
      "Выберите область для фона профиля (3:1)"
    );
  }

  window.BunkerAvatarCrop = { pickAndCrop, pickAndCropBanner, createCropModal };
})();
