import { createFileRoute } from '@tanstack/react-router';
import Stock from '@/femini/pages/Stock';

export const Route = createFileRoute('/stock')({
  head: () => ({
    meta: [
      { title: 'المخزون · Fémini Stock' },
      { name: 'description', content: 'مصفوفة المخزون لكل موديل ولون ومقاس عبر الحالات الخمس.' },
      { property: 'og:title', content: 'المخزون · Fémini Stock' },
      { property: 'og:description', content: 'مصفوفة المخزون لكل موديل ولون ومقاس عبر الحالات الخمس.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Stock,
});
