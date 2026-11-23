import { DocsContent } from './DocsContent';

export const metadata = { title: 'Docs - CommitLabs' };

export default function DocsPage() {
        <p className="muted">
          The <Link href="/protocol">Protocol health</Link> page shows the live pause state, the yield
          pool&apos;s balance, reserved and available amounts, and a 7/30/90-day forecast of whether the
          available yield covers funded commitments.
        </p>
  return <DocsContent />;
}
