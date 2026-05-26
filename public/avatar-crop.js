(function () {
  function createCropModal({
    imageSrc,
    aspectRatio = 1,
    title = "Обрезка",
    subtitle = "Перетащите рамку или потяните за углы",
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
            <div class="crop-modal__frame" tabindex="0" aria-label="Область обрезки">
              <span class="crop-modal__handle crop-modal__handle--nw" data-handle="nw"></span>
              <span class="crop-modal__handle crop-modal__handle--ne" data-handle="ne"></span>
              <span class="crop-modal__handle crop-modal__handle--sw" data-handle="sw"></span>
              <span class="crop-modal__handle crop-modal__handle--se" data-handle="se"></span>
            </div>
          </div>
        </div>
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
    const shades = {
      top: overlay.querySelector(".crop-modal__shade--top"),
      bottom: overlay.querySelector(".crop-modal__shade--bottom"),
      left: overlay.querySelector(".crop-modal__shade--left"),
      right: overlay.querySelector(".crop-modal__shade--right"),
    };

    const img = new Image();
    const MIN = 48;
    let frameW = 120;
    let frameH = 120;
    let frameX = 0;
    let frameY = 0;
    let dragging = null;
    let dragStart = null;

    function close() {
      overlay.remove();
    }

    function drawImage() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    function layout() {
      const vw = viewport.clientWidth;
      const vh = Math.min(380, Math.max(260, viewport.clientWidth * 0.72));
      viewport.style.height = `${vh}px`;

      const scale = Math.min(vw / img.width, vh / img.height);
      canvas.width = Math.max(1, Math.floor(img.width * scale));
      canvas.height = Math.max(1, Math.floor(img.height * scale));
      stage.style.width = `${canvas.width}px`;
      stage.style.height = `${canvas.height}px`;

      drawImage();

      if (aspectRatio >= 1) {
        frameW = Math.min(canvas.width * 0.85, canvas.height * 0.85 * aspectRatio);
        frameH = frameW / aspectRatio;
      } else {
        frameH = Math.min(canvas.height * 0.85, canvas.width * 0.85 / aspectRatio);
        frameW = frameH * aspectRatio;
      }
      frameX = (canvas.width - frameW) / 2;
      frameY = (canvas.height - frameH) / 2;
      updateFrame();
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
      frameW = Math.max(MIN, Math.min(canvas.width, frameW));
      frameH = Math.max(MIN / aspectRatio, Math.min(canvas.height, frameH));
      if (Math.abs(frameW / frameH - aspectRatio) > 0.01) {
        frameH = frameW / aspectRatio;
      }
      if (frameH > canvas.height) {
        frameH = canvas.height;
        frameW = frameH * aspectRatio;
      }
      if (frameW > canvas.width) {
        frameW = canvas.width;
        frameH = frameW / aspectRatio;
      }
      frameX = Math.max(0, Math.min(canvas.width - frameW, frameX));
      frameY = Math.max(0, Math.min(canvas.height - frameH, frameY));
      updateFrame();
    }

    function resizeFromCorner(handle, dx) {
      let x = dragStart.fx;
      let y = dragStart.fy;
      let w = dragStart.fw;
      const h = w / aspectRatio;

      if (handle === "se") {
        w = dragStart.fw + dx;
      } else if (handle === "sw") {
        w = dragStart.fw - dx;
        x = dragStart.fx + dragStart.fw - w;
      } else if (handle === "ne") {
        w = dragStart.fw + dx;
        y = dragStart.fy + dragStart.fh - w / aspectRatio;
      } else if (handle === "nw") {
        w = dragStart.fw - dx;
        x = dragStart.fx + dragStart.fw - w;
        y = dragStart.fy + dragStart.fh - w / aspectRatio;
      }

      frameX = x;
      frameY = y;
      frameW = w;
      frameH = w / aspectRatio;
      clampFrame();
    }

    function getCropNormalized() {
      return {
        x: Math.max(0, Math.min(1, frameX / canvas.width)),
        y: Math.max(0, Math.min(1, frameY / canvas.height)),
        w: Math.max(0.05, Math.min(1, frameW / canvas.width)),
        h: Math.max(0.05, Math.min(1, frameH / canvas.height)),
      };
    }

    frame.addEventListener("pointerdown", (e) => {
      const handle = e.target.dataset.handle;
      if (handle) {
        dragging = handle;
      } else if (e.target === frame) {
        dragging = "move";
      } else {
        return;
      }
      frame.setPointerCapture(e.pointerId);
      dragStart = { x: e.clientX, y: e.clientY, fx: frameX, fy: frameY, fw: frameW, fh: frameH };
      e.preventDefault();
    });

    frame.addEventListener("pointermove", (e) => {
      if (!dragging || !dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (dragging === "move") {
        frameX = dragStart.fx + dx;
        frameY = dragStart.fy + dy;
        clampFrame();
      } else {
        resizeFromCorner(dragging, dx);
      }
    });

    frame.addEventListener("pointerup", () => {
      dragging = null;
      dragStart = null;
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
    return pickWithAspect(1, "Обрезка аватарки", "Потяните углы рамки или переместите её");
  }

  async function pickAndCropBanner() {
    return pickWithAspect(3, "Обрезка баннера", "Потяните углы рамки (формат 3:1)");
  }

  window.BunkerAvatarCrop = { pickAndCrop, pickAndCropBanner, createCropModal };
})();
