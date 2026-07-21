const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HTCAPTION,
  SC_MOVE,
  SC_MOVE_HTCAPTION,
  WM_SYSCOMMAND,
  decodeNativeHandle,
  didWindowMove,
  isValidNativeHandle,
  startSystemWindowMove
} = require("../src/native-window-drag");

test("validates native handles without starting a system move", () => {
  assert.equal(WM_SYSCOMMAND, 0x0112);
  assert.equal(SC_MOVE, 0xf010);
  assert.equal(HTCAPTION, 0x0002);
  assert.equal(SC_MOVE_HTCAPTION, 0xf012);
  assert.equal(isValidNativeHandle(Buffer.alloc(8)), true);
  assert.equal(isValidNativeHandle(Buffer.alloc(2)), false);
  assert.equal(isValidNativeHandle(null), false);
  assert.equal(startSystemWindowMove(null), false);
});

test("decodes the HWND value stored inside Electron's native handle buffer", () => {
  const x64Handle = Buffer.alloc(8);
  x64Handle.writeBigUInt64LE(0x1234567890n);
  assert.equal(decodeNativeHandle(x64Handle), 0x1234567890n);

  const x86Handle = Buffer.alloc(4);
  x86Handle.writeUInt32LE(0x12345678);
  assert.equal(decodeNativeHandle(x86Handle), 0x12345678n);
  assert.equal(decodeNativeHandle(Buffer.alloc(2)), null);
});

test("classifies a native gesture by its final window position", () => {
  assert.equal(didWindowMove({ x: 10, y: 20 }, { x: 10, y: 20 }), false);
  assert.equal(didWindowMove({ x: 10, y: 20 }, { x: 11, y: 20 }), true);
  assert.equal(didWindowMove({ x: 10, y: 20 }, { x: 10, y: 19 }), true);
});
