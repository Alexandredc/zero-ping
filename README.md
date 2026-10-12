# Triage GitHub

Boîte de réception locale pour lead dev : elle remplace les emails de notification GitHub par une liste triée de ce qui attend une action de ta part.

- **À reviewer** : PR ouvertes où ta review est encore demandée (directement ou via ton équipe).
- **On t'attend** : mentions et fils de review où quelqu'un a répondu après toi.
- **Mes PR** : tes PR ouvertes, avec CI et décision de review.

Chaque élément a un score de priorité expliqué (ancienneté, dernier reviewer manquant, taille, CI, labels urgents, urgence estimée par Jev). Depuis l'app, tu peux lire la conversation, répondre (commentaire ou fil de review), approuver ou demander des changements, marquer comme traité (synchronisé avec GitHub) ou mettre en pause.

## Démarrer

```sh
pnpm install
cp .env.example .env   # puis renseigne TYPESAFE_AI_API_KEY
pnpm dev               # http://localhost:3000
```

En production : `pnpm build && pnpm start` (port 3000, ou `PORT`).

L'authentification GitHub réutilise `gh auth token` (ou `GITHUB_TOKEN`). La première synchronisation récupère les 30 derniers jours de notifications.

## Raccourcis

| Touche | Action |
| --- | --- |
| `j` / `k` | Élément suivant / précédent |
| `e` | Marquer comme traité (ou remettre dans l'inbox) |
| `o` | Ouvrir sur GitHub, sur le message concerné |
| `r` | Écrire une réponse |
| `⌘ Entrée` | Envoyer la réponse |
| `Échap` | Fermer le détail |

## Fonctionnement

- Le serveur interroge `/notifications` à l'intervalle demandé par GitHub (`X-Poll-Interval`, 60 s) avec `If-Modified-Since` : les réponses 304 ne consomment pas de quota. Une recherche `review-requested:@me` complète toutes les 5 minutes.
- Les sujets modifiés sont enrichis via GraphQL (une passe légère pour l'état, puis le détail des sujets ouverts), puis notés.
- Jev n'est appelé que lorsque le contenu d'un sujet change (empreinte du contenu stockée).
- L'interface relit la base locale toutes les 4 secondes.

## Stack

TanStack Start, React 19, shadcn/ui (Base UI), Tailwind CSS v4, TanStack Query, PGlite + Drizzle ORM 1.0 RC, AI SDK (`experimental_decide` avec Jev), Octokit.

## Scripts

```sh
pnpm test          # Vitest
pnpm typecheck
pnpm lint
pnpm db:generate   # nouvelle migration après un changement de schéma
```

Les migrations sont appliquées au démarrage. Comme PGlite n'accepte qu'un processus par dossier de données, arrête l'app avant d'utiliser `drizzle-kit` sur `.data/pglite`.
