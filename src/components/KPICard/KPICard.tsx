'use client';

import React from 'react';
import { clsx } from 'clsx';
import { 
    TrendingUp, 
    TrendingDown, 
    Minus, 
    AlertCircle, 
    Loader2,
    LucideIcon 
} from 'lucide-react';
import styles from './KPICard.module.css';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type KPICardVariant = 'teal' | 'green' | 'blue' | 'purple' | 'orange' | 'neutral';
export type KPICardSize = 'small' | 'medium' | 'large';
export type DeltaDirection = 'up' | 'down' | 'neutral';
export type MetricCategory = 'value' | 'percentage' | 'currency' | 'count' | 'score';
export type CardState = 'default' | 'loading' | 'error' | 'empty';

export interface KPIDelta {
    value: number;
    direction: DeltaDirection;
    period?: string; // e.g., "vs last 30 days"
    isPercentage?: boolean;
}

export interface KPICardProps {
    // Core data
    label: string;
    value?: string | number;
    previousValue?: string | number;
    
    // Visual configuration
    variant?: KPICardVariant;
    size?: KPICardSize;
    icon?: LucideIcon;
    
    // Delta/change tracking
    delta?: KPIDelta;
    
    // State management
    state?: CardState;
    loadingMessage?: string;
    errorMessage?: string;
    
    // Formatting
    format?: MetricCategory;
    unit?: string;
    decimals?: number;
    
    // Optional metadata
    description?: string;
    tooltip?: string;
    
    // Callbacks
    onRetry?: () => void;
    onClick?: () => void;
    
    // Accessibility
    ariaLabel?: string;
}

// ============================================================================
// FORMAT UTILITIES
// ============================================================================

/**
 * Format a number with specified decimals and separators
 */
export function formatNumber(value: string | number, decimals: number = 0): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '--';
    
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Format as currency (USD by default)
 */
export function formatCurrency(
    value: string | number, 
    currency: string = 'USD',
    decimals: number = 2
): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '--';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format as percentage
 */
export function formatPercentage(
    value: string | number, 
    decimals: number = 1,
    showSign: boolean = false
): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '--';
    
    const formatted = Math.abs(num).toFixed(decimals);
    const sign = showSign && num > 0 ? '+' : '';
    
    return `${sign}${formatted}%`;
}

/**
 * Format as compact number (1K, 1M, 1B, etc.)
 */
export function formatCompact(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '--';
    
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
}

/**
 * Calculate delta between two values
 */
export function calculateDelta(
    current: string | number, 
    previous: string | number
): KPIDelta {
    const curr = typeof current === 'string' ? parseFloat(current) : current;
    const prev = typeof previous === 'string' ? parseFloat(previous) : previous;
    
    if (isNaN(curr) || isNaN(prev) || prev === 0) {
        return { value: 0, direction: 'neutral' };
    }
    
    const percentChange = ((curr - prev) / prev) * 100;
    
    return {
        value: Math.abs(percentChange),
        direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral',
        isPercentage: true,
    };
}

// ============================================================================
// DELTA COMPONENT
// ============================================================================

interface DeltaIndicatorProps {
    delta: KPIDelta;
    size?: KPICardSize;
}

const DeltaIndicator: React.FC<DeltaIndicatorProps> = ({ delta, size = 'medium' }) => {
    const Icon = delta.direction === 'up' 
        ? TrendingUp 
        : delta.direction === 'down' 
            ? TrendingDown 
            : Minus;
    
    const isPositive = delta.direction === 'up';
    const isNegative = delta.direction === 'down';
    
    return (
        <div 
            className={clsx(
                styles.delta,
                styles[`delta${size.charAt(0).toUpperCase() + size.slice(1)}`],
                {
                    [styles.deltaPositive]: isPositive,
                    [styles.deltaNegative]: isNegative,
                    [styles.deltaNeutral]: delta.direction === 'neutral',
                }
            )}
        >
            <Icon size={size === 'small' ? 12 : size === 'large' ? 18 : 14} />
            <span>{delta.value.toFixed(1)}%</span>
            {delta.period && <span className={styles.deltaPeriod}>{delta.period}</span>}
        </div>
    );
};

// ============================================================================
// LOADING STATE COMPONENT
// ============================================================================

interface LoadingStateProps {
    message?: string;
    size?: KPICardSize;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message, size = 'medium' }) => {
    return (
        <div className={clsx(styles.loadingState, styles[`loading${size.charAt(0).toUpperCase() + size.slice(1)}`])}>
            <Loader2 className={styles.spinner} size={size === 'small' ? 16 : size === 'large' ? 28 : 20} />
            {message && <span className={styles.loadingMessage}>{message}</span>}
            <div className={styles.skeleton}>
                <div className={styles.skeletonBar} style={{ width: '60%' }} />
                <div className={styles.skeletonBar} style={{ width: '40%' }} />
            </div>
        </div>
    );
};

