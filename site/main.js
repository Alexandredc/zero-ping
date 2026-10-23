const root = document.documentElement
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const I18N = window.ZP_I18N
let lang = "en"

/* ---------- Language ---------- */

const STORAGE_KEY = "zero-ping-lang"
const english = new Map()
const metaDescription = document.querySelector('meta[name="description"]')
english.set("meta.description", metaDescription.content)

function t(key) {
  return I18N[lang][key] ?? english.get(key) ?? I18N.en[key] ?? key
}

function remember(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
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

function applyLang(next) {
  lang = next
  root.lang = next
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.dataset.i18n
    if (!english.has(key)) english.set(key, el.innerHTML)
    el.innerHTML = t(key)
  }
  for (const el of document.querySelectorAll("[data-i18n-label]")) {
    const key = el.dataset.i18nLabel
    if (!english.has(key)) english.set(key, el.getAttribute("aria-label"))
    el.setAttribute("aria-label", t(key))
  }
  for (const el of document.querySelectorAll("[data-i18n-alt]")) {
    const key = el.dataset.i18nAlt
    if (!english.has(key)) english.set(key, el.alt)
    el.alt = t(key)
  }
  document.title = t("meta.title")
  metaDescription.content = t("meta.description")
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === next))
  }
  renderBoardTitle()
  renderSummary(false)
  renderKpiTiles()
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

/* ---------- Scroll: parallax, hero tilt, nav ---------- */

const nav = document.querySelector(".nav")
const hero = document.querySelector(".hero")
const speedLayers = [...document.querySelectorAll("[data-speed]")]
let ticking = false

function onScroll() {
  const y = window.scrollY
  nav.classList.toggle("scrolled", y > 8)
  if (!reduceMotion) {
    root.style.setProperty("--scroll", y.toFixed(1))
    // The app is flat once the visitor has scrolled about half a screen.
    const p = Math.min(1, Math.max(0, y / (window.innerHeight * 0.55)))
    hero.style.setProperty("--p", p.toFixed(3))
    for (const layer of speedLayers) {
      // Layers inside a section move relative to that section's centre, so they
      // sit in place when the section is on screen; the sky moves with the page.
      const section = layer.closest("section")
      let delta = y
      if (section) {
        const box = section.getBoundingClientRect()
        delta = section === hero ? y : box.top + box.height / 2 - window.innerHeight / 2
      }
      layer.style.transform = `translate3d(0, ${(delta * Number(layer.dataset.speed)).toFixed(1)}px, 0)`
    }
  }
  ticking = false
}

window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(onScroll)
    }
  },
  { passive: true }
)
onScroll()

/* ---------- Reveal on scroll ---------- */

const seen = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in")
        seen.unobserve(entry.target)
      }
    }
  },
  { rootMargin: "0px 0px -12% 0px" }
)
for (const el of document.querySelectorAll(
  ".works, .sort > .wrap, .features > .eyebrow, .features > h2, .tile, .also, .local .wrap > *, .start > *, .oss-copy"
)) {
  if (!reduceMotion) el.classList.add("reveal")
  seen.observe(el)
}

/* ---------- Hero counter ---------- */

