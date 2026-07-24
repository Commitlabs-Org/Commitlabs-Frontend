import { useEffect, useState, KeyboardEvent } from 'react';
import ComparisonPanel from '../ComparisonPanel';
import styles from './RiskProfileComparison.module.css';

interface RiskProfile {
  id: string;
  name: string;
  description: string;
  maxLossBps: number; // basis points
}

interface SupportedConfig {
  riskProfiles: RiskProfile[];
}

interface Props {
  selectedType: 'safe' | 'balanced' | 'aggressive' | null;
  onSelectType: (type: 'safe' | 'balanced' | 'aggressive') => void;
}

// Map config IDs to wizard commitment IDs
const ID_MAP: Record<string, 'safe' | 'balanced' | 'aggressive'> = {
  conservative: 'safe',
  balanced: 'balanced',
  aggressive: 'aggressive',
};

export default function RiskProfileComparison({ selectedType, onSelectType }: Props) {
  const [profiles, setProfiles] = useState<RiskProfile[]>([]);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  useEffect(() => {
    fetch('/api/config/supported')
      .then((res) => res.json())
      .then((data: SupportedConfig) => setProfiles(data.riskProfiles))
      .catch(() => setProfiles([]));
  }, []);

  const buildItems = (profile: RiskProfile) => [
    `Yield: ${profile.name}`,
    `Penalty Exposure: ${profile.maxLossBps / 100}% loss`,
    `Lock Duration: ${profile.id === 'conservative' ? '30d' : profile.id === 'balanced' ? '60d' : '90d'}`,
  ];

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, idx: number) => {
    if (e.key === 'ArrowRight') {
      const next = (idx + 1) % profiles.length;
      setFocusedIdx(next);
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = (idx - 1 + profiles.length) % profiles.length;
      setFocusedIdx(prev);
      (e.currentTarget.parentElement?.children[prev] as HTMLElement)?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const profile = profiles[idx];
      const type = profile ? ID_MAP[profile.id] : undefined;
      if (type) onSelectType(type);
    }
  };

  return (
    <div className={styles.container} role="radiogroup" aria-label="Risk profile selection">
      <div aria-live="polite" className={styles.srOnly}>
        {selectedType ? `Selected ${selectedType} profile` : 'No profile selected'}
      </div>
      {profiles.map((profile, idx) => {
        const type = ID_MAP[profile.id];
        const isSelected = selectedType === type;
        return (
          <div
            key={profile.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            className={`${styles.column} ${isSelected ? styles.selected : ''}`}
            onClick={() => type && onSelectType(type)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <ComparisonPanel
              title={profile.name}
              items={buildItems(profile)}
              variant={isSelected ? 'positive' : 'negative'}
            />
          </div>
        );
      })}
    </div>
  );
}
