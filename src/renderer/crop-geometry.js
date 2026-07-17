(function exposeCropGeometry(global) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function containedImageRect(stageWidth, stageHeight, imageWidth, imageHeight) {
    if (![stageWidth, stageHeight, imageWidth, imageHeight].every(value => Number.isFinite(value) && value > 0)) {
      return null;
    }
    const scale = Math.min(stageWidth / imageWidth, stageHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    return {
      x: (stageWidth - width) / 2,
      y: (stageHeight - height) / 2,
      width,
      height
    };
  }

  function initialCrop(bounds, aspectRatio) {
    if (!bounds || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
    let width = bounds.width * 0.82;
    let height = width / aspectRatio;
    if (height > bounds.height * 0.82) {
      height = bounds.height * 0.82;
      width = height * aspectRatio;
    }
    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height
    };
  }

  function moveCrop(crop, deltaX, deltaY, bounds) {
    return {
      ...crop,
      x: clamp(crop.x + deltaX, bounds.x, bounds.x + bounds.width - crop.width),
      y: clamp(crop.y + deltaY, bounds.y, bounds.y + bounds.height - crop.height)
    };
  }

  function resizeCrop(crop, deltaX, deltaY, bounds, aspectRatio, minimumWidth = 70) {
    const widthFromX = crop.width + deltaX;
    const widthFromY = crop.width + deltaY * aspectRatio;
    let width = Math.abs(deltaX) >= Math.abs(deltaY * aspectRatio) ? widthFromX : widthFromY;
    const maximumWidth = Math.min(
      bounds.x + bounds.width - crop.x,
      (bounds.y + bounds.height - crop.y) * aspectRatio
    );
    width = clamp(width, Math.min(minimumWidth, maximumWidth), maximumWidth);
    return {
      ...crop,
      width,
      height: width / aspectRatio
    };
  }

  function toSourceRect(crop, displayedImage, naturalWidth, naturalHeight) {
    if (!crop || !displayedImage) return null;
    const scaleX = naturalWidth / displayedImage.width;
    const scaleY = naturalHeight / displayedImage.height;
    return {
      x: clamp((crop.x - displayedImage.x) * scaleX, 0, naturalWidth),
      y: clamp((crop.y - displayedImage.y) * scaleY, 0, naturalHeight),
      width: clamp(crop.width * scaleX, 1, naturalWidth),
      height: clamp(crop.height * scaleY, 1, naturalHeight)
    };
  }

  const api = {
    containedImageRect,
    initialCrop,
    moveCrop,
    resizeCrop,
    toSourceRect
  };
  global.CropGeometry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
