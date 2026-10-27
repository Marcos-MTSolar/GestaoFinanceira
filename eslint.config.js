import reactHooks from 'eslint-plugin-react-hooks';
import babelParser from '@babel/eslint-parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            '@babel/preset-react',
            '@babel/preset-typescript',
          ],
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': {
        rules: {
          'no-explicit-any': { create: () => ({}) },
        },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
];
