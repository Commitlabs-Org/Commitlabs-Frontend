import { DocsContent } from './DocsContent';
import { DocsErrorsTable, DocsPauseTable } from './DocsErrorsTable';
import { DocsErrorsTable, DocsPauseTable } from './DocsErrorsTable';

export const metadata = { title: 'Docs - CommitLabs' };

  ['errors', 'Error codes'],
  ['pause', 'Pause behaviour'],
  ['errors', 'Error codes'],
  ['pause', 'Pause behaviour'],
export default function DocsPage() {
        <p className="muted">
          The <Link href="/protocol">Protocol health</Link> page shows the live pause state, the yield
          pool&apos;s balance, reserved and available amounts, and a 7/30/90-day forecast of whether the
          available yield covers funded commitments.
        <h2 id="errors">Error codes</h2>
        <DocsErrorsTable />

        <h2 id="pause">Pause behaviour</h2>
        <p>These actions remain available or become blocked when the escrow contract is paused.</p>
        <DocsPauseTable />


        <h2 id="errors">Error codes</h2>
        <DocsErrorsTable />

        <h2 id="pause">Pause behaviour</h2>
        <p>These actions remain available or become blocked when the escrow contract is paused.</p>
        <DocsPauseTable />
        </p>
  return <DocsContent />;
}
