import { ProtectedRouteLayout } from '../../../components/auth/ProtectedRouteLayout';

export const metadata = {
  title: 'Commitments | Commitlabs',
  description: 'View your commitments on Commitlabs',
};

export default function CommitmentsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>;
}
