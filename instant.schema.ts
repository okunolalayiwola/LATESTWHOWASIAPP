// src/instant.schema.ts — FINAL MASTER
// Every entity from every build session included.
// Replace your existing instant.schema.ts with this file.

import { i } from "@instantdb/react"

const _schema = i.schema({
  entities: {

    // ─── InstantDB system entities ───────────────────────────────────────────

    $files: i.entity({
      path: i.string().unique().indexed(),
      url:  i.string(),
    }),
    $streams: i.entity({
      abortReason: i.string().optional(),
      clientId:    i.string().unique().indexed(),
      done:        i.boolean().optional(),
      size:        i.number().optional(),
    }),
    $users: i.entity({
      email:    i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type:     i.string().optional(),
    }),

    // ─── Memorials ──────────────────────────────────────────────────────────

    memorials: i.entity({
      // Identity
      name:          i.string(),
      subtitle:      i.string().optional(),
      relation:      i.string().optional(),

      // Dates / life record
      years:         i.string().optional(),
      birthYear:     i.string().optional(),
      deathYear:     i.string().optional(),
      born:          i.string().optional(),
      died:          i.string().optional(),
      age:           i.string().optional(),
      alive:         i.boolean().optional(),

      // Location
      location:      i.string().optional(),

      // Content
      bio:           i.string().optional(),
      description:   i.string().optional(),
      color:         i.string().optional(),

      // Media
      photo:         i.string().optional(),   // portrait / avatar
      coverPhoto:    i.string().optional(),   // hero cover image

      // Voice / AI
      voiceUrl:           i.string().optional(),
      voiceDuration:      i.number().optional(),
      elevenLabsVoiceId:  i.string().optional(),

      // Privacy
      visibility:    i.string().optional(),   // 'public' | 'family' | 'private'
      allowTributes: i.boolean().optional(),

      // Ownership
      creatorId:     i.string().optional(),
      createdBy:     i.string().optional(),

      // Counts (denormalised for Explore performance)
      tributeCount:  i.number().optional(),
      candleCount:   i.number().optional(),

      // View count
      viewCount:     i.number().optional(),

      // Timestamps
      createdAt:     i.number().optional(),
      updatedAt:     i.number().optional(),
    }),

    // ─── Tributes ────────────────────────────────────────────────────────────

    tributes: i.entity({
      text:        i.string().optional(),
      content:     i.string().optional(),
      type:        i.string().optional(),      // 'tribute' | 'candle' | 'memory'
      author:      i.string().optional(),
      authorName:  i.string().optional(),
      authorId:    i.string().optional(),
      authorPhoto: i.string().optional(),
      likes:       i.number().optional(),
      reactions:   i.json().optional(),
      createdAt:   i.number().optional(),
    }),

    // ─── Photos ──────────────────────────────────────────────────────────────

    photos: i.entity({
      url:         i.string(),
      caption:     i.string().optional(),

      // Social media import metadata
      takenAt:     i.number().optional(),    // original Unix timestamp from Facebook/Instagram
      displayDate: i.string().optional(),   // human-readable: "15 June 2019"
      source:      i.string().optional(),   // 'facebook' | 'instagram' | null

      createdAt:   i.number().optional(),
    }),

    // ─── Profiles ────────────────────────────────────────────────────────────

    profiles: i.entity({
      userId:      i.string(),
      displayName: i.string().optional(),
      photoUrl:    i.string().optional(),
      onboarded:   i.boolean().optional(),
      plan:        i.string().optional(),    // 'free' | 'family' | 'legacy'
      subscribedAt: i.number().optional(),
      stripeCustomerId: i.string().optional(),
      createdAt:   i.number().optional(),
    }),

    // ─── Family members (orbital family tree) ────────────────────────────────

    familyMembers: i.entity({
      name:       i.string(),
      avatar:     i.string().optional(),
      photo:      i.string().optional(),
      born:       i.number().optional(),
      died:       i.number().optional(),
      alive:      i.boolean().optional(),
      relation:   i.string().optional(),
      generation: i.number().optional(),
      ring:       i.number().optional(),     // 1 | 2 | 3 (orbital ring)
      angle:      i.number().optional(),     // 0–360
      byMarriage: i.boolean().optional(),
      bio:        i.string().optional(),
      ownerId:    i.string().optional(),
      createdAt:  i.number().optional(),
      updatedAt:  i.number().optional(),
    }),

    // ─── Invites (family tree sharing) ───────────────────────────────────────

    invites: i.entity({
      code:          i.string().indexed(),   // 8-char code, indexed for lookup
      familyOwnerId: i.string().indexed(),
      createdAt:     i.number(),
      expiresAt:     i.number(),             // 7 days from creation
      used:          i.boolean().optional(),
    }),

    // ─── Legacy Letters (time-capsule messages) ───────────────────────────────

    letters: i.entity({
      title:         i.string(),
      recipientName: i.string().optional(),
      content:       i.string(),
      unlockType:    i.string(),             // 'date' | 'event' | 'immediate'
      unlockDate:    i.number().optional(),  // Unix ms timestamp
      unlockEvent:   i.string().optional(),  // 'graduation' | 'wedding' | '18th' etc.
      isLocked:      i.boolean().optional(),
      createdBy:     i.string().optional(),  // user.id
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

  },

  // ─── Links ─────────────────────────────────────────────────────────────────

  links: {

    $streams$files: {
      forward:  { on: "$streams", has: "many", label: "$files" },
      reverse:  { on: "$files",   has: "one",  label: "$stream", onDelete: "cascade" },
    },

    $usersLinkedPrimaryUser: {
      forward:  { on: "$users", has: "one",  label: "linkedPrimaryUser", onDelete: "cascade" },
      reverse:  { on: "$users", has: "many", label: "linkedGuestUsers" },
    },

    // Memorial → Tributes
    memorialTributes: {
      forward:  { on: "memorials", has: "many", label: "tributes" },
      reverse:  { on: "tributes",  has: "one",  label: "memorial" },
    },

    // Memorial → Photos
    memorialPhotos: {
      forward:  { on: "memorials", has: "many", label: "photos" },
      reverse:  { on: "photos",    has: "one",  label: "memorial" },
    },

    // Memorial → Letters (Legacy Letters)
    memorialLetters: {
      forward:  { on: "memorials", has: "many", label: "letters" },
      reverse:  { on: "letters",   has: "one",  label: "memorial" },
    },

    // Memorial → Documents
    memorialDocuments: {
      forward:  { on: "memorials", has: "many", label: "documents" },
      reverse:  { on: "documents", has: "one",  label: "memorial" },
    },

  },

  rooms: {},
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema
