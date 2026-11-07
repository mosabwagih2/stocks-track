import { createFileRoute } from '@tanstack/react-router';
import Operations from '@/femini/pages/Operations';

export const Route = createFileRoute('/operations')({
  head: () => ({
    meta: [
      { title: 'العمليات · Fémini Stock' },
      { name: 'description', content: 'استلام توريد، تغيير حالة، مرتجعات وجرد في دفتر حركات ثابت.' },
      { property: 'og:title', content: 'العمليات · Fémini Stock' },
      { property: 'og:description', content: 'استلام توريد، تغيير حالة، مرتجعات وجرد في دفتر حركات ثابت.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Operations,
});
