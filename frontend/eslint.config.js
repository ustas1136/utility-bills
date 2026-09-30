import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Правило React 19 ругается на осознанный паттерн: сброс состояния формы
      // в effect при закрытии диалога. Паттерн рабочий, поэтому понижаем до warn.
      'react-hooks/set-state-in-effect': 'warn',
      // Подчёркивание — общепринятый маркер «аргумент намеренно не используется»
      // (например заглушка cancelInvitation, которой важен только тип переменной).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // shadcn/ui экспортирует вместе с компонентами варианты (cva) и хуки,
    // а router.tsx — сам конфиг роутера. Для fast refresh это не проблема,
    // поэтому правило отключаем точечно, а не глобально.
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/router.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
