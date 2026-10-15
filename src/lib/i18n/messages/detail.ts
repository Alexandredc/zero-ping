import { defineMessages } from "../core"

export const detail = defineMessages({
  fr: {
    panel: {
      label: "Détail",
      closeHint: "Fermer le détail (Échap)",
      openedBy: (isPull: boolean, login: string) =>
        `${isPull ? "PR ouverte" : "Issue ouverte"} par @${login}`,
      copyBranch: (branch: string) => `Copier « ${branch} »`,
      branchCopied: "Branche copiée",
      openOnGitHubAwaitingHint:
        "Ouvre GitHub directement sur le message qui attend ta réponse (o).",
      openOnGitHubHint:
        "Ouvre la PR ou l'issue sur GitHub dans un nouvel onglet (o).",
      undoneHint: "Remet l'élément dans son dossier de l'inbox.",
      doneHint:
        "Retire l'élément de l'inbox et le marque « Done » dans tes notifications GitHub. Il revient tout seul s'il y a du nouveau.",
      undone: "Remettre dans l'inbox",
      done: "Marquer comme traité",
      snoozeHint:
        "Cache l'élément jusqu'à l'heure choisie, puis le fait revenir dans son dossier. En attendant, il est rangé dans « En pause ». Rien ne change sur GitHub.",
      snoozedUntil: (when: string) => `En pause jusqu'à ${when}`,
      snooze: "Mettre en pause",
      snoozeMenuLabel: "Faire revenir cet élément…",
      snoozeIn3Hours: "Dans 3 heures",
      snoozeTomorrowMorning: "Demain matin",
      snoozeMondayMorning: "Lundi matin",
      unsnooze: "Reprendre maintenant",
      tabs: {
        conversation: "Conversation",
        issues: (count: number) => `Issues ${count}`,
        issue: (number: number) => `Issue #${number}`,
        files: "Fichiers modifiés",
      },
      awaitingTitle: (login: string | null) => `@${login} attend ta réponse`,
      seeMessageOnGitHub: "Voir le message sur GitHub",
    },
    priority: {
      title: (priority: number) => `Pourquoi la priorité ${priority} sur 100`,
      needsCheck: "À vérifier",
      needsCheckHint:
        "Jev a répondu avec une confiance trop faible (moins de 50 %) : son estimation n'est pas comptée dans le score. Regarde toi-même si c'est urgent.",
    },
    composer: {
      replyInThread: "Réponse dans le fil GitHub",
      replyToConversation: "Répondre à la conversation",
      commentOnConversation: "Commentaire sur la conversation GitHub",
      keysWrite: "pour écrire,",
      keysEnter: "Entrée",
      keysSend: "pour envoyer",
      placeholder: "Écris ta réponse en Markdown…",
      requestChangesHint:
        "Envoie une review « Changes requested » avec ton texte comme commentaire : la PR ne peut plus être mergée sans nouvelle approbation. Écris d'abord ce qu'il faut changer.",
      requestChanges: "Demander des changements",
      approveHint:
        "Envoie une review « Approve » sur GitHub, avec ton texte en commentaire s'il y en a un.",
      approve: "Approuver",
      sendThreadHint:
        "Publie ta réponse dans ce fil de review sur GitHub (⌘ Entrée).",
      sendConversationHint:
        "Publie ton texte comme commentaire sur la conversation GitHub, sans review (⌘ Entrée).",
      sendOnGitHub: "Envoyer sur GitHub",
    },
    summary: {
      lengths: {
        short: "Court",
        standard: "Standard",
        detailed: "Détaillé",
      },
      lengthHints: {
        short: "L'essentiel en une phrase, lisible en 15 secondes",
        standard: "Les points clés, lisible en moins d'une minute",
        detailed: "Toutes les décisions, désaccords et points en suspens",
      },
      lengthDurations: {
        short: "10 à 20 s",
        standard: "15 à 40 s",
        detailed: "20 à 60 s",
      },
      lengthPicker: "Longueur du résumé",
      alreadyGenerated: "déjà généré",
      pitch: (kind: string) =>
        `Pas le temps de tout lire ? L'IA résume la ${kind}, ses fils Slack et ce qu'on attend de toi.`,
      summarize: "Résumer avec l'IA",
      title: "Résumé IA",
      outdatedHint:
        "Il y a eu de l'activité sur GitHub depuis ce résumé : régénère-le pour en tenir compte.",
      outdated: "Pas à jour",
      generating: (duration: string) => `L'IA résume… (${duration})`,
      regenerate: "Régénérer",
      readHint: "Replie le résumé ; il se rouvre s'il est régénéré.",
      read: "Lu",
      missing: (length: string, kind: string) =>
        `Pas encore de résumé ${length.toLowerCase()} pour cette ${kind}.`,
      generate: (duration: string) => `Générer (${duration})`,
      reading: (duration: string) => `L'IA lit la conversation… (${duration})`,
      expectedFromMe: "Ce qu'on attend de toi",
      status: "Où on en est",
      openQuestions: "Questions ouvertes",
      risks: "Points de vigilance",
    },
    ask: {
      suggestions: {
        PR: [
          "Qu'est-ce qui bloque le merge ?",
          "Quels fichiers relire en priorité ?",
          "Y a-t-il un risque en prod ?",
        ],
        issue: [
          "Qu'est-ce qui reste à faire ?",
          "Qui attend une décision ?",
          "Comment découper ce ticket ?",
        ],
      },
      title: "Demander à l'IA",
      clearHint: "Efface les questions et les réponses de cet élément.",
      clear: "Effacer la discussion",
      reading: (isPull: boolean) =>
        `L'IA lit ${isPull ? "la PR et son diff" : "l'issue"}… (15 à 60 s)`,
      placeholder: (kind: string) => `Une question sur cette ${kind} ?`,
      sendHintStart: "Envoyer à l'IA (",
      sendHintShift: "Maj",
      sendHintEnd: "pour aller à la ligne)",
      send: "Envoyer la question",
    },
    review: {
      approve: {
        title: "Approuver la PR ?",
        action: "Approuver",
        description: "La review « Approve » part sur GitHub en ton nom.",
      },
      requestChanges: {
        title: "Demander des changements ?",
        action: "Demander des changements",
        description:
          "La review « Changes requested » part sur GitHub en ton nom : la PR ne pourra plus être mergée sans nouvelle approbation.",
      },
      notifyAuthor: "Prévenir l'auteur sur Slack",
      inThread: (channel: string) =>
        `En réponse dans le fil de la PR sur #${channel}.`,
      newMessage: (channel: string) => `Nouveau message dans #${channel}.`,
      broadcast: (channel: string) => `Aussi dans #${channel}`,
      broadcastHint:
        "La réponse reste dans le fil et s'affiche aussi dans le canal, comme « Envoyer aussi dans » sur Slack.",
      slackMessage: "Message Slack",
      willBeMentioned: (who: string) =>
        `${who} sera mentionné : l'agent retrouve son compte Slack, sinon il écrit son nom en clair.`,
      sendingReview: "Envoi de la review…",
      sendingSlack: "Message Slack… (20 à 40 s)",
      actionAndNotify: (action: string) => `${action} et prévenir`,
    },
    /** GitHub review states, as a note after the reviewer's name. */
    reviewState: (state: string): string | undefined =>
      new Map([
        ["APPROVED", "a approuvé"],
        ["CHANGES_REQUESTED", "a demandé des changements"],
        ["COMMENTED", "a commenté"],
        ["DISMISSED", "review écartée"],
      ]).get(state),
    reviewers: {
      hint: "Choisis qui doit reviewer la PR : GitHub leur envoie la demande, et retire celle des reviewers que tu décoches.",
      button: "Reviewers",
      search: "Chercher une personne ou une équipe…",
      loading: "Chargement des reviewers…",
      empty: "Personne ne correspond.",
      suggested: "Suggérés par GitHub",
      people: "Personnes",
      teams: "Équipes",
      count: (n: number) => `${n} reviewer${n > 1 ? "s" : ""}`,
    },
    merge: {
      hint: "Merge la PR sur GitHub, avec la méthode choisie, et supprime sa branche si tu le veux.",
      button: "Merger",
      checking: "Vérification de la PR…",
      mergeWith: "Merger avec…",
      state: "État du merge sur GitHub",
      methods: {
        SQUASH: "Squash and merge",
        MERGE: "Merge commit",
        REBASE: "Rebase and merge",
      },
      default: "par défaut",
      deleteBranch: "Supprimer la branche",
      forkBranch: "Branche dans un fork : elle reste en place.",
      autoDelete: "GitHub supprime la branche après le merge.",
    },
    aiReview: {
      hint: "Poste en un clic un commentaire qui demande une review à un bot IA (Codex, Claude, Gemini…). Les commandes se règlent dans Réglages > Agent IA.",
      button: "Review IA",
      postOn: "Poster sur la PR…",
    },
    conversation: {
      label: "Conversation GitHub",
      ghost: "fantôme",
      dismissed: "review rejetée",
      resolved: "Résolu",
      foldedThread: (count: number, author: string | null) =>
        `${count} commentaire${count > 1 ? "s" : ""}${author ? `, dernier de @${author}` : ""}`,
      replyInThread: "Répondre dans ce fil",
      messages: (n: number) => `${n} message${n > 1 ? "s" : ""}`,
      unavailable: "Conversation indisponible",
      unavailableDetail: (error: string) =>
        `${error}. Ouvre-la sur GitHub en attendant.`,
      unsupported:
        "Ce type de notification ne s'affiche pas ici. Ouvre-la sur GitHub.",
      opened: "a ouvert",
    },
    mentions: {
      label: "Personnes à mentionner",
      keys: "↑ ↓ pour choisir, Entrée ou Tab pour insérer",
    },
    markdown: {
      empty: "Pas de description.",
    },
    linkedIssues: {
      open: "ouverte",
      closed: "fermée",
      choose: "Choisir l'issue",
    },
    project: {
      where: (via: number | null, project: string) =>
        via !== null
          ? `la carte de l'issue #${via} que cette PR ferme, sur le projet « ${project} »`
          : `la carte du projet « ${project} »`,
      status: "Statut",
      noStatus: "Sans statut",
      statusHint: (where: string) =>
        `Colonne de ${where}. Choisir une valeur la change sur GitHub.`,
      priority: "Priorité",
      noPriority: "Aucune",
      priorityHint: (where: string) =>
        `Priorité de ${where}. Choisir une valeur la change sur GitHub.`,
      via: (number: number) => `via #${number}`,
    },
    uat: {
      on: "Sur UAT",
      mergeCommitOnUat: "Le commit de merge est dans l'historique de uat.",
      when: (date: string) => ` le ${date}`,
      missing: "Pas encore sur uat :",
      outdated: "Réécrits depuis leur déploiement, à redéployer :",
      onToRedeploy: "Sur UAT, à redéployer",
      allDeployed: (when: string) =>
        `Tous les commits sont sur uat, déployés${when}.`,
      partial: (shipped: number, total: number) =>
        `En partie sur UAT · ${shipped}/${total}`,
      lastDeploy: (when: string) => `Dernier déploiement${when}.`,
      reverted: "Retirée d'UAT",
      revertedDetail: (when: string) =>
        `Déployée puis revertée sur uat${when}.`,
      absent: "Pas sur UAT",
      absentDetail: "Aucun commit de la PR dans les derniers commits de uat.",
      matching:
        "Comparé aux titres des commits, qui restent les mêmes quand un cherry-pick règle un conflit.",
    },
  },
  en: {
    panel: {
      label: "Details",
      closeHint: "Close the details (Esc)",
      openedBy: (isPull: boolean, login: string) =>
        `${isPull ? "PR" : "Issue"} opened by @${login}`,
      copyBranch: (branch: string) => `Copy “${branch}”`,
      branchCopied: "Branch copied",
      openOnGitHubAwaitingHint:
        "Opens GitHub right on the message waiting for your reply (o).",
      openOnGitHubHint: "Opens the PR or issue on GitHub in a new tab (o).",
      undoneHint: "Puts the item back in its inbox folder.",
      doneHint:
        "Removes the item from the inbox and marks it “Done” in your GitHub notifications. It comes back by itself when something new happens.",
      undone: "Back to the inbox",
      done: "Mark as done",
      snoozeHint:
        "Hides the item until the chosen time, then brings it back to its folder. Meanwhile it sits in “Snoozed”. Nothing changes on GitHub.",
      snoozedUntil: (when: string) => `Snoozed until ${when}`,
      snooze: "Snooze",
      snoozeMenuLabel: "Bring this item back…",
      snoozeIn3Hours: "In 3 hours",
      snoozeTomorrowMorning: "Tomorrow morning",
      snoozeMondayMorning: "Monday morning",
      unsnooze: "Resume now",
      tabs: {
        conversation: "Conversation",
        issues: (count: number) => `Issues ${count}`,
        issue: (number: number) => `Issue #${number}`,
        files: "Files changed",
      },
      awaitingTitle: (login: string | null) =>
        `@${login} is waiting for your reply`,
      seeMessageOnGitHub: "See the message on GitHub",
    },
    priority: {
      title: (priority: number) => `Why priority ${priority} out of 100`,
      needsCheck: "To check",
      needsCheckHint:
        "Jev answered with too low a confidence (under 50%): its estimate doesn't count in the score. Check for yourself whether it's urgent.",
    },
    composer: {
      replyInThread: "Reply in the GitHub thread",
      replyToConversation: "Reply to the conversation",
      commentOnConversation: "Comment on the GitHub conversation",
      keysWrite: "to write,",
      keysEnter: "Enter",
      keysSend: "to send",
      placeholder: "Write your reply in Markdown…",
      requestChangesHint:
        "Sends a “Changes requested” review with your text as the comment: the PR can't be merged without a new approval. Write what needs to change first.",
      requestChanges: "Request changes",
      approveHint:
        "Sends an “Approve” review on GitHub, with your text as the comment if there is one.",
      approve: "Approve",
      sendThreadHint:
        "Posts your reply in this review thread on GitHub (⌘ Enter).",
      sendConversationHint:
        "Posts your text as a comment on the GitHub conversation, without a review (⌘ Enter).",
      sendOnGitHub: "Send to GitHub",
    },
    summary: {
      lengths: {
        short: "Short",
        standard: "Standard",
        detailed: "Detailed",
      },
      lengthHints: {
        short: "The gist in one sentence, a 15-second read",
        standard: "The key points, under a minute to read",
        detailed: "Every decision, disagreement and open point",
      },
      lengthDurations: {
        short: "10–20 s",
        standard: "15–40 s",
        detailed: "20–60 s",
      },
      lengthPicker: "Summary length",
      alreadyGenerated: "already generated",
      pitch: (kind: string) =>
        `No time to read it all? The AI summarizes the ${kind}, its Slack threads and what's expected from you.`,
      summarize: "Summarize with AI",
      title: "AI summary",
      outdatedHint:
        "There has been activity on GitHub since this summary: regenerate it to take it into account.",
      outdated: "Outdated",
      generating: (duration: string) => `The AI is summarizing… (${duration})`,
      regenerate: "Regenerate",
      readHint: "Folds the summary; it opens again if regenerated.",
      read: "Read",
      missing: (length: string, kind: string) =>
        `No ${length.toLowerCase()} summary for this ${kind} yet.`,
      generate: (duration: string) => `Generate (${duration})`,
      reading: (duration: string) =>
        `The AI is reading the conversation… (${duration})`,
      expectedFromMe: "What's expected from you",
      status: "Where things stand",
      openQuestions: "Open questions",
      risks: "Watch out for",
    },
    ask: {
      suggestions: {
        PR: [
          "What's blocking the merge?",
          "Which files should I review first?",
          "Is there a risk in production?",
        ],
        issue: [
          "What's left to do?",
          "Who is waiting on a decision?",
          "How could this ticket be split?",
        ],
      },
      title: "Ask the AI",
      clearHint: "Clears the questions and answers for this item.",
      clear: "Clear the discussion",
      reading: (isPull: boolean) =>
        `The AI is reading ${isPull ? "the PR and its diff" : "the issue"}… (15–60 s)`,
      placeholder: (kind: string) => `A question about this ${kind}?`,
      sendHintStart: "Send to the AI (",
      sendHintShift: "Shift",
      sendHintEnd: "for a new line)",
      send: "Send the question",
    },
    review: {
      approve: {
        title: "Approve the PR?",
        action: "Approve",
        description: "The “Approve” review goes to GitHub in your name.",
      },
      requestChanges: {
        title: "Request changes?",
        action: "Request changes",
        description:
          "The “Changes requested” review goes to GitHub in your name: the PR can't be merged without a new approval.",
      },
      notifyAuthor: "Notify the author on Slack",
      inThread: (channel: string) =>
        `As a reply in the PR's thread on #${channel}.`,
      newMessage: (channel: string) => `New message in #${channel}.`,
      broadcast: (channel: string) => `Also in #${channel}`,
      broadcastHint:
        "The reply stays in the thread and also shows in the channel, like Slack's « Also send to ».",
      slackMessage: "Slack message",
      willBeMentioned: (who: string) =>
        `${who} will be mentioned: the agent finds their Slack account, otherwise it writes their name in plain text.`,
      sendingReview: "Sending the review…",
      sendingSlack: "Slack message… (20–40 s)",
      actionAndNotify: (action: string) => `${action} and notify`,
    },
    /** GitHub review states, as a note after the reviewer's name. */
    reviewState: (state: string): string | undefined =>
      new Map([
        ["APPROVED", "approved"],
        ["CHANGES_REQUESTED", "requested changes"],
        ["COMMENTED", "commented"],
        ["DISMISSED", "review dismissed"],
      ]).get(state),
    reviewers: {
      hint: "Choose who should review the PR: GitHub sends them the request, and withdraws it from the reviewers you uncheck.",
      button: "Reviewers",
      search: "Search for a person or a team…",
      loading: "Loading reviewers…",
      empty: "No one matches.",
      suggested: "Suggested by GitHub",
      people: "People",
      teams: "Teams",
      count: (n: number) => `${n} reviewer${n === 1 ? "" : "s"}`,
    },
    merge: {
      hint: "Merges the PR on GitHub with the chosen method, and deletes its branch if you want.",
      button: "Merge",
      checking: "Checking the PR…",
      mergeWith: "Merge with…",
      state: "Merge state on GitHub",
      methods: {
        SQUASH: "Squash and merge",
        MERGE: "Merge commit",
        REBASE: "Rebase and merge",
      },
      default: "default",
      deleteBranch: "Delete the branch",
      forkBranch: "Branch in a fork: it stays in place.",
      autoDelete: "GitHub deletes the branch after the merge.",
    },
    aiReview: {
      hint: "Posts, in one click, a comment asking an AI bot for a review (Codex, Claude, Gemini…). Commands are set in Settings > AI agent.",
      button: "AI review",
      postOn: "Post on the PR…",
    },
    conversation: {
      label: "GitHub conversation",
      ghost: "ghost",
      dismissed: "review dismissed",
      resolved: "Resolved",
      foldedThread: (count: number, author: string | null) =>
        `${count} comment${count > 1 ? "s" : ""}${author ? `, last by @${author}` : ""}`,
      replyInThread: "Reply in this thread",
      messages: (n: number) => `${n} message${n === 1 ? "" : "s"}`,
      unavailable: "Conversation unavailable",
      unavailableDetail: (error: string) =>
        `${error}. Open it on GitHub in the meantime.`,
      unsupported:
        "This kind of notification isn't shown here. Open it on GitHub.",
      opened: "opened",
    },
    mentions: {
      label: "People to mention",
      keys: "↑ ↓ to choose, Enter or Tab to insert",
    },
    markdown: {
      empty: "No description.",
    },
    linkedIssues: {
      open: "open",
      closed: "closed",
      choose: "Choose the issue",
    },
    project: {
      where: (via: number | null, project: string) =>
        via !== null
          ? `the card of issue #${via}, which this PR closes, on the “${project}” project`
          : `the card on the “${project}” project`,
      status: "Status",
      noStatus: "No status",
      statusHint: (where: string) =>
        `Column of ${where}. Choosing a value changes it on GitHub.`,
      priority: "Priority",
      noPriority: "None",
      priorityHint: (where: string) =>
        `Priority of ${where}. Choosing a value changes it on GitHub.`,
      via: (number: number) => `via #${number}`,
    },
    uat: {
      on: "On UAT",
      mergeCommitOnUat: "The merge commit is in the uat history.",
      when: (date: string) => ` ${date}`,
      missing: "Not on uat yet:",
      outdated: "Rewritten since their deploy, to redeploy:",
      onToRedeploy: "On UAT, to redeploy",
      allDeployed: (when: string) => `All commits are on uat, deployed${when}.`,
      partial: (shipped: number, total: number) =>
        `Partly on UAT · ${shipped}/${total}`,
      lastDeploy: (when: string) => `Last deploy${when}.`,
      reverted: "Removed from UAT",
      revertedDetail: (when: string) => `Deployed then reverted on uat${when}.`,
      absent: "Not on UAT",
      absentDetail: "No commit of the PR in the latest uat commits.",
      matching:
        "Matched on commit titles, which stay the same when a cherry-pick resolves a conflict.",
    },
  },
})
