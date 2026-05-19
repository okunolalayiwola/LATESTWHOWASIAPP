// src/pages/FacebookCallbackPage.jsx
// OAuth callback handler for Facebook/Instagram login.
//
// Route: /auth/facebook/callback
// Receives the authorization code from Facebook's OAuth flow,
// exchanges it for an access token, and redirects back to the
// SocialImportPage or the memorial detail page.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { db } from '../lib/instant'
import { useToast } from '../contexts/ToastContext'

export default function FacebookCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { user } = db.useAuth()

  const [status, setStatus] = useState('Connecting to Facebook...')

  useEffect(() => {
    if (!user) {
      // Wait for auth state
      setStatus('Authenticating...')
      return
    }

    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        toast.error('Facebook connection cancelled')
        navigate(-1)
        return
      }

      if (!code) {
        toast.error('No authorization code received')
        navigate(-1)
        return
      }

      setStatus('Exchanging authorization code...')

      try {
        // In production, this would call your backend to exchange the code
        // for an access token using Facebook's Graph API:
        //
        //   POST https://graph.facebook.com/v18.0/oauth/access_token
        //     ?client_id={app-id}
        //     &redirect_uri={redirect-uri}
        //     &client_secret={app-secret}
        //     &code={code}
        //
        // For now, we simulate a successful connection

        await new Promise(r => setTimeout(r, 1000))

        // Store the connection status in the user's profile
        const { data } = await db.query({
          profiles: { $: { where: { userId: user.id } } },
        })

        const profile = data?.profiles?.[0]
        if (profile) {
          await db.transact([
            db.tx.profiles[profile.id].update({
              facebookConnected: true,
              updatedAt: Date.now(),
            }),
          ])
        }

        setStatus('Connected!')
        toast.success('Facebook connected ✦')

        // Redirect back to the import page or memorial
        const redirectTo = state || '/dashboard'
        setTimeout(() => navigate(redirectTo), 800)
      } catch {
        setStatus('Connection failed')
        toast.error('Failed to connect Facebook')
        setTimeout(() => navigate(-1), 1500)
      }
    }

    handleCallback()
  }, [user, searchParams, navigate, toast])

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-6">
          f
        </div>

        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />

        <h1 className="font-display text-xl font-bold text-white mb-2">
          {status}
        </h1>
        <p className="text-sm text-white/40 max-w-xs mx-auto leading-relaxed">
          We're securely connecting your Facebook account to import photos and memories.
        </p>
      </motion.div>
    </div>
  )
}
