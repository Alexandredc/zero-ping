# Zéro Ping

<img src="public/logo.svg" alt="" width="64" />

Boîte de réception locale pour lead dev : elle remplace les emails de notification GitHub par une liste triée de ce qui attend une action de ta part.

- **À reviewer** : PR ouvertes où ta review est encore demandée (directement ou via ton équipe).
- **On t'attend** : mentions et fils de review où quelqu'un a répondu après toi.
- **Mes PR** : tes PR ouvertes, avec CI et décision de review.

Chaque élément a un score de priorité expliqué (ancienneté, dernier reviewer manquant, taille, CI, labels urgents, urgence estimée par Jev). Depuis l'app, tu peux lire la conversation (GitHub, Slack ou les deux) et le diff de la PR (onglet « Fichiers modifiés », avec l'arborescence des fichiers et les cases « Vu » synchronisées avec GitHub), lancer une review IA en un clic (`@codex review`, `@claude review`, `/gemini review`, réglables), répondre (commentaire ou fil de review), approuver ou demander des changements, marquer comme traité (synchronisé avec GitHub) ou mettre en pause.

## Démarrer

```sh
pnpm install
cp .env.example .env   # puis renseigne TYPESAFE_AI_API_KEY
pnpm dev               # http://localhost:3000
```

En production : `pnpm build && pnpm start` (port 3000, ou `PORT`).

L'authentification GitHub réutilise `gh auth token` (ou `GITHUB_TOKEN`). La première synchronisation récupère les 30 derniers jours de notifications.

## Résumés IA

En haut de chaque PR et issue, **Résumer avec Claude** produit un résumé en français, **court** (une phrase, par défaut), **standard** ou **détaillé** : chaque longueur s'enregistre à part et se choisit d'un clic sur la PR. Le résumé contient l'essentiel, où on en est, ce qu'on attend de toi, les questions ouvertes et les points de vigilance. Claude lit la conversation GitHub (description, commentaires, reviews, fils de review) et les fils Slack trouvés. Le résumé est enregistré en base et réaffiché sans régénération ; un badge « Pas à jour » signale une activité GitHub plus récente, et **Régénérer** le refait.

Les résumés passent toujours par Claude Code (`claude -p`, sans outils), quel que soit l'agent choisi pour Slack. Le modèle (Sonnet par défaut) se règle dans **Réglages > Agent IA**.

## Compteur de pings

