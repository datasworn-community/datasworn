import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.generated/**',
      'dist/**',
      'node_modules/**',
      'packages/build-tools/schema-source/**',
      'packages/core/migration/**/*.d.ts',
      'packages/*/dist/**',
      '**/*.tsbuildinfo'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['packages/build-tools/src/**/*.ts'],
    ignores: [
      'packages/build-tools/src/node/**',
      'packages/build-tools/src/cli/**'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'The build-tools root entry must stay bundler-safe. Put filesystem code in src/node/ and export it from the "./node" subpath.'
            },
            {
              group: ['./node/*', '../node/*'],
              message:
                'src/node/ reaches Node builtins, so importing it from the root graph would break browser and worker bundles. Consumers import it as "@datasworn-community/build-tools/node".'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['.github/actions/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly'
      }
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports'
        }
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/unified-signatures': 'off',
      'preserve-caught-error': 'off'
    }
  }
)
