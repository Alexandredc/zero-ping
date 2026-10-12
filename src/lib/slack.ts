/**
 * Converts Slack mrkdwn to the GitHub-flavoured Markdown the app renders:
 * links, mentions and channels lose their angle-bracket syntax, and Slack's
 * single-character emphasis maps to its Markdown equivalent.
 */
export function slackToMarkdown(text: string): string {
  return text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "[$2]($1)")
    .replace(/<(https?:\/\/[^>]+)>/g, "<$1>")
    .replace(/<@[A-Z0-9]+\|([^>]+)>/g, "@$1")
    .replace(/<@([A-Z0-9]+)>/g, "@$1")
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#$1")
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1**$2**")
    .replace(/(^|[\s(])~([^~\n]+)~(?=[\s).,!?:;]|$)/g, "$1~~$2~~")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
}
