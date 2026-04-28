'use client';

import { Check } from 'lucide-react';
import styles from './WizardStepper.module.css';

interface WizardStepperProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = ['Select Type', 'Configure', 'Review'] as const;

export default function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <nav className={styles.stepper} aria-label="Wizard progress">
      <div className={styles.track}>
        {STEPS.map((label, idx) => {
          const stepNum = (idx + 1) as 1 | 2 | 3;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <div key={label} className={styles.stepGroup}>
              <div className={styles.step}>
                <div
                  className={`${styles.circle} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : stepNum}
                </div>
                <span className={`${styles.label} ${isActive ? styles.labelActive : ''} ${isCompleted ? styles.labelCompleted : ''}`}>
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`${styles.connector} ${isCompleted ? styles.connectorCompleted : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
