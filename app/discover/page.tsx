import { redirect } from 'next/navigation';

// Discover merged into the Community feed.
export default function DiscoverRedirect() {
  redirect('/community');
}