const counter = document.querySelector("[data-counter]")
if (!reduceMotion) {
  const start = performance.now()
  const tick = (now) => {
    const k = Math.min(1, (now - start) / 1400)
    counter.textContent = String(Math.round(47 * (1 - Math.pow(1 - k, 3))))
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* ---------- Interactive demo of the app ---------- */

// Neutral demo data, in the app's own French labels.
const FOLDERS = [
  { id: "review", name: "À reviewer" },
  { id: "awaiting", name: "On t’attend" },
  { id: "mine", name: "Mes PR" },
  { id: "team", name: "Équipe" },
  { id: "done", name: "Traités" },
]

const ITEMS = {
  review: [
    {
      repo: "acme/api",
      num: 233,
      author: "nadia",
      age: "2 j",
      size: "M",
      score: 93,
      title: "Add rate limiting to public endpoints",
      chips: [["#", "slack"]],
      reasons: [
        ["Review demandée à toi", 30],
        ["IA : importante", 20],
        ["Label urgent", 20],
        ["Il ne manque que ta review", 15],
        ["En attente depuis 2 j", 8],
      ],
      summary:
        "Ajoute une limite de 100 requêtes par minute et par clé. nadia attend ta review ; une question reste ouverte sur les clés internes.",
      kpis: [
        ["Risque en prod", "Élevé", "bad"],
        ["Effort de review", "~30 min", "ok"],
        ["Prête à merger", "Pas encore", "watch"],
        ["Expertise requise", "sécurité", "bad"],
      ],
      thread: [
        "#api-team",
        [
          ["priya", "On garde la même limite pour les clés internes ?"],
          ["nadia", "Non, je les exclus, c’est dans la PR."],
        ],
      ],
      actions: [["Approuver", "primary", true], ["Demander des changements"], ["Traité", "", true, "e"]],
    },
    {
      repo: "acme/web",
      num: 415,
      author: "priya",
      age: "5 h",
      size: "S",
      score: 66,
      title: "Fix flaky checkout test on Safari",
      chips: [["Corrections poussées", "info"]],
      reasons: [
        ["Review demandée à toi", 30],
        ["Corrections poussées", 25],
        ["Petite PR", 10],
      ],
      summary:
        "Remplace l’attente fixe par une attente sur l’état du panier. Tu avais demandé des changements : deux commits sont arrivés depuis, le diff peut se limiter à eux.",
      actions: [["Approuver", "primary", true], ["Voir les nouveaux commits"], ["Traité", "", true, "e"]],
    },
  ],
  awaiting: [
    {
      repo: "acme/web",
      num: 409,
      author: "otto",
      age: "1 h",
      size: "L",
      score: 74,
      title: "Move checkout to server components",
      chips: [["#", "slack"]],
      reasons: [
        ["On attend ta réponse", 25],
        ["IA : importante", 20],
        ["Question posée", 10],
      ],
      summary:
        "otto a répondu à ton fil de review sur le cache du panier et te demande s’il peut merger après la démo de jeudi.",
      kpis: [
        ["Risque en prod", "Modéré", "watch"],
        ["Effort de review", "~1 h", "watch"],
        ["Prête à merger", "Oui", "ok"],
        ["Tests", "Suffisants", "ok"],
      ],
      thread: ["#web", [["otto", "Je merge après la démo si c’est bon pour toi ?"]]],
      actions: [["Répondre", "primary", false, "r"], ["Traité", "", true, "e"]],
    },
  ],
  mine: [
    {
      repo: "acme/mobile",
      num: 87,
      author: "toi",
      age: "3 h",
      size: "M",
      score: 58,
      title: "Cache avatars on device",
      chips: [["CI en échec", "bad"]],
      reasons: [
        ["CI en échec", 15],
        ["Changements demandés", 15],
      ],
      failed: ["test (ios)", "2 échecs · AvatarCache › evicts oldest entry"],
      summary:
        "Le job test (ios) échoue sur l’éviction du cache ; kim demande de garder la taille maximale configurable.",
      actions: [["Relancer les jobs ratés", "primary"], ["Ouvrir le log"]],
    },
    {
      repo: "acme/api",
      num: 229,
      author: "toi",
      age: "1 j",
      size: "S",
      score: 48,
      title: "Paginate the audit log",
      chips: [["Approuvée", "good"]],
      reasons: [
        ["Approuvée, prête à merger", 10],
        ["Petite PR", 10],
      ],
      summary: "Approuvée par nadia et otto, CI verte. Il ne reste qu’à merger.",
      actions: [["Squash and merge", "primary", true], ["Supprimer la branche"]],
    },
    {
      repo: "acme/web",
      num: 402,
      author: "toi",
      age: "4 j",
      size: "XL",
      score: 12,
      title: "Upgrade the router to v2",
      chips: [["Brouillon", ""]],
      reasons: [
        ["Brouillon", -20],
        ["Très grosse PR", -5],
      ],
      summary: "Brouillon en cours, pas encore de reviewer demandé.",
      actions: [["Marquer prête pour la review", "primary"]],
    },
  ],
  team: [
    {
      repo: "acme/api",
      num: 231,
      author: "pablo",
      age: "3 j",
      size: "M",
      title: "Retry webhooks with backoff",
      chips: [["Sans reviewer", "info"]],
      summary: "Ouverte depuis 3 jours sans reviewer. Ajoute des tentatives avec délai croissant sur les webhooks sortants.",
      actions: [["Prendre la review", "primary", true]],
    },
    {
      repo: "acme/web",
      num: 398,
      author: "kim",
      age: "2 j",
      size: "S",
      title: "Dark mode for settings",
      chips: [["Conflits", "bad"]],
      summary: "En conflit avec main depuis le merge de #412.",
      actions: [["Prendre la review", "primary", true]],
    },
    {
      repo: "acme/docs",
      num: 74,
      author: "lena",
      age: "9 j",
      size: "S",
      title: "API versioning guide",
      chips: [["Ouverte depuis 9 j", "info"]],
      summary: "Guide de versionnement de l’API, ouvert depuis 9 jours.",
      actions: [["Prendre la review", "primary", true]],
    },
    {
      repo: "acme/mobile",
      num: 84,
      author: "otto",
      age: "6 h",
      size: "L",
      title: "Biometric login",
      chips: [["CI rouge", "bad"]],
      summary: "La CI échoue sur le build Android.",
      actions: [["Prendre la review", "primary", true]],
    },
  ],
  done: [
    { repo: "acme/web", num: 418, author: "dependabot[bot]", age: "2 h", title: "Bump vite from 7.1.2 to 7.1.4", chips: [["bot", ""]] },
    { repo: "acme/api", num: 0, author: "github-actions", age: "3 h", title: "Release v2.8.0", chips: [["release", ""]] },
    { repo: "acme/web", num: 412, author: "kim", age: "5 h", title: "Merged into main", chips: [["mergée", ""]] },
    { repo: "acme/docs", num: 77, author: "renovate[bot]", age: "1 j", title: "Update dependency eslint to v9.38", chips: [["bot", ""]] },
  ],
}

const demo = document.getElementById("demo")
const foldersEl = demo.querySelector("[data-folders]")
const listEl = demo.querySelector("[data-list]")
const detailEl = demo.querySelector("[data-detail]")
const tabTitle = demo.querySelector("[data-tab-title]")
const sideCount = demo.querySelector("[data-side-count]")
const state = { folder: "review", index: 0, removed: new Set() }

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
}

function itemKey(folder, item) {
  return `${folder}:${item.repo}#${item.num}:${item.title}`
}

function visible(folder) {
  return ITEMS[folder].filter((item) => !state.removed.has(itemKey(folder, item)))
}

// Like the app: the count covers « À reviewer » and « On t'attend ».
function pingCount() {
  return visible("review").length + visible("awaiting").length
}

function renderFolders() {
  foldersEl.innerHTML = FOLDERS.map((f) => {
    const n = f.id === "done" ? 41 + state.removed.size : visible(f.id).length
    return `<li><button type="button" data-folder="${f.id}" aria-current="${f.id === state.folder}">${f.name}<em>${n || ""}</em></button></li>`
  }).join("")
  const count = pingCount()
  tabTitle.textContent = count ? `(${count}) Zéro Ping` : "Zéro Ping"
  sideCount.textContent = count ? String(count) : ""
}

function gauge(score) {
  if (!score) return '<span class="gauge" style="--level: 0.06"><span>–</span></span>'
  return `<span class="gauge${score >= 60 ? " hot" : ""}" style="--level: ${Math.max(0.06, score / 100)}"><span>${score}</span></span>`
}

function renderList() {
  const items = visible(state.folder)
  const folder = FOLDERS.find((f) => f.id === state.folder)
  if (!items.length) {
    listEl.innerHTML = `<div class="list-head"><b>${folder.name}</b></div>
      <div class="empty"><div><b>Zéro ping.</b>Rien ne t’attend ici.</div><button type="button" data-reset>Remettre les éléments</button></div>`
    detailEl.innerHTML = ""
    return
  }
  state.index = Math.min(state.index, items.length - 1)
  const sort = state.folder === "done" ? "Plus récents" : "Priorité ▾"
  listEl.innerHTML =
    `<div class="list-head"><b>${folder.name}</b><span>${sort}</span></div>` +
    items
      .map((item, i) => {
        const chips = (item.chips || []).map(([label, kind]) => `<span class="chip ${kind}">${esc(label)}</span>`).join("")
        const size = item.size ? `<span class="chip">${item.size}</span>` : ""
        const ref = item.num ? ` #${item.num}` : ""
        return `<button type="button" class="row" data-index="${i}" aria-current="${i === state.index}">
          ${gauge(item.score)}
          <div><p class="row-meta">${item.repo}${ref} · ${esc(item.author)} · ${item.age} ${size}${chips}</p>
          <p class="row-title">${esc(item.title)}</p></div></button>`
      })
      .join("")
  renderDetail(items[state.index])
}

function renderDetail(item) {
  const ref = item.num ? ` #${item.num}` : ""
  let html = `<p class="row-meta">${item.repo}${ref} · ${esc(item.author)} · ${item.age}</p>
    <p class="detail-title">${esc(item.title)}</p>
    <div class="tabs"><span class="on">Conversation</span><span>Fichiers modifiés</span></div>`
  if (item.summary) {
    html += `<div class="d-card ai"><p class="d-label">✦ Résumé IA · court</p><p>${esc(item.summary)}</p></div>`
  }
  if (item.kpis) {
    html += `<div class="d-kpis"><p class="d-label">◔ KPI Jev</p><div>${item.kpis
      .map(([label, value, tone]) => `<span><em>${label}</em><b class="${tone}">${value}</b></span>`)
      .join("")}</div></div>`
  }
  if (item.failed) {
    html += `<div class="d-card bad"><p class="d-label">✕ ${esc(item.failed[0])}</p><p>${esc(item.failed[1])}</p></div>`
  }
  if (item.thread) {
    const [channel, messages] = item.thread
    html += `<div class="d-card sl"><p class="d-label"># ${channel}</p>${messages
      .map(([who, text]) => `<p><b>${who}</b> ${esc(text)}</p>`)
      .join("")}</div>`
  }
  if (item.reasons) {
    html += `<div class="reasons">${item.reasons
      .map(([label, w]) => `<span>${esc(label)} <b>${w > 0 ? "+" : ""}${w}</b></span>`)
      .join("")}</div>`
  }
  if (item.actions) {
    html += `<div class="actions">${item.actions
      .map(
        ([label, kind = "", done = false, shortcut]) =>
          `<button type="button" class="act ${kind}" data-act="${done ? "done" : "noop"}">${label}${shortcut ? ` <kbd>${shortcut}</kbd>` : ""}</button>`
      )
      .join("")}</div>`
  }
  detailEl.innerHTML = html
}

function render() {
  renderFolders()
  renderList()
}

function markDone() {
  const item = visible(state.folder)[state.index]
  if (!item || state.folder === "done") return
  const row = listEl.querySelector(`[data-index="${state.index}"]`)
  const finish = () => {
    state.removed.add(itemKey(state.folder, item))
    render()
  }
  if (row && !reduceMotion) {
    row.classList.add("leaving")
    setTimeout(finish, 260)
  } else finish()
}

function move(step) {
  const n = visible(state.folder).length
  if (!n) return
  state.index = (state.index + step + n) % n
  renderList()
}

// Buttons that would reach GitHub or Slack say so instead.
function noop(button) {
  const actions = button.parentElement
  if (actions.querySelector(".noop")) return
  const note = document.createElement("span")
  note.className = "chip info noop"
  note.textContent = t("demo.noop")
  actions.append(note)
  setTimeout(() => note.remove(), 1800)
}

demo.addEventListener("click", (event) => {
  const folder = event.target.closest("[data-folder]")
  if (folder) {
    state.folder = folder.dataset.folder
    state.index = 0
    render()
    return
  }
  const row = event.target.closest("[data-index]")
  if (row) {
    state.index = Number(row.dataset.index)
    renderList()
    return
  }
  const act = event.target.closest("[data-act]")
  if (act) {
    if (act.dataset.act === "done") markDone()
    else noop(act)
    return
  }
  if (event.target.closest("[data-reset]")) {
    state.removed.clear()
    render()
  }
})

render()

let demoInView = false
new IntersectionObserver(
  ([entry]) => {
    demoInView = entry.isIntersecting
  },
  { threshold: 0.35 }
).observe(demo)

/* ---------- Keyboard: drives the demo and lights the keycaps ---------- */

const caps = new Map([...document.querySelectorAll("[data-key]")].map((el) => [el.dataset.key, el]))
let userTyped = false

function flash(name) {
  const cap = caps.get(name)
  if (!cap) return
  cap.classList.add("pressed")
  setTimeout(() => cap.classList.remove("pressed"), 160)
}

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.target.closest("input, textarea, select")) return
  if (event.metaKey && event.key !== "Enter") return
  const name = event.key === "Enter" ? (event.metaKey ? "Enter" : "") : event.key.toLowerCase()
  if (!caps.has(name)) return
  userTyped = true
  flash(name)
  if (!demoInView) return
  if (name === "j") move(1)
  if (name === "k") move(-1)
  if (name === "e") markDone()
})

