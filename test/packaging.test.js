const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const packageJson = require(path.join(__dirname, "..", "package.json"));

test("development guidance and repository files are excluded from packaged apps", () => {
  assert.deepEqual(packageJson.build.files, ["src/**/*", "package.json"]);
  for (const entry of packageJson.build.files) {
    assert.doesNotMatch(entry, /AGENTS?\.md|README|test|scripts/i);
  }
});
