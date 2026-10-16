import { defineMessages } from "../core"

export const server = defineMessages({
  fr: {
    errors: {
      demoOffline: "Mode démo : rien n'est envoyé à GitHub, à Slack ni à l'IA.",
      itemNotFound: (key: string) => `Élément introuvable : ${key}`,
      itemUnreadable: (key: string) => `Élément illisible : ${key}`,
      cannotReply: "Impossible de répondre à cet élément.",
      cannotReview: "Impossible de reviewer cet élément.",
      slackLinkUnreadable:
        "Lien Slack illisible : ouvre le fil dans Slack pour répondre.",
      summaryNeedsSubject: "Seules les PR et les issues peuvent être résumées.",
      insightsNeedSubject: "Seules les PR et les issues ont des KPI Jev.",
      pullConversationNotFound: "Conversation de la PR introuvable.",
      issueConversationNotFound: "Conversation de l'issue introuvable.",
      filesNeedPull: "Seules les PR ont des fichiers modifiés.",
      notAPull: "Cet élément n'est pas une PR.",
      slackNotConfirmed: "Slack n'a pas confirmé l'envoi du message.",
      slackUnavailable:
        "L'agent n'a pas pu accéder à Slack : vérifie que le connecteur Slack est disponible pour cet agent.",
      noGithubToken:
        "Aucun token GitHub : lance `gh auth login` ou définis GITHUB_TOKEN.",
      nothingToRerun:
        "Aucun job GitHub Actions à relancer : la CI en échec est externe.",
      dbLocked: (pid: number) =>
        `La base locale est déjà ouverte par une autre instance de l'app (PID ${pid}). Arrête-la (inbox stop, ou Ctrl+C dans son terminal) avant d'en lancer une autre.`,
    },
    demo: {
      chatAnswer:
        "Avec Claude Code ou Codex, la réponse s'appuie sur la conversation GitHub, les fils Slack, le diff et les KPI Jev de l'élément.",
    },
    agent: {
      noJson: "Claude Code n'a renvoyé aucun résultat JSON.",
      failed: "Claude Code a échoué.",
      noStructuredAnswer: "Claude Code n'a pas renvoyé de réponse structurée.",
      commandNotFound: (command: string) =>
        `Commande « ${command} » introuvable : installe-la ou définis AGENT_COMMAND.`,
      timedOut: (seconds: number) => `L'agent a dépassé ${seconds} s.`,
      exited: (code: number | null) => `L'agent a quitté avec le code ${code}.`,
    },
    merge: {
      blocked:
        "Bloquée par les règles de la branche : review ou checks obligatoires manquants.",
      behind: "La branche est en retard sur la base : mets-la à jour d'abord.",
      dirty: "Conflits avec la branche de base : à résoudre avant de merger.",
      draft: "La PR est en brouillon.",
      unknown:
        "GitHub calcule encore si la PR peut être mergée : réessaie dans un instant.",
      noMethod: "Aucune méthode de merge n'est autorisée sur ce repo.",
      state: (status: string) => `État de merge : ${status}.`,
      impossible: "Merge impossible.",
    },
    reviewers: {
      viewer: (login: string) => `@${login} (toi)`,
      team: (slug: string) => `équipe ${slug}`,
    },
    attention: {
      reviewTeam: "Review demandée à ton équipe",
      reviewDirect: "Review demandée",
      fixesPushed: "Corrections poussées après ta review",
      awaiting: (who: string) => `@${who} attend ta réponse`,
      someone: "quelqu'un",
      changesRequested: "Changements demandés sur ta PR",
      ciFailing: "La CI de ta PR échoue",
    },
    autoDone: {
      merged: "PR mergée",
      closed: "Fermée",
      ci: "Activité CI",
      release: "Release",
      bot: (login: string) => `Bot @${login}`,
      author: (login: string) => `Auteur @${login}`,
    },
    priority: {
      /** Jev's urgency levels as shown, in the order of URGENCY_LEVELS. */
      urgencyLevels: [
        "Peut attendre",
        "Normale",
        "Importante",
        "Bloquante ou urgente",
      ],
      needsCheckHint:
        "Jev a répondu avec une confiance trop faible (moins de 50 %) : son estimation n'est pas comptée dans le score. Regarde toi-même si c'est urgent.",
      closed: "Fermée",
      closedHint: "Mergée ou fermée : rien à faire.",
      reviewDirect: "Review demandée à toi",
      reviewDirectHint: "Tu es nommé personnellement comme reviewer.",
      reviewTeam: "Review demandée à ton équipe",
      reviewTeamHint:
        "La demande vise une de tes équipes : un collègue peut aussi la prendre.",
      lastReviewer: "Il ne manque que ta review",
      lastReviewerHint:
        "La PR a déjà au moins une approbation et tu es le dernier reviewer attendu.",
      fixesPushed: "Corrections poussées",
      fixesPushedHint:
        "Tu avais demandé des changements et de nouveaux commits sont arrivés depuis : à revoir.",
      reReview: "Re-review",
      reReviewHint:
        "Tu as déjà reviewé cette PR : seuls les commits arrivés depuis ta review sont à lire.",
      awaiting: "On attend ta réponse",
      awaitingHint:
        "Quelqu'un t'a mentionné ou a répondu après toi dans un fil, et tu n'as pas encore réagi.",
      question: "Question posée",
      questionHint:
        "Jev estime que le message t'adresse une vraie question ou une décision à prendre.",
      changesRequested: "Changements demandés",
      changesRequestedHint: "Un reviewer a demandé des changements sur ta PR.",
      approved: "Approuvée, prête à merger",
      approvedHint: "Ta PR est approuvée : il ne reste qu'à la merger.",
      urgentLabel: "Label urgent",
      urgentLabelHint:
        "Un label signale l'urgence (urgent, hotfix, blocking, critical, p0…).",
      waiting: (days: number) => `En attente depuis ${days} j`,
      waitingHint:
        "Depuis la demande de review ou le message sans réponse : 4 points par jour, 20 au maximum.",
      smallPull: "Petite PR",
      smallPullHint:
        "100 lignes modifiées ou moins : rapide à reviewer pour débloquer quelqu'un.",
      hugePull: "Très grosse PR",
      hugePullHint:
        "Plus de 1 000 lignes modifiées : à planifier plutôt qu'à glisser entre deux tâches.",
      ciFailing: "CI en échec",
      ciFailingMineHint: "La CI de ta PR échoue : c'est à toi de la corriger.",
      ciFailingHint:
        "La CI échoue : l'auteur devra sans doute modifier la PR avant ta review.",
      draft: "Brouillon",
      draftHint:
        "La PR est en brouillon : l'auteur ne la considère pas encore prête.",
      /** "IA : importante". */
      ai: (level: string) => `IA : ${level.toLowerCase()}`,
      aiHint:
        "Urgence estimée par Jev à partir du titre, de la description, des labels et des derniers commentaires.",
      aiHintWithConfidence: (confidence: string) =>
        `Urgence estimée par Jev à partir du titre, de la description, des labels et des derniers commentaires (confiance ${confidence}).`,
      confidence: (percent: number) => `${percent} %`,
      confidenceMissing: "non fournie",
    },
    reviewNotice: {
      approve: "c'est tout bon pour moi, tu peux merger ✅",
      requestChanges: "je t'ai laissé quelques retours avant de merger 🔁",
      comment: "je t'ai laissé quelques commentaires 💬",
      /** In the PR's thread, which already says which PR it is: "@auteur c'est tout bon…". */
      inThread: (who: string | null, body: string) =>
        who ? `${who} ${body}` : body[0].toUpperCase() + body.slice(1),
      /** In the channel: "@auteur j'ai regardé ta PR repo#12, c'est tout bon…". */
      inChannel: (who: string | null, subject: string, body: string) =>
        who
          ? `${who} j'ai regardé ta PR ${subject}, ${body}`
          : `J'ai regardé ${subject}, ${body}`,
    },
  },
  en: {
    errors: {
      demoOffline: "Demo mode: nothing is sent to GitHub, Slack or the AI.",
      itemNotFound: (key: string) => `Item not found: ${key}`,
      itemUnreadable: (key: string) => `Unreadable item: ${key}`,
      cannotReply: "You can't reply to this item.",
      cannotReview: "You can't review this item.",
      slackLinkUnreadable:
        "Unreadable Slack link: open the thread in Slack to reply.",
      summaryNeedsSubject: "Only PRs and issues can be summarised.",
      insightsNeedSubject: "Only PRs and issues have Jev KPIs.",
      pullConversationNotFound: "PR conversation not found.",
      issueConversationNotFound: "Issue conversation not found.",
      filesNeedPull: "Only PRs have changed files.",
      notAPull: "This item is not a PR.",
      slackNotConfirmed: "Slack did not confirm the message was sent.",
      slackUnavailable:
        "The agent could not reach Slack: check that the Slack connector is available to this agent.",
      noGithubToken:
        "No GitHub token: run `gh auth login` or set GITHUB_TOKEN.",
      nothingToRerun:
        "No GitHub Actions job to re-run: the failing CI is external.",
      dbLocked: (pid: number) =>
        `The local database is already open in another instance of the app (PID ${pid}). Stop it (inbox stop, or Ctrl+C in its terminal) before starting another one.`,
    },
    demo: {
      chatAnswer:
        "With Claude Code or Codex, the answer draws on the item's GitHub conversation, Slack threads, diff and Jev KPIs.",
    },
    agent: {
      noJson: "Claude Code returned no JSON result.",
      failed: "Claude Code failed.",
      noStructuredAnswer: "Claude Code returned no structured answer.",
      commandNotFound: (command: string) =>
        `Command “${command}” not found: install it or set AGENT_COMMAND.`,
      timedOut: (seconds: number) => `The agent ran over ${seconds} s.`,
      exited: (code: number | null) => `The agent exited with code ${code}.`,
    },
    merge: {
      blocked:
        "Blocked by the branch rules: a required review or check is missing.",
      behind: "The branch is behind its base: update it first.",
      dirty: "Conflicts with the base branch: resolve them before merging.",
      draft: "The PR is a draft.",
      unknown:
        "GitHub is still working out whether the PR can be merged: try again in a moment.",
      noMethod: "No merge method is allowed on this repo.",
      state: (status: string) => `Merge state: ${status}.`,
      impossible: "Can't merge.",
    },
    reviewers: {
      viewer: (login: string) => `@${login} (you)`,
      team: (slug: string) => `team ${slug}`,
    },
    attention: {
      reviewTeam: "Review requested from your team",
      reviewDirect: "Review requested",
      fixesPushed: "Fixes pushed after your review",
      awaiting: (who: string) => `@${who} is waiting for your reply`,
      someone: "someone",
      changesRequested: "Changes requested on your PR",
      ciFailing: "CI is failing on your PR",
    },
    autoDone: {
      merged: "PR merged",
      closed: "Closed",
      ci: "CI activity",
      release: "Release",
      bot: (login: string) => `Bot @${login}`,
      author: (login: string) => `Author @${login}`,
    },
    priority: {
      urgencyLevels: ["Can wait", "Normal", "Important", "Blocking or urgent"],
      needsCheckHint:
        "Jev answered with too little confidence (under 50%): its estimate is left out of the score. Check for yourself whether it's urgent.",
      closed: "Closed",
      closedHint: "Merged or closed: nothing to do.",
      reviewDirect: "Review requested from you",
      reviewDirectHint: "You are named personally as a reviewer.",
      reviewTeam: "Review requested from your team",
      reviewTeamHint:
        "The request targets one of your teams: a teammate can take it too.",
      lastReviewer: "Only your review is missing",
      lastReviewerHint:
        "The PR already has at least one approval and you are the last reviewer expected.",
      fixesPushed: "Fixes pushed",
      fixesPushedHint:
        "You requested changes and new commits have landed since: take another look.",
      reReview: "Re-review",
      reReviewHint:
        "You already reviewed this PR: only the commits since your review need reading.",
      awaiting: "Waiting for your reply",
      awaitingHint:
        "Someone mentioned you or replied after you in a thread, and you haven't responded yet.",
      question: "Question asked",
      questionHint:
        "Jev thinks the message asks you a real question or needs a decision from you.",
      changesRequested: "Changes requested",
      changesRequestedHint: "A reviewer requested changes on your PR.",
      approved: "Approved, ready to merge",
      approvedHint: "Your PR is approved: all that's left is to merge it.",
      urgentLabel: "Urgent label",
      urgentLabelHint:
        "A label flags it as urgent (urgent, hotfix, blocking, critical, p0…).",
      waiting: (days: number) => `Waiting for ${days} d`,
      waitingHint:
        "Since the review request or the unanswered message: 4 points a day, 20 at most.",
      smallPull: "Small PR",
      smallPullHint:
        "100 changed lines or fewer: quick to review to unblock someone.",
      hugePull: "Very large PR",
      hugePullHint:
        "Over 1,000 changed lines: plan for it rather than squeeze it between two tasks.",
      ciFailing: "CI failing",
      ciFailingMineHint: "CI is failing on your PR: it's yours to fix.",
      ciFailingHint:
        "CI is failing: the author will probably have to change the PR before your review.",
      draft: "Draft",
      draftHint: "The PR is a draft: the author doesn't consider it ready yet.",
      ai: (level: string) => `AI: ${level.toLowerCase()}`,
      aiHint:
        "Urgency estimated by Jev from the title, description, labels and latest comments.",
      aiHintWithConfidence: (confidence: string) =>
        `Urgency estimated by Jev from the title, description, labels and latest comments (confidence ${confidence}).`,
      confidence: (percent: number) => `${percent}%`,
      confidenceMissing: "not given",
    },
    reviewNotice: {
      approve: "all good for me, you can merge ✅",
      requestChanges: "I left you some feedback before merging 🔁",
      comment: "I left you a few comments 💬",
      inThread: (who: string | null, body: string) =>
        who ? `${who} ${body}` : body[0].toUpperCase() + body.slice(1),
      inChannel: (who: string | null, subject: string, body: string) =>
        who
          ? `${who} I looked at your PR ${subject}, ${body}`
          : `I looked at ${subject}, ${body}`,
    },
  },
})