// Until someone types, the keycaps play a short sequence on their own.
let keysTimer = null
new IntersectionObserver(([entry]) => {
  clearInterval(keysTimer)
  if (!entry.isIntersecting || reduceMotion) return
  const sequence = ["j", "j", "k", "x", "e", "r", "Enter", "d"]
  let i = 0
  keysTimer = setInterval(() => {
    if (!userTyped) flash(sequence[i++ % sequence.length])
  }, 700)
}).observe(document.querySelector(".t-keys"))

/* ---------- How it sorts: steps drive the board ---------- */

const board = document.querySelector("[data-board]")
const boardTitle = document.querySelector("[data-board-title]")
const triggers = [...document.querySelectorAll("[data-step-trigger]")]

function renderBoardTitle() {
  boardTitle.textContent = t(`board.${board.dataset.step}`)
}

const stepObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      board.dataset.step = entry.target.dataset.stepTrigger
      for (const trigger of triggers) trigger.classList.toggle("active", trigger === entry.target)
      renderBoardTitle()
    }
  },
  { rootMargin: "-45% 0px -45% 0px" }
)
for (const trigger of triggers) stepObserver.observe(trigger)
triggers[0].classList.add("active")

/* ---------- AI summary tile ---------- */

// The app writes its summaries in French, whatever the page language.
const SUMMARIES = {
  court: "<p>Ajoute une limite de 100 requêtes par minute et par clé ; nadia attend ta review, une question reste ouverte sur les clés internes.</p>",
  standard:
    "<p><b>Essentiel.</b> La PR limite les endpoints publics à 100 requêtes par minute et par clé, avec un en-tête <code>Retry-After</code>.</p><p><b>Ce qu’on attend de toi.</b> Ta review : tu es le dernier reviewer attendu, otto a déjà approuvé.</p><p><b>Question ouverte.</b> priya demande sur Slack si les clés internes gardent la même limite ; nadia répond qu’elles sont exclues.</p>",
  detaille:
    "<p><b>Essentiel.</b> Limite de 100 requêtes par minute et par clé sur les endpoints publics, stockée en mémoire avec une fenêtre glissante.</p><ul><li>Les clés internes sont exclues (réponse de nadia dans #api-team).</li><li>otto a approuvé ; il ne manque que ta review.</li><li>CI verte, taille M (+184 −22).</li></ul><p><b>Points de vigilance.</b> Le compteur en mémoire ne tient pas entre plusieurs instances ; à confirmer avant la mise en production.</p>",
}
const summaryEl = document.querySelector("[data-summary]")
const segButtons = [...document.querySelectorAll("[data-len]")]
let summaryLen = "court"
let typing = null

