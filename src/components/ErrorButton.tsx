import Link from 'next/link'
import styles from './ErrorButton.module.css'

interface ErrorButtonProps {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  isExternal?: boolean
  disabled?: boolean
}

export default function ErrorButton({
  href,
  onClick,
  children,
  variant = 'primary',
  isExternal = false,
  disabled = false,
}: ErrorButtonProps) {
  const buttonClass = `${styles.button} ${styles[variant]} ${disabled ? styles.disabled : ''}`

  if (href && isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        {children}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} className={buttonClass}>
        {children}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={buttonClass} disabled={disabled}>
      {children}
    </button>
  )
}
