import { defineMessages } from "../core"

export const issues = defineMessages({
  fr: {
    tabHints: {
      assigned:
        "Tes issues ouvertes dans tous les repos, celles du sprint d'abord.",
      mine: "Tes tâches du sprint courant, colonne par colonne du board.",
      team: "Tout le sprint courant de l'équipe, colonne par colonne du board.",
    },
    tabs: {
      label: "Choisir la liste",
      assigned: "Assignées",
      mine: "Mon sprint",
      team: "Équipe",
    },
    noStatus: "Sans statut",
    urgency: ["Peut attendre", "Normale", "Importante", "Bloquante"],
    filters: {
      kind: "Type",
      kinds: {
        issue: "Issue",
        pull: "PR",
        draft: "Brouillon du board",
      },
      status: "Statut",
      jev: "Urgence Jev",
      repo: "Repo",
      label: "Label",
    },
    projectDraft: "Brouillon du projet",
    unassigned: "Non assignée",
    sprint: {
      day: "jour",
      left: (n: number) => (n > 1 ? `${n} restants` : `${n} restant`),
      dayOf: (day: number, total: number) => `Jour ${day} sur ${total}`,
    },
    groups: {
      aiSearch: "Trouvées par la recherche IA",
      inSprint: (sprint: string) => `Dans le ${sprint}`,
      assigned: "Assignées",
      offSprint: "Hors sprint",
    },
    people: {
      everyone: "Tout le monde",
      unassigned: "Non assignées",
      you: "Toi",
      tasksOf: "Tâches de…",
    },
    project: "Projet",
    sprintProject: "Projet du sprint",
    epics: "Epics",
    sprintUnavailable: "Sprint indisponible",
    empty: {
      title: "Rien ici",
      noProject:
        "Aucun projet GitHub de tes repos suivis n'a de champ itération (le token doit avoir le scope read:project).",
      noAssigned: "Aucune issue ouverte ne t'est assignée.",
      noTask: "Aucune tâche dans le sprint courant pour ce filtre.",
    },
    placeholder: {
      count: (n: number) =>
        n > 1 ? `${n} tickets dans la liste` : `${n} ticket dans la liste`,
      nothing: "Rien à ouvrir ici",
      pick: "Choisis-en un à gauche pour lire sa conversation et changer son statut, ou appuie sur ↓ pour commencer par le premier.",
      changeFilters:
        "Change d'onglet ou de filtres pour retrouver tes tickets.",
    },
    preview: {
      label: "Aperçu",
      close: "Fermer l'aperçu (Échap)",
      statusHint: "Change la colonne du ticket sur le board GitHub du projet.",
      moveTo: "Déplacer dans…",
      draftNoConversation:
        "Brouillon du board, sans conversation : ouvre le projet sur GitHub pour le détailler.",
      replyInThread: "Réponse dans le fil GitHub",
      replyToConversation: "Répondre à la conversation",
      commentOnConversation: "Commentaire sur la conversation GitHub",
      toWrite: "pour écrire,",
      enter: "Entrée",
      toSend: "pour envoyer",
      placeholder: "Écris ton commentaire en Markdown…",
      sendOnGitHub: "Envoyer sur GitHub",
    },
    errors: {
      projectNotFound: (project: string) => `Projet ${project} introuvable.`,
    },
  },
  en: {
    tabHints: {
      assigned: "Your open issues across all repos, the sprint's first.",
      mine: "Your tasks in the current sprint, column by column of the board.",
      team: "The team's whole current sprint, column by column of the board.",
    },
    tabs: {
      label: "Choose the list",
      assigned: "Assigned",
      mine: "My sprint",
      team: "Team",
    },
    noStatus: "No status",
    urgency: ["Can wait", "Normal", "Important", "Blocking"],
    filters: {
      kind: "Type",
      kinds: {
        issue: "Issue",
        pull: "PR",
        draft: "Board draft",
      },
      status: "Status",
      jev: "Jev urgency",
      repo: "Repo",
      label: "Label",
    },
    projectDraft: "Project draft",
    unassigned: "Unassigned",
    sprint: {
      day: "day",
      left: (n: number) => `${n} left`,
      dayOf: (day: number, total: number) => `Day ${day} of ${total}`,
    },
    groups: {
      aiSearch: "Found by the AI search",
      inSprint: (sprint: string) => `In ${sprint}`,
      assigned: "Assigned",
      offSprint: "Outside the sprint",
    },
    people: {
      everyone: "Everyone",
      unassigned: "Unassigned",
      you: "You",
      tasksOf: "Tasks of…",
    },
    project: "Project",
    sprintProject: "Sprint project",
    epics: "Epics",
    sprintUnavailable: "Sprint unavailable",
    empty: {
      title: "Nothing here",
      noProject:
        "No GitHub project of your tracked repos has an iteration field (the token needs the read:project scope).",
      noAssigned: "No open issue is assigned to you.",
      noTask: "No task in the current sprint for this filter.",
    },
    placeholder: {
      count: (n: number) =>
        n === 1 ? "1 ticket in the list" : `${n} tickets in the list`,
      nothing: "Nothing to open here",
      pick: "Pick one on the left to read its conversation and change its status, or press ↓ to start with the first.",
      changeFilters: "Switch tabs or filters to find your tickets.",
    },
    preview: {
      label: "Preview",
      close: "Close the preview (Esc)",
      statusHint:
        "Moves the ticket to another column of the project's GitHub board.",
      moveTo: "Move to…",
      draftNoConversation:
        "Board draft, no conversation: open the project on GitHub to flesh it out.",
      replyInThread: "Reply in the GitHub thread",
      replyToConversation: "Reply to the conversation",
      commentOnConversation: "Comment on the GitHub conversation",
      toWrite: "to write,",
      enter: "Enter",
      toSend: "to send",
      placeholder: "Write your comment in Markdown…",
      sendOnGitHub: "Send to GitHub",
    },
    errors: {
      projectNotFound: (project: string) => `Project ${project} not found.`,
    },
  },
})
