import { createFileRoute } from '@tanstack/react-router';
import Orders from '@/femini/pages/Orders';

export const Route = createFileRoute('/orders')({
  head: () => ({
    meta: [
      { title: 'الأوردرات · Fémini Stock' },
      { name: 'description', content: 'كل أوردرات البيك أب مع حالة الشحن والأوردرات المتوقفة.' },
      { property: 'og:title', content: 'الأوردرات · Fémini Stock' },
      { property: 'og:description', content: 'كل أوردرات البيك أب مع حالة الشحن والأوردرات المتوقفة.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Orders,
});
