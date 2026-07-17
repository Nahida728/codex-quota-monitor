const test = require("node:test");
const assert = require("node:assert/strict");
const {
  containedImageRect,
  initialCrop,
  moveCrop,
  resizeCrop,
  toSourceRect
} = require("../src/renderer/crop-geometry");

test("contains landscape images inside the crop stage", () => {
  const rect = containedImageRect(400, 420, 1920, 1080);
  assert.deepEqual(rect, { x: 0, y: 97.5, width: 400, height: 225 });
});

test("initial crop uses the fixed 460:690 window aspect", () => {
  const bounds = { x: 0, y: 0, width: 400, height: 400 };
  const crop = initialCrop(bounds, 460 / 690);
  assert.ok(Math.abs(crop.width / crop.height - 460 / 690) < 0.000001);
  assert.ok(crop.x >= bounds.x && crop.y >= bounds.y);
});

test("moving and resizing the crop box stay inside the image", () => {
  const bounds = { x: 10, y: 20, width: 300, height: 360 };
  const crop = { x: 50, y: 60, width: 120, height: 180 };
  const moved = moveCrop(crop, 999, 999, bounds);
  assert.equal(moved.x, 190);
  assert.equal(moved.y, 200);
  const resized = resizeCrop(crop, 999, 999, bounds, 460 / 690);
  assert.ok(resized.x + resized.width <= bounds.x + bounds.width + 0.000001);
  assert.ok(resized.y + resized.height <= bounds.y + bounds.height + 0.000001);
});

test("maps a displayed crop to original image pixels", () => {
  const source = toSourceRect(
    { x: 100, y: 80, width: 100, height: 150 },
    { x: 50, y: 30, width: 400, height: 300 },
    2000,
    1500
  );
  assert.deepEqual(source, { x: 250, y: 250, width: 500, height: 750 });
});
