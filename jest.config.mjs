export default {
  transform: {
    '^.+\\.tsx?$': 
      ['ts-jest', {
        // ts-jest config
      }]
  },
  preset: 'ts-jest/presets/default-esm', // Use the ESM preset
  globals: {
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1', // Redirect .js imports to .ts files
  },
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node'
};
