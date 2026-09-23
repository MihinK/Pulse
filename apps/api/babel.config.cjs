// Used only by Jest's e2e config (test/jest-e2e.json) to transpile @nestjs/bullmq and
// @nestjs/schedule — both ESM-only (no CJS build) — into CommonJS so Jest's require() pipeline
// can load them. Unit tests never hit this: jest.config.js mocks those two packages instead,
// since e2e tests are the ones that actually need their real behavior against real Redis.
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
