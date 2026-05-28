import { defineConfig, presetTypography } from 'unocss';
import { presetWind } from 'unocss';

export default defineConfig({
  theme: {
    colors: {
      primary: '#22D3EE',
      ink: '#020617',
      panel: '#0F172A',
      violet: '#8B5CF6',
      lime: '#A3E635',
    },
  },
  shortcuts: {
    'btn': 'px-4 py-2 rounded-xl font-semibold transition-colors',
    'btn-primary': 'px-4 py-2 rounded-xl font-semibold transition-colors bg-cyan-400 text-slate-950 hover:bg-cyan-300',
    'card': 'border border-white/10 bg-slate-950/70 rounded-2xl p-5 shadow-xl shadow-slate-950/20',
    'link': 'text-cyan-300 hover:text-cyan-200 hover:underline underline-offset-4',
  },
  presets: [
    presetWind(),
    presetTypography(),
  ],
});
