// src/pages/PrivacyPolicyPage.jsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

function LegalSection({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-xl font-bold text-white mb-3">{title}</h2>
      <div className="text-sm text-white/50 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export function PrivacyPolicyPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative z-10 pt-20 pb-24 px-6 max-w-2xl mx-auto"
    >
      <Link to="/settings" className="text-[0.65rem] font-bold tracking-widest uppercase text-gold hover:text-gold/70 transition-colors block mb-8">
        ← Back to settings
      </Link>

      <span className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-cream-dim block mb-2">Legal</span>
      <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] font-bold mb-2">Privacy Policy</h1>
      <p className="text-xs text-white/30 mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <LegalSection title="What we collect">
        <p>We collect your email address and display name when you register. We store the content you create: memorials, tributes, family member records, and any photos you upload.</p>
        <p>We do not sell your data. We do not share your personal information with advertisers or third parties, except as required to operate the service (e.g. cloud storage providers).</p>
      </LegalSection>

      <LegalSection title="How we use your data">
        <p>Your data is used solely to provide the WHO WAS I service: displaying your memorials, enabling family collaboration, sending you anniversary reminders if you opt in, and improving the product.</p>
        <p>We use InstantDB for real-time data storage. Images are stored on Cloudinary. Neither service sells user data.</p>
      </LegalSection>

      <LegalSection title="Memorial visibility">
        <p>Public memorials are indexed and discoverable. Family-only memorials are accessible only to people with your invite link. Private memorials are visible only to you.</p>
        <p>You can change a memorial's visibility at any time from the memorial settings.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>You can delete your account and all associated data at any time from Settings. We will process deletions within 30 days.</p>
        <p>You can export your memorial data by contacting us at privacy@whowasi.com.</p>
        <p>If you are in the EU/EEA, you have rights under GDPR including the right to access, correct, and delete your data.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>We use session cookies only for authentication. We do not use advertising cookies or third-party tracking scripts.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about privacy? Email us at <span className="text-gold">privacy@whowasi.com</span></p>
      </LegalSection>
    </motion.div>
  )
}

// ─── Terms Page ───────────────────────────────────────────────────────────────

export function TermsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative z-10 pt-20 pb-24 px-6 max-w-2xl mx-auto"
    >
      <Link to="/settings" className="text-[0.65rem] font-bold tracking-widest uppercase text-gold hover:text-gold/70 transition-colors block mb-8">
        ← Back to settings
      </Link>

      <span className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-cream-dim block mb-2">Legal</span>
      <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] font-bold mb-2">Terms of Service</h1>
      <p className="text-xs text-white/30 mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <LegalSection title="Acceptance">
        <p>By using WHO WAS I, you agree to these terms. If you do not agree, please do not use the service.</p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>You retain ownership of the content you create. By uploading content, you grant WHO WAS I a licence to display and store it for the purpose of operating the service.</p>
        <p>You are responsible for ensuring you have the right to upload photos and other content. Do not upload content that infringes on copyright or that you do not have permission to share.</p>
      </LegalSection>

      <LegalSection title="Prohibited content">
        <p>You may not use WHO WAS I to: post content that is abusive, hateful, or discriminatory; impersonate living people without consent; create false memorials for living people without their permission; or violate any applicable law.</p>
        <p>We reserve the right to remove content and suspend accounts that violate these terms.</p>
      </LegalSection>

      <LegalSection title="Memorial accuracy">
        <p>WHO WAS I is a platform for personal memorials. We do not verify the accuracy of information submitted by users. If you believe a memorial is inaccurate or created in bad faith, please contact us at support@whowasi.com.</p>
      </LegalSection>

      <LegalSection title="Service availability">
        <p>We aim for high availability but cannot guarantee uninterrupted access. We are not liable for any loss resulting from service downtime or data loss beyond the limits required by applicable law.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>We may update these terms. We will notify you of material changes by email. Continued use of the service after notification constitutes acceptance.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions? Email <span className="text-gold">support@whowasi.com</span></p>
      </LegalSection>
    </motion.div>
  )
}
