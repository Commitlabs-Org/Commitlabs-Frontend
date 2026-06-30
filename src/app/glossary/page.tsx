'use client';

import { useState, useMemo } from 'react';
import { glossary } from '@/lib/glossary';

export default function GlossaryPage() {
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(glossary)
      .filter((entry) =>
        !q ||
        entry.term.toLowerCase().includes(q) ||
        entry.definition.toLowerCase().includes(q),
      )
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [query]);

  return (
    <main>
      <h1>Glossary</h1>

      <label htmlFor="glossary-search" style={{ display: 'block', marginBottom: '0.5rem' }}>
        Search terms
      </label>
      <input
        aria-controls="glossary-list"
        aria-label="Search glossary"
        id="glossary-search"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. drawdown"
        type="search"
        value={query}
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.75rem', width: '100%', maxWidth: '28rem' }}
      />

      {entries.length === 0 ? (
        <p aria-live="polite">No terms match &ldquo;{query}&rdquo;.</p>
      ) : (
        <dl id="glossary-list" aria-live="polite">
          {entries.map((entry) => (
            <div key={entry.term} style={{ marginBottom: '1.25rem' }}>
              <dt style={{ fontWeight: 600 }}>{entry.term}</dt>
              <dd style={{ margin: '0.25rem 0 0 1rem', color: 'var(--muted)' }}>
                {entry.definition}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
