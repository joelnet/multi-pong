import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  {
    ignores: [
      'node_modules/**',
      'docs/**',
      '.vscode/**',
      'assets/**',
      'public/**',
      'src/old/**',
      'src/lib/unused.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        MutationObserver: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        alert: 'readonly',
        performance: 'readonly',
        RTCPeerConnection: 'readonly',
        RTCSessionDescription: 'readonly',
        RTCIceCandidate: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: prettier.plugins.prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(e|error)$',
        },
      ],
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ['**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        it: 'readonly',
        describe: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
];
