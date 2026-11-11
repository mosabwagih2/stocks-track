import { createFileRoute } from '@tanstack/react-router';
import Ledger from '@/femini/pages/Ledger';

export const Route = createFileRoute('/ledger')({
  head: () => ({
    meta: [
      { title: 'السجل · Fémini Stock' },
      { name: 'description', content: 'سجل الحركات الثابت لكل قطعة دخلت أو خرجت.' },
      { property: 'og:title', content: 'السجل · Fémini Stock' },
      { property: 'og:description', content: 'سجل الحركات الثابت لكل قطعة دخلت أو خرجت.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Ledger,
});
