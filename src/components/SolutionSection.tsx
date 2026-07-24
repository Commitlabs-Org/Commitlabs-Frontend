import React from 'react';
import styles from './SolutionSection.module.css';

export default function SolutionSection() {
  return (
    <section className={styles.solutionSection}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.badge}>THE SOLUTION</span>
          <h2 className={styles.title}>
            Composable Liquidity
            <br />
            <span className={styles.titleAccent}>Commitments Network</span>
          </h2>
          <p className={styles.description}>
            A new DeFi primitive that enforces liquidity behavior cryptographically, making capital
            predictable, composable, and verifiable.
          </p>
        </div>

        {/* Central Diagram */}
        <div className={styles.diagramContainer}>
          {/* Glow Effect Background */}
          <div className={styles.glowBackground}></div>

          {/* Connection Lines */}
          <svg
            className={styles.connections}
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(20, 184, 166, 0)" />
                <stop offset="50%" stopColor="rgba(20, 184, 166, 0.8)" />
                <stop offset="100%" stopColor="rgba(20, 184, 166, 0)" />
              </linearGradient>
            </defs>

            {/* Top Left to Center */}
            <path
              className={styles.connectionLine}
              d="M 150 80 Q 250 120, 350 180"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              fill="none"
            />

            {/* Top Right to Center */}
            <path
              className={styles.connectionLine}
              d="M 650 80 Q 550 120, 450 180"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              fill="none"
            />

            {/* Bottom Left to Center */}
            <path
              className={styles.connectionLine}
              d="M 150 320 Q 250 280, 350 220"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              fill="none"
            />

            {/* Bottom Right to Center */}
            <path
              className={styles.connectionLine}
              d="M 650 320 Q 550 280, 450 220"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              fill="none"
            />
          </svg>

          <div className={styles.topBar}></div>

          {/* Central 3D Block */}
          <div className={styles.centralBlock}>
            <div className={styles.blockFront}></div>
            <div className={styles.blockTop}></div>
            <div className={styles.blockRight}></div>
          </div>

          {/* Labels */}
          <div className={`${styles.label} ${styles.labelTopLeft}`}>
            <span>Duration Lock</span>
          </div>
          <div className={`${styles.label} ${styles.labelTopRight}`}>
            <span>Risk Bounds</span>
          </div>
          <div className={`${styles.label} ${styles.labelBottomLeft}`}>
            <span>Exit Rules</span>
          </div>
          <div className={`${styles.label} ${styles.labelBottomRight}`}>
            <span>Attestations</span>
          </div>
        </div>

        {/* Feature Cards */}
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureDot}></div>
            <h3 className={styles.featureTitle}>Cryptographic Enforcement</h3>
            <p className={styles.featureDescription}>
              Smart contracts enforce commitment rules automatically, eliminating reliance on trust
              or incentives.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureDot}></div>
            <h3 className={styles.featureTitle}>NFT-Based Commitments</h3>
            <p className={styles.featureDescription}>
              Each commitment becomes a transferable, composable NFT with full on-chain history.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureDot}></div>
            <h3 className={styles.featureTitle}>Continuous Attestations</h3>
            <p className={styles.featureDescription}>
              Real-time verification of commitment health, creating an immutable reliability record.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureDot}></div>
            <h3 className={styles.featureTitle}>Infinite Composability</h3>
            <p className={styles.featureDescription}>
              Transform commitments into tranches, collateral, or protocol-specific guarantees
              without withdrawal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
