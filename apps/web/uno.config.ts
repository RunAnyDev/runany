import { defineConfig, presetTypography, presetWebFonts } from 'unocss';
import { presetWind } from 'unocss';

export default defineConfig({
  theme: {
    colors: {
      primary: '#3B82F6',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
  },
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors',
    'btn-primary': 'px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-white hover:bg-blue-600',
    'card': 'border border-gray-200 dark:border-gray-700 rounded-xl p-4',
    'link': 'text-blue-500 hover:underline',
  },
  presets: [
    presetWind(),
    presetTypography(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'JetBrains Mono:400,500',
      },
    }),
  ],
});