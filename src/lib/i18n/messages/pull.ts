import { defineMessages } from "../core"

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`
/** Labels looked up by a value from the API, such as a file status. */
const byKey = (labels: Record<string, string>) => labels
const pluralEn = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`

export const pull = defineMessages({
  fr: {
    diff: {
      status: byKey({
        added: "ajouté",
        removed: "supprimé",
        renamed: "renommé",
        copied: "copié",
      }),
      changedSinceHint: "Tu l'avais marqué comme vu, mais il a changé depuis.",
      changedSince: "modifié depuis",
      viewedHint: "Marqué aussi comme vu sur GitHub",
      viewed: "Vu",
      viewFileOnGitHub: (file: string) => `Voir ${file} sur GitHub`,
      copyPath: "Copier le chemin du fichier",
      pathCopied: "Chemin copié",
      notShown: "Diff non affiché (fichier binaire ou trop volumineux).",
      seeOnGitHub: "Le voir sur GitHub",
      rangeLabel: "Étendue du diff",
      sinceMyReview: "Depuis ma review",
      wholePr: "Toute la PR",
      lastReview: (when: string) => `Ta dernière review date de ${when}`,
      forcePushNote:
        ". Après un rebase, seuls les fichiers de la PR qui ont changé restent affichés.",
      unavailable: "Diff indisponible",
      reviewCommitGone:
        " Le commit de ta review a peut-être disparu après un force-push : affiche toute la PR.",
      commitsSinceReview: (n: number) =>
        `${n} ${plural(n, "commit")} depuis ta review ·`,
      rewrittenSinceReview:
        "Branche rebasée depuis ta review : seuls les fichiers de la PR qui ont changé, avec leur diff complet ·",
      files: (n: number) => `${n} ${plural(n, "fichier")}`,
      viewedCount: (viewed: number, total: number) => `${viewed}/${total} vus`,
      openOnGitHub: "Ouvrir le diff sur GitHub",
      truncated: "Seuls les 300 premiers fichiers sont affichés.",
      fileTree: "Arborescence des fichiers",
    },
    checks: {
      allPassing: (passed: number, total: number) =>
        `Tous les checks passent · ${passed}/${total}`,
      failing: (n: number) => `${n} ${plural(n, "check")} en échec`,
      running: (pending: number, total: number) =>
        `Checks en cours · ${pending} sur ${total}`,
      none: "Aucun check",
      lastCommit: (s: {
        passed: number
        failed: number
        pending: number
        skipped: number
      }) =>
        `Sur le dernier commit : ${s.passed} ${plural(s.passed, "réussi")}, ${s.failed} en échec, ${s.pending} en cours, ${s.skipped} ${plural(s.skipped, "ignoré")}.`,
      failedList: (names: string) => `En échec : ${names}`,
      runningList: (names: string) => `En cours : ${names}`,
      ciState: byKey({
        SUCCESS: "Tous les checks passent",
        FAILURE: "Des checks sont en échec",
        ERROR: "Des checks sont en erreur",
        PENDING: "Checks en cours",
        EXPECTED: "Checks attendus",
      }),
      failedTitle: "CI en échec",
      rerunDone: "Relancés",
      rerun: "Relancer les jobs en échec",
      unavailable: (error: string) => `Checks indisponibles : ${error}`,
      noneFailing:
        "Plus aucun check en échec sur le dernier commit : la CI tourne peut-être encore.",
      viewLog: "Voir le log",
      externalCi:
        "Ces checks viennent d'une CI externe : relance-les depuis son interface.",
    },
    slack: {
      title: "Slack",
      sectionLabel: "Discussions Slack",
      match: { link: "lien", reference: "référence", title: "possible" },
      matchHint: {
        link: "Le message contient le lien de la PR.",
        reference: "Le message cite la PR par sa référence (repo#numéro).",
        title:
          "Le message parle du sujet de la PR sans la citer : à confirmer.",
      },
      replyPlaceholder: "Ta réponse dans le fil Slack…",
      sending: (agent: string) => `${agent} envoie ta réponse… (20 à 40 s)`,
      sentAs: (agent: string) =>
        `Envoyée en ton nom par ${agent}, telle quelle.`,
      sendToSlack: "Envoyer sur Slack",
      sendShortcut: "⌘ Entrée",
      messages: (n: number) => `${n} ${plural(n, "message")}`,
      newMessagesHint:
        "Tu l'avais marqué comme lu, mais de nouveaux messages sont arrivés depuis.",
      newMessages: "nouveaux messages",
      readHint:
        "Replie le fil dans Zéro Ping ; il se rouvre si un nouveau message arrive. Rien ne change dans Slack.",
      read: "Lu",
      replyInApp: "Répondre dans l'app",
      openInSlack: "Ouvrir le fil dans Slack",
      thisIssue: "cette issue",
      thisPr: "cette PR",
      readCount: (read: number, total: number) => `${read}/${total} lus`,
      searchHint: (agent: string, subject: string) =>
        `${agent} cherche dans ton Slack les messages qui citent ${subject} (lien, référence ou sujet), en lecture seule. Les résultats sont gardés 6 h.`,
      searching: (agent: string) => `${agent} cherche… (30 s à 1 min)`,
      checked: (when: string) => `vérifié ${when}`,
      searchAgain: "Chercher à nouveau dans Slack",
      hiddenBefore: (n: number) =>
        `${n} ${plural(n, "fil")} ${plural(n, "masqué")} (canaux exclus, `,
      hiddenEdit: "modifier",
      hiddenAfter: ").",
      searchFailed: (error: string) => `Recherche impossible : ${error}`,
      noneFound: "Aucune discussion trouvée sur Slack.",
      possible: (subject: string) =>
        `Discussions possibles, sans lien vers ${subject} :`,
    },
    insights: {
      title: "KPI Jev",
      expertise: byKey({
        security: "sécurité",
        data: "data / BDD",
        infra: "infra",
      }),
      expertiseRequired: "Expertise requise",
      expertiseHint:
        "Domaines qu'une personne spécialisée devrait valider avant le merge.",
      expertiseLine: (label: string, percent: string, confidence: string) =>
        `${label} : ${percent} (confiance ${confidence})`,
      noExpertise: "Aucune",
      percent: (n: number) => `${n} %`,
      confidenceMissing: "non fournie",
      unsure: "incertain",
      yesProbability: (yes: string) => `Probabilité de « ${yes} » :`,
      yesFrom: (yes: string) => `(« ${yes} » à partir de 50 %)`,
      levelMeaning: (level: string, meaning: string) => `${level} : ${meaning}`,
      confidence: (confidence: string) => `Confiance de Jev : ${confidence}.`,
      unsureNote:
        " C'est sous 50 % : Jev n'est pas sûr de lui, cette valeur est donnée à titre indicatif. Vérifie toi-même.",
      sureNote: " Au-dessus de 50 %, la réponse est jugée fiable.",
      thePr: "la PR",
      theIssue: "l'issue",
      evaluating: (subject: string) =>
        `Jev évalue ${subject}… (quelques secondes)`,
      howToRead: "Comment lire ces KPI",
      sourcesPr:
        "Jev, le modèle de décision de l'app, les estime d'après la description, les commentaires, la CI, les fichiers et le début du diff.",
      sourcesIssue:
        "Jev, le modèle de décision de l'app, les estime d'après la description, les labels et les derniers commentaires.",
      hoverTile: "Survole une tuile pour son échelle.",
      legend: {
        green: "Vert",
        fine: " : rien à signaler · ",
        orange: "orange",
        watch: " : à surveiller · ",
        red: "rouge",
        look: " : à regarder.",
      },
      unsureLegend:
        "« incertain » : Jev a moins de 50 % de confiance dans sa réponse.",
      cacheNote: "Le résultat est gardé 20 minutes ; ↻ le recalcule.",
      refreshHint: (subject: string) =>
        `Recalcule les KPI avec l'état actuel de ${subject}.`,
      refreshLabel: "Recalculer les KPI Jev",
      unavailable: (error: string) => `KPI Jev indisponibles : ${error}`,
    },
    /** The KPIs of a pull request: name, hover hint and answers. */
    pullKpis: {
      risk: {
        label: "Risque en prod",
        hint: "Ce qui peut casser une fois en prod : migrations, auth, paiements, infra, config, volume du changement.",
        levels: ["Faible", "Modéré", "Élevé", "Critique"],
        meanings: [
          "changement isolé, sans zone sensible",
          "touche du code partagé ou un comportement visible",
          "zone sensible (données, auth, infra) ou gros volume",
          "peut casser la prod ou perdre des données",
        ],
      },
      effort: {
        label: "Effort de review",
        hint: "Temps de relecture estimé, d'après le nombre de fichiers, les lignes et la complexité du diff.",
        levels: ["< 15 min", "~30 min", "~1 h", "> 2 h"],
        meanings: [
          "quelques fichiers simples",
          "un sujet à comprendre, diff court",
          "plusieurs fichiers ou une logique à suivre",
          "gros diff ou logique dense : prévoir un créneau",
        ],
      },
      ready: {
        label: "Prête à merger",
        hint: "Chance d'être mergée sans nouvel aller-retour : CI, approbations, fils de review ouverts, questions sans réponse.",
        yes: "Oui",
        no: "Pas encore",
      },
      tests: {
        label: "Tests",
        hint: "Les changements sont-ils couverts par des tests ajoutés ou modifiés dans le diff ?",
        levels: ["Absents", "Partiels", "Suffisants"],
        meanings: [
          "aucun test ajouté ni modifié pour ce changement",
          "des tests, mais des cas changés restent sans test",
          "les comportements modifiés sont testés",
        ],
      },
      breaking: {
        label: "Changement cassant",
        hint: "Rupture d'un contrat : API, schéma de base, variables d'environnement, format d'événement. Il faut alors prévenir ou migrer.",
        yes: "Oui",
        no: "Non",
      },
      clarity: {
        label: "Clarté de la PR",
        hint: "La description dit-elle pourquoi, comment tester et quel impact attendre ?",
        levels: ["Floue", "Correcte", "Claire"],
        meanings: [
          "on ne sait pas pourquoi ni comment tester",
          "le quoi est dit, le pourquoi ou les tests manquent",
          "pourquoi, comment tester et impact sont expliqués",
        ],
      },
      security: {
        label: "Avis sécurité",
        hint: "Une personne spécialisée en sécurité devrait-elle valider ? (auth, permissions, secrets, données personnelles)",
        yes: "Requis",
        no: "Non",
      },
      data: {
        label: "Avis data / BDD",
        hint: "Une personne spécialisée data ou base de données devrait-elle valider ? (migrations, requêtes, index, volumétrie)",
        yes: "Requis",
        no: "Non",
      },
      infra: {
        label: "Avis infra",
        hint: "Une personne spécialisée infra devrait-elle valider ? (Terraform, CI/CD, Docker, Cloud Run, réseau)",
        yes: "Requis",
        no: "Non",
      },
    },
    /** The KPIs of an issue: name, hover hint and answers. */
    issueKpis: {
      ready: {
        label: "Prête à démarrer",
        hint: "Le besoin est-il assez précis pour qu'un dev s'y mette : contexte, critères d'acceptation, exemples ou maquettes ?",
        yes: "Prête",
        no: "À préciser",
      },
      size: {
        label: "Taille estimée",
        hint: "Effort probable pour une personne de l'équipe, d'après le périmètre décrit.",
        levels: ["< ½ j", "~1 j", "2-3 j", "~1 sem.", "> 1 sprint"],
        meanings: [
          "une petite correction ou un réglage",
          "un changement simple et bien délimité",
          "une fonctionnalité courte ou un bug à investiguer",
          "une fonctionnalité complète, plusieurs couches",
          "trop gros pour un sprint : à découper",
        ],
      },
      impact: {
        label: "Impact métier",
        hint: "Qui est touché et à quel point : clients, opérations, finance, bug en prod, process bloqué.",
        levels: ["Faible", "Moyen", "Fort", "Critique"],
        meanings: [
          "confort ou cas rare",
          "gêne réelle pour une partie des utilisateurs",
          "process ou clients importants touchés",
          "prod cassée, perte d'argent ou de données",
        ],
      },
      blocked: {
        label: "Bloquée",
        hint: "L'issue attend-elle quelque chose : une décision, une autre équipe, une dépendance, une réponse du métier ?",
        yes: "Oui",
        no: "Non",
      },
      split: {
        label: "À découper",
        hint: "Le ticket mélange-t-il plusieurs sujets qu'il vaudrait mieux séparer en plusieurs issues ?",
        yes: "Conseillé",
        no: "Non",
      },
      techRisk: {
        label: "Risque technique",
        hint: "Inconnues techniques, zones sensibles (données, auth, infra), besoin d'une étude avant de coder.",
        levels: ["Faible", "Modéré", "Élevé"],
        meanings: [
          "terrain connu, peu d'inconnues",
          "quelques points à vérifier en route",
          "inconnues ou zone sensible : prévoir une étude",
        ],
      },
      decision: {
        label: "Ton arbitrage",
        hint: "Une question ou une décision t'est-elle demandée, à toi le lead, dans la conversation ?",
        yes: "Oui",
        no: "Non",
      },
    },
    jev: {
      /** Jev's urgency, in the order of the score rubric. */
      urgencyLevels: [
        "Peut attendre",
        "Normale",
        "Importante",
        "Bloquante ou urgente",
      ],
      notRated: "Pas encore évaluée par Jev",
      notRatedHint:
        "Jev l'évalue en arrière-plan ; elle sera classée au prochain rafraîchissement. Une réponse trop peu sûre n'est pas comptée.",
      urgency: (level: string, score: number) =>
        `Urgence Jev : ${level} (${score} sur 100)`,
      urgencyHint:
        "Estimée d'après le titre, la description, les labels et les derniers commentaires. Plus le score est haut, plus c'est à traiter tôt.",
    },
  },
  en: {
    diff: {
      status: {
        added: "added",
        removed: "deleted",
        renamed: "renamed",
        copied: "copied",
      },
      changedSinceHint:
        "You had marked it as viewed, but it has changed since.",
      changedSince: "changed since",
      viewedHint: "Also marked as viewed on GitHub",
      viewed: "Viewed",
      viewFileOnGitHub: (file: string) => `View ${file} on GitHub`,
      copyPath: "Copy the file path",
      pathCopied: "Path copied",
      notShown: "Diff not shown (binary or too large file).",
      seeOnGitHub: "View it on GitHub",
      rangeLabel: "Diff range",
      sinceMyReview: "Since my review",
      wholePr: "Whole PR",
      lastReview: (when: string) => `Your last review was ${when}`,
      forcePushNote:
        ". After a rebase, only the PR's files that changed stay listed.",
      unavailable: "Diff unavailable",
      reviewCommitGone:
        " The commit of your review may be gone after a force-push: show the whole PR.",
      commitsSinceReview: (n: number) =>
        `${n} ${pluralEn(n, "commit")} since your review ·`,
      rewrittenSinceReview:
        "Branch rebased since your review: only the PR's files that changed, with their whole diff ·",
      files: (n: number) => `${n} ${pluralEn(n, "file")}`,
      viewedCount: (viewed: number, total: number) =>
        `${viewed}/${total} viewed`,
      openOnGitHub: "Open the diff on GitHub",
      truncated: "Only the first 300 files are shown.",
      fileTree: "File tree",
    },
    checks: {
      allPassing: (passed: number, total: number) =>
        `All checks pass · ${passed}/${total}`,
      failing: (n: number) => `${n} failing ${pluralEn(n, "check")}`,
      running: (pending: number, total: number) =>
        `Checks running · ${pending} of ${total}`,
      none: "No checks",
      lastCommit: (s: {
        passed: number
        failed: number
        pending: number
        skipped: number
      }) =>
        `On the last commit: ${s.passed} passed, ${s.failed} failed, ${s.pending} running, ${s.skipped} skipped.`,
      failedList: (names: string) => `Failing: ${names}`,
      runningList: (names: string) => `Running: ${names}`,
      ciState: {
        SUCCESS: "All checks pass",
        FAILURE: "Some checks are failing",
        ERROR: "Some checks errored",
        PENDING: "Checks running",
        EXPECTED: "Checks expected",
      },
      failedTitle: "CI failing",
      rerunDone: "Re-run started",
      rerun: "Re-run failed jobs",
      unavailable: (error: string) => `Checks unavailable: ${error}`,
      noneFailing:
        "No failing checks left on the last commit: CI may still be running.",
      viewLog: "View log",
      externalCi:
        "These checks come from an external CI: re-run them from its interface.",
    },
    slack: {
      title: "Slack",
      sectionLabel: "Slack discussions",
      match: { link: "link", reference: "reference", title: "possible" },
      matchHint: {
        link: "The message contains the PR's link.",
        reference: "The message cites the PR by its reference (repo#number).",
        title:
          "The message talks about the PR's topic without citing it: to be confirmed.",
      },
      replyPlaceholder: "Your reply in the Slack thread…",
      sending: (agent: string) =>
        `${agent} is sending your reply… (20 to 40 s)`,
      sentAs: (agent: string) => `Sent on your behalf by ${agent}, as is.`,
      sendToSlack: "Send to Slack",
      sendShortcut: "⌘ Enter",
      messages: (n: number) => `${n} ${pluralEn(n, "message")}`,
      newMessagesHint:
        "You had marked it as read, but new messages have arrived since.",
      newMessages: "new messages",
      readHint:
        "Folds the thread in Zéro Ping; it reopens when a new message arrives. Nothing changes in Slack.",
      read: "Read",
      replyInApp: "Reply in the app",
      openInSlack: "Open the thread in Slack",
      thisIssue: "this issue",
      thisPr: "this PR",
      readCount: (read: number, total: number) => `${read}/${total} read`,
      searchHint: (agent: string, subject: string) =>
        `${agent} searches your Slack for messages that cite ${subject} (link, reference or topic), read-only. Results are kept for 6 h.`,
      searching: (agent: string) => `${agent} is searching… (30 s to 1 min)`,
      checked: (when: string) => `checked ${when}`,
      searchAgain: "Search Slack again",
      hiddenBefore: (n: number) =>
        `${n} ${pluralEn(n, "thread")} hidden (excluded channels, `,
      hiddenEdit: "edit",
      hiddenAfter: ").",
      searchFailed: (error: string) => `Search failed: ${error}`,
      noneFound: "No discussion found on Slack.",
      possible: (subject: string) =>
        `Possible discussions, with no link to ${subject}:`,
    },
    insights: {
      title: "Jev KPIs",
      expertise: {
        security: "security",
        data: "data / DB",
        infra: "infra",
      },
      expertiseRequired: "Expertise required",
      expertiseHint: "Areas a specialist should approve before the merge.",
      expertiseLine: (label: string, percent: string, confidence: string) =>
        `${label}: ${percent} (confidence ${confidence})`,
      noExpertise: "None",
      percent: (n: number) => `${n}%`,
      confidenceMissing: "not provided",
      unsure: "unsure",
      yesProbability: (yes: string) => `Probability of “${yes}”:`,
      yesFrom: (yes: string) => `(“${yes}” from 50%)`,
      levelMeaning: (level: string, meaning: string) => `${level}: ${meaning}`,
      confidence: (confidence: string) => `Jev's confidence: ${confidence}.`,
      unsureNote:
        " That's under 50%: Jev isn't sure, so take this value as a hint. Check for yourself.",
      sureNote: " Above 50%, the answer is deemed reliable.",
      thePr: "the PR",
      theIssue: "the issue",
      evaluating: (subject: string) =>
        `Jev is evaluating ${subject}… (a few seconds)`,
      howToRead: "How to read these KPIs",
      sourcesPr:
        "Jev, the app's decision model, estimates them from the description, comments, CI, files and the start of the diff.",
      sourcesIssue:
        "Jev, the app's decision model, estimates them from the description, labels and latest comments.",
      hoverTile: "Hover a tile to see its scale.",
      legend: {
        green: "Green",
        fine: ": nothing to report · ",
        orange: "orange",
        watch: ": keep an eye on it · ",
        red: "red",
        look: ": take a look.",
      },
      unsureLegend: "“unsure”: Jev is less than 50% confident in its answer.",
      cacheNote: "The result is kept for 20 minutes; ↻ recomputes it.",
      refreshHint: (subject: string) =>
        `Recomputes the KPIs with the current state of ${subject}.`,
      refreshLabel: "Recompute Jev KPIs",
      unavailable: (error: string) => `Jev KPIs unavailable: ${error}`,
    },
    pullKpis: {
      risk: {
        label: "Production risk",
        hint: "What could break once in production: migrations, auth, payments, infra, config, size of the change.",
        levels: ["Low", "Moderate", "High", "Critical"],
        meanings: [
          "isolated change, no sensitive area",
          "touches shared code or visible behavior",
          "sensitive area (data, auth, infra) or large change",
          "could break production or lose data",
        ],
      },
      effort: {
        label: "Review effort",
        hint: "Estimated review time, from the number of files, the lines and the complexity of the diff.",
        levels: ["< 15 min", "~30 min", "~1 h", "> 2 h"],
        meanings: [
          "a few simple files",
          "one topic to understand, short diff",
          "several files or some logic to follow",
          "large diff or dense logic: block out some time",
        ],
      },
      ready: {
        label: "Ready to merge",
        hint: "Chance of being merged without another round: CI, approvals, open review threads, unanswered questions.",
        yes: "Yes",
        no: "Not yet",
      },
      tests: {
        label: "Tests",
        hint: "Are the changes covered by tests added or changed in the diff?",
        levels: ["Missing", "Partial", "Sufficient"],
        meanings: [
          "no test added or changed for this change",
          "some tests, but changed cases remain untested",
          "the changed behaviors are tested",
        ],
      },
      breaking: {
        label: "Breaking change",
        hint: "Breaks a contract: API, database schema, environment variables, event format. Others must then be warned or migrated.",
        yes: "Yes",
        no: "No",
      },
      clarity: {
        label: "PR clarity",
        hint: "Does the description say why, how to test and what impact to expect?",
        levels: ["Vague", "Fair", "Clear"],
        meanings: [
          "no idea why or how to test",
          "the what is there, the why or the tests are missing",
          "why, how to test and impact are explained",
        ],
      },
      security: {
        label: "Security review",
        hint: "Should a security specialist approve it? (auth, permissions, secrets, personal data)",
        yes: "Required",
        no: "No",
      },
      data: {
        label: "Data / DB review",
        hint: "Should a data or database specialist approve it? (migrations, queries, indexes, data volume)",
        yes: "Required",
        no: "No",
      },
      infra: {
        label: "Infra review",
        hint: "Should an infrastructure specialist approve it? (Terraform, CI/CD, Docker, Cloud Run, networking)",
        yes: "Required",
        no: "No",
      },
    },
    issueKpis: {
      ready: {
        label: "Ready to start",
        hint: "Is the need precise enough for a developer to start: context, acceptance criteria, examples or mock-ups?",
        yes: "Ready",
        no: "Needs detail",
      },
      size: {
        label: "Estimated size",
        hint: "Likely effort for one person of the team, from the scope described.",
        levels: ["< ½ d", "~1 d", "2-3 d", "~1 wk", "> 1 sprint"],
        meanings: [
          "a small fix or a tweak",
          "a simple, well-bounded change",
          "a short feature or a bug to investigate",
          "a full feature, several layers",
          "too big for one sprint: split it",
        ],
      },
      impact: {
        label: "Business impact",
        hint: "Who is affected and how much: customers, operations, finance, production bug, blocked process.",
        levels: ["Low", "Medium", "High", "Critical"],
        meanings: [
          "nice to have or rare case",
          "real friction for some users",
          "key processes or customers affected",
          "production broken, money or data lost",
        ],
      },
      blocked: {
        label: "Blocked",
        hint: "Is the issue waiting on something: a decision, another team, a dependency, an answer from the business?",
        yes: "Yes",
        no: "No",
      },
      split: {
        label: "Split it",
        hint: "Does the ticket mix several topics that would be better split into separate issues?",
        yes: "Advised",
        no: "No",
      },
      techRisk: {
        label: "Technical risk",
        hint: "Technical unknowns, sensitive areas (data, auth, infra), need for a spike before coding.",
        levels: ["Low", "Moderate", "High"],
        meanings: [
          "known ground, few unknowns",
          "a few things to check along the way",
          "unknowns or sensitive area: plan a spike",
        ],
      },
      decision: {
        label: "Your call",
        hint: "Is a question or a decision asked of you, the lead, in the conversation?",
        yes: "Yes",
        no: "No",
      },
    },
    jev: {
      urgencyLevels: ["Can wait", "Normal", "Important", "Blocking or urgent"],
      notRated: "Not rated by Jev yet",
      notRatedHint:
        "Jev rates it in the background; it will be ranked at the next refresh. An answer that isn't sure enough doesn't count.",
      urgency: (level: string, score: number) =>
        `Jev urgency: ${level} (${score} out of 100)`,
      urgencyHint:
        "Estimated from the title, description, labels and latest comments. The higher the score, the sooner to handle it.",
    },
  },
})
