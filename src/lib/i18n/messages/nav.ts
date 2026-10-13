import { defineMessages } from "../core"

export const nav = defineMessages({
  fr: {
    folders: {
      review: {
        label: "À reviewer",
        hint: "PR ouvertes où ta review est demandée",
      },
      awaiting: {
        label: "On t'attend",
        hint: "Mentions et fils où tu n'as pas encore répondu (ceux de tes PR restent dans « Mes PR »)",
      },
      mine: {
        label: "Mes PR",
        hint: "Toutes tes PR ouvertes, brouillons compris : réponses, retours, CI, prêtes à merger",
      },
      other: {
        label: "Le reste",
        hint: "Notifications sans action attendue de ta part",
      },
      snoozed: {
        label: "En pause",
        hint: "Reviendront à l'heure choisie",
      },
      done: {
        label: "Traités",
        hint: "Reviennent s'il y a du nouveau",
      },
    },
    pages: {
      dashboard: "Vue d'ensemble",
      team: "Équipe",
      recap: "Récap du jour",
      issues: "Mes issues",
      settings: "Réglages",
    },
    status: {
      errorTitle: "Quelque chose a coincé",
      errorDescription: (app: string) =>
        `${app} n'a pas pu afficher cette page. Souvent, GitHub ou la connexion a répondu de travers : réessaie dans un instant.`,
      errorDetail: "Détail de l'erreur",
      notFoundTitle: "Page introuvable",
      notFoundDescription: "Cette adresse ne correspond à aucune vue de l'app.",
      backToInbox: "Retour à l'inbox",
    },
  },
  en: {
    folders: {
      review: {
        label: "To review",
        hint: "Open PRs where your review is requested",
      },
      awaiting: {
        label: "Waiting on you",
        hint: "Mentions and threads you haven't answered yet (those on your PRs stay in “My PRs”)",
      },
      mine: {
        label: "My PRs",
        hint: "All your open PRs, drafts included: replies, feedback, CI, ready to merge",
      },
      other: {
        label: "Everything else",
        hint: "Notifications that expect no action from you",
      },
      snoozed: {
        label: "Snoozed",
        hint: "Will come back at the chosen time",
      },
      done: {
        label: "Done",
        hint: "Come back when something new happens",
      },
    },
    pages: {
      dashboard: "Overview",
      team: "Team",
      recap: "Daily recap",
      issues: "My issues",
      settings: "Settings",
    },
    status: {
      errorTitle: "Something got stuck",
      errorDescription: (app: string) =>
        `${app} couldn't display this page. GitHub or the connection often answered badly: try again in a moment.`,
      errorDetail: "Error details",
      notFoundTitle: "Page not found",
      notFoundDescription: "This address matches no view of the app.",
      backToInbox: "Back to the inbox",
    },
  },
})
