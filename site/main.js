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
  document.title = t("meta.title")
  metaDescription.content = t("meta.description")
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === next))
  }
  renderBoardTitle()
  renderSummary(false)
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

/* ---------- Initial language ---------- */

// English by default; French for ?lang=fr, a saved choice or a French browser.
const requested = new URLSearchParams(location.search).get("lang")
const initial = requested ?? savedLang() ?? (navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en")
if (initial === "fr") applyLang("fr")
else renderBoardTitle()
