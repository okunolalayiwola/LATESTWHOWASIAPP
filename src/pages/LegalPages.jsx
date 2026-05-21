// src/pages/LegalPages.jsx
// UK GDPR / Data Protection Act 2018 compliant legal pages.
// Last reviewed: May 2026

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Design tokens ────────────────────────────────────────────────────────────
const UPDATED = '21 May 2026'

function PageShell({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 pt-20 pb-28 px-6"
      style={{ maxWidth: 760, margin: '0 auto' }}
    >
      <Link
        to="/settings"
        className="text-[0.65rem] font-bold tracking-widest uppercase text-gold hover:text-gold/70 transition-colors block mb-8"
      >
        ← Back
      </Link>

      <span className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-white/30 block mb-2">Legal</span>
      <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] font-bold text-white mb-2">{title}</h1>
      <p className="text-xs text-white/30 mb-2">{subtitle}</p>
      <p className="text-xs text-white/20 mb-12">Last updated: {UPDATED}</p>

      <div className="space-y-10">{children}</div>
    </motion.div>
  )
}

function Section({ id, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div id={id} className="border border-white/08 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/02 transition-colors"
      >
        <h2 className="font-display text-base font-bold text-white">{title}</h2>
        <span className="text-white/30 text-sm flex-shrink-0 ml-4">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 text-sm text-white/55 leading-relaxed space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Bold({ children }) {
  return <strong className="text-white/80 font-semibold">{children}</strong>
}

function Pill({ children }) {
  return (
    <span className="inline-block text-[0.6rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gold/15 text-gold/80 border border-gold/20">
      {children}
    </span>
  )
}

// ─── Privacy Policy ───────────────────────────────────────────────────────────

export function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="WHO WAS I Limited · Company registered in England and Wales"
    >

      <div className="glass border border-gold/15 rounded-2xl p-5">
        <p className="text-sm text-white/70 leading-relaxed">
          <Bold>WHO WAS I</Bold> ("<Bold>we</Bold>", "<Bold>us</Bold>", "<Bold>our</Bold>") is committed to
          protecting your personal information and respecting your privacy. This policy explains what data we
          collect, why we collect it, and your rights under the <Bold>UK General Data Protection Regulation
          (UK GDPR)</Bold> and the <Bold>Data Protection Act 2018 (DPA 2018)</Bold>.
        </p>
        <p className="text-xs text-white/35 mt-3">
          We are the <Bold>data controller</Bold> for personal data processed through this platform. Our
          registered contact for data protection matters is: <span className="text-gold">privacy@whowasi.uk</span>
        </p>
      </div>

      <Section id="data-we-collect" title="1. Personal data we collect">
        <p>We collect the following categories of personal data:</p>

        <div className="space-y-4 mt-2">
          <div>
            <p><Bold>Account &amp; identity data:</Bold> your email address, display name, profile photo, and the password hash maintained by our authentication provider (InstantDB). We do not store your raw password.</p>
          </div>
          <div>
            <p><Bold>Memorial content:</Bold> names, dates of birth and death, life stories, photos, and other biographical information you enter about yourself or others. This may include <Pill>Special category data</Pill> such as health information (e.g. cause of death, medical directives).</p>
          </div>
          <div>
            <p><Bold>Voice recordings:</Bold> audio clips you upload to create a voice memory experience. You must have the consent of the person whose voice is recorded, or own the recording rights yourself.</p>
          </div>
          <div>
            <p><Bold>Family connection data:</Bold> your claimed relationship to memorial owners, your name and email shared during the join-family flow, and the approval status recorded by the memorial owner.</p>
          </div>
          <div>
            <p><Bold>Legacy Vault &amp; documents:</Bold> files you upload to the Vault (wills, deeds, letters, medical directives). These are encrypted at rest. Only the account holder and users they explicitly authorise may access them.</p>
          </div>
          <div>
            <p><Bold>Payment data:</Bold> if you subscribe to WHO WAS I Premium, payment is processed by <Bold>Stripe</Bold>. We receive only a subscription status flag and a Stripe customer ID — we do not store card numbers.</p>
          </div>
          <div>
            <p><Bold>Usage data:</Bold> page views, feature interactions, and basic browser/device information collected via our analytics infrastructure. This data is aggregated and not linked to your identity by default.</p>
          </div>
          <div>
            <p><Bold>Cookies:</Bold> we use a single session cookie for authentication. We do not use advertising cookies, cross-site tracking pixels, or third-party analytics cookies.</p>
          </div>
        </div>
      </Section>

      <Section id="legal-basis" title="2. Legal basis for processing (UK GDPR Article 6)">
        <p>We process your personal data on the following lawful bases:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li><Bold>Contract performance (Art. 6(1)(b)):</Bold> processing necessary to provide the WHO WAS I service, including storing memorials, enabling family connections, and delivering Premium features.</li>
          <li><Bold>Legitimate interests (Art. 6(1)(f)):</Bold> fraud prevention, security, platform integrity, and sending transactional notifications (tribute alerts, anniversary reminders, family connection approvals). We have balanced these interests against your rights and concluded they do not override them.</li>
          <li><Bold>Consent (Art. 6(1)(a)):</Bold> for optional communications such as product update newsletters. You may withdraw consent at any time.</li>
          <li><Bold>Legal obligation (Art. 6(1)(c)):</Bold> where required by UK law.</li>
        </ul>
        <p className="mt-3">For <Pill>Special category data</Pill> (health-related memorial content), we process on the basis of <Bold>explicit consent (Art. 9(2)(a))</Bold> — by submitting such content you are explicitly consenting to its processing for the purpose of creating and displaying the memorial.</p>
      </Section>

      <Section id="how-we-use" title="3. How we use your data">
        <ul className="list-disc list-inside space-y-2">
          <li>To create and display memorial pages visible to the audiences you choose (public, family-only, or private).</li>
          <li>To enable family connections: sending approval emails, verifying relationships, and granting family-member access.</li>
          <li>To send transactional emails — tribute notifications, anniversary reminders, family connection approvals, and Vault recovery — using <Bold>Resend</Bold> as our email delivery provider.</li>
          <li>To process payments for Premium subscriptions via <Bold>Stripe</Bold>.</li>
          <li>To generate voice memory experiences using <Bold>ElevenLabs</Bold> voice synthesis on voice recordings you upload. These are processed server-side and never sent to the browser unprotected.</li>
          <li>To maintain platform security, investigate abuse reports, and comply with legal obligations.</li>
        </ul>
      </Section>

      <Section id="third-parties" title="4. Third-party processors">
        <p>We share data only with the following processors, all subject to appropriate data processing agreements:</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-white/40 text-left">
                <th className="pb-2 pr-4">Processor</th>
                <th className="pb-2 pr-4">Purpose</th>
                <th className="pb-2">Data shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/05">
              {[
                ['InstantDB', 'Real-time database & auth', 'All user-generated content, account credentials'],
                ['Cloudinary', 'Image & file storage', 'Photos, uploaded documents, profile images'],
                ['Resend', 'Transactional email delivery', 'Recipient email address and message content'],
                ['Stripe', 'Payment processing', 'Billing details (card numbers not stored by us)'],
                ['ElevenLabs', 'Voice memory synthesis', 'Voice audio clips (server-side only)'],
                ['Vercel', 'Hosting & serverless functions', 'All traffic (standard web hosting)'],
              ].map(([name, purpose, data]) => (
                <tr key={name} className="text-white/50">
                  <td className="py-2 pr-4 font-bold text-white/70">{name}</td>
                  <td className="py-2 pr-4">{purpose}</td>
                  <td className="py-2">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">We do not sell, rent, or trade your personal data to any third party for marketing purposes.</p>
      </Section>

      <Section id="retention" title="5. Data retention">
        <p>We retain your data for the following periods:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li><Bold>Account &amp; profile data:</Bold> for as long as your account is active. If you delete your account, your profile is removed within 30 days.</li>
          <li><Bold>Memorial content &amp; photos:</Bold> for as long as the memorial exists, or until you delete it. Memorial owners can delete a memorial at any time.</li>
          <li><Bold>Family tree records:</Bold> if you delete your account, your name and relationship records remain in the family trees of other users who have connected with you. This allows the integrity of existing family circles to be preserved. Your profile photo and personal content are removed; only your name and relationship label remain as a reference within others' family trees. You may request removal by contacting privacy@whowasi.uk.</li>
          <li><Bold>Family connection data:</Bold> retained for as long as the connection is active. Rejected connections are deleted after 90 days.</li>
          <li><Bold>Vault documents:</Bold> retained until you delete them or close your account. We keep encrypted backups for up to 30 days after deletion.</li>
          <li><Bold>Payment records:</Bold> retained for 7 years as required by UK financial law.</li>
          <li><Bold>Server logs:</Bold> anonymised after 90 days.</li>
        </ul>
      </Section>

      <Section id="your-rights" title="6. Your rights under UK GDPR">
        <p>You have the following rights, which you may exercise by contacting privacy@whowasi.uk:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li><Bold>Right of access (Art. 15):</Bold> request a copy of the personal data we hold about you.</li>
          <li><Bold>Right to rectification (Art. 16):</Bold> request correction of inaccurate or incomplete data.</li>
          <li><Bold>Right to erasure / "right to be forgotten" (Art. 17):</Bold> request deletion of your data where there is no overriding legal basis to retain it. Note: see the family tree data retention policy above.</li>
          <li><Bold>Right to restriction (Art. 18):</Bold> request that we pause processing of your data in certain circumstances.</li>
          <li><Bold>Right to data portability (Art. 20):</Bold> receive your data in a structured, machine-readable format (JSON export available on request).</li>
          <li><Bold>Right to object (Art. 21):</Bold> object to processing based on legitimate interests. We will cease unless we can demonstrate compelling legitimate grounds.</li>
          <li><Bold>Rights related to automated decision-making (Art. 22):</Bold> we do not make automated decisions about you with legal or significant effects.</li>
        </ul>
        <p className="mt-3">We will respond to requests within <Bold>one calendar month</Bold>. If your request is complex or numerous, we may extend by a further two months and will notify you.</p>
        <p>If you are dissatisfied with our response, you have the right to lodge a complaint with the <Bold>Information Commissioner's Office (ICO)</Bold>: <span className="text-gold">ico.org.uk</span> · 0303 123 1113.</p>
      </Section>

      <Section id="vault-recovery" title="7. Legacy Vault — recovery policy">
        <p>The Legacy Vault may contain sensitive documents (wills, deeds, medical directives) protected by a personal vault code set by the account holder.</p>
        <p>If the account holder is deceased and did not share their vault code with any family member:</p>
        <ol className="list-decimal list-inside space-y-2 mt-2">
          <li>A verified family member must contact us at <span className="text-gold">vault@whowasi.uk</span>.</li>
          <li>We require proof of identity (government-issued photo ID) and a <Bold>certified copy of the death certificate</Bold> of the account holder.</li>
          <li>We may also require proof of your relationship to the deceased (e.g. grant of probate, birth/marriage certificate).</li>
          <li>If satisfied, we will assist in granting access to a designated executor or next-of-kin within 14 working days.</li>
          <li>We reserve the right to refuse access where documentation is insufficient or where there is a dispute between claimants.</li>
        </ol>
        <p className="mt-3">We strongly encourage account holders to share their vault code with a trusted person, or designate a digital executor in their account settings.</p>
      </Section>

      <Section id="voice-consent" title="8. Voice recordings — consent &amp; rights">
        <p>When you upload a voice recording to create a voice memory experience:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You confirm that you are the rights holder of the recording, or that you have the <Bold>explicit consent</Bold> of the individual whose voice is captured.</li>
          <li>You grant WHO WAS I a non-exclusive, royalty-free licence to process the recording for the purpose of generating a voice memory on the memorial page.</li>
          <li>The voice model is stored securely and is not shared with any third party beyond ElevenLabs (our synthesis provider), under contract.</li>
          <li>You may delete the voice recording and associated model at any time from the memorial settings, subject to a 30-day backup retention window.</li>
        </ul>
      </Section>

      <Section id="international" title="9. International data transfers">
        <p>Our infrastructure is primarily based in the United Kingdom and European Economic Area. Some processors (Cloudinary, ElevenLabs, Resend) may transfer data to the United States. Where this occurs, we rely on Standard Contractual Clauses (SCCs) or the UK-US Data Bridge as an appropriate safeguard.</p>
      </Section>

      <Section id="children" title="10. Children's privacy">
        <p>WHO WAS I is not directed at children under the age of 13. We do not knowingly collect personal data from children under 13. If you believe a child has provided us with personal data without parental consent, please contact privacy@whowasi.uk and we will delete it promptly.</p>
        <p>Memorials may contain information about deceased children. This information is subject to the same protections as all other memorial content and is governed by the privacy settings chosen by the memorial creator.</p>
      </Section>

      <Section id="contact-privacy" title="11. Contact &amp; complaints">
        <p>For any privacy enquiry, to exercise your rights, or to raise a concern:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Email: <span className="text-gold">privacy@whowasi.uk</span></li>
          <li>Post: WHO WAS I, Data Protection, [Registered Address], United Kingdom</li>
        </ul>
        <p className="mt-3">If you wish to complain to the supervisory authority:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Information Commissioner's Office (ICO): <span className="text-gold">ico.org.uk</span></li>
          <li>ICO helpline: 0303 123 1113</li>
        </ul>
      </Section>

    </PageShell>
  )
}

// ─── Terms of Service ─────────────────────────────────────────────────────────

export function TermsPage() {
  return (
    <PageShell
      title="Terms of Service"
      subtitle="WHO WAS I Limited · These terms form a legally binding agreement between you and WHO WAS I"
    >

      <div className="glass border border-white/08 rounded-2xl p-5">
        <p className="text-sm text-white/60 leading-relaxed">
          Please read these terms carefully. By creating an account or using WHO WAS I you agree to be bound by them.
          If you do not agree, you must not use the platform. These terms are governed by the law of <Bold>England and Wales</Bold>.
        </p>
      </div>

      <Section id="eligibility" title="1. Eligibility &amp; account registration">
        <p>You must be at least <Bold>18 years of age</Bold> to create an account on WHO WAS I. By registering, you confirm that you meet this requirement.</p>
        <p>You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately at support@whowasi.uk if you believe your account has been compromised.</p>
        <p>Each account must be registered with a real, current email address that you control. You may not create multiple accounts to circumvent restrictions or suspensions.</p>
        <p>Memorials created on behalf of a living person (the "<Bold>isSelf</Bold>" feature) require that person's informed consent. You must not create a memorial for a living person without their explicit permission.</p>
      </Section>

      <Section id="your-content" title="2. Your content — ownership &amp; licence">
        <p>You retain full ownership of all content you create or upload to WHO WAS I, including text, photos, voice recordings, and documents ("<Bold>Your Content</Bold>").</p>
        <p>By uploading Your Content you grant WHO WAS I a <Bold>non-exclusive, royalty-free, worldwide licence</Bold> to store, display, reproduce, and process Your Content solely for the purpose of operating and improving the platform. This licence ends when you delete the content or close your account, subject to the retention periods described in the Privacy Policy.</p>
        <p>You are solely responsible for ensuring that Your Content does not infringe third-party intellectual property rights, and that you have the necessary rights or consents for any material you upload — including photographs and voice recordings of other individuals.</p>
      </Section>

      <Section id="prohibited" title="3. Prohibited content &amp; conduct">
        <p>You must not use WHO WAS I to:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>Post content that is abusive, hateful, discriminatory, sexually explicit, or violent.</li>
          <li>Create a memorial for a living person without their explicit consent, or for the purpose of harassing, defaming, or impersonating them.</li>
          <li>Upload content to which you do not hold the rights or a valid licence.</li>
          <li>Submit fraudulent family connection requests or impersonate another user.</li>
          <li>Attempt to gain unauthorised access to another user's Vault, account, or private content.</li>
          <li>Use the platform for commercial solicitation, spam, or unsolicited communications.</li>
          <li>Engage in any activity that interferes with the operation of the platform or its infrastructure.</li>
          <li>Violate any applicable UK law or regulation, including the <Bold>Computer Misuse Act 1990</Bold> and the <Bold>Online Safety Act 2023</Bold>.</li>
        </ul>
        <p className="mt-3">We reserve the right to remove content and suspend or terminate accounts that violate these terms, at our sole discretion and without prior notice where the violation is serious.</p>
      </Section>

      <Section id="family-connections" title="4. Family connections &amp; access controls">
        <p>The family connection system allows other registered users to request to join your family circle. As the memorial owner, you are in full control of approvals:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You will receive an email for each connection request. You may approve, reject, or change the claimed relationship before approving.</li>
          <li>Approved family members gain access to: leaving tributes, commenting on tributes, viewing family-only content, sending and receiving private family messages, and updating certain memorial fields (status, date of passing).</li>
          <li>You may revoke a family connection at any time from the Family Tree page.</li>
          <li>WHO WAS I does not verify biological or legal family relationships. By approving a connection you are granting access to that individual based on your own judgement.</li>
        </ul>
      </Section>

      <Section id="vault" title="5. Legacy Vault &amp; digital assets">
        <p>The Legacy Vault is a secure digital storage facility for important documents and sealed letters. By using the Vault:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You acknowledge that WHO WAS I is a <Bold>platform provider, not a solicitor or legal adviser</Bold>. Documents stored in the Vault do not constitute legally valid wills or instruments unless executed in accordance with applicable UK law (Wills Act 1837, as amended).</li>
          <li>We strongly recommend that you obtain independent legal advice for any documents of legal significance.</li>
          <li>Non-owner family members with Vault access may <Bold>view and download</Bold> documents only. They cannot add, edit, or delete documents.</li>
          <li>The Vault password is personal to you. We recommend sharing it securely with a trusted person or your solicitor. In the event of your death, see the Vault Recovery process in the Privacy Policy (Section 7).</li>
        </ul>
      </Section>

      <Section id="account-deletion" title="6. Account deletion policy">
        <p>You may delete your account at any time from Settings → Manage Account. When you delete your account:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>Your <Bold>profile, email address, photos, bio, and all personal identifiers</Bold> are permanently removed from our active systems within 30 days.</li>
          <li>Any <Bold>memorials you created</Bold> will also be deleted, along with associated tributes, photos, and Vault documents, unless you have transferred ownership to another user prior to deletion.</li>
          <li><Bold>Family tree records:</Bold> your name and relationship label will be retained within the family trees of other connected users to preserve the integrity of their family records. Your personal data (photo, email, bio) will be removed. You may request complete erasure by contacting privacy@whowasi.uk, subject to the retention considerations described in the Privacy Policy.</li>
          <li>Any Premium subscription must be cancelled separately through your Stripe billing portal; deletion of your account does not automatically cancel a subscription.</li>
        </ul>
      </Section>

      <Section id="voice" title="7. Voice memory — consent &amp; usage">
        <p>If you upload a voice recording to create a voice memory experience:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You confirm you are the rights holder of the recording, or have the <Bold>explicit consent</Bold> of the person whose voice is captured.</li>
          <li>Voice synthesis is performed server-side only, through our provider ElevenLabs. The generated voice model is not auditable or downloadable by third parties.</li>
          <li>If you receive a legitimate request from the estate of a deceased person to remove a voice model, we will action such requests within 14 working days upon receipt of satisfactory documentation.</li>
        </ul>
      </Section>

      <Section id="premium" title="8. Premium subscriptions &amp; payments">
        <p>Premium subscriptions are offered on a monthly or annual basis. Payments are processed by <Bold>Stripe</Bold>. By subscribing:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You authorise us to charge the applicable fee to your chosen payment method at the start of each billing period.</li>
          <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
          <li>You have the right to cancel your subscription at any time. Cancellation takes effect at the end of the current billing period; you retain access to Premium features until then.</li>
          <li>Under the <Bold>Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013</Bold>, you have a 14-day cooling-off period for new subscriptions. To exercise this right, contact support@whowasi.uk.</li>
          <li>Prices are stated inclusive of UK VAT where applicable. We reserve the right to change pricing with 30 days' notice.</li>
        </ul>
      </Section>

      <Section id="availability" title="9. Service availability &amp; liability">
        <p>We aim to provide a reliable and continuous service. However, we cannot guarantee uninterrupted access. We reserve the right to perform maintenance, which we will endeavour to communicate in advance where possible.</p>
        <p>To the maximum extent permitted by the <Bold>Consumer Rights Act 2015</Bold> and applicable UK law:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>Our liability for any single claim arising from your use of the platform is limited to the amount you paid us in the 12 months preceding the claim.</li>
          <li>We are not liable for indirect, consequential, or incidental losses, including loss of profits or data, except where such limitation is not permitted by law.</li>
          <li>We do not exclude or limit our liability for death or personal injury caused by negligence, or for fraud or fraudulent misrepresentation.</li>
          <li>Nothing in these terms affects your statutory rights as a consumer under UK law.</li>
        </ul>
      </Section>

      <Section id="ip" title="10. Intellectual property">
        <p>The WHO WAS I platform — including its design, code, branding, trademarks, and original content (excluding Your Content) — is owned by WHO WAS I Limited and protected by intellectual property law.</p>
        <p>You may not copy, reproduce, reverse-engineer, or create derivative works from any part of the platform without our prior written consent.</p>
      </Section>

      <Section id="tributes" title="11. Tributes &amp; community conduct">
        <p>Anyone may leave a tribute on a public memorial. By leaving a tribute:</p>
        <ul className="list-disc list-inside space-y-2 mt-2">
          <li>You confirm that your tribute is sincere and respectful and does not violate the Prohibited Content rules (Section 3).</li>
          <li>You grant WHO WAS I a licence to display your tribute on the memorial page.</li>
          <li>The memorial owner and the tribute author may delete a tribute at any time.</li>
          <li>Family member comments under tributes are visible to all approved family members of that memorial.</li>
        </ul>
      </Section>

      <Section id="changes" title="12. Changes to these terms">
        <p>We may update these terms from time to time. We will notify you of <Bold>material changes</Bold> by email at least 14 days before they take effect. Your continued use of the platform after that date constitutes acceptance of the updated terms.</p>
        <p>If you do not accept the updated terms, you must stop using the platform and may delete your account.</p>
      </Section>

      <Section id="law" title="13. Governing law &amp; disputes">
        <p>These terms are governed by the law of <Bold>England and Wales</Bold>. Any dispute arising under or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        <p>We encourage you to contact us at support@whowasi.uk in the first instance to resolve any dispute informally. If we cannot resolve it within 30 days, either party may escalate to formal proceedings.</p>
      </Section>

      <Section id="contact-terms" title="14. Contact">
        <ul className="list-disc list-inside space-y-1">
          <li>General enquiries: <span className="text-gold">support@whowasi.uk</span></li>
          <li>Privacy &amp; data protection: <span className="text-gold">privacy@whowasi.uk</span></li>
          <li>Vault recovery: <span className="text-gold">vault@whowasi.uk</span></li>
          <li>Legal &amp; abuse: <span className="text-gold">legal@whowasi.uk</span></li>
        </ul>
        <p className="mt-3 text-white/35 text-xs">
          WHO WAS I · Living Memorial Platform · whowasi.uk<br />
          Registered in England and Wales · ICO registration number: [pending]
        </p>
      </Section>

    </PageShell>
  )
}