function renderSummary(animate = true) {
  clearInterval(typing)
  const html = SUMMARIES[summaryLen]
  if (!animate || reduceMotion) {
    summaryEl.innerHTML = html
    return
  }
  // Reveal the summary word by word, like a model streaming its answer.
  const words = html.split(/(?<=\s)/)
  let i = 0
  typing = setInterval(() => {
    i += 2
    const part = words.slice(0, i).join("")
    summaryEl.innerHTML = part + (i < words.length ? '<span class="caret"></span>' : "")
    if (i >= words.length) clearInterval(typing)
  }, 45)
}

for (const button of segButtons) {
  button.addEventListener("click", () => {
    summaryLen = button.dataset.len
    for (const b of segButtons) b.setAttribute("aria-selected", String(b === button))
    renderSummary()
  })
}
renderSummary(false)

/* ---------- Ping counter tile ---------- */

const badge = document.querySelector("[data-count-badge]")
const badgeTitle = document.querySelector("[data-count-title]")
let countTimer = null

function showCount(n) {
  badge.textContent = String(n)
  badge.classList.toggle("gone", n === 0)
  badgeTitle.textContent = n ? `(${n}) Zéro Ping` : "Zéro Ping"
}

new IntersectionObserver(([entry]) => {
  clearInterval(countTimer)
  if (!entry.isIntersecting || reduceMotion) return
  let n = 3
  showCount(n)
  countTimer = setInterval(() => {
    n = n === 0 ? 3 : n - 1
    showCount(n)
  }, 1300)
}).observe(document.querySelector(".t-counter"))

