import { AppShell } from '@/components/bertos/shell/AppShell'

export default function BertOSLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
