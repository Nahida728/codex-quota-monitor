const path = require("node:path");

// Filter dependency documentation before ASAR integrity is calculated. Platform
// negative-only file patterns override the application allowlist on Windows.
module.exports = function beforePack() {
  const { NodeModuleCopyHelper } = require("app-builder-lib/out/util/NodeModuleCopyHelper");
  const prototype = NodeModuleCopyHelper.prototype;
  const marker = Symbol.for("codex-quota-monitor.filtered-module-docs");
  if (prototype[marker]) return;
  const collect = prototype.collectNodeModules;
  if (typeof collect !== "function") {
    throw new Error("Unsupported dependency collector: verify packaging before release.");
  }
  prototype.collectNodeModules = async function (...args) {
    const files = await collect.apply(this, args);
    return files.filter(file => file && !/^(?:readme(?:\..*)?|agents?\.md)$/i.test(path.basename(file)));
  };
  prototype[marker] = true;
};
