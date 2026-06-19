import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  moduleNameMapper: {
    "^next/navigation$": "<rootDir>/__mocks__/next/navigation.ts",
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
};

export default config;
