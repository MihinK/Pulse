// Wraps babel-jest with an explicit configFile, since jest's `<rootDir>` token is only
// substituted for a transform entry's own path, not for values nested inside its options object.
// See babel.config.cjs for why this transform exists at all (ESM-only @nestjs packages).
const babelJest = require("babel-jest").default;
const path = require("node:path");

module.exports = babelJest.createTransformer({
  configFile: path.join(__dirname, "..", "babel.config.cjs"),
});
