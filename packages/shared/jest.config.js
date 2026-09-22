/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/index.ts",
    // Pure type/enum declarations have no branches or statements to exercise;
    // excluding them keeps the coverage number meaningful rather than padded.
    "!**/types/**",
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
