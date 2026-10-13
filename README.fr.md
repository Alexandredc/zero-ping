<div align="center">

<img src="public/logo.svg" alt="Logo Zéro Ping" width="96" />

# Zéro Ping

**Boîte de réception locale pour lead dev : notifications GitHub, fils Slack et sprint, triés et classés, pour que rien ne t'attende.**

[Fonctionnalités](#fonctionnalités) · [Démarrer](#démarrer) · [Réglages](#réglages) · [App macOS](#app-macos) · [Confidentialité](#confidentialité) · [Développement](#développement) · [FAQ](#faq) · [English](README.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/inbox-dark.webp" />
  <img src="docs/screenshots/inbox-light.webp" alt="Le dossier « À reviewer » avec une PR ouverte : KPI Jev, résumé IA et question posée à l'IA" />
</picture>

</div>

Zéro Ping remplace les emails de notification GitHub par une liste triée de ce qui attend une action de ta part : les reviews à faire, les réponses qu'on attend de toi, tes PR, ton sprint. Chaque élément a un score de priorité expliqué, les fils Slack qui le citent, un résumé IA et les actions pour le traiter sans quitter l'app.

Tout tourne sur ton Mac : l'app utilise ton `gh`, ton agent de code (Claude Code ou Codex) et une base locale.

> Les captures viennent du [mode démo](#mode-démo) : personnes et repos fictifs, rien n'est lu ni envoyé à GitHub, à Slack ou à une IA.

## Fonctionnalités

### Inbox

- **À reviewer** : PR ouvertes où ta review est encore demandée (directement ou via ton équipe).
- **On t'attend** : mentions et fils de review où quelqu'un a répondu après toi.
- **Mes PR** : tes PR ouvertes, avec CI et décision de review, ou toutes les PR ouvertes des repos suivis.
- **Mes issues**, **Le reste**, **En pause** et **Traités**.
- **Priorité expliquée** : chaque élément a un score sur 100 (ancienneté, dernier reviewer manquant, taille, CI, labels urgents, urgence estimée par Jev) ; survole-le pour voir le détail.
- **Classement et KPI Jev** : Jev (le modèle de décision de TypeSafe) classe les listes et donne à chaque PR des cartes KPI (risque en prod, effort de review, prête à merger, tests, changement cassant, clarté, expertise requise) ; les issues ont les leurs (taille, impact, bloquée, décision attendue…). Sans clé, seules les règles déterministes classent.
- **Re-reviews** : quand des commits arrivent après ta review, la PR est signalée et le diff peut se limiter à ces commits ; si tu avais demandé des changements, elle revient dans « À reviewer ».
- **Classement automatique** : les PR mergées ou fermées, les bots, l'activité CI, les releases et les auteurs de ton choix vont dans « Traités », sans jamais toucher à ce qui t'attend.
- **Clavier d'abord** et actions par lot (voir [Raccourcis](#raccourcis)).
- **Compteur de pings** sur le logo de la barre latérale, dans le titre de l'onglet (`(5) Zéro Ping`), sur le favicon et sur l'icône du Dock ; notifications du navigateur pour les reviews demandées, les réponses attendues, les changements demandés et la CI en échec sur tes PR.

### Panneau de PR

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/diff-dark.webp" />
  <img src="docs/screenshots/diff-light.webp" alt="Les fichiers modifiés d'une PR : arborescence, cases « Vu » et diff" />
</picture>

- **En-tête** : branches, checks (`14/14`), statut et priorité du projet GitHub (modifiables), issue liée, état sur la branche `uat`.
- **Conversation** GitHub, Slack ou les deux, **fichiers modifiés** avec l'arborescence et les cases « Vu » synchronisées avec GitHub, **issue liée** dans son onglet.
- **Agir depuis l'app** : répondre (commentaire ou fil de review, avec `@mentions`), approuver ou demander des changements, choisir les reviewers, lancer une review IA (`@codex review`, `@claude review`, `/gemini review`, réglables), merger (méthode au choix, suppression de la branche), lire les jobs en échec et leur log, relancer les jobs GitHub Actions ratés, marquer comme traité (synchronisé avec GitHub) ou mettre en pause.

### Résumés et questions à l'IA

- **Résumer avec l'IA** produit un résumé **court** (une phrase, par défaut), **standard** ou **détaillé** : l'essentiel, où on en est, ce qu'on attend de toi, les questions ouvertes et les points de vigilance. Chaque longueur est enregistrée ; un badge « Pas à jour » signale une activité GitHub plus récente, et **Régénérer** le refait.
- **Demander à l'IA** : l'IA reçoit la conversation, les fils Slack, les KPI Jev, le statut et la priorité du projet et, pour une PR, son état sur uat et son diff.
- **Recherche IA** en langage naturel dans les listes de PR et d'issues.
- **IA principale au choix** : Claude Code (`claude -p`) ou Codex (`codex exec`), sans outils, dans un dossier temporaire vide, avec un **modèle rapide** (Slack) et un **modèle de lecture** (résumés, questions, recherche ; Sonnet par défaut pour Claude).

### Slack

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/slack-dark.webp" />
  <img src="docs/screenshots/slack-light.webp" alt="Fils Slack trouvés pour une PR, avec les boutons de réponse" />
</picture>

- **Fils par PR et par issue** : l'app cherche dans Slack les messages qui citent l'élément (lien, référence `repo#123` ou sujet) et affiche les fils complets, avec un badge `#` dans la liste et des marques de lecture.
- **Répondre dans l'app** : l'agent poste ta réponse telle quelle dans le fil, en ton nom (20 à 40 s). **Ouvrir le fil dans Slack** mène à la conversation.
- **Review avec message Slack** : après une approbation ou une demande de changements, l'app propose le message qui prévient l'auteur, dans le fil de la PR s'il existe, avec sa mention.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/review-dark.webp" />
  <img src="docs/screenshots/review-light.webp" alt="Confirmation d'une demande de changements, avec le message Slack qui prévient l'auteur" />
</picture>

### « Mes issues » et le board du sprint

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/sprint-dark.webp" />
  <img src="docs/screenshots/sprint-light.webp" alt="Le sprint de l'équipe, colonne par colonne, avec une issue ouverte" />
</picture>

Tes issues assignées, ton sprint et tout le sprint de l'équipe depuis un board GitHub Projects (v2) : regroupés par colonne, classés par Jev, avec l'avancement du sprint, le filtre des epics et le changement de statut depuis le panneau. Le projet se choisit depuis la page s'il y en a plusieurs.

### Équipe, vue d'ensemble et récap du jour

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/team-dark.webp" />
  <img src="docs/screenshots/team-light.webp" alt="Vue Équipe : les PR bloquées, ce qui coince et qui a la balle" />
</picture>

- **Équipe** : PR des repos suivis sans reviewer, avec changements en attente, CI rouge, conflits ou ouvertes depuis trop longtemps (hors les tiennes et les bots), avec ce qui coince, qui a la balle et « Prendre la review » en un clic.
- **Vue d'ensemble** : ta charge en minutes, tes prochaines actions, la météo de l'équipe, le flux sur 14 jours, le délai médian de review et ta série Zéro Ping.
- **Récap du jour** : chaque jour ouvré à l'heure choisie (9 h 05 par défaut), une notification résume ce qui t'attend, et ton standup comme celui de l'équipe (`/standup`, `/standup:team`) sont préparés en brouillon, prêts à publier dans le fil du rappel du jour sur Slack. « Ma semaine » liste ce que tu as livré, commencé, reviewé et fermé.
- **Ne pas déranger** : pendant une heure, jusqu'à demain, ou chaque soir avec les heures calmes.

<table>
  <tr>
    <td><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dashboard-dark.webp" /><img src="docs/screenshots/dashboard-light.webp" alt="Vue d'ensemble : charge, prochaines actions et météo de l'équipe" /></picture></td>
    <td><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/recap-dark.webp" /><img src="docs/screenshots/recap-light.webp" alt="Récap du jour avec le standup d'équipe préparé par l'agent" /></picture></td>
  </tr>
</table>

## Prérequis

| | |
| --- | --- |
| **Node.js** 22+ et **pnpm** | installer et lancer l'app |
| **GitHub CLI** (`gh`) connecté | le jeton vient de `gh auth token` (ou `GITHUB_TOKEN`) |
| **Claude Code** avec le **connecteur Slack** de claude.ai, ou **Codex** avec un **serveur MCP Slack** | toutes les fonctions IA et la recherche Slack ; facultatif, l'inbox, l'équipe et le board marchent sans |
| **Clé TypeSafe** (Jev), facultative | classement et KPI Jev ; sans elle, seules les règles déterministes classent |
| macOS, facultatif | pour l'app du Dock ; l'app web tourne partout où Node tourne |

## Démarrer

```sh
pnpm install
cp .env.example .env   # facultatif : TYPESAFE_AI_API_KEY pour Jev
pnpm dev               # http://localhost:3000
```

La première synchronisation récupère les 30 derniers jours de notifications. Ouvre ensuite **Réglages** pour choisir les repos suivis et ton IA principale.

En production : `pnpm build && pnpm start` (port 3000, ou `PORT`), ou l'[app macOS](#app-macos).

### Mode démo

```sh
pnpm demo              # http://localhost:3100
```

Lance l'app sur des données fictives (l'équipe Acme, `acme/api`, `acme/web`, `acme/infra`, Jane Doe et ses collègues) dans son propre dossier, `.data/demo`. Rien n'est lu ni envoyé à GitHub, à Slack, à Jev ou à une IA : ces appels échouent avec « Mode démo » et la démo répond avec ses fixtures. Les actions locales (traité, pause, lu, réglages) fonctionnent. Les données sont recréées à chaque démarrage, datées de ce moment.

## Réglages

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/settings-dark.webp" />
  <img src="docs/screenshots/settings-light.webp" alt="Réglages, section « Agent IA » : IA principale et ses modèles" />
</picture>

La page **Réglages** (barre latérale) regroupe :

- **Repos** : repos suivis, ajout d'un repo, filtre.
- **Classement** : règles de classement automatique, auteurs à classer, seuil d'ancienneté de la vue Équipe.
- **Récap** : récap du jour et son heure, standups (canal Slack, texte du rappel, commandes).
- **Slack** : recherche automatique en arrière-plan, canaux exclus (leurs fils sont masqués tout de suite et l'agent ne les fouille plus), message Slack après une review et son canal.
- **Agent IA** : l'IA principale (Claude Code ou Codex), son modèle rapide et son modèle de lecture, la longueur par défaut des résumés, l'état de Jev et du compte GitHub. Changer d'IA remet les deux modèles sur leurs valeurs par défaut.
- **Notifications** : autorisation du navigateur, types de notifications, test, intervalle de synchronisation, ne pas déranger et heures calmes.

Ces réglages sont enregistrés dans la base locale et priment sur `.env` (`AGENT_CLI`, `AGENT_MODEL`). Les clés et jetons restent dans `.env` :

| Variable | Effet |
| --- | --- |
| `GITHUB_TOKEN` | Jeton GitHub ; par défaut celui de `gh` |
| `TYPESAFE_AI_API_KEY` | Active Jev |
| `AI_DECISION_MODEL` | `typesafe:<modèle>` (défaut `typesafe:jev-latest`) ou `anthropic:<modèle>` avec `ANTHROPIC_API_KEY` |
| `AGENT_CLI` | IA principale : `claude` (défaut) ou `codex` |
| `AGENT_MODEL` | Modèle rapide de l'IA principale (défaut `haiku` pour Claude, celui de ta config pour Codex) |
| `AGENT_COMMAND` | Chemin de l'exécutable s'il n'est pas dans le `PATH` |
| `SLACK_AGENT_TOOLS` | Outils Slack autorisés pour Claude Code, si tu utilises un autre serveur MCP |
| `SLACK_AGENT_SEND_TOOL` | Outil d'envoi Slack pour Claude Code, si tu utilises un autre serveur MCP |
| `SLACK_SEARCH` | `off` pour désactiver la recherche Slack |
| `DATA_DIR` | Dossier de données PGlite (défaut `.data/pglite`) |

### Accès Slack

La recherche passe par un agent en ligne de commande qui utilise **ton** accès Slack, en lecture seule :

- **Claude Code** (par défaut) : utilise le connecteur Slack de ton compte claude.ai. Rien à configurer si `claude` est connecté et que le connecteur Slack est activé.
- **Codex** : `AGENT_CLI=codex` dans `.env`, ou **Réglages > Agent IA**. Codex a besoin de son propre serveur MCP Slack : `codex mcp add slack --url <URL du serveur MCP Slack>` puis `codex mcp login slack`. Pour les standups, Codex suit le texte des commandes `~/.claude/commands/standup.md` et `standup/team.md` dans un sandbox accessible en écriture, avec réseau (gh, Slack).

Chaque recherche prend 30 s à 1 min et coûte environ 0,02 $ avec Haiku. Les résultats sont gardés 6 h ; trois PR au plus sont recherchées par synchronisation, une à la fois. Le bouton ↻ de la section Slack relance une recherche. L'alternative sans agent (app Slack et jeton personnel, plus rapide et sans tokens) est décrite dans [docs/slack-app.md](docs/slack-app.md).

## Raccourcis

| Touche | Action |
| --- | --- |
| `j` / `k` | Élément suivant / précédent |
| `e` | Marquer comme traité (ou remettre dans l'inbox), ou toute la sélection |
| `x` | Sélectionner l'élément (ou `⇧` clic) |
| `o` | Ouvrir sur GitHub, sur le message concerné |
| `r` | Écrire une réponse |
| `⌘ Entrée` | Envoyer la réponse |
| `Échap` | Vider la sélection, sinon fermer le détail |
| `d` | Basculer entre la conversation et les fichiers modifiés d'une PR |
| `f` | Détail en plein écran |
| `[` | Replier ou déplier la barre latérale |

## App macOS

```sh
scripts/macos-app.sh   # crée ~/Applications/Zéro Ping.app (ou le dossier passé en argument)
```

L'app démarre le serveur sur le port 4747 s'il ne tourne pas (avec un build si les sources ont changé), puis ouvre http://inbox.localhost:4747. Un clic sur son icône dans le Dock ramène l'onglet Zéro Ping déjà ouvert au premier plan (Dia, Chrome, Arc, Brave, Edge ou Safari ; macOS demande une fois l'autorisation de piloter le navigateur) et n'en ouvre un nouveau que s'il n'y en a pas. Sa pastille affiche le nombre d'éléments qui t'attendent. La quitter (⌘Q ou clic droit > Quitter) arrête le serveur. Pour la garder dans le Dock : clic droit sur l'icône > Options > Garder dans le Dock. Relance le script si tu déplaces le repo : il fige le chemin du repo et ton `PATH` (pnpm, gh, claude).

Depuis le terminal, `scripts/server.sh start|stop|status` fait la même chose.

## Confidentialité

- **Tout tourne en local.** Le serveur de production écoute sur `127.0.0.1` ; les données (éléments, résumés, fils Slack, réglages) restent dans une base PGlite sous `.data/`, ignorée par git.
- **Aucun serveur tiers.** Zéro Ping parle à GitHub avec ton jeton, à Jev seulement quand le contenu d'un sujet change (son empreinte est stockée), et à Slack et à l'IA uniquement via l'agent installé sur ta machine, avec tes comptes.
- **Lecture seule par défaut.** L'agent Slack n'a que les outils de recherche et de lecture ; il n'écrit (réponse, message de review, standup) que quand tu cliques.

## Fonctionnement

- Le serveur interroge `/notifications` à l'intervalle demandé par GitHub (`X-Poll-Interval`, 60 s) avec `If-Modified-Since` : les réponses 304 ne consomment pas de quota. Une recherche `review-requested:@me` complète toutes les 5 minutes.
- Les sujets modifiés sont enrichis via GraphQL (une passe légère pour l'état, puis le détail des sujets ouverts), puis notés.
- Jev n'est appelé que lorsque le contenu d'un sujet change.
- L'interface relit la base locale toutes les quelques secondes ; le panneau de PR est en stale-while-revalidate.

**Stack** : TanStack Start, Router et Query, React 19, shadcn/ui (Base UI), Tailwind CSS v4, PGlite + Drizzle ORM 1.0, AI SDK (`experimental_decide` avec Jev), Octokit.

## Développement

```sh
pnpm dev               # serveur de dev, port 3000
pnpm demo              # serveur de dev sur données fictives, port 3100
pnpm test              # Vitest
pnpm typecheck
pnpm lint
pnpm format            # Prettier
pnpm db:generate       # nouvelle migration après un changement de schéma
pnpm screenshots       # régénère docs/screenshots
```

Les migrations sont appliquées au démarrage. Comme PGlite n'accepte qu'un processus par dossier de données, arrête l'app avant d'utiliser `drizzle-kit` sur `.data/pglite`.

### Captures d'écran

`pnpm screenshots` lance son propre serveur démo sur le port 3999 (`SCREENSHOTS_PORT`) avec un dossier de données jetable, capture chaque page en clair et en sombre en 2× avec [agent-browser](https://github.com/vercel-labs/agent-browser), puis écrit des WebP dans `docs/screenshots/` (avec `cwebp`, ou Python et Pillow). Passe des noms pour n'en refaire que certaines : `pnpm screenshots inbox team`. Les captures sont définies à la fin de [`scripts/screenshots.sh`](scripts/screenshots.sh) ; les données de démo sont dans [`src/server/demo/fixtures.ts`](src/server/demo/fixtures.ts).

La structure du projet est décrite dans le [README anglais](README.md#project-structure).

## FAQ

**Ça marche sans Claude Code ni Codex ?**
Oui : l'inbox, les priorités, la vue Équipe, le board et toutes les actions GitHub ne demandent que `gh`. Les résumés, les questions, la recherche IA, les fils Slack et les standups demandent un agent.

**Et sans Jev ?**
Oui : sans `TYPESAFE_AI_API_KEY`, le score n'utilise que les règles déterministes et les cartes KPI sont masquées.

**Mes notifications GitHub sont-elles touchées ?**
Ouvrir un élément marque sa notification comme lue, et « Marquer comme traité » la marque comme traitée sur GitHub : github.com reste synchronisé.

**Je peux essayer sans rien connecter ?**
Oui : `pnpm demo`.
