import { defineMessages } from "../core"

export const team = defineMessages({
  fr: {
    description:
      "Les PR ouvertes par l'équipe dans les repos suivis, hors les tiennes et celles des bots. Pour chaque PR bloquée : ce qui coince, ce qu'il faut faire, et qui doit agir.",
    problems: {
      "no-reviewer": {
        label: "Sans reviewer",
        hint: "Ni reviewer désigné, ni review faite : personne ne sait qu'elle attend.",
      },
      changes: {
        label: "Changements en attente",
        hint: "Des changements ont été demandés et l'auteur n'a rien poussé depuis plus de 2 jours.",
      },
      ci: {
        label: "CI en échec",
        hint: "La CI du dernier commit échoue : la PR ne peut pas être mergée en l'état.",
      },
      conflict: {
        label: "En conflit",
        hint: "La branche est en conflit avec la base : il faut rebaser.",
      },
      stale: {
        label: "Ouverte depuis longtemps",
        hint: "Ouverte depuis plus longtemps que le seuil des réglages.",
      },
    },
    /** A team reviewer stored as `team:leads`. */
    teamReviewer: (name: string) => `équipe ${name}`,
    theAuthor: "l'auteur",
    diagnosis: {
      noReviewer: {
        reason: "Personne n'est désigné pour la reviewer.",
        nextStep: "Prends la review ou assigne quelqu'un avec « Reviewers ».",
      },
      changes: {
        reason: (since: string) =>
          `Des changements ont été demandés et rien n'a été poussé depuis ${since}.`,
        nextStep: (author: string) =>
          `Relance ${author} : il lui reste des retours à traiter.`,
      },
      ci: {
        reason: "La CI du dernier commit échoue.",
        nextStep: (author: string) =>
          `${author} doit la corriger avant toute review.`,
      },
      conflict: {
        reason: "La branche est en conflit avec la base.",
        nextStep: (author: string) =>
          `${author} doit la rebaser ou résoudre les conflits.`,
      },
      stale: {
        waitingReason: (age: string) =>
          `Ouverte depuis ${age}, toujours en attente de review.`,
        yourTurn: "Ta review est attendue : c'est à toi de jouer.",
        nudge: (reviewers: string) => `Relance ${reviewers}.`,
        reason: (age: string) => `Ouverte depuis ${age}.`,
        askAuthor: (author: string) =>
          `Demande à ${author} si elle doit encore avancer ou être fermée.`,
      },
    },
    holder: {
      title: "La balle est chez",
      lead: "Toi ou un reviewer",
      author: " (auteur)",
      review: " (review)",
    },
    row: {
      by: (login: string) => `· par @${login}`,
      ghost: "fantôme",
      opened: (ago: string) => `· ouverte ${ago}`,
      lastActivity: (ago: string) => `· dernière activité ${ago}`,
      draft: "Brouillon : l'auteur ne la considère pas encore prête.",
      healthy: "En bonne voie : reviewer désigné, CI et branche sans souci.",
      takeHint: (folder: string) =>
        `Te désigne comme reviewer sur GitHub : la PR arrive dans « ${folder} » à la prochaine synchro.`,
      take: "Prendre la review",
      taken: "Review prise",
    },
    stuckOf: (stuck: number, total: number) =>
      `bloquée${stuck > 1 ? "s" : ""} sur ${total}`,
    filters: {
      label: "Filtrer les PR",
      stuck: "À débloquer",
      all: "Toutes",
      stuckHint: "Les PR qui n'avancent pas, les plus anciennes d'abord.",
      allHint: "Toutes les PR ouvertes de l'équipe, les bloquées d'abord.",
    },
    empty: {
      title: "Rien de bloqué",
      description:
        "Toutes les PR de l'équipe ont un reviewer et avancent. La liste se met à jour toutes les 10 minutes.",
    },
    staleFootnote: (
      label: string,
      days: number,
      settings: string,
      section: string
    ) =>
      `« ${label} » : plus de ${days} jours, réglable dans ${settings} > ${section}.`,
  },
  en: {
    description:
      "PRs opened by the team in the tracked repos, except yours and the bots'. For each blocked PR: what's stuck, what to do, and who has to act.",
    problems: {
      "no-reviewer": {
        label: "No reviewer",
        hint: "No reviewer assigned and no review given: nobody knows it's waiting.",
      },
      changes: {
        label: "Changes pending",
        hint: "Changes were requested and the author hasn't pushed anything for over 2 days.",
      },
      ci: {
        label: "CI failing",
        hint: "The CI of the last commit fails: the PR can't be merged as is.",
      },
      conflict: {
        label: "Conflicting",
        hint: "The branch conflicts with the base: it needs a rebase.",
      },
      stale: {
        label: "Open for a long time",
        hint: "Open for longer than the threshold in the settings.",
      },
    },
    teamReviewer: (name: string) => `team ${name}`,
    theAuthor: "the author",
    diagnosis: {
      noReviewer: {
        reason: "Nobody is assigned to review it.",
        nextStep: "Take the review or assign someone with “Reviewers”.",
      },
      changes: {
        reason: (since: string) =>
          `Changes were requested and nothing has been pushed for ${since}.`,
        nextStep: (author: string) =>
          `Nudge ${author}: there is feedback left to address.`,
      },
      ci: {
        reason: "The CI of the last commit fails.",
        nextStep: (author: string) =>
          `${author} has to fix it before any review.`,
      },
      conflict: {
        reason: "The branch conflicts with the base.",
        nextStep: (author: string) =>
          `${author} has to rebase it or resolve the conflicts.`,
      },
      stale: {
        waitingReason: (age: string) =>
          `Open for ${age}, still waiting for a review.`,
        yourTurn: "Your review is expected: your move.",
        nudge: (reviewers: string) => `Nudge ${reviewers}.`,
        reason: (age: string) => `Open for ${age}.`,
        askAuthor: (author: string) =>
          `Ask ${author} whether it should still move forward or be closed.`,
      },
    },
    holder: {
      title: "The ball is with",
      lead: "You or a reviewer",
      author: " (author)",
      review: " (review)",
    },
    row: {
      by: (login: string) => `· by @${login}`,
      ghost: "ghost",
      opened: (ago: string) => `· opened ${ago}`,
      lastActivity: (ago: string) => `· last activity ${ago}`,
      draft: "Draft: the author doesn't consider it ready yet.",
      healthy: "On track: reviewer assigned, CI and branch all good.",
      takeHint: (folder: string) =>
        `Assigns you as a reviewer on GitHub: the PR lands in “${folder}” at the next sync.`,
      take: "Take the review",
      taken: "Review taken",
    },
    stuckOf: (_stuck: number, total: number) => `stuck out of ${total}`,
    filters: {
      label: "Filter the PRs",
      stuck: "To unblock",
      all: "All",
      stuckHint: "PRs that don't move, oldest first.",
      allHint: "All the team's open PRs, blocked ones first.",
    },
    empty: {
      title: "Nothing blocked",
      description:
        "Every team PR has a reviewer and is moving. The list refreshes every 10 minutes.",
    },
    staleFootnote: (
      label: string,
      days: number,
      settings: string,
      section: string
    ) =>
      `“${label}”: over ${days} days, adjustable in ${settings} > ${section}.`,
  },
})
