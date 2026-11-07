import { createFileRoute } from '@tanstack/react-router';
import Settings from '@/femini/pages/Settings';

export const Route = createFileRoute('/settings')({
  head: () => ({
    meta: [
      { title: 'الإعدادات · Fémini Stock' },
      { name: 'description', content: 'النسخ الاحتياطي والاسترجاع وسلامة بيانات المخزون.' },
      { property: 'og:title', content: 'الإعدادات · Fémini Stock' },
      { property: 'og:description', content: 'النسخ الاحتياطي والاسترجاع وسلامة بيانات المخزون.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Settings,
});
