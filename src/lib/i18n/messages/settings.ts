import type { ReactNode } from "react"
import { defineMessages } from "../core"

export const settings = defineMessages({
  fr: {
    saved: "Réglage enregistré",
    notSaved: "Réglage non enregistré",
    subtitle: "Enregistrés sur ton Mac, appliqués tout de suite.",
    tabs: {
      repos: "Repos",
      triage: "Classement",
      recap: "Récap",
      slack: "Slack",
      agent: "Agent IA",
      notifications: "Notifications",
      language: "Langue",
    },
    language: {
      title: "Langue",
      description:
        "Langue de l'interface, des notifications et des réponses de l'IA.",
    },
    add: "Ajouter",
    remove: (name: string) => `Retirer ${name}`,
    repos: {
      title: "Repos suivis",
      description:
        "Seuls les repos activés apparaissent dans l'inbox. Ceux qui t'envoient des notifications sont ajoutés et activés automatiquement.",
      add: "Ajouter un repo",
      search: "Chercher parmi tes repos…",
      loading: "Chargement de tes repos…",
      noneFound: "Aucun repo trouvé.",
      filter: "Filtrer les repos",
      trackedCount: (tracked: number, total: number) =>
        `${tracked} suivi${tracked > 1 ? "s" : ""} sur ${total}`,
      toHandle: (count: number) => `${count} à traiter`,
      noMatch: (filter: string) => `Aucun repo ne correspond à « ${filter} ».`,
    },
    triage: {
      title: "Classement automatique",
      description:
        "À chaque synchro, ces notifications passent dans « Traités », ici et sur GitHub. Celles qui t'attendent (review, mention, réponse) ne sont jamais classées, et tout revient s'il y a du nouveau.",
      legend: "Classer d'office",
      rules: {
        autoDoneClosed: {
          label: "PR et issues mergées ou fermées",
          description: "Une fois fermées, il n'y a plus rien à y faire.",
        },
        autoDoneBots: {
          label: "PR et issues de bots",
          description:
            "Dependabot, Renovate, GitHub Actions et autres comptes [bot].",
        },
        autoDoneCi: {
          label: "Activité CI",
          description:
            "Les notifications de workflows terminés. Les échecs de tes PR restent signalés dans « Mes PR ».",
        },
        autoDoneReleases: {
          label: "Releases",
          description: "Les nouvelles versions publiées sur les repos suivis.",
        },
      },
      authors: {
        label: "Auteurs à classer",
        description:
          "Les notifications de ces comptes GitHub sont classées d'office, sauf quand elles te mentionnent ou te demandent une review.",
        placeholder: "login GitHub, par ex. release-bot",
      },
    },
    team: {
      title: "Vue équipe",
      description:
        "Les PR ouvertes des repos suivis, hors les tiennes et celles des bots, mises à jour toutes les 10 minutes.",
      staleLabel: "Ancienne au-delà de",
      staleDescription:
        "Nombre de jours depuis l'ouverture d'une PR avant qu'elle soit signalée comme « ouverte depuis longtemps ».",
    },
    recap: {
      title: "Récap du jour",
      description:
        "Chaque jour ouvré, une notification résume ce qui t'attend. Si l'app était éteinte à l'heure choisie, le récap part à son démarrage.",
      enabled: "Envoyer le récap",
      enabledDescription:
        "Une notification du navigateur, qui ouvre la page Récap du jour.",
      time: "Heure",
      timeDescription: (reminder: string) =>
        `Après le message « ${reminder} » du jour, pour que le standup trouve son fil Slack.`,
      channel: "Canal du standup",
      channelDescription:
        "Le canal Slack où un message de rappel ouvre chaque jour le fil des standups. Sans canal, les standups ne se lancent pas.",
      reminder: "Message de rappel",
      reminderDescription:
        "Le texte qui distingue le rappel du jour dans ce canal, par exemple celui d'un rappel Slack automatique.",
      runWithRecap: (command: string) => `Lancer ${command} avec le récap`,
      teamStandupDescription: (channel: string) =>
        `L'IA principale exporte le board et rédige le standup de l'équipe. Tu le relis dans le récap du jour, puis tu le publies d'un clic dans le fil du jour${channel ? ` de #${channel}` : ""}.`,
      teamCommand: "Commande du standup d'équipe",
      myStandupDescription:
        "L'IA principale rédige ton propre standup à partir de tes PR et de tes reviews. Tu le relis dans le récap du jour, puis tu le publies d'un clic dans le même fil.",
      myCommand: "Commande de ton standup",
      commandDescription:
        "Une commande de ~/.claude/commands. Codex en suit le texte.",
    },
    slack: {
      description:
        "Les discussions Slack sur tes PR sont trouvées par l'agent choisi dans l'onglet Agent IA, avec ton propre accès Slack, en lecture seule.",
      disabled: (flag: ReactNode, file: ReactNode) => [
        "La recherche Slack est désactivée par ",
        flag,
        " dans ",
        file,
        " : retire cette ligne pour l'activer.",
      ],
      autoSearch: "Recherche automatique",
      autoSearchDescription:
        "Cherche les discussions des PR à traiter en arrière-plan, trois par synchronisation. Désactivée, la recherche ne se lance qu'à l'ouverture d'une PR. Chaque recherche coûte environ 0,02 $.",
      reviewNotice: "Prévenir l'auteur après une review",
      reviewNoticeDescription:
        "Quand tu approuves ou demandes des changements depuis l'app, une fenêtre propose un message Slack qui mentionne l'auteur. Il ne part qu'après ta confirmation, dans le fil de la PR s'il existe, sinon dans le canal ci-dessous.",
      reviewChannel: "Canal des reviews",
      reviewChannelDescription: "Sans le #, par exemple pull-requests.",
      excluded: "Canaux exclus",
      excludedDescription:
        "Les fils de ces canaux sont masqués tout de suite, y compris ceux déjà trouvés, et l'agent ne les fouille plus.",
      unexclude: (channel: string) => `Ne plus exclure #${channel}`,
      noneExcluded: "Aucun canal exclu.",
      exclude: "Exclure un canal",
      channelPlaceholder: "Nom du canal, par exemple eng-general",
      noChannel: "Aucun canal vu dans les discussions trouvées.",
      typed: "Saisie",
      excludeTyped: (channel: string) => `Exclure #${channel}`,
      seenChannels: "Canaux vus dans les discussions",
      threads: (count: number) => `${count} fil${count > 1 ? "s" : ""}`,
    },
    agent: {
      mainTitle: "IA principale",
      mainDescription:
        "L'agent en ligne de commande derrière toutes les fonctions IA : les résumés, les questions sur une PR ou une issue, la recherche IA, les fils et messages Slack et les standups. Il tourne en arrière-plan sur ton Mac, dans un dossier temporaire vide. Jev, qui classe et note les PR, reste à part.",
      ai: "IA",
      fromEnv: (agent: string) => `Selon .env (${agent})`,
      claudeHint:
        "Claude Code utilise le connecteur Slack de ton compte claude.ai et lance tes commandes /standup et /standup:team.",
      codexHint:
        "Codex a besoin de son propre serveur MCP Slack dans ~/.codex/config.toml (voir le README). Pour les standups, il suit le texte de tes commandes ~/.claude/commands/standup.md et standup/team.md, avec accès au réseau.",
      switchResetsModels:
        "Changer d'IA remet les modèles sur ses valeurs par défaut.",
      fastModel: "Modèle rapide",
      fastModelDescription: (examples: string) =>
        `Pour les recherches et messages Slack. Laisse vide pour la valeur par défaut. ${examples}`,
      readingModel: "Modèle de lecture",
      readingModelDescription: (agent: string) =>
        `Pour les résumés, les questions et la recherche IA, qui lisent toute la conversation. Les standups gardent le modèle par défaut de ton ${agent}.`,
      defaultModel: (model: string) => `${model} (par défaut)`,
      codexConfigModel: "celui de ta config Codex",
      claudeExamples: "Exemples : haiku, sonnet, opus.",
      codexExamples: "Indique un nom accepté par codex --model.",
      summariesTitle: "Résumés",
      summariesDescription:
        "Le bouton « Résumer avec l'IA » d'une PR ou d'une issue utilise l'IA principale et son modèle de lecture. Chaque résumé est enregistré et reste affiché jusqu'à ce que tu le régénères.",
      defaultLength: "Longueur par défaut",
      defaultLengthLabel: "Longueur par défaut des résumés",
      lengths: {
        short: "Court",
        standard: "Standard",
        detailed: "Détaillé",
      },
      lengthsDescription:
        "Court : l'essentiel en une phrase. Standard : les points clés. Détaillé : toutes les décisions et points en suspens. Tu peux changer de longueur sur chaque PR ou issue ; chaque version reste enregistrée.",
      reviewCommandsTitle: "Reviews IA en un clic",
      reviewCommandsDescription:
        "Le bouton « Review IA » d'une PR poste l'une de ces commandes en commentaire, pour déclencher le bot correspondant installé sur le repo.",
      noReviewCommand: "Aucune commande : le bouton est masqué.",
      newReviewCommand: "Nouvelle commande de review",
      connectionsTitle: "Priorité et connexions",
      connectionsDescription: (env: ReactNode, gh: ReactNode) => [
        "Ces valeurs viennent de ",
        env,
        " et du CLI ",
        gh,
        " : modifie-les là-bas, puis relance l'app.",
      ],
      decisionModel: "Modèle de priorité",
      jevKey: "Clé Jev (TYPESAFE_AI_API_KEY)",
      jevConfigured: "configurée",
      jevMissing: "absente : règles seules",
      githubAccount: "Compte GitHub",
      notConnected: "non connecté",
      via: (source: string) => `via ${source}`,
    },
    notifications: {
      title: "Notifications du navigateur",
      description:
        "Une notification apparaît quand une PR ou une issue demande ton attention, tant qu'un onglet Zéro Ping est ouvert. Clique dessus pour ouvrir l'élément.",
      kinds: {
        review: {
          label: "Review demandée",
          description: "On te demande une review, à toi ou à ton équipe.",
        },
        awaiting: {
          label: "On attend ta réponse",
          description:
            "Une mention ou une réponse dans un fil où tu n'as pas encore réagi.",
        },
        changes: {
          label: "Changements demandés sur ta PR",
          description: "Un reviewer demande des changements sur une de tes PR.",
        },
        ci: {
          label: "CI en échec sur ta PR",
          description: "La CI d'une de tes PR échoue.",
        },
      },
      permission: {
        granted: "autorisées",
        denied: "bloquées",
        default: "pas encore autorisées",
        unsupported: "non prises en charge",
      },
      macosHint:
        "Tu ne la vois pas ? Autorise ton navigateur dans Réglages Système > Notifications (Dia, Chrome…) et vérifie qu'aucun mode Concentration n'est actif.",
      testBody: (time: string) =>
        `acme-api#1234 · Notification de test envoyée à ${time}`,
      unavailable: "Notification impossible",
      unavailableDescription:
        "Le navigateur ne l'autorise pas pour cette page.",
      delivered: "Notification transmise à macOS",
      refused: "Notification refusée",
      allowTitle: "Autorise les notifications",
      allowDescription: "Le navigateur te demandera une seule fois ton accord.",
      allow: "Autoriser les notifications",
      blockedTitle: "Notifications bloquées par le navigateur",
      blockedDescription:
        "Clique sur l'icône à gauche de l'adresse, autorise les notifications pour inbox.localhost, puis recharge la page.",
      enable: "Activer les notifications",
      enableDescription:
        "Rien n'est notifié pendant la première synchronisation, ni pour un élément traité ou en pause.",
      notifyFor: "Me prévenir pour",
      test: "Tester",
      testDescription:
        "Affiche une notification d'exemple pour vérifier que ton navigateur et macOS les laissent passer.",
      sendTest: "Envoyer un test",
    },
    quiet: {
      title: "Ne pas déranger",
      description:
        "Coupe les notifications sans rien changer à l'inbox : ce qui arrive pendant ce temps reste dans ses dossiers mais n'est pas notifié ensuite. Le récap du jour aussi se tait. Active-le vite depuis la barre latérale.",
      now: "En ce moment",
      mutedForever: "Notifications coupées jusqu'à ce que tu les réactives.",
      mutedUntil: (when: string) => `Notifications coupées jusqu'à ${when}.`,
      quietUntil: (time: string) => `Heures calmes, jusqu'à ${time}.`,
      passing: "Les notifications passent.",
      resume: "Réactiver",
      hours: "Heures calmes",
      hoursDescription:
        "Chaque jour, aucune notification entre ces deux heures. La fin peut tomber le lendemain (19:00 → 09:00).",
      from: "De",
      to: "à",
    },
    sync: {
      title: "Synchronisation GitHub",
      description:
        "À quel rythme l'app interroge GitHub pour les notifications, les PR et les reviews. Plus espacé, l'app est moins réactive mais consomme moins de quota d'API. Le bouton Sync de la barre latérale force une synchronisation à tout moment.",
      interval: "Intervalle",
      intervalLabel: "Intervalle de synchronisation",
      auto: "Auto",
      autoDescription: (githubSeconds: number | null) =>
        `Auto suit le rythme que GitHub demande${githubSeconds ? ` (en ce moment ${githubSeconds} s)` : ""}, qu'aucun réglage ne peut raccourcir. Le changement s'applique dès la prochaine synchronisation.`,
    },
  },
  en: {
    saved: "Setting saved",
    notSaved: "Setting not saved",
    subtitle: "Saved on your Mac, applied right away.",
    tabs: {
      repos: "Repos",
      triage: "Triage",
      recap: "Recap",
      slack: "Slack",
      agent: "AI agent",
      notifications: "Notifications",
      language: "Language",
    },
    language: {
      title: "Language",
      description: "Language of the interface, notifications and AI answers.",
    },
    add: "Add",
    remove: (name: string) => `Remove ${name}`,
    repos: {
      title: "Tracked repos",
      description:
        "Only enabled repos show up in the inbox. Repos that send you notifications are added and enabled automatically.",
      add: "Add a repo",
      search: "Search your repos…",
      loading: "Loading your repos…",
      noneFound: "No repo found.",
      filter: "Filter repos",
      trackedCount: (tracked: number, total: number) =>
        `${tracked} tracked out of ${total}`,
      toHandle: (count: number) => `${count} to handle`,
      noMatch: (filter: string) => `No repo matches “${filter}”.`,
    },
    triage: {
      title: "Auto-triage",
      description:
        "On every sync, these notifications move to “Done”, here and on GitHub. Those waiting on you (review, mention, reply) are never triaged, and everything comes back when something new happens.",
      legend: "Mark as done automatically",
      rules: {
        autoDoneClosed: {
          label: "Merged or closed PRs and issues",
          description: "Once closed, there is nothing left to do.",
        },
        autoDoneBots: {
          label: "PRs and issues from bots",
          description:
            "Dependabot, Renovate, GitHub Actions and other [bot] accounts.",
        },
        autoDoneCi: {
          label: "CI activity",
          description:
            "Notifications for finished workflows. Failures on your PRs still show up in “My PRs”.",
        },
        autoDoneReleases: {
          label: "Releases",
          description: "New versions published on tracked repos.",
        },
      },
      authors: {
        label: "Authors to mark as done",
        description:
          "Notifications from these GitHub accounts are marked as done automatically, unless they mention you or request your review.",
        placeholder: "GitHub login, e.g. release-bot",
      },
    },
    team: {
      title: "Team view",
      description:
        "Open PRs from tracked repos, except yours and bots', refreshed every 10 minutes.",
      staleLabel: "Old after",
      staleDescription:
        "Number of days since a PR was opened before it is flagged as “open for a long time”.",
    },
    recap: {
      title: "Daily recap",
      description:
        "Every working day, a notification sums up what is waiting for you. If the app was off at the chosen time, the recap goes out when it starts.",
      enabled: "Send the recap",
      enabledDescription:
        "A browser notification that opens the Daily recap page.",
      time: "Time",
      timeDescription: (reminder: string) =>
        `After the day's “${reminder}” message, so the standup finds its Slack thread.`,
      channel: "Standup channel",
      channelDescription:
        "The Slack channel where a reminder message opens the standup thread every day. Without a channel, standups don't run.",
      reminder: "Reminder message",
      reminderDescription:
        "The text that identifies the day's reminder in this channel, such as an automatic Slack reminder.",
      runWithRecap: (command: string) => `Run ${command} with the recap`,
      teamStandupDescription: (channel: string) =>
        `The main AI exports the board and writes the team standup. You review it in the daily recap, then post it in one click to the day's thread${channel ? ` in #${channel}` : ""}.`,
      teamCommand: "Team standup command",
      myStandupDescription:
        "The main AI writes your own standup from your PRs and reviews. You review it in the daily recap, then post it in one click to the same thread.",
      myCommand: "Your standup command",
      commandDescription:
        "A command from ~/.claude/commands. Codex follows its text.",
    },
    slack: {
      description:
        "Slack discussions about your PRs are found by the agent chosen in the AI agent tab, with your own Slack access, read-only.",
      disabled: (flag: ReactNode, file: ReactNode) => [
        "Slack search is turned off by ",
        flag,
        " in ",
        file,
        ": remove that line to turn it on.",
      ],
      autoSearch: "Automatic search",
      autoSearchDescription:
        "Looks for discussions about PRs to handle in the background, three per sync. When off, a search only runs when you open a PR. Each search costs about $0.02.",
      reviewNotice: "Notify the author after a review",
      reviewNoticeDescription:
        "When you approve or request changes from the app, a dialog suggests a Slack message mentioning the author. It is only sent after you confirm, in the PR's thread if there is one, otherwise in the channel below.",
      reviewChannel: "Reviews channel",
      reviewChannelDescription: "Without the #, e.g. pull-requests.",
      excluded: "Excluded channels",
      excludedDescription:
        "Threads from these channels are hidden right away, including those already found, and the agent stops searching them.",
      unexclude: (channel: string) => `Stop excluding #${channel}`,
      noneExcluded: "No excluded channel.",
      exclude: "Exclude a channel",
      channelPlaceholder: "Channel name, e.g. eng-general",
      noChannel: "No channel seen in the discussions found.",
      typed: "Typed",
      excludeTyped: (channel: string) => `Exclude #${channel}`,
      seenChannels: "Channels seen in discussions",
      threads: (count: number) =>
        count === 1 ? "1 thread" : `${count} threads`,
    },
    agent: {
      mainTitle: "Main AI",
      mainDescription:
        "The command-line agent behind every AI feature: summaries, questions about a PR or an issue, AI search, Slack threads and messages, and standups. It runs in the background on your Mac, in an empty temporary folder. Jev, which triages and scores PRs, is separate.",
      ai: "AI",
      fromEnv: (agent: string) => `From .env (${agent})`,
      claudeHint:
        "Claude Code uses the Slack connector of your claude.ai account and runs your /standup and /standup:team commands.",
      codexHint:
        "Codex needs its own Slack MCP server in ~/.codex/config.toml (see the README). For standups, it follows the text of your ~/.claude/commands/standup.md and standup/team.md commands, with network access.",
      switchResetsModels: "Switching AI resets the models to its defaults.",
      fastModel: "Fast model",
      fastModelDescription: (examples: string) =>
        `For searches and Slack messages. Leave empty for the default. ${examples}`,
      readingModel: "Reading model",
      readingModelDescription: (agent: string) =>
        `For summaries, questions and AI search, which read the whole conversation. Standups keep your ${agent}'s default model.`,
      defaultModel: (model: string) => `${model} (default)`,
      codexConfigModel: "the one in your Codex config",
      claudeExamples: "Examples: haiku, sonnet, opus.",
      codexExamples: "Enter a name accepted by codex --model.",
      summariesTitle: "Summaries",
      summariesDescription:
        "The “Summarize with AI” button on a PR or an issue uses the main AI and its reading model. Each summary is saved and stays displayed until you regenerate it.",
      defaultLength: "Default length",
      defaultLengthLabel: "Default summary length",
      lengths: {
        short: "Short",
        standard: "Standard",
        detailed: "Detailed",
      },
      lengthsDescription:
        "Short: the gist in one sentence. Standard: the key points. Detailed: every decision and open question. You can change the length on each PR or issue; every version stays saved.",
      reviewCommandsTitle: "One-click AI reviews",
      reviewCommandsDescription:
        "The “AI review” button on a PR posts one of these commands as a comment, to trigger the matching bot installed on the repo.",
      noReviewCommand: "No command: the button is hidden.",
      newReviewCommand: "New review command",
      connectionsTitle: "Priority and connections",
      connectionsDescription: (env: ReactNode, gh: ReactNode) => [
        "These values come from ",
        env,
        " and the ",
        gh,
        " CLI: change them there, then restart the app.",
      ],
      decisionModel: "Priority model",
      jevKey: "Jev key (TYPESAFE_AI_API_KEY)",
      jevConfigured: "configured",
      jevMissing: "missing: rules only",
      githubAccount: "GitHub account",
      notConnected: "not connected",
      via: (source: string) => `via ${source}`,
    },
    notifications: {
      title: "Browser notifications",
      description:
        "A notification appears when a PR or an issue needs your attention, as long as a Zéro Ping tab is open. Click it to open the item.",
      kinds: {
        review: {
          label: "Review requested",
          description: "Someone requests a review from you or your team.",
        },
        awaiting: {
          label: "Waiting for your reply",
          description:
            "A mention or a reply in a thread you haven't reacted to yet.",
        },
        changes: {
          label: "Changes requested on your PR",
          description: "A reviewer requests changes on one of your PRs.",
        },
        ci: {
          label: "CI failing on your PR",
          description: "The CI of one of your PRs fails.",
        },
      },
      permission: {
        granted: "allowed",
        denied: "blocked",
        default: "not allowed yet",
        unsupported: "not supported",
      },
      macosHint:
        "Don't see it? Allow your browser in System Settings > Notifications (Dia, Chrome…) and check that no Focus mode is on.",
      testBody: (time: string) =>
        `acme-api#1234 · Test notification sent at ${time}`,
      unavailable: "Notification unavailable",
      unavailableDescription: "The browser doesn't allow it for this page.",
      delivered: "Notification handed to macOS",
      refused: "Notification refused",
      allowTitle: "Allow notifications",
      allowDescription: "The browser will ask for your consent only once.",
      allow: "Allow notifications",
      blockedTitle: "Notifications blocked by the browser",
      blockedDescription:
        "Click the icon to the left of the address, allow notifications for inbox.localhost, then reload the page.",
      enable: "Turn on notifications",
      enableDescription:
        "Nothing is notified during the first sync, nor for an item that is done or snoozed.",
      notifyFor: "Notify me for",
      test: "Test",
      testDescription:
        "Shows a sample notification to check that your browser and macOS let them through.",
      sendTest: "Send a test",
    },
    quiet: {
      title: "Do not disturb",
      description:
        "Mutes notifications without changing the inbox: what arrives meanwhile stays in its folders but isn't notified later. The daily recap goes quiet too. Turn it on quickly from the sidebar.",
      now: "Right now",
      mutedForever: "Notifications muted until you turn them back on.",
      mutedUntil: (when: string) => `Notifications muted until ${when}.`,
      quietUntil: (time: string) => `Quiet hours, until ${time}.`,
      passing: "Notifications are coming through.",
      resume: "Turn back on",
      hours: "Quiet hours",
      hoursDescription:
        "Every day, no notification between these two times. The end can fall on the next day (19:00 → 09:00).",
      from: "From",
      to: "to",
    },
    sync: {
      title: "GitHub sync",
      description:
        "How often the app polls GitHub for notifications, PRs and reviews. Less often, the app is less responsive but uses less API quota. The Sync button in the sidebar forces a sync at any time.",
      interval: "Interval",
      intervalLabel: "Sync interval",
      auto: "Auto",
      autoDescription: (githubSeconds: number | null) =>
        `Auto follows the pace GitHub asks for${githubSeconds ? ` (currently ${githubSeconds} s)` : ""}, which no setting can shorten. The change applies from the next sync.`,
    },
  },
})
