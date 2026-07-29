const koffi = require("koffi");

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const SW_SHOW = 5;
const SW_RESTORE = 9;

let native;

function isTrustedCodexExecutable(value) {
  return typeof value === "string" &&
    /\\WindowsApps\\OpenAI\.(?:Codex|ChatGPT)_[^\\]+\\app\\ChatGPT\.exe$/i.test(value);
}

function loadNative() {
  if (native) return native;
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");
  const DWORD = koffi.alias("DWORD", "uint32_t");
  const HANDLE = koffi.pointer("HANDLE", koffi.opaque());
  const HWND = koffi.alias("HWND", HANDLE);
  const RECT = koffi.struct("RECT", {
    left: "long",
    top: "long",
    right: "long",
    bottom: "long"
  });
  native = {
    CloseHandle: kernel32.func("bool __stdcall CloseHandle(HANDLE)"),
    FindWindowExW: user32.func(
      "HWND __stdcall FindWindowExW(HWND, HWND, const char16_t *, const char16_t *)"
    ),
    GetWindowRect: user32.func("bool __stdcall GetWindowRect(HWND, _Out_ RECT *)"),
    GetForegroundWindow: user32.func("HWND __stdcall GetForegroundWindow()"),
    GetWindowThreadProcessId: user32.func(
      "DWORD __stdcall GetWindowThreadProcessId(HWND, _Out_ DWORD *)"
    ),
    GetCurrentThreadId: kernel32.func("DWORD __stdcall GetCurrentThreadId()"),
    AttachThreadInput: user32.func(
      "bool __stdcall AttachThreadInput(DWORD, DWORD, bool)"
    ),
    IsIconic: user32.func("bool __stdcall IsIconic(HWND)"),
    IsWindowVisible: user32.func("bool __stdcall IsWindowVisible(HWND)"),
    OpenProcess: kernel32.func("HANDLE __stdcall OpenProcess(DWORD, bool, DWORD)"),
    QueryFullProcessImageNameW: kernel32.func(
      "bool __stdcall QueryFullProcessImageNameW(HANDLE, DWORD, _Out_ uint16_t *, _Inout_ DWORD *)"
    ),
    ShowWindowAsync: user32.func("bool __stdcall ShowWindowAsync(HWND, int)"),
    BringWindowToTop: user32.func("bool __stdcall BringWindowToTop(HWND)"),
    SetForegroundWindow: user32.func("bool __stdcall SetForegroundWindow(HWND)")
  };
  return native;
}

function readProcessImagePath(api, hwnd) {
  const pidPointer = [null];
  if (!api.GetWindowThreadProcessId(hwnd, pidPointer)) return null;
  const processHandle = api.OpenProcess(
    PROCESS_QUERY_LIMITED_INFORMATION,
    false,
    pidPointer[0]
  );
  if (!processHandle) return null;
  try {
    const buffer = Buffer.alloc(32_768 * 2);
    const sizePointer = [32_768];
    if (!api.QueryFullProcessImageNameW(processHandle, 0, buffer, sizePointer)) {
      return null;
    }
    return koffi.decode(buffer, "char16_t", sizePointer[0]);
  } finally {
    api.CloseHandle(processHandle);
  }
}

function listCodexWindows() {
  if (process.platform !== "win32") return [];
  const api = loadNative();
  const candidates = [];
  for (let hwnd = null;;) {
    hwnd = api.FindWindowExW(0, hwnd, "Chrome_WidgetWin_1", null);
    if (!hwnd) break;
    const imagePath = readProcessImagePath(api, hwnd);
    if (!isTrustedCodexExecutable(imagePath)) continue;
    const rectangle = {};
    api.GetWindowRect(hwnd, rectangle);
    candidates.push({
      hwnd,
      visible: Boolean(api.IsWindowVisible(hwnd)),
      iconic: Boolean(api.IsIconic(hwnd)),
      area: Math.max(0, rectangle.right - rectangle.left) *
        Math.max(0, rectangle.bottom - rectangle.top)
    });
  }
  return candidates;
}

function selectCodexWindow(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter(candidate => candidate?.hwnd && candidate.visible)
    .sort((left, right) => (
      Number(Boolean(right.visible)) - Number(Boolean(left.visible)) ||
      Number(Boolean(left.iconic)) - Number(Boolean(right.iconic)) ||
      (Number(right.area) || 0) - (Number(left.area) || 0)
    ))[0] || null;
}

function focusCodexWindow() {
  if (process.platform !== "win32") return false;
  const target = selectCodexWindow(listCodexWindows());
  if (!target) return false;
  const api = loadNative();
  const foreground = api.GetForegroundWindow();
  const foregroundThread = foreground
    ? api.GetWindowThreadProcessId(foreground, [null])
    : 0;
  const currentThread = api.GetCurrentThreadId();
  const attached = Boolean(
    foregroundThread &&
    currentThread !== foregroundThread &&
    api.AttachThreadInput(currentThread, foregroundThread, true)
  );
  try {
    api.ShowWindowAsync(target.hwnd, target.iconic ? SW_RESTORE : SW_SHOW);
    api.BringWindowToTop(target.hwnd);
    return Boolean(api.SetForegroundWindow(target.hwnd));
  } finally {
    if (attached) api.AttachThreadInput(currentThread, foregroundThread, false);
  }
}

module.exports = {
  focusCodexWindow,
  isTrustedCodexExecutable,
  selectCodexWindow
};