/* ---------- Tiles: the border follows the cursor ---------- */

for (const tile of document.querySelectorAll(".tile")) {
  tile.addEventListener("pointermove", (event) => {
    const box = tile.getBoundingClientRect()
    tile.style.setProperty("--mx", `${event.clientX - box.left}px`)
    tile.style.setProperty("--my", `${event.clientY - box.top}px`)
  })
  tile.addEventListener("pointerleave", () => {
    tile.style.removeProperty("--mx")
    tile.style.removeProperty("--my")
  })
}

/* ---------- Terminal ---------- */

const term = document.querySelector(".term")
if (!reduceMotion) {
  term.classList.add("typing")
  const lines = [...term.querySelectorAll(".line")]
  const termObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      termObserver.disconnect()
      lines.forEach((line, i) => setTimeout(() => line.classList.add("shown"), 250 + i * 420))
    },
    { threshold: 0.5 }
  )
  termObserver.observe(term)
}

/* ---------- Copy ---------- */

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    const before = label.textContent
    label.textContent = t("copied")
    setTimeout(() => {
      label.textContent = before === t("copied") ? t("copy") : before
    }, 1500)
  } catch {
    // Without clipboard access the command stays selectable by hand.
  }
}

const heroCmd = document.querySelector("[data-copy]")
heroCmd.addEventListener("click", () => copy(heroCmd.dataset.copy, heroCmd.querySelector(".cmd-copy")))

const copyAll = document.querySelector("[data-copy-all]")
copyAll.addEventListener("click", () =>
  copy([...document.querySelectorAll("[data-cmd]")].map((el) => el.textContent).join("\n"), copyAll)
)

/* ---------- Jev KPIs ---------- */

