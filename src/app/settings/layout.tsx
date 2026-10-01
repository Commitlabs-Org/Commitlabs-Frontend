import { ProtectedRouteLayout } from '../../../components/auth/ProtectedRouteLayout';

export const metadata = {
  title: 'Settings | Commitlabs',
  description: 'Manage your Commitlabs settings',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>;
}
