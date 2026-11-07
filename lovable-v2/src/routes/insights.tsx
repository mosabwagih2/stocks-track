import { createFileRoute } from '@tanstack/react-router';
import Insights from '@/femini/pages/Insights';

export const Route = createFileRoute('/insights')({
  head: () => ({
    meta: [
      { title: 'التحليلات · Fémini Stock' },
      { name: 'description', content: 'تحليل باريتو، خريطة الطلب، مخاطر المخزون وأداء الفريق.' },
      { property: 'og:title', content: 'التحليلات · Fémini Stock' },
      { property: 'og:description', content: 'تحليل باريتو، خريطة الطلب، مخاطر المخزون وأداء الفريق.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Insights,
});