// The KPI scales come from src/lib/insights.ts; values are demo answers.
const KPI = {
  pr: {
    subject: "acme/api #233 · Add rate limiting to public endpoints",
    specs: [
      {
        label: ["Production risk", "Risque en prod"],
        hint: ["What can break once in production: migrations, auth, payments, infra, config, size of the change.", "Ce qui peut casser une fois en prod : migrations, auth, paiements, infra, config, volume du changement."],
        levels: [["Low", "Faible"], ["Moderate", "Modéré"], ["High", "Élevé"], ["Critical", "Critique"]],
        meanings: [["isolated change, no sensitive area", "changement isolé, sans zone sensible"], ["touches shared code or visible behaviour", "touche du code partagé ou un comportement visible"], ["sensitive area (data, auth, infra) or large volume", "zone sensible (données, auth, infra) ou gros volume"], ["can break production or lose data", "peut casser la prod ou perdre des données"]],
        worst: "high",
        level: 2,
        confidence: 0.82,
      },
      {
        label: ["Review effort", "Effort de review"],
        hint: ["Estimated reading time, from the number of files, the lines and the complexity of the diff.", "Temps de relecture estimé, d'après le nombre de fichiers, les lignes et la complexité du diff."],
        levels: [["< 15 min", "< 15 min"], ["~30 min", "~30 min"], ["~1 h", "~1 h"], ["> 2 h", "> 2 h"]],
        meanings: [["a few simple files", "quelques fichiers simples"], ["one topic to understand, short diff", "un sujet à comprendre, diff court"], ["several files or logic to follow", "plusieurs fichiers ou une logique à suivre"], ["large diff or dense logic: book a slot", "gros diff ou logique dense : prévoir un créneau"]],
        worst: "high",
        level: 1,
        confidence: 0.77,
      },
      {
        label: ["Ready to merge", "Prête à merger"],
        hint: ["Chance of merging without another round: CI, approvals, open review threads, unanswered questions.", "Chance d'être mergée sans nouvel aller-retour : CI, approbations, fils de review ouverts, questions sans réponse."],
        yes: ["Yes", "Oui"],
        no: ["Not yet", "Pas encore"],
        worst: "no",
        value: 0.41,
        confidence: 0.74,
      },
      {
        label: ["Tests", "Tests"],
        hint: ["Are the changes covered by tests added or changed in the diff?", "Les changements sont-ils couverts par des tests ajoutés ou modifiés dans le diff ?"],
        levels: [["Missing", "Absents"], ["Partial", "Partiels"], ["Enough", "Suffisants"]],
        meanings: [["no test added or changed for this change", "aucun test ajouté ni modifié pour ce changement"], ["tests, but some changed cases have none", "des tests, mais des cas changés restent sans test"], ["the changed behaviours are tested", "les comportements modifiés sont testés"]],
        worst: "low",
        level: 1,
        confidence: 0.7,
      },
      {
        label: ["Breaking change", "Changement cassant"],
        hint: ["A broken contract: API, database schema, environment variables, event format. Then someone must be told or migrate.", "Rupture d'un contrat : API, schéma de base, variables d'environnement, format d'événement. Il faut alors prévenir ou migrer."],
        yes: ["Yes", "Oui"],
        no: ["No", "Non"],
        worst: "yes",
        value: 0.22,
        confidence: 0.42,
      },
      {
        label: ["PR clarity", "Clarté de la PR"],
        hint: ["Does the description say why, how to test and what impact to expect?", "La description dit-elle pourquoi, comment tester et quel impact attendre ?"],
        levels: [["Vague", "Floue"], ["Fair", "Correcte"], ["Clear", "Claire"]],
        meanings: [["no idea why or how to test", "on ne sait pas pourquoi ni comment tester"], ["the what is there, the why or the tests are missing", "le quoi est dit, le pourquoi ou les tests manquent"], ["why, how to test and impact are explained", "pourquoi, comment tester et impact sont expliqués"]],
        worst: "low",
        level: 2,
        confidence: 0.88,
      },
      {
        label: ["Expertise needed", "Expertise requise"],
        hint: ["Should a security, data or infra specialist sign off?", "Une personne spécialisée en sécurité, data ou infra devrait-elle valider ?"],
        experts: [
          [["security", "sécurité"], 0.78],
          [["data / DB", "data / BDD"], 0.12],
          [["infra", "infra"], 0.2],
        ],
        confidence: 0.8,
      },
    ],
  },
  issue: {
    subject: "acme/web #420 · Export invoices as CSV",
    specs: [
      {
        label: ["Ready to start", "Prête à démarrer"],
        hint: ["Is the need precise enough for a dev to start: context, acceptance criteria, examples or mock-ups?", "Le besoin est-il assez précis pour qu'un dev s'y mette : contexte, critères d'acceptation, exemples ou maquettes ?"],
        yes: ["Ready", "Prête"],
        no: ["Needs detail", "À préciser"],
        worst: "no",
        value: 0.3,
        confidence: 0.79,
      },
      {
        label: ["Estimated size", "Taille estimée"],
        hint: ["Likely effort for one person of the team, from the scope described.", "Effort probable pour une personne de l'équipe, d'après le périmètre décrit."],
        levels: [["< ½ day", "< ½ j"], ["~1 day", "~1 j"], ["2-3 days", "2-3 j"], ["~1 week", "~1 sem."], ["> 1 sprint", "> 1 sprint"]],
        meanings: [["a small fix or a setting", "une petite correction ou un réglage"], ["a simple, well-bounded change", "un changement simple et bien délimité"], ["a short feature or a bug to investigate", "une fonctionnalité courte ou un bug à investiguer"], ["a full feature, several layers", "une fonctionnalité complète, plusieurs couches"], ["too big for a sprint: split it", "trop gros pour un sprint : à découper"]],
        worst: "high",
        level: 2,
        confidence: 0.66,
      },
      {
        label: ["Business impact", "Impact métier"],
        hint: ["Who is affected and how much: customers, operations, finance, production bug, blocked process.", "Qui est touché et à quel point : clients, opérations, finance, bug en prod, process bloqué."],
        levels: [["Low", "Faible"], ["Medium", "Moyen"], ["High", "Fort"], ["Critical", "Critique"]],
        meanings: [["comfort or a rare case", "confort ou cas rare"], ["a real nuisance for some users", "gêne réelle pour une partie des utilisateurs"], ["key processes or customers affected", "process ou clients importants touchés"], ["production down, money or data lost", "prod cassée, perte d'argent ou de données"]],
        worst: "high",
        level: 1,
        confidence: 0.71,
      },
      {
        label: ["Blocked", "Bloquée"],
        hint: ["Is the issue waiting on something: a decision, another team, a dependency, an answer from the business?", "L'issue attend-elle quelque chose : une décision, une autre équipe, une dépendance, une réponse du métier ?"],
        yes: ["Yes", "Oui"],
        no: ["No", "Non"],
        worst: "yes",
        value: 0.14,
        confidence: 0.83,
      },
      {
        label: ["Split it", "À découper"],
        hint: ["Does the ticket mix several topics better tracked as separate issues?", "Le ticket mélange-t-il plusieurs sujets qu'il vaudrait mieux séparer en plusieurs issues ?"],
        yes: ["Advised", "Conseillé"],
        no: ["No", "Non"],
        worst: "yes",
        value: 0.62,
        confidence: 0.68,
      },
      {
        label: ["Technical risk", "Risque technique"],
        hint: ["Technical unknowns, sensitive areas (data, auth, infra), need for a spike before coding.", "Inconnues techniques, zones sensibles (données, auth, infra), besoin d'une étude avant de coder."],
        levels: [["Low", "Faible"], ["Moderate", "Modéré"], ["High", "Élevé"]],
        meanings: [["known ground, few unknowns", "terrain connu, peu d'inconnues"], ["a few points to check on the way", "quelques points à vérifier en route"], ["unknowns or sensitive area: plan a spike", "inconnues ou zone sensible : prévoir une étude"]],
        worst: "high",
        level: 1,
        confidence: 0.72,
      },
      {
        label: ["Your call", "Ton arbitrage"],
        hint: ["Does the conversation wait for a question or a decision from you, the lead?", "Une question ou une décision t'est-elle demandée, à toi le lead, dans la conversation ?"],
        yes: ["Yes", "Oui"],
        no: ["No", "Non"],
        worst: "yes",
        value: 0.58,
        confidence: 0.64,
      },
    ],
  },
}

