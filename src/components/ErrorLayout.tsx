import styles from './ErrorLayout.module.css'

interface ErrorLayoutProps {
  children: React.ReactNode
}

export default function ErrorLayout({ children }: ErrorLayoutProps) {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
