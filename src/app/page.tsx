import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main id="main-content" className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>CommitLabs</h1>
          <p className={styles.subtitle}>
            Liquidity as a commitment, not a guess.
          </p>
        </header>

        <nav className={styles.nav}>
          <Link href="/create" className={styles.navLink}>
            Create Commitment
          </Link>
          <Link href="/commitments" className={styles.navLink}>
            My Commitments
          </Link>
          <Link href="/marketplace" className={styles.navLink}>
            Marketplace
          </Link>
        </nav>

        <section className={styles.hero}>
          <h2>Transform Passive Liquidity</h2>
          <p>
            Define explicit rules for how your liquidity behaves — including
            duration, risk tolerance, and exit conditions — and the protocol
            enforces those rules cryptographically.
          </p>
        </section>

        <section className={styles.features}>
          <div className={styles.featureCard}>
            <h3>Commitment NFTs</h3>
            <p>
              Each commitment is minted as an NFT representing locked capital,
              commitment parameters, and historical performance.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3>On-Chain Attestations</h3>
            <p>
              Continuous verification of commitment health: volatility exposure,
              fee generation, drawdown events, and rule compliance.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3>Composable & Reusable</h3>
            <p>
              Commitments can be transformed into risk tranches, collateralized
              assets, and protocol-specific liquidity guarantees.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

