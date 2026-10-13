// Shared sidebar of the screenshots, with the page given by <body data-page>.
const PAGES = [
  ["Lead"],
  ["overview", "◔", "Overview"],
  ["team", "⚇", "Team"],
  ["recap", "☼", "Daily recap"],
  ["To do"],
  ["review", "⟟", "To review", 2],
  ["awaiting", "✉", "Waiting on you", 1],
  ["mine", "⑂", "My PRs", 3],
  ["issues", "⊙", "My issues", 5],
  ["Sorted"],
  ["rest", "≡", "The rest", 12],
  ["snoozed", "◷", "Snoozed", 2],
  ["done", "✓", "Done"],
]

const page = document.body.dataset.page
const links = PAGES.map(([id, icon, label, count]) =>
  label === undefined
    ? `<p class="side-group">${id}</p>`
    : `<a class="${id === page ? "on" : ""}"><span class="ico">${icon}</span>${label}${count ? `<em>${count}</em>` : ""}</a>`
).join("")

document.querySelector("[data-side]").innerHTML = `
  <div class="side-brand"><img src="../../assets/logo.svg" width="26" height="26" alt="" /><span class="badge">3</span>Zéro Ping</div>
  ${links}
  <div class="side-bottom">
    <a><span class="ico">☾</span>Do not disturb</a>
    <a><span class="ico">↻</span>Sync <em>12 s</em></a>
    <a><span class="ico">⚙</span>Settings</a>
  </div>`
