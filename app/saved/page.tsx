import { redirect } from 'next/navigation';

// Saved looks now live on the profile under the "Saved" tab.
export default function SavedRedirect() {
  redirect('/profile');
}
