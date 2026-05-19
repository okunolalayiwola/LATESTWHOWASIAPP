// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  memorials: {
    allow: {
      view: "true",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isOwner": "auth.id != null && auth.id == data.createdBy",
    },
  },
  tributes: {
    allow: {
      view: "true",
      create: "auth.id != null",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isOwner": "auth.id != null && auth.id == data.author",
    },
  },
} satisfies InstantRules;

export default rules;
