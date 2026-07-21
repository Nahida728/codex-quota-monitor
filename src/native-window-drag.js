const koffi = require("koffi");

const WM_SYSCOMMAND = 0x0112;
const SC_MOVE = 0xf010;
const HTCAPTION = 0x0002;
const SC_MOVE_HTCAPTION = SC_MOVE | HTCAPTION;

let releaseCapture;
let sendMessageW;
let isWindow;

function loadUser32() {
  if (releaseCapture && sendMessageW && isWindow) return;
  const user32 = koffi.load("user32.dll");
  releaseCapture = user32.func("bool ReleaseCapture()");
  isWindow = user32.func("bool IsWindow(void *hWnd)");
  sendMessageW = user32.func(
    "intptr_t SendMessageW(void *hWnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)"
  );
}

function isValidNativeHandle(nativeHandle) {
  return Buffer.isBuffer(nativeHandle) && nativeHandle.length >= 4;
}

function decodeNativeHandle(nativeHandle) {
  if (!isValidNativeHandle(nativeHandle)) return null;
  return nativeHandle.length >= 8
    ? nativeHandle.readBigUInt64LE(0)
    : BigInt(nativeHandle.readUInt32LE(0));
}

function startSystemWindowMove(nativeHandle) {
  if (process.platform !== "win32" || !isValidNativeHandle(nativeHandle)) return false;
  loadUser32();
  const hwnd = decodeNativeHandle(nativeHandle);
  if (!hwnd || !isWindow(hwnd)) return false;
  releaseCapture();
  // WM_SYSCOMMAND enters Windows' modal move loop synchronously and does not
  // return until the pointer is released. A synthetic WM_NCLBUTTONDOWN can be
  // consumed by Chromium and return before any movement has actually occurred.
  sendMessageW(hwnd, WM_SYSCOMMAND, SC_MOVE_HTCAPTION, 0);
  return true;
}

function didWindowMove(startBounds, endBounds) {
  return Boolean(startBounds && endBounds)
    && (startBounds.x !== endBounds.x || startBounds.y !== endBounds.y);
}

module.exports = {
  HTCAPTION,
  SC_MOVE,
  SC_MOVE_HTCAPTION,
  WM_SYSCOMMAND,
  decodeNativeHandle,
  didWindowMove,
  isValidNativeHandle,
  startSystemWindowMove
};
