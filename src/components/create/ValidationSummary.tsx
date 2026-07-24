"use client";

import React, { useRef, useEffect } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import styles from "./ValidationSummary.module.css";

export interface ValidationErrorItem {
  id: string;
  message: string;
  step: 1 | 2 | 3;
  field: string;
}

interface ValidationSummaryProps {
  errors: ValidationErrorItem[];
  onJumpToError: (step: 1 | 2 | 3, field: string) => void;
}

export default function ValidationSummary({
  errors,
  onJumpToError,
}: ValidationSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the summary container when errors are present for screen readers / accessibility
  useEffect(() => {
    if (errors.length > 0 && containerRef.current) {
      containerRef.current.focus();
    }
  }, [errors.length]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      aria-labelledby="validation-summary-title"
    >
      <div className={styles.header}>
        <AlertTriangle className={styles.warningIcon} size={20} />
        <h3 id="validation-summary-title" className={styles.title}>
          Review Validation Summary ({errors.length} error{errors.length > 1 ? "s" : ""})
        </h3>
      </div>
      <p className={styles.subtitle}>
        Please resolve the following issues before submitting your commitment:
      </p>
      <ul className={styles.errorList}>
        {errors.map((error) => (
          <li key={error.id} className={styles.errorItem}>
            <button
              type="button"
              className={styles.jumpButton}
              onClick={() => onJumpToError(error.step, error.field)}
              aria-label={`Error in step ${error.step}, field ${error.field}: ${error.message}. Click to jump to this step and field.`}
            >
              <span className={styles.stepBadge}>Step {error.step}</span>
              <span className={styles.errorMessage}>{error.message}</span>
              <span className={styles.jumpText}>
                Fix Field <ArrowRight size={14} className={styles.arrowIcon} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
