import Link from 'next/link'
import styles from './MarketplaceCard.module.css'

export type CommitmentType = 'Safe' | 'Balanced' | 'Aggressive'

export interface MarketplaceCardProps {
  id: string
  type: CommitmentType
  score: number
  amount: string
  duration: string
  yield: string
  maxLoss: string
  owner: string
  price: string
  forSale: boolean
  viewHref?: string
  tradeHref?: string
}

function clampScore(score: number) {
  if (Number.isNaN(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 90) return 'high'
  if (score >= 80) return 'mid'
  return 'low'
}

function truncateAddress(addr: string) {
  const s = addr?.trim() ?? ''
  if (s.length <= 12) return s
  return `${s.slice(0, 6)}...${s.slice(-4)}`
}

function TypeIcon({ type }: { type: CommitmentType }) {
  // Minimal inline SVGs so we don’t pull in any icon deps.
  if (type === 'Safe') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={styles.icon}>
        <path d="M23.3292 15.164C23.3292 20.9962 19.2466 23.9124 14.3942 25.6037C14.1401 25.6898 13.8641 25.6857 13.6127 25.5921C8.74859 23.9124 4.66602 20.9962 4.66602 15.164V6.99884C4.66602 6.68948 4.78891 6.39279 5.00766 6.17404C5.22641 5.95529 5.5231 5.83239 5.83247 5.83239C8.16536 5.83239 11.0815 4.43265 13.1111 2.65965C13.3582 2.44852 13.6726 2.33252 13.9976 2.33252C14.3226 2.33252 14.637 2.44852 14.8841 2.65965C16.9254 4.44432 19.8299 5.83239 22.1628 5.83239C22.4721 5.83239 22.7688 5.95529 22.9876 6.17404C23.2063 6.39279 23.3292 6.68948 23.3292 6.99884V15.164Z" stroke="#05DF72" stroke-width="2.3329" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    )
  }

  if (type === 'Balanced') {
    return (    
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.icon}>
        <path d="M25.662 8.16504L15.7472 18.0799L9.91493 12.2476L2.33301 19.8295" stroke="#51A2FF" stroke-width="2.3329" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.6631 8.16504H25.6618V15.1637" stroke="#51A2FF" stroke-width="2.3329" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    )
  }

  return ( 
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={styles.icon}>
      <path d="M9.91461 16.9137C10.688 16.9137 11.4297 16.6064 11.9766 16.0596C12.5235 15.5127 12.8307 14.771 12.8307 13.9976C12.8307 12.3879 12.2475 11.6647 11.6643 10.4982C10.4138 7.99851 11.403 5.76942 13.9972 3.49951C14.5804 6.41564 16.3301 9.21512 18.663 11.0814C20.9959 12.9478 22.1623 15.164 22.1623 17.4969C22.1623 18.5692 21.9511 19.6309 21.5408 20.6216C21.1305 21.6122 20.529 22.5123 19.7708 23.2705C19.0126 24.0287 18.1125 24.6302 17.1218 25.0405C16.1312 25.4509 15.0694 25.6621 13.9972 25.6621C12.9249 25.6621 11.8632 25.4509 10.8725 25.0405C9.88187 24.6302 8.98175 24.0287 8.22355 23.2705C7.46534 22.5123 6.8639 21.6122 6.45357 20.6216C6.04323 19.6309 5.83203 18.5692 5.83203 17.4969C5.83203 16.152 6.3371 14.8211 6.99848 13.9976C6.99848 14.771 7.30571 15.5127 7.85259 16.0596C8.39947 16.6064 9.1412 16.9137 9.91461 16.9137Z" stroke="#FF8904" stroke-width="2.3329" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  )
}

function ViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_158_2158)">
        <path d="M1.37467 8.23122C1.31912 8.08156 1.31912 7.91693 1.37467 7.76727C1.91575 6.45532 2.83419 5.33356 4.01357 4.54422C5.19294 3.75488 6.58014 3.3335 7.99929 3.3335C9.41844 3.3335 10.8056 3.75488 11.985 4.54422C13.1644 5.33356 14.0828 6.45532 14.6239 7.76727C14.6795 7.91693 14.6795 8.08156 14.6239 8.23122C14.0828 9.54317 13.1644 10.6649 11.985 11.4543C10.8056 12.2436 9.41844 12.665 7.99929 12.665C6.58014 12.665 5.19294 12.2436 4.01357 11.4543C2.83419 10.6649 1.91575 9.54317 1.37467 8.23122Z" stroke="white" stroke-width="1.33319" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7.99881 9.99908C9.10326 9.99908 9.99859 9.10374 9.99859 7.99929C9.99859 6.89485 9.10326 5.99951 7.99881 5.99951C6.89436 5.99951 5.99902 6.89485 5.99902 7.99929C5.99902 9.10374 6.89436 9.99908 7.99881 9.99908Z" stroke="white" stroke-width="1.33319" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    <defs>
      <clipPath id="clip0_158_2158">
        <rect width="15.9983" height="15.9983" fill="white"/>
      </clipPath>
    </defs>
    </svg>
  )
}

function DollarSignIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M7.99902 1.33301V14.6649" stroke="#0FF0FC" stroke-width="1.33319" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.3325 3.33301H6.33308C5.71431 3.33301 5.12088 3.57881 4.68334 4.01635C4.24581 4.45389 4 5.04732 4 5.66609C4 6.28486 4.24581 6.87829 4.68334 7.31582C5.12088 7.75336 5.71431 7.99917 6.33308 7.99917H9.66605C10.2848 7.99917 10.8783 8.24497 11.3158 8.68251C11.7533 9.12005 11.9991 9.71348 11.9991 10.3322C11.9991 10.951 11.7533 11.5444 11.3158 11.982C10.8783 12.4195 10.2848 12.6653 9.66605 12.6653H4" stroke="#0FF0FC" stroke-width="1.33319" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  )
}

export function MarketplaceCard({
  id,
  type,
  score,
  amount,
  duration,
  yield: apy,
  maxLoss,
  owner,
  price,
  forSale,
  viewHref,
  tradeHref,
}: MarketplaceCardProps) {
  const clampedScore = clampScore(score)
  const tier = scoreTier(clampedScore)

  const typeClass =
    type === 'Safe' ? styles.typeSafe : type === 'Balanced' ? styles.typeBalanced : styles.typeAggressive

  const scoreClass = tier === 'high' ? styles.scoreHigh : tier === 'mid' ? styles.scoreMid : styles.scoreLow

  const resolvedViewHref = viewHref ?? `/commitments?id=${encodeURIComponent(id)}`
  const resolvedTradeHref = tradeHref ?? `/marketplace/trade?id=${encodeURIComponent(id)}`

  return (
    <article className={`${styles.card} ${typeClass}`} aria-label={`Commitment ${id}`}>
      <header className={styles.topRow}>
        <div className={styles.iconWrap} aria-hidden="true">
          <TypeIcon type={type} />
        </div>
        <div className={styles.badges}>
          <span className={styles.typeBadge}>{type}</span>
          <span className={`${styles.scoreBadge} ${scoreClass}`}>{clampedScore}%</span>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.metaId}>#CMT-{id.padStart(3, '0')}</div>

        <dl className={styles.kv}>
          <div className={styles.kvRow}>
            <dt>Amount</dt>
            <dd>{amount}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt>Duration</dt>
            <dd>{duration}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt>Yield</dt>
            <dd className={styles.accentValue}>{apy}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt>Max Loss</dt>
            <dd>{maxLoss}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt>Owner</dt>
            <dd className={styles.mono}>{truncateAddress(owner)}</dd>
          </div>
        </dl>
      </div>

      <footer className={styles.bottom}>
        {forSale ?(
          <>
          <div className={styles.pricePanel} aria-label="Price">
            <div className={styles.priceLabel}>Price</div>
            <div className={styles.priceValue}>{price}</div>
          </div>
          <div className={styles.actions}>
          <Link className={styles.viewButton} href={resolvedViewHref} aria-label={`View ${id}`}>
            <ViewIcon />View
          </Link>

            <Link className={styles.tradeButton} href={resolvedTradeHref} aria-label={`Trade ${id}`}>
              <DollarSignIcon /> Trade
            </Link>
          </div>
          </>
          
        ):(
          <>
            <div className={styles.notForSale} aria-disabled="true">
              Not for sale
            </div>
            <Link className={styles.viewButton} href={resolvedViewHref} aria-label={`View ${id}`}>
            <ViewIcon />View
            </Link>
          </>
          
        )}
      </footer>
    </article>
  )
}