Le nombre d'éléments qui t'attendent (dossiers « À reviewer » et « On t'attend », hors pause) s'affiche sur le logo de la barre latérale, dans le titre de l'onglet (`(5) Zéro Ping`) et en pastille sur le favicon. À zéro, tout disparaît.

## Notifications

Zéro Ping affiche une notification du navigateur quand un élément demande ton attention : review demandée, message qui attend ta réponse, changements demandés ou CI en échec sur ta PR. Clique dessus pour ouvrir l'élément. Il faut un onglet ouvert ; autorise les notifications depuis la barre latérale ou **Réglages > Notifications**, où tu choisis aussi les types. Rien n'est notifié pendant la première synchronisation, ni pour un élément traité ou en pause.

## Réglages

La page **Réglages** (barre latérale) regroupe :

- **Repos** : repos suivis, ajout d'un repo, filtre.
- **Slack** : recherche automatique en arrière-plan, canaux exclus (leurs fils sont masqués tout de suite et l'agent ne les fouille plus).
- **Agent IA** : agent (Claude Code ou Codex) et modèle pour Slack, longueur par défaut et modèle des résumés, état de Jev et du compte GitHub.
- **Notifications** : autorisation du navigateur, types de notifications, test.

Ces réglages sont enregistrés dans la base locale et priment sur `.env` (`AGENT_CLI`, `AGENT_MODEL`). Les clés et jetons restent dans `.env`.

## Discussions Slack

Pour chaque PR à traiter, l'app cherche dans Slack les messages qui la citent (lien, référence `repo#123`, ou sujet) et affiche les fils complets dans le panneau de détail, avec un badge `#` dans la liste.

La recherche passe par un agent en ligne de commande qui utilise **ton** accès Slack, en lecture seule :

- **Claude Code** (par défaut) : utilise le connecteur Slack de ton compte claude.ai. Rien à configurer si `claude` est connecté et que le connecteur Slack est activé.
- **Codex** : `AGENT_CLI=codex` dans `.env`. Codex a besoin de son propre serveur MCP Slack : `codex mcp add slack --url <URL du serveur MCP Slack>` puis `codex mcp login slack`. Si les outils ont d'autres noms que ceux de Claude, rien à changer : Codex n'utilise pas `SLACK_AGENT_TOOLS`.

Chaque fil Slack propose **Répondre dans l'app** : l'agent poste ta réponse telle quelle dans le fil, en ton nom (20 à 40 s), et elle s'ajoute aussitôt au fil affiché. **Ouvrir le fil dans Slack** mène directement à la conversation.

Chaque recherche prend 30 s à 1 min et coûte environ 0,02 $ avec Haiku (sur ton abonnement ou ton compte Claude). Les résultats sont gardés 6 h ; trois PR au plus sont recherchées par synchronisation, une à la fois. Le bouton ↻ de la section Slack relance une recherche.

| Variable | Effet |
| --- | --- |
| `AGENT_CLI` | `claude` (défaut) ou `codex` |
| `AGENT_MODEL` | Modèle de l'agent (défaut `haiku` pour Claude, celui de ta config pour Codex) |
| `AGENT_COMMAND` | Chemin de l'exécutable s'il n'est pas dans le `PATH` |
| `SLACK_AGENT_TOOLS` | Outils Slack autorisés pour Claude Code, si tu utilises un autre serveur MCP |
| `SLACK_AGENT_SEND_TOOL` | Outil d'envoi Slack pour Claude Code, si tu utilises un autre serveur MCP |
| `SLACK_SEARCH` | `off` pour désactiver la recherche Slack |

L'alternative sans agent (app Slack et jeton personnel, plus rapide et sans tokens) est décrite dans [docs/slack-app.md](docs/slack-app.md).

## Raccourcis

| Touche | Action |
| --- | --- |
| `j` / `k` | Élément suivant / précédent |
| `e` | Marquer comme traité (ou remettre dans l'inbox) |
| `o` | Ouvrir sur GitHub, sur le message concerné |
| `r` | Écrire une réponse |
| `⌘ Entrée` | Envoyer la réponse |
| `Échap` | Fermer le détail |
| `d` | Basculer entre la conversation et les fichiers modifiés d'une PR |
| `[` | Replier ou déplier la barre latérale |

## Fonctionnement

- Le serveur interroge `/notifications` à l'intervalle demandé par GitHub (`X-Poll-Interval`, 60 s) avec `If-Modified-Since` : les réponses 304 ne consomment pas de quota. Une recherche `review-requested:@me` complète toutes les 5 minutes.
- Les sujets modifiés sont enrichis via GraphQL (une passe légère pour l'état, puis le détail des sujets ouverts), puis notés.
- Jev n'est appelé que lorsque le contenu d'un sujet change (empreinte du contenu stockée).
- L'interface relit la base locale toutes les 4 secondes.

## Stack

TanStack Start, React 19, shadcn/ui (Base UI), Tailwind CSS v4, TanStack Query, PGlite + Drizzle ORM 1.0 RC, AI SDK (`experimental_decide` avec Jev), Octokit, Claude Code ou Codex en mode non interactif pour Slack.

## Scripts

```sh
pnpm test          # Vitest
pnpm typecheck
pnpm lint
pnpm db:generate   # nouvelle migration après un changement de schéma
```

Les migrations sont appliquées au démarrage. Comme PGlite n'accepte qu'un processus par dossier de données, arrête l'app avant d'utiliser `drizzle-kit` sur `.data/pglite`.
