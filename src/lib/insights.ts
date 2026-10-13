import type { PullInsight } from "@/server/db/schema"

/**
 * The KPIs Jev gives a PR. A `levels` KPI is a score over ordered levels; a
 * `yesno` KPI is a probability. `tone` says which end is the worrying one.
 */
export type InsightSpec = {
  id: string
  label: string
  /** Shown on hover: what the KPI says and what Jev looked at. */
  hint: string
  instructions: string
} & (
  | {
      kind: "levels"
      levels: string[]
      /** What each level means, shown on hover. */
      meanings: string[]
      worst: "high" | "low"
    }
  | { kind: "yesno"; yes: string; no: string; worst: "yes" | "no" }
)

/** The KPIs of a pull request. */
export const INSIGHTS: InsightSpec[] = [
  {
    id: "risk",
    label: "Risque en prod",
    hint: "Ce qui peut casser une fois en prod : migrations, auth, paiements, infra, config, volume du changement.",
    instructions:
      "How risky is deploying this pull request to production? Consider database migrations, authentication and permissions, payments, infrastructure or configuration changes, shared code, and the size of the change.",
    kind: "levels",
    levels: ["Faible", "Modéré", "Élevé", "Critique"],
    meanings: [
      "changement isolé, sans zone sensible",
      "touche du code partagé ou un comportement visible",
      "zone sensible (données, auth, infra) ou gros volume",
      "peut casser la prod ou perdre des données",
    ],
    worst: "high",
  },
  {
    id: "effort",
    label: "Effort de review",
    hint: "Temps de relecture estimé, d'après le nombre de fichiers, les lignes et la complexité du diff.",
    instructions:
      "How long would a careful review of this diff take an experienced developer of the codebase?",
    kind: "levels",
    levels: ["< 15 min", "~30 min", "~1 h", "> 2 h"],
    meanings: [
      "quelques fichiers simples",
      "un sujet à comprendre, diff court",
      "plusieurs fichiers ou une logique à suivre",
      "gros diff ou logique dense : prévoir un créneau",
    ],
    worst: "high",
  },
  {
    id: "ready",
    label: "Prête à merger",
    hint: "Chance d'être mergée sans nouvel aller-retour : CI, approbations, fils de review ouverts, questions sans réponse.",
    instructions:
      "Can this pull request be merged as it is, without another round of changes? Consider CI, approvals, unresolved review threads and unanswered questions.",
    kind: "yesno",
    yes: "Oui",
    no: "Pas encore",
    worst: "no",
  },
  {
    id: "tests",
    label: "Tests",
    hint: "Les changements sont-ils couverts par des tests ajoutés ou modifiés dans le diff ?",
    instructions:
      "How well do the tests added or changed in this diff cover the behaviour it changes?",
    kind: "levels",
    levels: ["Absents", "Partiels", "Suffisants"],
    meanings: [
      "aucun test ajouté ni modifié pour ce changement",
      "des tests, mais des cas changés restent sans test",
      "les comportements modifiés sont testés",
    ],
    worst: "low",
  },
  {
    id: "breaking",
    label: "Changement cassant",
    hint: "Rupture d'un contrat : API, schéma de base, variables d'environnement, format d'événement. Il faut alors prévenir ou migrer.",
    instructions:
      "Does this pull request break a contract other code or teams rely on: a public or internal API, a database schema, environment variables, an event or message format?",
    kind: "yesno",
    yes: "Oui",
    no: "Non",
    worst: "yes",
  },
  {
    id: "clarity",
    label: "Clarté de la PR",
    hint: "La description dit-elle pourquoi, comment tester et quel impact attendre ?",
    instructions:
      "How well does the description explain why the change is made, how to test it and what impact to expect?",
    kind: "levels",
    levels: ["Floue", "Correcte", "Claire"],
    meanings: [
      "on ne sait pas pourquoi ni comment tester",
      "le quoi est dit, le pourquoi ou les tests manquent",
      "pourquoi, comment tester et impact sont expliqués",
    ],
    worst: "low",
  },
  {
    id: "security",
    label: "Avis sécurité",
    hint: "Une personne spécialisée en sécurité devrait-elle valider ? (auth, permissions, secrets, données personnelles)",
    instructions:
      "Should a security specialist review this pull request (authentication, permissions, secrets, personal data, injection)?",
    kind: "yesno",
    yes: "Requis",
    no: "Non",
    worst: "yes",
  },
  {
    id: "data",
    label: "Avis data / BDD",
    hint: "Une personne spécialisée data ou base de données devrait-elle valider ? (migrations, requêtes, index, volumétrie)",
    instructions:
      "Should a data or database specialist review this pull request (migrations, queries, indexes, data volume)?",
    kind: "yesno",
    yes: "Requis",
    no: "Non",
    worst: "yes",
  },
  {
    id: "infra",
    label: "Avis infra",
    hint: "Une personne spécialisée infra devrait-elle valider ? (Terraform, CI/CD, Docker, Cloud Run, réseau)",
    instructions:
      "Should an infrastructure specialist review this pull request (Terraform, CI/CD, containers, cloud resources, networking)?",
    kind: "yesno",
    yes: "Requis",
    no: "Non",
    worst: "yes",
  },
]

