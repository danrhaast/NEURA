/* ESLint 9 (flat config). O eslint-config-next ainda é publicado no formato
   antigo (.eslintrc), então passa pelo FlatCompat. */

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'data/**', 'public/**'],
  },
  ...compat.extends('next/core-web-vitals'),
];

export default config;