const kpiCard = document.querySelector("[data-kpi-card]")
const kpiTiles = document.querySelector("[data-kpi-tiles]")
const kpiScale = document.querySelector("[data-kpi-scale]")
const kpiWhen = document.querySelector("[data-kpi-when]")
const kpiSubject = document.querySelector("[data-kpi-subject]")
const kindButtons = [...document.querySelectorAll("[data-kind]")]
const kpiState = { kind: "pr", selected: 0, loaded: false }
let kpiTimer = null

const tr = (pair) => pair[lang === "fr" ? 1 : 0]
const pct = (value) => `${Math.round(value * 100)}${lang === "fr" ? " %" : "%"}`

// Same reading as the app: 0 is fine, 1 means look at it.
function kpiConcern(spec) {
  if (spec.experts) return Math.max(...spec.experts.map(([, value]) => value))
  if (spec.levels) {
    const top = spec.levels.length - 1
    return spec.worst === "high" ? spec.level / top : 1 - spec.level / top
  }
  return spec.worst === "yes" ? spec.value : 1 - spec.value
}

function kpiTone(spec) {
  if (spec.confidence < 0.5) return "unsure"
  const level = kpiConcern(spec)
  if (level >= 0.66) return "bad"
  if (level >= 0.4) return "watch"
  return "ok"
}

function kpiValue(spec) {
  if (spec.experts) {
    const needed = spec.experts.filter(([, value]) => value >= 0.5).map(([name]) => tr(name))
    return needed.length ? needed.join(", ") : tr(["None", "Aucune"])
  }
  if (spec.levels) return tr(spec.levels[spec.level])
  return spec.value >= 0.5 ? tr(spec.yes) : tr(spec.no)
}

function renderKpiTiles() {
  const specs = KPI[kpiState.kind].specs
  kpiSubject.textContent = KPI[kpiState.kind].subject
  if (!kpiState.loaded) {
    kpiWhen.textContent = tr([
      `Jev is reading the ${kpiState.kind === "pr" ? "PR" : "issue"}… (a few seconds)`,
      `Jev évalue ${kpiState.kind === "pr" ? "la PR" : "l’issue"}… (quelques secondes)`,
    ])
    kpiTiles.innerHTML = specs
      .map((spec) => `<li><span class="kpi-tile loading"><span class="kpi-label">${tr(spec.label)}</span><span class="skel"></span></span></li>`)
      .join("")
    kpiScale.innerHTML = ""
    return
  }
  kpiWhen.textContent = tr(["2 min ago", "il y a 2 min"])
  kpiTiles.innerHTML = specs
    .map((spec, i) => {
      const tone = kpiTone(spec)
      const unsure = tone === "unsure" ? `<i class="unsure-tag">${t("kpi.unsure")}</i>` : ""
      return `<li style="--i: ${i}"><button type="button" class="kpi-tile" data-kpi="${i}" aria-pressed="${i === kpiState.selected}">
        <span class="kpi-label">${tr(spec.label)} <span aria-hidden="true">ⓘ</span></span>
        <span class="kpi-value ${tone}">${kpiValue(spec)}${unsure}</span></button></li>`
    })
    .join("")
  renderKpiScale()
}

