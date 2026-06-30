import React from 'react';
import styles from './CommitmentJourney.module.css';

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 6H23V12" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FlameIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 14.5C8.5 14.5 10.5 12.5 10.5 10.5C10.5 8.5 8.5 6.5 8.5 6.5C8.5 6.5 6.5 8.5 6.5 10.5C6.5 12.5 8.5 14.5 8.5 14.5Z" fill="#F59E0B"/>
    <path d="M12 2C12 2 12 6 9 8C6 10 5 13.5 6 16C7 18.5 9 22 12 22C15 22 18 19 18 16C18 13.5 17.5 10 15 8C12 6 12 2 12 2Z" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CommitmentJourney: React.FC = () => {
  return (
    <section className={styles.journeySection}>
      <div className={styles.badge}>USER JOURNEY</div>
      <h2 className={styles.mainHeader}>Alice&apos;s Commitment Journey</h2>
      <p className={styles.subtitle}>
        See how Alice deploys $100,000 with predictable behavior and full control
      </p>

      <div className={styles.journeyContainer}>
        {/* Step 1 */}
        <div className={styles.stepRow}>
          <div className={styles.stepIndicator}>1</div>
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose Your Commitment Type</h2>
            
            <div className={styles.cardsGrid}>
              {/* Safe Commitment */}
              <div className={styles.card}>
                <div className={styles.iconWrapper}>
                  <ShieldIcon />
                </div>
                <h3 className={styles.cardTitle}>Safe Commitment</h3>
                <div className={styles.cardStats}>
                  <div className={styles.statRow}>
                    <span>Duration</span>
                    <span className={styles.statValue}>30 days</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Max Loss</span>
                    <span className={styles.statValue}>2%</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Allocation</span>
                    <span className={styles.statValue}>Conservative</span>
                  </div>
                  <div className={styles.divider} />
                  <div className={styles.statRow}>
                    <span className={styles.yieldLabel}>Yield</span>
                    <span className={`${styles.yieldValue} ${styles.safeYield}`}>Lower but stable</span>
                  </div>
                </div>
              </div>

              {/* Balanced Commitment */}
              <div className={styles.card}>
                <div className={styles.iconWrapper}>
                  <ChartIcon />
                </div>
                <h3 className={styles.cardTitle}>Balanced Commitment</h3>
                <div className={styles.cardStats}>
                  <div className={styles.statRow}>
                    <span>Duration</span>
                    <span className={styles.statValue}>60 days</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Max Loss</span>
                    <span className={styles.statValue}>8%</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Allocation</span>
                    <span className={styles.statValue}>Adaptive</span>
                  </div>
                  <div className={styles.divider} />
                  <div className={styles.statRow}>
                    <span className={styles.yieldLabel}>Yield</span>
                    <span className={`${styles.yieldValue} ${styles.balancedYield}`}>Medium yield</span>
                  </div>
                </div>
              </div>

              {/* Aggressive Commitment */}
              <div className={styles.card}>
                <div className={styles.iconWrapper}>
                  <FlameIcon />
                </div>
                <h3 className={styles.cardTitle}>Aggressive Commitment</h3>
                <div className={styles.cardStats}>
                  <div className={styles.statRow}>
                    <span>Duration</span>
                    <span className={styles.statValue}>90 days</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Max Loss</span>
                    <span className={styles.statValue}>No protection</span>
                  </div>
                  <div className={styles.statRow}>
                    <span>Allocation</span>
                    <span className={styles.statValue}>Highest yield potential</span>
                  </div>
                  <div className={styles.divider} />
                  <div className={styles.statRow}>
                    <span className={styles.yieldLabel}>Yield</span>
                    <span className={`${styles.yieldValue} ${styles.aggressiveYield}`}>Maximum returns</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className={styles.stepRow}>
          <div className={styles.stepIndicator}>2</div>
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Receive Commitment NFT</h2>
            <p className={styles.stepDescription}>
              Alice receives a unique Commitment NFT that represents her locked capital. The protocol allocates her funds dynamically within her defined rules, and commitment health is continuously attested on-chain.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className={styles.stepRow}>
          <div className={styles.stepIndicator}>3</div>
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Reuse as Collateral</h2>
            <p className={styles.stepDescription}>
              The Commitment NFT can be reused as collateral or liquidity proof across other DeFi protocols, all while the original commitment remains active and enforced.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className={styles.stepRow}>
          <div className={styles.stepIndicator}>4</div>
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Automatic Settlement</h2>
            <p className={styles.stepDescription}>
              At maturity, funds are settled automatically and the NFT is archived on-chain as a permanent reliability record, building Alice&apos;s commitment history.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommitmentJourney;
