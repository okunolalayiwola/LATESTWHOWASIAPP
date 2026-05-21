// instant.schema.ts — ROOT (CLI pushes this to InstantDB)
// Keep this file in sync with src/instant.schema.ts
// To push: npx instant-cli push schema  (from project root)

import { i } from "@instantdb/react"

const _schema = i.schema({
  entities: {

    // ─── InstantDB system entities ───────────────────────────────────────────
    $files:   i.entity({ path: i.string().unique().indexed(), url: i.string() }),
    $streams: i.entity({ abortReason: i.string().optional(), clientId: i.string().unique().indexed(), done: i.boolean().optional(), size: i.number().optional() }),
    $users:   i.entity({ email: i.string().unique().indexed().optional(), imageURL: i.string().optional(), type: i.string().optional() }),

    // ─── Memorials ──────────────────────────────────────────────────────────
    memorials: i.entity({
      name:               i.string(),
      subtitle:           i.string().optional(),
      years:              i.string().optional(),
      bio:                i.string().optional(),
      description:        i.string().optional(),
      color:              i.string().optional(),    // legacy Tailwind class
      themeHex:           i.string().optional(),    // "#92400e" hex accent
      tributeCount:       i.number().optional(),
      candleCount:        i.number().optional(),
      visibility:         i.string().optional(),    // 'public' | 'family' | 'private'
      dob:                i.string().optional(),
      dod:                i.string().optional(),
      dodYear:            i.string().optional(),    // year of death (family-set)
      createdAt:          i.number(),
      createdBy:          i.string(),
      creatorId:          i.string().optional(),
      photo:              i.string().optional(),
      coverPhoto:         i.string().optional(),
      born:               i.string().optional(),
      died:               i.string().optional(),
      age:                i.string().optional(),
      location:           i.string().optional(),
      birthYear:          i.string().optional(),
      deathYear:          i.string().optional(),
      relation:           i.string().optional(),
      alive:              i.boolean().optional(),
      allowTributes:      i.boolean().optional(),
      updatedAt:          i.number().optional(),
      voiceUrl:           i.string().optional(),
      voiceDuration:      i.number().optional(),
      elevenLabsVoiceId:  i.string().optional(),
      viewCount:          i.number().optional(),
      isSelf:             i.boolean().optional(),   // true = this memorial IS the creator
      countryCode:        i.string().optional(),   // creator's country at creation time (flag display)
      pronouns:           i.string().optional(),   // 'he' | 'she' | 'they' — drives form copy + UI pronoun usage
    }),

    // ─── Tributes ────────────────────────────────────────────────────────────
    tributes: i.entity({
      author:       i.string(),
      type:         i.string(),
      content:      i.string(),
      color:        i.string().optional(),
      createdAt:    i.number(),
      text:         i.string().optional(),
      authorName:   i.string().optional(),
      authorId:     i.string().optional(),
      authorPhoto:  i.string().optional(),
      likes:        i.number().optional(),
      reactions:    i.json().optional(),
      photoUrl:     i.string().optional(),     // image attached to tribute
      photoCaption: i.string().optional(),
    }),

    // ─── Tribute Comments (family-only threads under tributes) ───────────────
    tributeComments: i.entity({
      tributeId:   i.string().indexed(),
      memorialId:  i.string().indexed(),
      authorId:    i.string(),
      authorName:  i.string(),
      authorPhoto: i.string().optional(),
      content:     i.string(),
      createdAt:   i.number(),
    }),

    // ─── Profiles ────────────────────────────────────────────────────────────
    profiles: i.entity({
      userId:              i.string(),
      firstName:           i.string().optional(),    // given name — used for greetings & recognition
      lastName:            i.string().optional(),    // family name
      displayName:         i.string().optional(),    // firstName + lastName (full name)
      country:             i.string().optional(),    // country name e.g. 'United Kingdom'
      countryCode:         i.string().optional(),    // ISO 3166-1 alpha-2 e.g. 'GB'
      photoUrl:            i.string().optional(),
      onboarded:           i.boolean().optional(),
      createdAt:           i.number().optional(),
      plan:                i.string().optional(),    // 'free' | 'family' | 'legacy'
      stripeCustomerId:    i.string().optional(),
      subscribedAt:        i.number().optional(),
      familyOwnerId:       i.string().optional(),
      joinedFamilyAt:      i.number().optional(),
      notifyAnniversaries: i.boolean().optional(),
      notifyTributes:      i.boolean().optional(),
      notifyFamily:        i.boolean().optional(),
      intent:              i.string().optional(),    // 'self' | 'other'
    }),

    // ─── Photos ──────────────────────────────────────────────────────────────
    photos: i.entity({
      url:         i.string(),
      caption:     i.string().optional(),
      createdAt:   i.number().optional(),
      takenAt:     i.number().optional(),      // original Unix timestamp (EXIF/social)
      displayDate: i.string().optional(),      // "15 June 2019"
      source:      i.string().optional(),      // 'upload' | 'facebook' | 'instagram'
      // Internal flags — drive AI persona enrichment (not exposed to users)
      usedForTraining:     i.boolean().optional(),  // first-batch photos that shape the AI persona
      addedAfterCreation:  i.boolean().optional(),  // true = added later; AI persona untouched
      aiDescription:       i.string().optional(),   // optional vision-extracted scene/context
    }),

    // ─── Family Members (orbital tree nodes) ─────────────────────────────────
    familyMembers: i.entity({
      name:       i.string(),
      avatar:     i.string().optional(),
      photo:      i.string().optional(),
      born:       i.number().optional(),
      died:       i.number().optional(),
      alive:      i.boolean().optional(),
      relation:   i.string().optional(),
      generation: i.number().optional(),
      ring:       i.number().optional(),       // 1 | 2 | 3 (orbital ring)
      angle:      i.number().optional(),       // 0–360
      byMarriage: i.boolean().optional(),
      bio:        i.string().optional(),
      ownerId:    i.string().optional(),
      memorialId: i.string().optional(),
      createdAt:  i.number().optional(),
      updatedAt:  i.number().optional(),
    }),

    // ─── Invites ─────────────────────────────────────────────────────────────
    invites: i.entity({
      code:          i.string().indexed(),
      familyOwnerId: i.string().indexed(),
      // memorialId — each memorial has its own dedicated invite code so
      // family members are connected to the specific memorial they're invited
      // to, not just the owner's overall family circle.
      memorialId:    i.string().optional().indexed(),
      memorialName:  i.string().optional(),   // human label so JoinPage can show "join Grace's family"
      createdAt:     i.number(),
      expiresAt:     i.number(),
      used:          i.boolean().optional(),
      usedBy:        i.string().optional(),
      usedAt:        i.number().optional(),
    }),

    // ─── Family Connections (request → approve → appear in tree) ─────────────
    familyConnections: i.entity({
      fromUserId:   i.string().indexed(),    // person claiming the relationship
      fromName:     i.string(),              // their display name
      fromEmail:    i.string().optional(),   // their email
      fromPhoto:    i.string().optional(),   // their profile photo
      toMemorialId: i.string().indexed(),    // which memorial they're connecting to
      toUserId:     i.string().indexed(),    // memorial owner's userId
      relation:     i.string(),              // final agreed relation
      status:       i.string().indexed(),    // 'pending' | 'approved' | 'rejected'
      verifyToken:  i.string().unique().indexed(), // one-time email verification token
      requestedAt:  i.number(),
      approvedAt:   i.number().optional(),
      approvalNote: i.string().optional(),
      // Owner can suggest a different relation. While suggestedRelation is set
      // + status is 'pending', the request is awaiting the INVITER's
      // confirmation of the owner's counter-suggestion.
      suggestedRelation:  i.string().optional(),
      suggestedAt:        i.number().optional(),
      inviterRespondedAt: i.number().optional(),
    }),

    // ─── Persona Profiles — AI knowledge base per memorial ──────────────────
    // Structured biographical and personality data used to build the system
    // prompt for the "hear them speak" AI conversation. One profile per
    // memorial. All fields are long-text optional so the form can save
    // progressively and chapters can be completed in any order.
    personaProfiles: i.entity({
      memorialId:   i.string().unique().indexed(),
      ownerId:      i.string().indexed(),
      // Identity foundation
      birthplace:        i.string().optional(),
      raisedIn:          i.string().optional(),
      occupation:        i.string().optional(),
      careerSummary:     i.string().optional(),   // long
      education:         i.string().optional(),   // long
      // Personality + voice
      personalityTraits: i.string().optional(),   // long — adjectives + how they act
      senseOfHumor:      i.string().optional(),
      catchphrases:      i.string().optional(),   // sayings they'd repeat
      speechStyle:       i.string().optional(),   // accent, vocabulary, formality
      // Life chapters (chronological — each is long-text)
      childhood:         i.string().optional(),
      youngAdult:        i.string().optional(),
      midLife:           i.string().optional(),
      laterYears:        i.string().optional(),
      // People — relationships in their life
      spouse:            i.string().optional(),
      children:          i.string().optional(),
      parents:           i.string().optional(),
      siblings:          i.string().optional(),
      closestFriends:    i.string().optional(),
      // Worldview
      values:            i.string().optional(),   // long
      faith:             i.string().optional(),
      philosophy:        i.string().optional(),
      // Memories
      signatureStories:  i.string().optional(),   // anecdotes they retold
      proudMoments:      i.string().optional(),
      hobbies:           i.string().optional(),
      // Voice samples — example things they'd say
      exampleResponses:  i.string().optional(),
      // Meta — which chapters have been completed at least once
      completedChapters: i.json().optional(),     // string[]
      createdAt:         i.number(),
      updatedAt:         i.number().optional(),
    }),

    // ─── Family Messages (private, approved-members only) ────────────────────
    familyMessages: i.entity({
      memorialId: i.string().indexed(),
      fromUserId: i.string(),
      fromName:   i.string(),
      fromPhoto:  i.string().optional(),
      content:    i.string(),
      photoUrl:   i.string().optional(),
      createdAt:  i.number(),
      readBy:     i.json().optional(),       // string[] — userIds who have read it
    }),

    // ─── Legacy Letters (time-capsule messages) ───────────────────────────────
    letters: i.entity({
      title:         i.string(),
      recipientName: i.string().optional(),
      content:       i.string(),
      unlockType:    i.string(),             // 'date' | 'event' | 'immediate'
      unlockDate:    i.number().optional(),
      unlockEvent:   i.string().optional(),  // 'graduation' | 'wedding' | '18th' etc.
      isLocked:      i.boolean().optional(),
      createdBy:     i.string().optional(),
      createdAt:     i.number(),
    }),

    // ─── Documents (wills, wishes, financial records) ─────────────────────────
    documents: i.entity({
      title:       i.string(),
      type:        i.string(),
      description: i.string().optional(),
      fileUrl:     i.string(),
      fileName:    i.string(),
      fileType:    i.string().optional(),
      fileSize:    i.number().optional(),
      unlockType:  i.string(),
      unlockDate:  i.number().optional(),
      unlockEvent: i.string().optional(),
      isLocked:    i.boolean().optional(),
      createdBy:   i.string().optional(),
      createdAt:   i.number(),
    }),

    // ─── Wills ────────────────────────────────────────────────────────────────
    wills: i.entity({
      testatorName:    i.string(),
      dateOfBirth:     i.string().optional(),
      address:         i.string().optional(),
      properties:      i.json().optional(),    // [{type, address, value, beneficiary, pct}]
      financialAssets: i.json().optional(),    // [{type, institution, accountRef, value, beneficiary, pct}]
      possessions:     i.json().optional(),
      digitalAssets:   i.json().optional(),
      beneficiaries:   i.json().optional(),    // [{name, relation, contact}]
      executorName:    i.string().optional(),
      executorContact: i.string().optional(),
      funeralWishes:   i.string().optional(),
      medicalWishes:   i.string().optional(),
      specialNote:     i.string().optional(),
      status:          i.string().optional(),  // 'draft' | 'complete'
      createdAt:       i.number(),
      updatedAt:       i.number().optional(),
    }),

  },

  // ─── Links ─────────────────────────────────────────────────────────────────
  links: {

    $streams$files:          { forward: { on:"$streams",  has:"many", label:"$files"   }, reverse: { on:"$files",    has:"one", label:"$stream",   onDelete:"cascade" } },
    $usersLinkedPrimaryUser: { forward: { on:"$users",    has:"one",  label:"linkedPrimaryUser", onDelete:"cascade" }, reverse: { on:"$users", has:"many", label:"linkedGuestUsers" } },

    memorialTributes:  { forward: { on:"memorials", has:"many", label:"tributes"  }, reverse: { on:"tributes",  has:"one", label:"memorial" } },
    memorialPhotos:    { forward: { on:"memorials", has:"many", label:"photos"    }, reverse: { on:"photos",    has:"one", label:"memorial" } },
    memorialLetters:   { forward: { on:"memorials", has:"many", label:"letters"   }, reverse: { on:"letters",   has:"one", label:"memorial" } },
    memorialDocuments: { forward: { on:"memorials", has:"many", label:"documents" }, reverse: { on:"documents", has:"one", label:"memorial" } },
    memorialWills:     { forward: { on:"memorials", has:"many", label:"wills"     }, reverse: { on:"wills",     has:"one", label:"memorial" } },

  },

  rooms: {},
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema
export type { AppSchema }
export default schema
