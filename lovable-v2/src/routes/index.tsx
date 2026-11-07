import { createFileRoute } from '@tanstack/react-router';
import Today from '@/femini/pages/Today';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'اليوم · Fémini Stock' },
      { name: 'description', content: 'لوحة اليوم: الطلب الوارد، ما تم شحنه، الأوردرات المتوقفة وحالة المخزون.' },
      { property: 'og:title', content: 'اليوم · Fémini Stock' },
      { property: 'og:description', content: 'لوحة اليوم: الطلب الوارد، ما تم شحنه، الأوردرات المتوقفة وحالة المخزون.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Today,
});