function renderKpiScale() {
  const spec = KPI[kpiState.kind].specs[kpiState.selected]
  let body = ""
  if (spec.levels) {
    body = `<ol class="scale-levels">${spec.levels
      .map(
        (level, i) =>
          `<li class="${i === spec.level ? `on ${kpiTone(spec)}` : ""}"><b>${tr(level)}</b><span>${tr(spec.meanings[i])}</span></li>`
      )
      .join("")}</ol>`
  } else if (spec.experts) {
    body = `<ul class="scale-probs">${spec.experts
      .map(
        ([name, value]) =>
          `<li><span>${tr(name)}</span><span class="bar"><i style="--v: ${value}" class="${value >= 0.5 ? "bad" : "ok"}"></i></span><b>${pct(value)}</b></li>`
      )
      .join("")}</ul><p class="scale-foot">${tr(["“Required” from 50%.", "« Requis » à partir de 50 %."])}</p>`
  } else {
    body = `<ul class="scale-probs"><li><span>${tr(spec.yes)}</span><span class="bar"><i style="--v: ${spec.value}" class="${kpiTone(spec)}"></i><em class="mid"></em></span><b>${pct(spec.value)}</b></li></ul>
      <p class="scale-foot">${tr([`Probability of “${tr(spec.yes).toLowerCase()}”; “${tr(spec.yes)}” from 50%.`, `Probabilité de « ${tr(spec.yes).toLowerCase()} » ; « ${tr(spec.yes)} » à partir de 50 %.`])}</p>`
  }
  const unsure =
    spec.confidence < 0.5
      ? `<p class="scale-warn">${tr(["Below 50% confidence: shown as uncertain and left out of the score.", "Moins de 50 % de confiance : affiché comme incertain et ignoré dans le score."])}</p>`
      : ""
  kpiScale.innerHTML = `<p class="scale-kicker">${tr(["Scale", "Échelle"])}</p>
    <h3>${tr(spec.label)}</h3>
    <p class="scale-hint">${tr(spec.hint)}</p>
    ${body}
    <p class="scale-conf">${tr(["Jev’s confidence", "Confiance de Jev"])} <b>${pct(spec.confidence)}</b></p>${unsure}`
}

function runKpi(animate = true) {
  clearTimeout(kpiTimer)
  if (!animate || reduceMotion) {
    kpiState.loaded = true
    renderKpiTiles()
    return
  }
  kpiState.loaded = false
  renderKpiTiles()
  kpiCard.classList.remove("revealed")
  kpiTimer = setTimeout(() => {
    kpiState.loaded = true
    renderKpiTiles()
    kpiCard.classList.add("revealed")
  }, 1100)
}

kpiTiles.addEventListener("click", (event) => {
  const tile = event.target.closest("[data-kpi]")
  if (!tile) return
  kpiState.selected = Number(tile.dataset.kpi)
  for (const t of kpiTiles.querySelectorAll("[data-kpi]")) t.setAttribute("aria-pressed", String(t === tile))
  renderKpiScale()
})
kpiTiles.addEventListener("pointerover", (event) => {
  const tile = event.target.closest("[data-kpi]")
  if (tile && window.matchMedia("(hover: hover)").matches) tile.click()
})

for (const button of kindButtons) {
  button.addEventListener("click", () => {
    kpiState.kind = button.dataset.kind
    kpiState.selected = 0
    for (const b of kindButtons) b.setAttribute("aria-selected", String(b === button))
    runKpi()
  })
}

// Jev "reads" the PR the first time the card scrolls into view.
kpiState.loaded = true
renderKpiTiles()
const kpiObserver = new IntersectionObserver(
  ([entry]) => {
    if (!entry.isIntersecting) return
    kpiObserver.disconnect()
    runKpi()
  },
  { threshold: 0.4 }
)
kpiObserver.observe(kpiCard)

/* ---------- Tour of the app ---------- */

const shotTabs = [...document.querySelectorAll("[data-shot]")]

function showShot(tab, focus = false) {
  for (const other of shotTabs) {
    const on = other === tab
    other.setAttribute("aria-selected", String(on))
    other.tabIndex = on ? 0 : -1
    document.getElementById(`shot-${other.dataset.shot}`).hidden = !on
  }
  if (focus) tab.focus()
}

shotTabs.forEach((tab, i) => {
  tab.addEventListener("click", () => showShot(tab))
  // Arrow keys move between tabs, as in any tab list.
  tab.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    showShot(shotTabs[(i + step + shotTabs.length) % shotTabs.length], true)
  })
})

/* ---------- Initial language ---------- */

// English by default; French for ?lang=fr, a saved choice or a French browser.
const requested = new URLSearchParams(location.search).get("lang")
const initial = requested ?? savedLang() ?? (navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en")
if (initial === "fr") applyLang("fr")
else renderBoardTitle()
