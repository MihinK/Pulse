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
