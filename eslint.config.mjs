import globals from 'globals'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      '.husky/**',
      '.vercel/**',
      'coverage/**',
      'dist/**',
      'docs/reference/**',
      'node_modules/**',
      'app/questions.json',
      'app/public/sw.js',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      complexity: ['warn', 12],
      'max-lines': [
        'warn',
        {
          max: 450,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: ['property', 'objectLiteralProperty'],
          format: null,
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      complexity: 'off',
      'max-lines': 'off',
    },
  },
  eslintConfigPrettier,
)
