import { ProtectedRouteLayout } from '../../../components/auth/ProtectedRouteLayout';

export const metadata = {
  title: 'Create Commitment | Commitlabs',
  description: 'Create a new commitment on Commitlabs',
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>;
}
