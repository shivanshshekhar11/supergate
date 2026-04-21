import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Supergate',
      url:   '/docs',
    },
    links: [
      {
        text: 'Documentation',
        url:  '/docs',
        active: 'nested-url',
      },
      {
        text: 'SDK',
        url:  '/docs/sdk',
        active: 'nested-url',
      },
      {
        text: 'GitHub',
        url:  'https://github.com/shivanshshekhar11/supergate',
        external: true,
      },
    ],
  }
}