// ============================================================================
// ERROR STATE COMPONENT
// ============================================================================

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    size?: KPICardSize;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, size = 'medium' }) => {
    return (
        <div className={clsx(styles.errorState, styles[`error${size.charAt(0).toUpperCase() + size.slice(1)}`])}>
            <AlertCircle className={styles.errorIcon} size={size === 'small' ? 16 : size === 'large' ? 28 : 20} />
            <span className={styles.errorMessage}>{message || 'Failed to load'}</span>
            {onRetry && (
                <button 
                    className={styles.retryButton}
                    onClick={onRetry}
                    aria-label="Retry loading data"
                >
                    Retry
                </button>
            )}
        </div>
    );
};

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
    message?: string;
    size?: KPICardSize;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, size = 'medium' }) => {
    return (
        <div className={clsx(styles.emptyState, styles[`empty${size.charAt(0).toUpperCase() + size.slice(1)}`])}>
            <span className={styles.emptyMessage}>{message || 'No data available'}</span>
        </div>
    );
};

// ============================================================================
// MAIN KPI CARD COMPONENT
// ============================================================================

/**
 * KPI Card Component
 * 
 * A reusable card component for displaying dashboard metrics with:
 * - Loading, error, and empty states
 * - Delta/change indicators
 * - Multiple size and variant options
 * - Number formatting utilities
 * - Accessibility support
 * 
 * @example
 * ```tsx
 * <KPICard
 *   label="Total Revenue"
 *   value={125000}
 *   format="currency"
 *   variant="green"
 *   delta={{ value: 12.5, direction: 'up', period: 'vs last month' }}
 * />
 * ```
 */
export const KPICard: React.FC<KPICardProps> = ({
    label,
    value,
    previousValue,
    variant = 'teal',
    size = 'medium',
    icon: Icon,
    delta,
    state = 'default',
    loadingMessage = 'Loading metrics...',
    errorMessage,
    format = 'value',
    unit,
    decimals = 0,
    description,
    tooltip,
    onRetry,
    onClick,
    ariaLabel,
}) => {
    // Format value based on format type
    const formattedValue = (() => {
        if (value === undefined || value === null) return '--';
        
        switch (format) {
            case 'currency':
                return formatCurrency(value, unit || 'USD', decimals);
            case 'percentage':
                return formatPercentage(value, decimals);
            case 'count':
                return formatCompact(value);
            case 'score':
                return formatNumber(value, decimals);
            default:
                return formatNumber(value, decimals);
        }
    })();

    // Calculate delta if previous value provided
    const displayDelta = delta || (
        previousValue !== undefined 
            ? calculateDelta(value as string | number, previousValue) 
            : undefined
    );

    // Render based on state
    if (state === 'loading') {
        return (
            <div className={clsx(styles.card, styles[variant], styles[size])}>
                <LoadingState message={loadingMessage} size={size} />
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className={clsx(styles.card, styles[variant], styles[size])}>
                <ErrorState message={errorMessage} onRetry={onRetry} size={size} />
            </div>
        );
    }

    if (state === 'empty') {
        return (
            <div className={clsx(styles.card, styles[variant], styles[size])}>
                <EmptyState size={size} />
            </div>
        );
    }

    // Default state
    return (
        <div 
            className={clsx(
                styles.card, 
                styles[variant], 
                styles[size],
                { [styles.clickable]: !!onClick }
            )}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
            aria-label={ariaLabel || `${label}: ${formattedValue}`}
        >
            {/* Header: Icon + Label */}
            <div className={styles.header}>
                {Icon && (
                    <div className={styles.iconWrapper}>
                        <Icon size={size === 'small' ? 14 : size === 'large' ? 22 : 18} />
                    </div>
                )}
                <span className={styles.label}>{label}</span>
                {tooltip && (
                    <span className={styles.tooltip} title={tooltip}>ⓘ</span>
                )}
            </div>

            {/* Value Display */}
            <div className={styles.valueContainer}>
                <span className={styles.value}>{formattedValue}</span>
                {displayDelta && (
                    <DeltaIndicator delta={displayDelta} size={size} />
                )}
            </div>

            {/* Description (optional) */}
            {description && (
                <p className={styles.description}>{description}</p>
            )}
        </div>
    );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default KPICard;