'use client'

import React, { useState } from 'react'
import { Navigation } from '@/components/landing-page/Navigation'
import Footer from '@/components/landing-page/Footer'
import { NotificationSection } from '@/components/settings/NotificationSection'
import { NotificationToggle } from '@/components/settings/NotificationToggle'
import { 
  ShieldAlert, 
  Clock, 
  Store, 
  Info, 
  Save, 
  RotateCcw 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SettingsPage() {
  const [preferences, setPreferences] = useState({
    violationAlerts: true,
    securityThresholds: true,
    expiry30Days: true,
    expiry7Days: true,
    expiry24Hours: true,
    newMarketplaceListings: false,
    successfulTrades: true,
    priceAlerts: false,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = () => {
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }, 1000)
  }

  const handleReset = () => {
    setPreferences({
      violationAlerts: true,
      securityThresholds: true,
      expiry30Days: true,
      expiry7Days: true,
      expiry24Hours: true,
      newMarketplaceListings: false,
      successfulTrades: true,
      priceAlerts: false,
    })
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white">
      <Navigation />

      <main id="main-content" className="mx-auto max-w-4xl px-4 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Notification Preferences
          </h1>
          <p className="text-lg text-white/50 max-w-2xl leading-relaxed">
            Manage how and when you receive updates about your commitments, 
            market activity, and account security.
          </p>
        </motion.div>

        {/* Violations & Security */}
        <NotificationSection 
          title="Violations & Security" 
          description="Stay informed about the integrity of your commitments."
          icon={<ShieldAlert size={20} />}
        >
          <NotificationToggle
            id="violationAlerts"
            label="Commitment Breach Alerts"
            description="Get immediate notifications when a commitment you're tracking or holding is violated on-chain. This includes attestation failures and rule breaches."
            enabled={preferences.violationAlerts}
            onChange={() => handleToggle('violationAlerts')}
          />
          <NotificationToggle
            id="securityThresholds"
            label="Security Threshold Warnings"
            description="Receive alerts when a commitment's compliance score drops below your defined safety threshold."
            enabled={preferences.securityThresholds}
            onChange={() => handleToggle('securityThresholds')}
          />
        </NotificationSection>

        {/* Expiry Reminders */}
        <NotificationSection 
          title="Expiry Reminders" 
          description="Never miss a deadline. Configure countdown alerts for your active commitments."
          icon={<Clock size={20} />}
        >
          <NotificationToggle
            id="expiry30Days"
            label="30-Day Reminder"
            description="A courtesy notification one month before a commitment reaches its unlock date."
            enabled={preferences.expiry30Days}
            onChange={() => handleToggle('expiry30Days')}
          />
          <NotificationToggle
            id="expiry7Days"
            label="7-Day Final Countdown"
            description="Important reminder one week before expiry to prepare for asset reallocation or renewal."
            enabled={preferences.expiry7Days}
            onChange={() => handleToggle('expiry7Days')}
          />
          <NotificationToggle
            id="expiry24Hours"
            label="Critical: 24-Hour Alert"
            description="Final high-priority alert 24 hours before a commitment expires."
            enabled={preferences.expiry24Hours}
            onChange={() => handleToggle('expiry24Hours')}
          />
        </NotificationSection>

        {/* Marketplace Updates */}
        <NotificationSection 
          title="Marketplace & Trading" 
          description="Updates on new opportunities and your trade executions."
          icon={<Store size={20} />}
        >
          <NotificationToggle
            id="newMarketplaceListings"
            label="New Market Listings"
            description="Be the first to know when new high-yield commitments are listed on the marketplace. Our advanced algorithm filters for institutional-grade liquidity opportunities, ensuring you receive alerts for only the most relevant and high-integrity commitments that match your investment profile and risk tolerance thresholds. This includes detailed metadata about the underlying assets and attestation history."
            enabled={preferences.newMarketplaceListings}
            onChange={() => handleToggle('newMarketplaceListings')}
          />
          <NotificationToggle
            id="successfulTrades"
            label="Trade Confirmations"
            description="Notifications when your buy or sell orders are successfully executed on the CommitLabs DEX."
            enabled={preferences.successfulTrades}
            onChange={() => handleToggle('successfulTrades')}
          />
          <NotificationToggle
            id="priceAlerts"
            label="Secondary Market Price Volatility"
            description="Alerts when the market price of your held commitments fluctuates by more than 5% within a 24-hour period."
            enabled={preferences.priceAlerts}
            onChange={() => handleToggle('priceAlerts')}
          />
        </NotificationSection>

        {/* Privacy Messaging */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-3xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Info size={120} className="text-[#0FF0FC]" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Info size={24} className="text-[#0FF0FC]" />
              <h3 className="text-xl font-bold text-white">Privacy & Communication</h3>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed max-w-2xl">
              <p>
                CommitLabs respects your privacy. All notifications are processed using 
                encrypted on-chain data and secure off-chain indexing. We never share 
                your notification preferences or wallet activity with third parties.
              </p>
              <p className="text-sm">
                Default settings are optimized for high-security environments. Critical 
                security alerts (Violations) cannot be fully disabled as they are essential 
                for maintaining protocol integrity.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 sm:justify-end border-t border-white/10 pt-10">
          <button
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white font-semibold transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            <RotateCcw size={18} />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-3.5 rounded-xl font-bold transition-all active:scale-[0.98]
              ${isSaving 
                ? 'bg-white/20 text-white/50 cursor-not-allowed' 
                : 'bg-[#0FF0FC] text-[#0a0a0a] hover:shadow-[0_0_20px_rgba(15,240,252,0.3)]'
              }
            `}
          >
            {isSaving ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                Save Preferences
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-[#00C950] text-white font-bold shadow-lg flex items-center gap-2"
            >
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Settings saved successfully!
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}
