const path = require("node:path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "assets");

async function buildIcons() {
  await sharp(path.join(assetsDir, "codex-icon-white.png"))
    .resize(32, 32, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(assetsDir, "tray-icon-on-dark.png"));
  await sharp(path.join(assetsDir, "codex-icon-black.png"))
    .resize(32, 32, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(assetsDir, "tray-icon-on-light.png"));
}

buildIcons().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
