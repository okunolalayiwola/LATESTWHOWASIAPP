// src/instant.perms.ts
// InstantDB permission rules — covers every entity in the schema.
// Docs: https://www.instantdb.com/docs/permissions
// Push: npx instant-cli push perms  (from project root)

import type { InstantRules } from "@instantdb/react";

const rules = {

  // ── Memorials ───────────────────────────────────────────────────────────────
  memorials: {
    allow: {
      view:   "true",                   // public by default; page hides content for private
      create: "isLoggedIn",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isOwner:    "auth.id != null && auth.id == data.createdBy",
    },
  },

  // ── Tributes ─────────────────────────────────────────────────────────────────
  tributes: {
    allow: {
      view:   "true",
      create: "isLoggedIn",
      update: "isAuthor",
      delete: "isAuthor",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isAuthor:   "auth.id != null && auth.id == data.authorId",
    },
  },

  // ── Tribute Comments (family members only — enforced client-side) ─────────────
  tributeComments: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isAuthor",
      delete: "isAuthor",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isAuthor:   "auth.id != null && auth.id == data.authorId",
    },
  },

  // ── Profiles ─────────────────────────────────────────────────────────────────
  profiles: {
    allow: {
      view:   "isLoggedIn",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isOwner:    "auth.id != null && auth.id == data.userId",
    },
  },

  // ── Photos ───────────────────────────────────────────────────────────────────
  photos: {
    allow: {
      view:   "true",
      create: "isLoggedIn",
      update: "isLoggedIn",
      delete: "isLoggedIn",
    },
    bind: {
      isLoggedIn: "auth.id != null",
    },
  },

  // ── Family Members (orbital tree nodes) ──────────────────────────────────────
  familyMembers: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isOwner:    "auth.id != null && auth.id == data.ownerId",
    },
  },

  // ── Invites ──────────────────────────────────────────────────────────────────
  invites: {
    allow: {
      view:   "isLoggedIn",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isOwner:    "auth.id != null && auth.id == data.familyOwnerId",
    },
  },

  // ── Family Connections ────────────────────────────────────────────────────────
  familyConnections: {
    allow: {
      view:   "isLoggedIn",           // both parties can see their own connections
      create: "isLoggedIn",           // any logged-in user can request a connection
      update: "isMemorialOwner",      // only memorial owner can approve/reject
      delete: "isParty",              // either party can remove
    },
    bind: {
      isLoggedIn:      "auth.id != null",
      isMemorialOwner: "auth.id != null && auth.id == data.toUserId",
      isParty:         "auth.id != null && (auth.id == data.fromUserId || auth.id == data.toUserId)",
    },
  },

  // ── Family Messages ───────────────────────────────────────────────────────────
  familyMessages: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isAuthor",             // only author can edit (e.g. readBy update done server-side)
      delete: "isAuthor",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isAuthor:   "auth.id != null && auth.id == data.fromUserId",
    },
  },

  // ── Legacy Letters ────────────────────────────────────────────────────────────
  letters: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isAuthor",
      delete: "isAuthor",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isAuthor:   "auth.id != null && auth.id == data.createdBy",
    },
  },

  // ── Documents ─────────────────────────────────────────────────────────────────
  documents: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isAuthor",
      delete: "isAuthor",
    },
    bind: {
      isLoggedIn: "auth.id != null",
      isAuthor:   "auth.id != null && auth.id == data.createdBy",
    },
  },

  // ── Wills ─────────────────────────────────────────────────────────────────────
  wills: {
    allow: {
      view:   "isLoggedIn",
      create: "isLoggedIn",
      update: "isLoggedIn",
      delete: "isLoggedIn",
    },
    bind: {
      isLoggedIn: "auth.id != null",
    },
  },

} satisfies InstantRules;

export default rules;
