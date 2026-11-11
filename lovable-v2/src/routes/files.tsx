import { createFileRoute } from '@tanstack/react-router';
import Files from '@/femini/pages/Files';

export const Route = createFileRoute('/files')({
  head: () => ({
    meta: [
      { title: 'الملفات · Fémini Stock' },
      { name: 'description', content: 'ملفات البيك أب والإسكان والأوردرات الملغاة.' },
      { property: 'og:title', content: 'الملفات · Fémini Stock' },
      { property: 'og:description', content: 'ملفات البيك أب والإسكان والأوردرات الملغاة.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Files,
});
