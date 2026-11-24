import { CONTRACT_ERRORS } from '@/lib/soroban/errors';
import { ACTION_POLICIES } from '@/lib/soroban/protocol-policy';

export function DocsErrorsTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Meaning</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(CONTRACT_ERRORS).map((error) => (
            <tr key={error.code}>
              <td>
                <code>{error.code}</code>
              </td>
              <td>
                <code>{error.name}</code>
              </td>
              <td>{error.message}</td>
              <td>{error.hint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocsPauseTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Blocked when paused</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(ACTION_POLICIES).map((policy) => (
            <tr key={policy.action}>
              <td>
                <code>{policy.action}</code>
              </td>
              <td>{policy.pausedBlocked ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
