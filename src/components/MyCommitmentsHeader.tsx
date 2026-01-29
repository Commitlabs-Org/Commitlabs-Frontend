'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import styles from './MyCommitmentsHeader.module.css';

interface MyCommitmentsHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onCreateNew?: () => void;
  backHref?: string;
  createHref?: string;
}

const MyCommitmentsHeader: React.FC<MyCommitmentsHeaderProps> = ({
  title = 'My Commitments',
  subtitle = 'View and manage all your liquidity commitments',
  onBack,
  onCreateNew,
  backHref = '/',
  createHref = '/create',
}) => {
  const handleBack = (e: React.MouseEvent) => {
    if (onBack) {
      e.preventDefault();
      onBack();
    }
  };

  const handleCreate = (e: React.MouseEvent) => {
    if (onCreateNew) {
      e.preventDefault();
      onCreateNew();
    }
  };

  return (
    <div className={styles.headerWrapper}>
      <header className={styles.container}>
        <div className={styles.leftSection}>
          <Link 
            href={backHref} 
            className={styles.backLink}
            onClick={handleBack}
            aria-label="Back to Home"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        <Link 
          href={createHref}
          className={styles.ctaButton}
          onClick={handleCreate}
          aria-label="Create New Commitment"
        >
          <Plus size={18} color='#0FF0FC' />
          <span>Create New Commitment</span>
        </Link>
      </header>
    </div>
  );
};

export default MyCommitmentsHeader;
