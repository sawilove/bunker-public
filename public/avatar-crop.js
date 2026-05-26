(function () {
  function createCropModal({ imageSrc, onConfirm, onCancel }) {
    const overlay = document.createElement("div");
    overlay.className = "crop-modal";
    overlay.innerHTML = `
      <div class="crop-modal__card panel" role="dialog" aria-modal="true">
        <p class="panel__title">Обрезка аватарки</p>
        <p class="panel__subtitle">Перетащите рамку на нужную область</p>
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
    let frameSize = 200;
    let frameX = 0;
    let frameY = 0;
    let dragging = false;
    let dragStart = { x: 0, y: 0, fx: 0, fy: 0 };

    function close() {
      overlay.remove();
    }

    function layout() {
      const vw = viewport.clientWidth;
      const vh = Math.min(360, Math.max(240, viewport.clientWidth * 0.75));
      viewport.style.height = `${vh}px`;

      const sx = vw / img.width;
      const sy = vh / img.height;
      const scale = Math.min(sx, sy);
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      stage.style.width = `${canvas.width}px`;
      stage.style.height = `${canvas.height}px`;

      frameSize = Math.min(canvas.width, canvas.height) * 0.85;
      frameX = Math.max(0, (canvas.width - frameSize) / 2);
      frameY = Math.max(0, (canvas.height - frameSize) / 2);
      updateFrame();
    }

    function updateFrame() {
      frame.style.width = `${frameSize}px`;
      frame.style.height = `${frameSize}px`;
      frame.style.left = `${frameX}px`;
      frame.style.top = `${frameY}px`;

      shades.top.style.height = `${frameY}px`;
      shades.left.style.top = `${frameY}px`;
      shades.left.style.width = `${frameX}px`;
      shades.left.style.height = `${frameSize}px`;
      shades.right.style.left = `${frameX + frameSize}px`;
      shades.right.style.top = `${frameY}px`;
      shades.right.style.width = `${canvas.width - frameX - frameSize}px`;
      shades.right.style.height = `${frameSize}px`;
      shades.bottom.style.top = `${frameY + frameSize}px`;
      shades.bottom.style.height = `${canvas.height - frameY - frameSize}px`;
    }

    function clampFrame() {
      frameX = Math.max(0, Math.min(canvas.width - frameSize, frameX));
      frameY = Math.max(0, Math.min(canvas.height - frameSize, frameY));
      updateFrame();
    }

    function getCropNormalized() {
      return {
        x: frameX / canvas.width,
        y: frameY / canvas.height,
        w: frameSize / canvas.width,
        h: frameSize / canvas.height,
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

  async function pickAndCrop() {
    const { dataUrl } = await pickImageFile();
    return new Promise((resolve, reject) => {
      createCropModal({
        imageSrc: dataUrl,
        onConfirm: (crop) => resolve({ dataUrl, crop }),
        onCancel: () => reject(new Error("cancel")),
      });
    });
  }

  window.BunkerAvatarCrop = { pickAndCrop, createCropModal };
})();
