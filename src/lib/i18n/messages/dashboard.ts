import { defineMessages } from "../core"

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`

export const dashboard = defineMessages({
  fr: {
    description: (today: string) =>
      `${today} · ta charge, tes prochaines actions, la météo de l'équipe et les tendances.`,
    footnote:
      "Estimations : 5 à 60 min par review selon la taille de la PR (moitié pour une re-review), 5 min par réponse, 2 à 20 min pour tes PR.",
    duration: {
      approx: (duration: string) => `≈ ${duration}`,
      minutes: (minutes: number) => `${minutes} min`,
      hours: (hours: string) => `${hours} h`,
      hoursMinutes: (hours: number, minutes: string) => `${hours} h ${minutes}`,
      days: (days: number) => `${days} j`,
    },
    actions: {
      review: "Reviewer",
      rereview: "Re-reviewer",
      fixes: "Vérifier les corrections",
      reply: "Répondre",
      replyTo: (login: string) => `Répondre à @${login}`,
      ci: "Réparer la CI",
      changes: "Traiter les retours",
      merge: "Merger",
    },
    ruler: {
      now: "maintenant",
      hour: (hour: number) => `+${hour} h`,
      rest: (duration: string) => `Le reste de la file · ${duration}`,
      actionLabel: (action: string, title: string) => `${action} : ${title}`,
    },
    hero: {
      eyebrow: "Ta file de travail",
      empty: "Rien ne t'attend. Profites-en.",
      waiting:
        "de travail t'attend, estimé d'après la taille des PR et les messages.",
      legend: {
        review: "Reviews",
        awaiting: "Réponses",
        mine: "Mes PR",
      },
    },
    next: {
      title: "Prochaines actions",
      description: "Dans l'ordre de priorité.",
      openInbox: "Ouvrir l'inbox",
      empty: "Aucune action en attente de ta part.",
    },
    weather: {
      title: "Météo de l'équipe",
      description:
        "Reviews dues et PR bloquées de chacun, d'après les repos suivis.",
      toUnblock: (count: number) => `${count} PR à débloquer`,
      person: "Personne",
      reviewsDue: "Reviews dues",
      blockedPulls: "PR bloquées",
      you: " (toi)",
      waitingOn: (reviewers: string) => `attend ${reviewers}`,
      reviewsRequested: (count: number) =>
        `${count} ${plural(count, "review")} ${plural(count, "demandée")}`,
      states: {
        sunny: "Fluide",
        cloudy: "Chargé",
        stormy: "Bloqué ou débordé",
      },
    },
    trends: {
      title: "Tendances",
      description: (review: string, awaiting: string) =>
        `Les 14 derniers jours : ce qui est arrivé dans « ${review} » et « ${awaiting} », face à ce que tu as traité.`,
      entered: "Arrivés",
      left: "Traités",
      day: (day: string, entered: number, left: number) =>
        `${day} · ${entered} ${plural(entered, "arrivé")}, ${left} ${plural(left, "traité")}`,
      noisyRepos: "Repos les plus bavards",
      share: (percent: number) => `${percent} %`,
      reviewDelay: "Délai de review",
      reviewDelayDetail: (count: number) =>
        `médiane sur ${count} ${plural(count, "review")}, 30 j`,
      noReviewMeasured: "pas encore de review mesurée",
      streak: "Série Zéro Ping",
      streakValue: (days: number) => `${days} j`,
      streakDetail: "jours d'affilée où l'inbox est tombée à zéro",
      streakFromToday: "mesurée à partir d'aujourd'hui",
      overSla: (hours: number) => `Hors SLA (plus de ${hours} h)`,
      allOnTime: "Toutes tes reviews sont dans les temps.",
    },
  },
  en: {
    description: (today: string) =>
      `${today} · your workload, your next actions, the team weather and the trends.`,
    footnote:
      "Estimates: 5 to 60 min per review depending on the PR size (half for a re-review), 5 min per reply, 2 to 20 min for your PRs.",
    duration: {
      approx: (duration: string) => `≈ ${duration}`,
      minutes: (minutes: number) => `${minutes} min`,
      hours: (hours: string) => `${hours} h`,
      hoursMinutes: (hours: number, minutes: string) =>
        `${hours} h ${minutes} min`,
      days: (days: number) => `${days} d`,
    },
    actions: {
      review: "Review",
      rereview: "Re-review",
      fixes: "Check the fixes",
      reply: "Reply",
      replyTo: (login: string) => `Reply to @${login}`,
      ci: "Fix the CI",
      changes: "Address the feedback",
      merge: "Merge",
    },
    ruler: {
      now: "now",
      hour: (hour: number) => `+${hour} h`,
      rest: (duration: string) => `The rest of the queue · ${duration}`,
      actionLabel: (action: string, title: string) => `${action}: ${title}`,
    },
    hero: {
      eyebrow: "Your work queue",
      empty: "Nothing is waiting for you. Enjoy it.",
      waiting:
        "of work waiting for you, estimated from the PR sizes and the messages.",
      legend: {
        review: "Reviews",
        awaiting: "Replies",
        mine: "My PRs",
      },
    },
    next: {
      title: "Next actions",
      description: "In order of priority.",
      openInbox: "Open the inbox",
      empty: "Nothing is waiting on you.",
    },
    weather: {
      title: "Team weather",
      description:
        "Everyone's reviews due and blocked PRs, from the tracked repos.",
      toUnblock: (count: number) =>
        count === 1 ? "1 PR to unblock" : `${count} PRs to unblock`,
      person: "Person",
      reviewsDue: "Reviews due",
      blockedPulls: "Blocked PRs",
      you: " (you)",
      waitingOn: (reviewers: string) => `waiting on ${reviewers}`,
      reviewsRequested: (count: number) =>
        count === 1 ? "1 review requested" : `${count} reviews requested`,
      states: {
        sunny: "Smooth sailing",
        cloudy: "Busy",
        stormy: "Blocked or swamped",
      },
    },
    trends: {
      title: "Trends",
      description: (review: string, awaiting: string) =>
        `The last 14 days: what arrived in “${review}” and “${awaiting}”, against what you handled.`,
      entered: "Arrived",
      left: "Handled",
      day: (day: string, entered: number, left: number) =>
        `${day} · ${entered} arrived, ${left} handled`,
      noisyRepos: "Noisiest repos",
      share: (percent: number) => `${percent}%`,
      reviewDelay: "Review time",
      reviewDelayDetail: (count: number) =>
        `median over ${count} ${count === 1 ? "review" : "reviews"}, 30 d`,
      noReviewMeasured: "no review measured yet",
      streak: "Zéro Ping streak",
      streakValue: (days: number) => `${days} d`,
      streakDetail: "days in a row the inbox hit zero",
      streakFromToday: "measured from today",
      overSla: (hours: number) => `Past SLA (over ${hours} h)`,
      allOnTime: "All your reviews are on time.",
    },
  },
})
