import { Clock, AlertTriangle, Shield, DollarSign } from 'lucide-react'
import styles from './CommitmentDetailParameters.module.css'
import { PiStack } from 'react-icons/pi'

const DEFAULT_DURATION_DESCRIPTION = 'Commitment lock period'
const DEFAULT_MAX_LOSS_DESCRIPTION = 'Maximum acceptable loss before violation'
const DEFAULT_COMMITMENT_TYPE_DESCRIPTION = 'Risk profile and strategy type'
const DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION = 'Penalty for exiting before expiry'

export interface CommitmentDetailParametersProps {
  durationLabel: string
  maxLossLabel: string
  commitmentTypeLabel: string
  earlyExitPenaltyLabel: string
  durationDescription?: string
  maxLossDescription?: string
  commitmentTypeDescription?: string
  earlyExitPenaltyDescription?: string
}



export function CommitmentDetailParameters({
  durationLabel,
  maxLossLabel,
  commitmentTypeLabel,
  earlyExitPenaltyLabel,
  durationDescription = DEFAULT_DURATION_DESCRIPTION,
  maxLossDescription = DEFAULT_MAX_LOSS_DESCRIPTION,
  commitmentTypeDescription = DEFAULT_COMMITMENT_TYPE_DESCRIPTION,
  earlyExitPenaltyDescription = DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION,
}: CommitmentDetailParametersProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="commitment-parameters-heading"
    >
      <div className={styles.headingRow}>
        <div className={styles.headingIcon} aria-hidden="true">
          <PiStack color='#0ef1fc' strokeWidth={2} size={22}/>
        </div>
        <h2 id="commitment-parameters-heading" className={styles.heading}>
          Commitment Parameters
        </h2>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.iconWrap}>
              <Clock size={22} color="#51A2FF" strokeWidth={2} />
            </div>
            <span className={styles.label}>Duration</span>
          </div>
          <p className={styles.value}>{durationLabel}</p>
          <p className={styles.description}>{durationDescription}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.iconWrap}>
              <AlertTriangle size={22} color="#FF3B30" strokeWidth={2} />
            </div>
            <span className={styles.label}>Max Loss Threshold</span>
          </div>
          <p className={styles.value}>{maxLossLabel}</p>
          <p className={styles.description}>{maxLossDescription}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.iconWrap}>
              <Shield size={22} color="#05DF72" strokeWidth={2} />
            </div>
            <span className={styles.label}>Commitment Type</span>
          </div>
          <p className={styles.value}>{commitmentTypeLabel}</p>
          <p className={styles.description}>{commitmentTypeDescription}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.iconWrap}>
              <DollarSign size={22} color="#F5A623" strokeWidth={2} />
            </div>
            <span className={styles.label}>Early Exit Penalty</span>
          </div>
          <p className={styles.value}>{earlyExitPenaltyLabel}</p>
          <p className={styles.description}>{earlyExitPenaltyDescription}</p>
        </div>
      </div>
    </section>
  );
}
