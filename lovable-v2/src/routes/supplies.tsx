import { createFileRoute, redirect } from '@tanstack/react-router';

// Supplies now live inside the stock page
export const Route = createFileRoute('/supplies')({
  beforeLoad: () => { throw redirect({ to: '/stock', search: { view: 'supplies' } as never }); },
});
