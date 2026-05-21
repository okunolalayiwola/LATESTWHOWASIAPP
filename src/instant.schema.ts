// src/instant.schema.ts — adds wills entity + memorialWills link + intent/isSelf
// Drop this in to replace the existing schema file.

import { i } from "@instantdb/react"

const _schema = i.schema({
  entities: {

    $files:   i.entity({ path: i.string().unique().indexed(), url: i.string() }),
    $streams: i.entity({ abortReason: i.string().optional(), clientId: i.string().unique().indexed(), done: i.boolean().optional(), size: i.number().optional() }),
    $users:   i.entity({ email: i.string().unique().indexed().optional(), imageURL: i.string().optional(), type: i.string().optional() }),

    memorials: i.entity({
      name:               i.string(),
      subtitle:           i.string().optional(),
      years:              i.string().optional(),
      bio:                i.string().optional(),
      description:        i.string().optional(),
      color:              i.string().optional(),   // legacy Tailwind class (kept for compat)
      themeHex:           i.string().optional(),   // "#92400e" — primary accent hex color
      tributeCount:       i.number().optional(),
      candleCount:        i.number().optional(),
      visibility:         i.string().optional(),
      dob:                i.string().optional(),
      dod:                i.string().optional(),
      dodYear:            i.string().optional(),   // year of death (family-set)
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
      isSelf:             i.boolean().optional(),  // true = this memorial IS the creator
      countryCode:        i.string().optional(),  // creator's country at creation time (for flag)
      pronouns:           i.string().optional(),  // 'he' | 'she' | 'they' — drives form copy + UI pronoun usage
    }),

    tributes: i.entity({
      author:          i.string(),
      type:            i.string(),
      content:         i.string(),
      color:           i.string().optional(),
      createdAt:       i.number(),
      text:            i.string().optional(),
      authorName:      i.string().optional(),
      authorId:        i.string().optional(),
      authorPhoto:     i.string().optional(),
      likes:           i.number().optional(),
      reactions:       i.json().optional(),
      photoUrl:        i.string().optional(),  // optional image attached to tribute
      photoCaption:    i.string().optional(),  // caption for the attached image
    }),

    profiles: i.entity({
      userId:              i.string(),
      firstName:           i.string().optional(),   // given name — used for greetings & recognition
      lastName:            i.string().optional(),   // family name
      displayName:         i.string().optional(),   // firstName + lastName (full name)
      country:             i.string().optional(),   // country name e.g. 'United Kingdom'
      countryCode:         i.string().optional(),   // ISO 3166-1 alpha-2 e.g. 'GB'
      photoUrl:            i.string().optional(),
      onboarded:           i.boolean().optional(),
      createdAt:           i.number().optional(),
      plan:                i.string().optional(),
      stripeCustomerId:    i.string().optional(),
      subscribedAt:        i.number().optional(),
      familyOwnerId:       i.string().optional(),   // set when this user joins a family
      joinedFamilyAt:      i.number().optional(),
      notifyAnniversaries: i.boolean().optional(),
      notifyTributes:      i.boolean().optional(),
      notifyFamily:        i.boolean().optional(),
      intent:              i.string().optional(),   // 'self' | 'other'
    }),

    photos: i.entity({
      url:         i.string(),
      caption:     i.string().optional(),
      createdAt:   i.number().optional(),
      takenAt:     i.number().optional(),
      displayDate: i.string().optional(),
      source:      i.string().optional(),
    }),

    familyMembers: i.entity({
      name:       i.string(),
      avatar:     i.string().optional(),
      photo:      i.string().optional(),
      born:       i.number().optional(),
      died:       i.number().optional(),
      alive:      i.boolean().optional(),
      relation:   i.string().optional(),
      generation: i.number().optional(),
      ring:       i.number().optional(),
      angle:      i.number().optional(),
      byMarriage: i.boolean().optional(),
      bio:        i.string().optional(),
      ownerId:    i.string().optional(),
      memorialId: i.string().optional(),
      createdAt:  i.number().optional(),
      updatedAt:  i.number().optional(),
    }),

    invites: i.entity({
      code:          i.string().indexed(),
      familyOwnerId: i.string().indexed(),
      createdAt:     i.number(),
      expiresAt:     i.number(),
      used:          i.boolean().optional(),
      usedBy:        i.string().optional(),
      usedAt:        i.number().optional(),
    }),

    letters: i.entity({
      title:         i.string(),
      recipientName: i.string().optional(),
      content:       i.string(),
      unlockType:    i.string(),
      unlockDate:    i.number().optional(),
      unlockEvent:   i.string().optional(),
      isLocked:      i.boolean().optional(),
      createdBy:     i.string().optional(),
      createdAt:     i.number(),
    }),

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

    // ── Family Connections (request → approve → appear in tree) ──────────────
    familyConnections: i.entity({
      fromUserId:    i.string().indexed(),   // person claiming the relationship
      fromName:      i.string(),             // their display name
      fromEmail:     i.string().optional(),  // their email
      fromPhoto:     i.string().optional(),  // their profile photo
      toMemorialId:  i.string().indexed(),   // which memorial they're connecting to
      toUserId:      i.string().indexed(),   // memorial owner's userId
      relation:      i.string(),             // canonical relation value
      status:        i.string().indexed(),   // 'pending' | 'approved' | 'rejected'
      verifyToken:   i.string().unique().indexed(), // one-time token for email link
      requestedAt:   i.number(),
      approvedAt:    i.number().optional(),
      approvalNote:  i.string().optional(),
    }),

    // ── Family Messages (private, approved-members only) ──────────────────────
    familyMessages: i.entity({
      memorialId:  i.string().indexed(),
      fromUserId:  i.string(),
      fromName:    i.string(),
      fromPhoto:   i.string().optional(),
      content:     i.string(),
      photoUrl:    i.string().optional(),
      createdAt:   i.number(),
      readBy:      i.json().optional(),   // array of userIds who have read it
    }),

    // ── Tribute Comments (family members commenting under tributes) ───────────
    tributeComments: i.entity({
      tributeId:   i.string().indexed(),
      memorialId:  i.string().indexed(),
      authorId:    i.string(),
      authorName:  i.string(),
      authorPhoto: i.string().optional(),
      content:     i.string(),
      createdAt:   i.number(),
    }),

    // ── NEW: Wills ────────────────────────────────────────────────────────────
    wills: i.entity({
      // Identity
      testatorName:    i.string(),
      dateOfBirth:     i.string().optional(),
      address:         i.string().optional(),

      // Structured data stored as JSON arrays
      properties:      i.json().optional(),   // [{type, address, value, beneficiary, pct}]
      financialAssets: i.json().optional(),   // [{type, institution, accountRef, value, beneficiary, pct}]
      possessions:     i.json().optional(),   // free text or array
      digitalAssets:   i.json().optional(),   // array of strings

      // Beneficiaries
      beneficiaries:   i.json().optional(),   // [{name, relation, contact}]

      // Executor
      executorName:    i.string().optional(),
      executorContact: i.string().optional(),

      // Wishes
      funeralWishes:   i.string().optional(),
      medicalWishes:   i.string().optional(),
      specialNote:     i.string().optional(),

      // Metadata
      status:          i.string().optional(), // 'draft' | 'complete'
      createdAt:       i.number(),
      updatedAt:       i.number().optional(),
    }),

  },

  links: {

    $streams$files:          { forward: { on:"$streams", has:"many", label:"$files"    }, reverse: { on:"$files",    has:"one",  label:"$stream",   onDelete:"cascade" } },
    $usersLinkedPrimaryUser: { forward: { on:"$users",   has:"one",  label:"linkedPrimaryUser", onDelete:"cascade" }, reverse: { on:"$users", has:"many", label:"linkedGuestUsers" } },

    memorialTributes:  { forward: { on:"memorials", has:"many", label:"tributes"  }, reverse: { on:"tributes",  has:"one", label:"memorial" } },
    memorialPhotos:    { forward: { on:"memorials", has:"many", label:"photos"    }, reverse: { on:"photos",    has:"one", label:"memorial" } },
    memorialLetters:   { forward: { on:"memorials", has:"many", label:"letters"   }, reverse: { on:"letters",   has:"one", label:"memorial" } },
    memorialDocuments: { forward: { on:"memorials", has:"many", label:"documents" }, reverse: { on:"documents", has:"one", label:"memorial" } },

    // ── NEW ────────────────────────────────────────────────────────────────────
    memorialWills:     { forward: { on:"memorials", has:"many", label:"wills"     }, reverse: { on:"wills",     has:"one", label:"memorial" } },

  },

  rooms: {},
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema
export type { AppSchema }
export default schema
