/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-body':        '#9898b8',
            '--tw-prose-headings':    '#f0f0fa',
            '--tw-prose-links':       'oklch(65% 0.28 268)',
            '--tw-prose-bold':        '#f0f0fa',
            '--tw-prose-counters':    '#55557a',
            '--tw-prose-bullets':     '#2d2d50',
            '--tw-prose-hr':          '#1e1e35',
            '--tw-prose-quotes':      '#9898b8',
            '--tw-prose-quote-borders': 'oklch(65% 0.28 268)',
            '--tw-prose-captions':    '#55557a',
            '--tw-prose-code':        'oklch(68% 0.2 155)',
            '--tw-prose-pre-code':    '#c8c8e8',
            '--tw-prose-pre-bg':      '#0a0a14',
            '--tw-prose-th-borders':  '#2d2d50',
            '--tw-prose-td-borders':  '#1e1e35',
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
