import { defineMessages } from "../core"

export const recap = defineMessages({
  fr: {
    line: {
      reviews: (n: number) => (n > 1 ? `${n} reviews` : `${n} review`),
      awaiting: (n: number) =>
        n > 1 ? `${n} réponses attendues` : `${n} réponse attendue`,
      ciFailing: (n: number) => (n > 1 ? `${n} CI rouges` : `${n} CI rouge`),
      readyToMerge: (n: number) => `${n} PR à merger`,
      team: (n: number) =>
        n > 1 ? `${n} PR d'équipe bloquées` : `${n} PR d'équipe bloquée`,
      separator: ", ",
      calm: "Rien ne t'attend ce matin.",
    },
    notification: {
      title: "Ton récap du jour",
    },
    page: {
      preparing: "Préparation du récap…",
      seeAll: "Tout voir",
      nothingHere: "Rien ici.",
      teamBlocked: (n: number) => `${n} PR de l'équipe à débloquer`,
      teamBlockedReasons: " : sans reviewer, en échec ou qui traînent.",
    },
    tabs: {
      me: "Mon standup",
      team: "Standup de l'équipe",
      week: "Ma semaine",
    },
    standup: {
      kinds: {
        me: {
          title: "Mon standup",
          subject: "ton standup",
          duration: "la lecture de tes PR prend une à deux minutes",
          readyTitle: "Ton standup est prêt",
          alreadyPosted: "Ton standup est déjà dans le fil d'aujourd'hui.",
        },
        team: {
          title: "Standup de l'équipe",
          subject: "le standup de l'équipe",
          duration: "l'export du board prend environ 6 minutes",
          readyTitle: "Standup d'équipe prêt",
          alreadyPosted:
            "Un point d'équipe est déjà dans le fil d'aujourd'hui.",
        },
      },
      started: (ago: string, duration: string) => `Lancé ${ago} : ${duration}.`,
      generated: (ago: string, command: string) =>
        `Généré ${ago} par ${command}.`,
      automatic: (time: string) =>
        `Lancé automatiquement les jours ouvrés à ${time}, ou à la main.`,
      automaticOff: "Le lancement automatique est coupé dans les réglages.",
      where: (reminder: string, channel: string) =>
        `dans le fil du « ${reminder} » d'aujourd'hui, sur #${channel}`,
      run: "Lancer",
      rerun: "Relancer",
      failed: "Standup échoué",
      none: "Pas encore de standup aujourd'hui.",
      posted: (ago: string) => `Publié dans le fil du Daily standup ${ago}.`,
      viewInSlack: "Voir dans Slack",
      publishHint: (subject: string, where: string) =>
        `Publie ${subject} en ton nom ${where}. Une confirmation est demandée avant l'envoi.`,
      publishOnSlack: "Publier sur Slack",
      publishTitle: (subject: string) => `Publier ${subject} ?`,
      publishDescription: (where: string) =>
        `Le message part en ton nom ${where}.`,
      publishMentions: " Chaque personne citée reçoit une notification Slack.",
      publish: "Publier",
      readyBody: "Relis-le dans le récap du jour, puis publie-le dans Slack.",
      interrupted: "Interrompu par un redémarrage de l'app.",
      noMessage: "Le standup n'a pas renvoyé de message.",
      setupChannel: "Choisis le canal Slack du standup dans Réglages > Récap.",
      codexCommandMissing: (command: string, file: string) =>
        `Codex lit la commande ${command} dans ${file}, introuvable : crée-la ou repasse l'IA principale sur Claude.`,
      blockers: {
        outdated:
          "Ce standup date d'avant le bouton : relance-le pour préparer sa version Slack.",
        nothing: "Aucun standup à publier.",
        noThread:
          "Pas de « Daily standup reminder » aujourd'hui : rien où publier.",
        oldThread:
          "Ce standup vise le rappel d'un autre jour : relance-le pour publier dans celui d'aujourd'hui.",
        alreadyPublished: "Ce standup est déjà publié.",
      },
    },
    week: {
      title: "Ma semaine",
      since: (date: string) =>
        `Depuis lundi ${date}, dans les repos suivis. Se complète tout seul au fil de la semaine.`,
      intro: "Ce que tu as fait depuis lundi, dans les repos suivis.",
      copyHint:
        "Copie le résumé en liste à puces, à coller dans le chat de la réunion.",
      copied: "Résumé copié",
      copyFailed: "Copie impossible",
      unavailable: "Résumé indisponible",
      empty:
        "Rien encore cette semaine : les PR mergées, ouvertes, reviewées et les issues fermées apparaîtront ici.",
      blocks: {
        shipped: "Livré",
        started: "Lancé",
        closed: "Fermé",
        reviewed: "Reviewé",
      },
      heading: (title: string) => `${title} :`,
    },
  },
  en: {
    line: {
      reviews: (n: number) => (n === 1 ? "1 review" : `${n} reviews`),
      awaiting: (n: number) =>
        n === 1 ? "1 reply awaited" : `${n} replies awaited`,
      ciFailing: (n: number) => (n === 1 ? "1 red CI" : `${n} red CIs`),
      readyToMerge: (n: number) =>
        n === 1 ? "1 PR to merge" : `${n} PRs to merge`,
      team: (n: number) =>
        n === 1 ? "1 blocked team PR" : `${n} blocked team PRs`,
      separator: ", ",
      calm: "Nothing is waiting for you this morning.",
    },
    notification: {
      title: "Your daily recap",
    },
    page: {
      preparing: "Preparing the recap…",
      seeAll: "See all",
      nothingHere: "Nothing here.",
      teamBlocked: (n: number) =>
        n === 1 ? "1 team PR to unblock" : `${n} team PRs to unblock`,
      teamBlockedReasons: ": no reviewer, failing or dragging on.",
    },
    tabs: {
      me: "My standup",
      team: "Team standup",
      week: "My week",
    },
    standup: {
      kinds: {
        me: {
          title: "My standup",
          subject: "your standup",
          duration: "reading your PRs takes one to two minutes",
          readyTitle: "Your standup is ready",
          alreadyPosted: "Your standup is already in today's thread.",
        },
        team: {
          title: "Team standup",
          subject: "the team standup",
          duration: "the board export takes about 6 minutes",
          readyTitle: "Team standup ready",
          alreadyPosted: "A team update is already in today's thread.",
        },
      },
      started: (ago: string, duration: string) =>
        `Started ${ago}: ${duration}.`,
      generated: (ago: string, command: string) =>
        `Generated ${ago} by ${command}.`,
      automatic: (time: string) =>
        `Runs automatically on working days at ${time}, or by hand.`,
      automaticOff: "Automatic runs are turned off in the settings.",
      where: (reminder: string, channel: string) =>
        `in the thread of today's “${reminder}”, in #${channel}`,
      run: "Run",
      rerun: "Run again",
      failed: "Standup failed",
      none: "No standup yet today.",
      posted: (ago: string) => `Posted in the Daily standup thread ${ago}.`,
      viewInSlack: "View in Slack",
      publishHint: (subject: string, where: string) =>
        `Posts ${subject} as you ${where}. You confirm before it is sent.`,
      publishOnSlack: "Post on Slack",
      publishTitle: (subject: string) => `Post ${subject}?`,
      publishDescription: (where: string) =>
        `The message goes out as you ${where}.`,
      publishMentions: " Everyone mentioned gets a Slack notification.",
      publish: "Post",
      readyBody: "Read it in the daily recap, then post it on Slack.",
      interrupted: "Interrupted by an app restart.",
      noMessage: "The standup returned no message.",
      setupChannel: "Pick the standup's Slack channel in Settings > Recap.",
      codexCommandMissing: (command: string, file: string) =>
        `Codex reads the ${command} command from ${file}, which is missing: create it or switch the main AI back to Claude.`,
      blockers: {
        outdated:
          "This standup predates the button: run it again to prepare its Slack version.",
        nothing: "No standup to post.",
        noThread: "No “Daily standup reminder” today: nowhere to post.",
        oldThread:
          "This standup targets another day's reminder: run it again to post in today's.",
        alreadyPublished: "This standup is already posted.",
      },
    },
    week: {
      title: "My week",
      since: (date: string) =>
        `Since Monday ${date}, in the tracked repos. Fills itself in as the week goes on.`,
      intro: "What you did since Monday, in the tracked repos.",
      copyHint: "Copies the summary as bullets, to paste in the meeting chat.",
      copied: "Summary copied",
      copyFailed: "Couldn't copy",
      unavailable: "Summary unavailable",
      empty:
        "Nothing yet this week: merged, opened and reviewed PRs and closed issues will show up here.",
      blocks: {
        shipped: "Shipped",
        started: "Started",
        closed: "Closed",
        reviewed: "Reviewed",
      },
      heading: (title: string) => `${title}:`,
    },
  },
})
