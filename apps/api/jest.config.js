const path = require("node:path");

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  // @nestjs/bullmq and @nestjs/schedule ship ESM-only (no CJS build) — Jest's CommonJS runtime
  // can't require() them. See test-support/nestjs-bullmq.mock.ts for why a stand-in is safe here.
  moduleNameMapper: {
    "^@nestjs/bullmq$": "<rootDir>/test-support/nestjs-bullmq.mock.ts",
    "^@nestjs/schedule$": "<rootDir>/test-support/nestjs-schedule.mock.ts",
  },
  // @apidevtools/swagger-parser's own `$ref` resolver, @apidevtools/json-schema-ref-parser, is
  // ESM-only — unlike bullmq/schedule this one IS the logic under test (OpenApi3Parser,
  // Swagger2Parser), so it's transpiled via the same babel-transformer.cjs the e2e config uses,
  // not mocked out. @nestjs/config is also ESM-only (see test/jest-e2e.json) and, unlike bullmq/
  // schedule, S3CompatibleStorage's unit test constructs a real ConfigService rather than a fake,
  // so it needs the same transpile rather than a mock.
  transform: {
    "^.+\\.ts$": "ts-jest",
    "\\.pnpm/(@apidevtools\\+json-schema-ref-parser|@nestjs\\+config)@.+\\.m?js$": path.join(
      __dirname,
      "test",
      "babel-transformer.cjs",
    ),
  },
  transformIgnorePatterns: ["\\.pnpm/(?!(@apidevtools\\+json-schema-ref-parser|@nestjs\\+config)@)"],
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.module.ts",
    "!main.ts",
    "!mikro-orm.config.ts",
    "!**/*.tokens.ts",
    "!**/migrations/**",
    "!test-support/**",
  ],
  coverageDirectory: "../coverage",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
