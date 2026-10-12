# Slack : passer par une app Slack (option 1)

L'app cherche aujourd'hui les discussions Slack en lançant un agent (Claude Code ou Codex) qui utilise ton connecteur Slack. Cette page décrit l'alternative, **non implémentée** : interroger directement l'API Slack avec un jeton personnel. Elle est plus rapide (moins d'une seconde par recherche au lieu de 30 s à 1 min) et ne consomme pas de tokens.

## 1. Créer l'app

1. Ouvre <https://api.slack.com/apps> puis **Create New App** > **From a manifest**.
2. Choisis ton workspace et colle ce manifest :

```yaml
display_information:
  name: Zéro Ping
  description: Retrouve les discussions Slack liées aux PR GitHub (lecture seule)
oauth_config:
  scopes:
    user:
      - search:read
      - channels:history
      - groups:history
      - im:history
      - mpim:history
      - users:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

3. **Install to Workspace**. Selon la configuration du workspace, un administrateur peut devoir approuver l'installation.
4. Dans **OAuth & Permissions**, copie le **User OAuth Token** (`xoxp-…`). Il agit en ton nom, avec exactement tes accès, en lecture seule grâce aux scopes ci-dessus.
5. Ajoute-le dans `.env` : `SLACK_USER_TOKEN=xoxp-…`.

Seuls des scopes **utilisateur** sont nécessaires : `search.messages` n'existe pas pour les jetons de bot.

## 2. Ce qu'il faudrait implémenter

Un second `AgentRunner` n'est pas le bon endroit : il s'agit d'une autre source pour `requestLookup` dans `src/server/slack/lookups.ts`, qui produit le même `SlackDiscussion[]`.

1. `search.messages` avec `query` = `"<repo>/pull/<numéro>"`, puis `"<repo>#<numéro>"`, puis le titre entre guillemets (`match` = `link`, `reference`, `title`).
2. Pour chaque résultat, `conversations.replies` avec `channel` et `thread_ts` (ou `ts` pour un message sans fil) pour récupérer la conversation complète.
3. `users.info` (mis en cache) pour remplacer les identifiants par les noms.
4. `chat.getPermalink`, ou le champ `permalink` des résultats de recherche, pour le lien « Ouvrir dans Slack ».
5. Respecter les limites : `search.messages` est en Tier 2 (environ 20 appels par minute), donc garder le cache de 6 h et la file d'attente séquentielle.

Le choix de la source se ferait par variable d'environnement, par exemple `SLACK_SEARCH=token` à côté de `agent` et `off`.