/** The KPIs of an issue, read from its description and conversation. */
export const ISSUE_INSIGHTS: InsightSpec[] = [
  {
    id: "ready",
    label: "Prête à démarrer",
    hint: "Le besoin est-il assez précis pour qu'un dev s'y mette : contexte, critères d'acceptation, exemples ou maquettes ?",
    instructions:
      "Is this issue specified well enough for a developer to start now: context, acceptance criteria, examples or mock-ups, no open question on the scope?",
    kind: "yesno",
    yes: "Prête",
    no: "À préciser",
    worst: "no",
  },
  {
    id: "size",
    label: "Taille estimée",
    hint: "Effort probable pour une personne de l'équipe, d'après le périmètre décrit.",
    instructions:
      "How much work would this issue take one developer of the team, from the scope described?",
    kind: "levels",
    levels: ["< ½ j", "~1 j", "2-3 j", "~1 sem.", "> 1 sprint"],
    meanings: [
      "une petite correction ou un réglage",
      "un changement simple et bien délimité",
      "une fonctionnalité courte ou un bug à investiguer",
      "une fonctionnalité complète, plusieurs couches",
      "trop gros pour un sprint : à découper",
    ],
    worst: "high",
  },
  {
    id: "impact",
    label: "Impact métier",
    hint: "Qui est touché et à quel point : clients, opérations, finance, bug en prod, process bloqué.",
    instructions:
      "How strong is the business impact of this issue: who is affected (customers, operations, finance), is production broken, is a process blocked?",
    kind: "levels",
    levels: ["Faible", "Moyen", "Fort", "Critique"],
    meanings: [
      "confort ou cas rare",
      "gêne réelle pour une partie des utilisateurs",
      "process ou clients importants touchés",
      "prod cassée, perte d'argent ou de données",
    ],
    worst: "high",
  },
  {
    id: "blocked",
    label: "Bloquée",
    hint: "L'issue attend-elle quelque chose : une décision, une autre équipe, une dépendance, une réponse du métier ?",
    instructions:
      "Is this issue waiting on something before work can go on: a decision, another team, a dependency, an answer from the business?",
    kind: "yesno",
    yes: "Oui",
    no: "Non",
    worst: "yes",
  },
  {
    id: "split",
    label: "À découper",
    hint: "Le ticket mélange-t-il plusieurs sujets qu'il vaudrait mieux séparer en plusieurs issues ?",
    instructions:
      "Does this issue mix several topics that would be better tracked as separate issues?",
    kind: "yesno",
    yes: "Conseillé",
    no: "Non",
    worst: "yes",
  },
  {
    id: "techRisk",
    label: "Risque technique",
    hint: "Inconnues techniques, zones sensibles (données, auth, infra), besoin d'une étude avant de coder.",
    instructions:
      "How much technical risk does this issue carry: unknowns, sensitive areas such as data, authentication or infrastructure, need for a spike before coding?",
    kind: "levels",
    levels: ["Faible", "Modéré", "Élevé"],
    meanings: [
      "terrain connu, peu d'inconnues",
      "quelques points à vérifier en route",
      "inconnues ou zone sensible : prévoir une étude",
    ],
    worst: "high",
  },
  {
    id: "decision",
    label: "Ton arbitrage",
    hint: "Une question ou une décision t'est-elle demandée, à toi le lead, dans la conversation ?",
    instructions:
      "Does the conversation wait for a question or a decision that the reader, the lead developer, must answer?",
    kind: "yesno",
    yes: "Oui",
    no: "Non",
    worst: "yes",
  },
]

/** How worrying an answer is, from 0 (fine) to 1 (look at it), for its colour. */
export function concern(spec: InsightSpec, insight: PullInsight): number {
  if (spec.kind === "yesno")
    return spec.worst === "yes" ? insight.value : 1 - insight.value
  const top = spec.levels.length - 1
  return spec.worst === "high" ? insight.value / top : 1 - insight.value / top
}

/** The answer in the interface's words. */
export function insightLabel(spec: InsightSpec, insight: PullInsight): string {
  if (spec.kind === "yesno") return insight.level === 1 ? spec.yes : spec.no
  return spec.levels[Math.min(insight.level, spec.levels.length - 1)]
}
