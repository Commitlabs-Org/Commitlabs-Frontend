"use client";
import styles from "./page.module.css";

export default function AboutUsPage() {
  return (
    <main className={styles.mainContainer}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.headerContent}>
          <h1 className={styles.pageTitle}>About CommitLabs</h1>
          <p className={styles.pageSubtitle}>
            Empowering commitment through blockchain transparency
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Project Overview Section */}
        <section className={styles.overviewSection}>
          <h2 className={styles.sectionTitle}>Project Overview</h2>

          {/* Mission Statement */}
          <div className={styles.missionBox}>
            <h3 className={styles.missionTitle}>Our Mission</h3>
            <p className={styles.missionText}>
              CommitLabs leverages blockchain technology to create verifiable,
              transparent commitments. We empower users to make meaningful
              pledges and track their progress on the immutable ledger of
              Soroban, fostering accountability and trust in a decentralized
              ecosystem.
            </p>
          </div>

          {/* Key Features */}
          <div className={styles.featureSection}>
            <h3 className={styles.subsectionTitle}>Key Features</h3>
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🔐</span>
                <h4 className={styles.featureCardTitle}>
                  Blockchain Verification
                </h4>
                <p className={styles.featureCardDescription}>
                  All commitments are recorded on the Soroban blockchain for
                  immutable proof of intent.
                </p>
              </div>

              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>📊</span>
                <h4 className={styles.featureCardTitle}>Progress Tracking</h4>
                <p className={styles.featureCardDescription}>
                  Monitor your commitment progress with real-time updates and
                  milestone tracking.
                </p>
              </div>

              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🎖️</span>
                <h4 className={styles.featureCardTitle}>NFT Attestation</h4>
                <p className={styles.featureCardDescription}>
                  Earn NFT badges as proof of completed commitments and
                  participation.
                </p>
              </div>

              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🤝</span>
                <h4 className={styles.featureCardTitle}>Community Driven</h4>
                <p className={styles.featureCardDescription}>
                  Connect with others, share commitments, and build trust
                  through transparent collaboration.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className={styles.howItWorksBox}>
            <h3 className={styles.subsectionTitle}>How It Works</h3>
            <div className={styles.howItWorksSteps}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h4>Create a Commitment</h4>
                  <p>
                    Define your commitment with clear goals, deadlines, and
                    parameters.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h4>Record on Blockchain</h4>
                  <p>
                    Your commitment is immutably recorded on the Soroban
                    blockchain for transparency.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h4>Track Progress</h4>
                  <p>
                    Submit attestations and milestones to track your progress
                    toward completion.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <div className={styles.stepContent}>
                  <h4>Earn Attestations</h4>
                  <p>
                    Complete your commitment and receive an NFT badge as proof
                    of achievement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Documentation Section */}
        <section className={styles.documentationSection}>
          <h2 className={styles.sectionTitle}>Documentation</h2>
          <div className={styles.documentationGrid}>
            <a href="#" className={styles.documentationCard}>
              <div className={styles.docIcon}>📖</div>
              <h3 className={styles.docCardTitle}>Getting Started Guide</h3>
              <p className={styles.docCardDescription}>
                Step-by-step instructions to set up your account, connect your
                wallet, and create your first commitment.
              </p>
              <span className={styles.docLink}>Read Guide →</span>
            </a>

            <a href="#" className={styles.documentationCard}>
              <div className={styles.docIcon}>🔌</div>
              <h3 className={styles.docCardTitle}>API Documentation</h3>
              <p className={styles.docCardDescription}>
                Complete API reference for integrating CommitLabs into your
                applications with examples and code snippets.
              </p>
              <span className={styles.docLink}>View API Docs →</span>
            </a>

            <a href="#" className={styles.documentationCard}>
              <div className={styles.docIcon}>📝</div>
              <h3 className={styles.docCardTitle}>Contract Documentation</h3>
              <p className={styles.docCardDescription}>
                Detailed documentation of our Soroban smart contracts, including
                function signatures and contract interactions.
              </p>
              <span className={styles.docLink}>View Contracts →</span>
            </a>

            <a href="#" className={styles.documentationCard}>
              <div className={styles.docIcon}>🔗</div>
              <h3 className={styles.docCardTitle}>Integration Guides</h3>
              <p className={styles.docCardDescription}>
                Learn how to integrate CommitLabs into your platform with
                detailed examples for common use cases.
              </p>
              <span className={styles.docLink}>View Guides →</span>
            </a>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                What is a liquidity commitment?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                A liquidity commitment is a pledge to provide or maintain a
                certain amount of liquidity in a protocol or trading pair for a
                specified duration. It locks funds to support network stability
                and is recorded immutably on the blockchain.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                How do Commitment NFTs work?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                When you complete a commitment, you receive a unique NFT badge
                minted on Soroban that proves your achievement. This NFT is
                verifiable on-chain, can be displayed in your wallet, and serves
                as a permanent record of your commitment completion.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                What are attestations?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Attestations are verifiable claims or proofs submitted on-chain
                to demonstrate progress toward a commitment. They update the
                commitment's state and can be from you, validators, or other
                authorized entities depending on the commitment type.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                How do I create a commitment?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Navigate to the Create page, fill in commitment details (title,
                description, deadline, type), set success criteria, and submit.
                Your commitment is then recorded on the Soroban blockchain and
                becomes publicly verifiable.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                What happens if my commitment is violated?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Violations are marked on-chain as permanent records. Depending
                on your commitment rules, penalties may apply (such as loss of
                collateral or reputation score). Your violation history is
                visible to the community, affecting trust metrics.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                Can I exit early?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Early exit policies depend on commitment settings. Some
                commitments allow early termination with penalties, while others
                are locked. You can configure exit conditions when creating a
                commitment.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                How are fees calculated?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Fees consist of network transaction costs (based on Soroban gas
                prices) and optional platform fees. Initial commitment creation
                has a small fee, with potential additional fees for attestations
                and NFT minting on completion.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                Is CommitLabs open source?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Yes! CommitLabs is built on open-source principles. Check out
                our GitHub repository to contribute, report issues, review the
                code, and submit pull requests.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                Can I dispute a commitment decision?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                Yes, CommitLabs has a dispute resolution process. You can submit
                evidence and appeals through the platform. Disputes are reviewed
                by validators or the community depending on commitment terms.
              </p>
            </details>

            <details className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                How do I track my commitment progress?
                <span className={styles.faqToggle}>+</span>
              </summary>
              <p className={styles.faqContent}>
                You can view all your commitments in your dashboard with
                real-time progress tracking, milestone status, attestation
                history, and upcoming deadlines. The blockchain provides a
                permanent audit trail of all activity.
              </p>
            </details>
          </div>
        </section>

        {/* Help Resources Section */}
        <section className={styles.resourcesSection}>
          <h2 className={styles.sectionTitle}>Resources</h2>
          <div className={styles.resourcesGrid}>
            <a href="#" className={styles.resourceCard}>
              <h3 className={styles.resourceCardTitle}>🔗 GitHub Repository</h3>
              <p className={styles.resourceCardDescription}>
                Access our open-source code, contribute to the project, and
                report issues.
              </p>
            </a>

            <a href="#" className={styles.resourceCard}>
              <h3 className={styles.resourceCardTitle}>
                📚 Documentation Site
              </h3>
              <p className={styles.resourceCardDescription}>
                Comprehensive documentation and API references for developers
                and users.
              </p>
            </a>

            <a href="#" className={styles.resourceCard}>
              <h3 className={styles.resourceCardTitle}>💬 Community Forum</h3>
              <p className={styles.resourceCardDescription}>
                Join our community to discuss ideas, ask questions, and share
                experiences.
              </p>
            </a>

            <a href="#" className={styles.resourceCard}>
              <h3 className={styles.resourceCardTitle}>📰 Blog & Updates</h3>
              <p className={styles.resourceCardDescription}>
                Read the latest news, updates, and insights from the CommitLabs
                team.
              </p>
            </a>
          </div>
        </section>

        {/* Team & Contact Section */}
        <section className={styles.teamSection}>
          <h2 className={styles.sectionTitle}>Get in Touch</h2>
          <div className={styles.contactGrid}>
            <div className={styles.contactCard}>
              <h3 className={styles.contactCardTitle}>📧 Support Email</h3>
              <p className={styles.contactCardText}>
                Have questions? Reach out to our support team for help.
              </p>
              <a
                href="mailto:support@commitlabs.io"
                className={styles.contactLink}
              >
                support@commitlabs.io
              </a>
            </div>

            <div className={styles.contactCard}>
              <h3 className={styles.contactCardTitle}>🤝 Partnership</h3>
              <p className={styles.contactCardText}>
                Interested in partnering with CommitLabs? Let's talk.
              </p>
              <a
                href="mailto:partners@commitlabs.io"
                className={styles.contactLink}
              >
                partners@commitlabs.io
              </a>
            </div>

            <div className={styles.contactCard}>
              <h3 className={styles.contactCardTitle}>📱 Social Media</h3>
              <p className={styles.contactCardText}>
                Follow us on social platforms for updates and community content.
              </p>
              <div className={styles.socialLinks}>
                <a href="#" className={styles.socialLink}>
                  Twitter
                </a>
                <a href="#" className={styles.socialLink}>
                  Discord
                </a>
                <a href="#" className={styles.socialLink}>
                  Telegram
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Legal Section */}
        <section className={styles.legalSection}>
          <h2 className={styles.sectionTitle}>Legal</h2>
          <div className={styles.legalGrid}>
            <a href="#" className={styles.legalCard}>
              <h3 className={styles.legalCardTitle}>📋 Terms of Service</h3>
              <p className={styles.legalCardDescription}>
                Read our terms and conditions for using CommitLabs.
              </p>
            </a>

            <a href="#" className={styles.legalCard}>
              <h3 className={styles.legalCardTitle}>🔐 Privacy Policy</h3>
              <p className={styles.legalCardDescription}>
                Learn how we collect, use, and protect your personal data.
              </p>
            </a>

            <a href="#" className={styles.legalCard}>
              <h3 className={styles.legalCardTitle}>⚖️ License</h3>
              <p className={styles.legalCardDescription}>
                View our open-source license and usage rights.
              </p>
            </a>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <h3 className={styles.ctaTitle}>Ready to Make a Commitment?</h3>
          <p className={styles.ctaDescription}>
            Start creating your first commitment today and join our community.
          </p>
          <a href="/create" className={styles.ctaButton}>
            Create Your First Commitment
          </a>
        </section>
      </div>
    </main>
  );
}
