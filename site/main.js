// The page is written in English; French replaces the text of [data-i18n] elements.
const FR = {
  skip: "Aller au contenu",
  lang: "Langue",
  "meta.title": "Zéro Ping, une inbox GitHub au calme pour lead dev",
  "meta.description":
    "Zéro Ping remplace les emails de notification GitHub par une liste triée de ce qui t’attend, avec ses fils Slack. Open source, sur ta machine.",
  "nav.inbox": "L’inbox",
  "nav.private": "En local",
  "nav.start": "Démarrer",
  "hero.eyebrow": "Tri GitHub local pour lead dev",
  "hero.title": "Coupe les pings.<br />Garde ce qui t’attend.",
  "hero.lede":
    "Zéro Ping remplace les emails de notification GitHub par une seule liste triée de ce qui attend une action de ta part : reviews, réponses, tes PR et celles de l’équipe, chacune avec ses fils Slack. Elle tourne sur ta machine.",
  "hero.start": "L’installer en local",
  "hero.github": "Voir sur GitHub",
  "hero.facts": "Open source · Sans compte · Données dans une base locale",
  "hero.caption":
    "Les mises à jour de bots, la CI, les releases et le bavardage sont classés. Trois éléments restent, triés par score de priorité.",
  "strip.review": "review demandée",
  "strip.reply": "otto a répondu après toi",
  "strip.ci": "ta PR, CI en échec",
  "why.eyebrow": "Pourquoi",
  "why.title": "Le ping qui compte arrive avec tous ceux qui ne comptent pas.",
  "why.body":
    "En lead dev, chaque demande de review, mention, run de CI, montée de version et fil Slack sur une PR tombe sur toi. Zéro Ping les lit tous, range le bruit et garde ce qui t’attend, trié par un score qu’il explique. Il ne range jamais ce qui t’attend.",
  "why.caption": "Comment les notifications entrantes sont triées",
  "why.in": "Arrive",
  "why.out": "Va dans",
  "why.bot": "bot",
  "why.ci": "activité CI",
  "why.release": "release",
  "why.merged": "mergée",
  "why.red": "CI rouge",
  "inbox.eyebrow": "L’inbox",
  "inbox.title": "Une liste, triée par ce que tu dois faire ensuite.",
  "inbox.caption": "Maquette fidèle, avec des données de démonstration.",
  "inbox.note1":
    "<strong>Un score qui s’explique.</strong> La priorité de chaque élément additionne son ancienneté, le dernier reviewer manquant, la taille, la CI, les labels urgents et l’urgence estimée par Jev.",
  "inbox.note2":
    "<strong>GitHub et Slack côte à côte.</strong> Lis la conversation avec les fils Slack qui citent la PR, ou le diff avec son arborescence et les cases « Vu » synchronisées avec GitHub.",
  "inbox.note3":
    "<strong>Agir sans sortir.</strong> Réponds, approuve, demande des changements, marque comme traité ou mets en pause, un élément ou tout un lot.",
  "folders.title": "Quatre dossiers, et rien d’autre en travers",
  "folders.review":
    "PR ouvertes où ta review est encore demandée, directement ou via ton équipe. Si tu as demandé des changements et que des commits arrivent, la PR revient, et le diff peut se limiter à ces commits.",
  "folders.awaiting": "Mentions et fils de review où quelqu’un a répondu après toi.",
  "folders.mine":
    "Tes PR ouvertes, avec CI et décision de review. Merge avec la méthode de ton choix, lis les jobs en échec avec leur log, relance les jobs GitHub Actions ratés.",
  "folders.team":
    "PR des repos suivis sans reviewer, avec changements demandés, CI rouge, conflits ou ouvertes depuis trop longtemps. Prends la review en un clic.",
  "around.title": "Autour de l’inbox",
  "around.summary":
    "<strong>Résumés IA.</strong> Court, standard ou détaillé, à partir de la conversation GitHub et des fils Slack trouvés. Enregistrés, et signalés quand une activité plus récente les rend obsolètes.",
  "around.ask":
    "<strong>Questions sur une PR.</strong> L’IA reçoit la conversation, les KPI Jev, le statut et la priorité du projet, l’état sur uat et le diff.",
  "around.slack":
    "<strong>Fils Slack.</strong> Un agent trouve les messages qui citent une PR avec ton propre accès Slack, affiche les fils complets et poste ta réponse dans le fil quand tu l’envoies.",
  "around.review":
    "<strong>Review IA en un clic.</strong> <code>@codex review</code>, <code>@claude review</code> ou <code>/gemini review</code>, réglables.",
  "around.recap":
    "<strong>Récap du jour.</strong> Chaque jour ouvré à l’heure choisie, une notification résume ce qui t’attend et <code>/standup:team</code> prépare le standup en brouillon dans Slack.",
  "around.issues":
    "<strong>Mes issues.</strong> Le sprint en cours de ton projet GitHub, avec statut, priorité et urgence Jev.",
  "around.overview":
    "<strong>Vue d’ensemble.</strong> Délai de review, ta série Zéro Ping, et ce qui est arrivé et sorti chaque jour.",
  "around.counter":
    "<strong>Un compteur de pings.</strong> Ce qui t’attend s’affiche sur le logo de la barre latérale, dans le titre de l’onglet et sur le favicon. À zéro, tout disparaît.",
  "around.notify":
    "<strong>Des notifications à ta mesure.</strong> Review demandée, réponse, changements demandés ou CI rouge sur ta PR, avec des heures « Ne pas déranger ».",
  "keys.title": "Pensé pour le clavier",
  "keys.move": "suivant / précédent",
  "keys.done": "marquer comme traité",
  "keys.select": "sélectionner",
  "keys.reply": "répondre",
  "keys.open": "ouvrir sur GitHub",
  "keys.diff": "conversation / fichiers",
  "private.eyebrow": "Local et privé",
  "private.title": "Rien à héberger, aucun compte à créer.",
  "private.machine.t": "Ta machine",
  "private.machine.d":
    "Un serveur Node sur localhost et une base PGlite embarquée dans le dossier <code>.data</code> du repo.",
  "private.github.t": "Ton jeton GitHub",
  "private.github.d":
    "Il réutilise <code>gh auth token</code> (ou <code>GITHUB_TOKEN</code>) et interroge GitHub à son rythme avec <code>If-Modified-Since</code> : une vérification sans changement ne consomme pas de quota.",
  "private.ai.t": "Ton IA",
  "private.ai.d":
    "Résumés, questions et recherche Slack passent par ton propre Claude Code ou Codex, en mode non interactif, sur ton compte.",
  "private.slack.t": "Ton accès Slack",
  "private.slack.d":
    "La recherche est en lecture seule. Un message n’est posté que quand tu envoies une réponse depuis l’app.",
  "private.jev.t": "Score facultatif",
  "private.jev.d":
    "Avec une clé TypeSafe, Jev estime l’urgence quand le contenu d’un élément change. Sans clé, des règles déterministes trient la liste.",
  "start.eyebrow": "Démarrer",
  "start.title": "En route en quatre commandes.",
  "start.needs": "Il te faut",
  "start.node": "Node.js 22.12 ou plus récent, et pnpm",
  "start.gh":
    "La CLI GitHub, connectée avec <code>gh auth login</code> (ou un <code>GITHUB_TOKEN</code>)",
  "start.agent":
    "Pour l’IA et Slack : Claude Code avec le connecteur Slack, ou Codex avec un serveur MCP Slack",
  "start.jev": "Facultatif : une clé API TypeSafe pour le score Jev",
  "start.s1": "Clone le dépôt",
  "start.s2": "Installe les dépendances",
  "start.s3":
    "Crée ton <code>.env</code>, et ajoute <code>TYPESAFE_AI_API_KEY</code> si tu en as une",
  "start.s4": "Lance-le, puis ouvre <code>http://localhost:3000</code>",
  "start.after":
    "La première synchronisation récupère les 30 derniers jours de notifications. Sur macOS, <code>scripts/macos-app.sh</code> crée une app pour le Dock qui démarre le serveur sur le port 4747 et affiche ton nombre de pings en pastille.",
  "start.readme": "Toute l’installation dans le README →",
  "foot.line": "Pour les lead devs qui préfèrent reviewer du code que lire des emails de notification.",
  "foot.source": "Code source",
  copy: "Copier",
  copied: "Copié",
}

