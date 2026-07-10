const js = require('@eslint/js');
const globals = require('globals');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  {
    ignores: ['coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.jest,
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      'consistent-return': 'off',
      'func-names': 'off',
      'no-console': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-underscore-dangle': 'off',
    },
  },
];