const STORAGE_KEY = "zero-ping-lang"
const english = new Map()
const metaDescription = document.querySelector('meta[name="description"]')
const labelled = document.querySelector("[data-i18n-label]")

function remember(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

function savedLang() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function text(key, lang) {
  return lang === "fr" ? FR[key] : english.get(key)
}

function applyLang(lang) {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.dataset.i18n
    if (!english.has(key)) english.set(key, el.innerHTML)
    const value = text(key, lang)
    if (value !== undefined) el.innerHTML = value
  }
  document.title = text("meta.title", lang)
  metaDescription.content = text("meta.description", lang)
  labelled.setAttribute("aria-label", text("lang", lang))
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang))
  }
  for (const button of document.querySelectorAll(".copy")) {
    if (!button.dataset.busy) button.textContent = text("copy", lang)
  }
}

english.set("meta.title", document.title)
english.set("meta.description", metaDescription.content)
english.set("lang", labelled.getAttribute("aria-label"))
english.set("copy", "Copy")
english.set("copied", "Copied")

// Copy buttons are added by script so they never show where they cannot work.
for (const pre of document.querySelectorAll("pre")) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "copy"
  button.textContent = "Copy"
  button.addEventListener("click", async () => {
    const lang = document.documentElement.lang
    try {
      await navigator.clipboard.writeText(pre.querySelector("code").textContent)
      button.dataset.busy = "1"
      button.textContent = text("copied", lang)
      setTimeout(() => {
        delete button.dataset.busy
        button.textContent = text("copy", document.documentElement.lang)
      }, 1600)
    } catch {
      // Without clipboard access the command stays selectable by hand.
    }
  })
  // The button sits on a wrapper so it stays put while a long command scrolls.
  const frame = document.createElement("div")
  frame.className = "code"
  pre.replaceWith(frame)
  frame.append(pre, button)
}

for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click", () => {
    applyLang(button.dataset.lang)
    remember(button.dataset.lang)
    // Keep a shared link in the language being read.
    const url = new URL(location.href)
    url.searchParams.set("lang", button.dataset.lang)
    history.replaceState(null, "", url)
  })
}

// English by default; French for ?lang=fr, a saved choice or a French browser.
const requested = new URLSearchParams(location.search).get("lang")
const initial =
  requested ??
  savedLang() ??
  (navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en")
if (initial === "fr") applyLang("fr")
