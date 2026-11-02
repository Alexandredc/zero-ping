import { afterEach, describe, expect, it, vi } from "vitest"
import { slackSendToasts } from "./slack-send"
import type { SlackSendCopy, Toasts } from "./slack-send"

type ToastOptions = Parameters<Toasts["add"]>[0]

const copy: SlackSendCopy = {
  sending: "Envoi du message Slack…",
  sent: "Message posté sur Slack",
  failed: "Message Slack non envoyé",
  openInSlack: "Ouvrir dans Slack",
  retry: "Réessayer",
  unknownError: "Erreur inconnue",
}

function fakeToasts() {
  let next = 0
  return {
    add: vi.fn((_options: ToastOptions) => `toast-${++next}`),
    close: vi.fn((_id?: string) => undefined),
  }
}

type ActionProps = { children: string; onClick: () => void }
const actionOf = (toasts: ReturnType<typeof fakeToasts>, call: number) =>
  toasts.add.mock.calls[call][0].actionProps as ActionProps | undefined

afterEach(() => vi.unstubAllGlobals())

describe("slackSendToasts", () => {
  it("shows a loading toast that never times out while the agent sends", () => {
    const toasts = fakeToasts()
    expect(slackSendToasts(toasts, copy).started()).toBe("toast-1")
    expect(toasts.add).toHaveBeenCalledWith({
      title: "Envoi du message Slack…",
      type: "loading",
      timeout: 0,
    })
  })

  it("shows no loading toast when the page shows the sending itself", () => {
    const toasts = fakeToasts()
    const pending = slackSendToasts(toasts, {
      ...copy,
      sending: undefined,
    }).started()
    expect(pending).toBeUndefined()
    expect(toasts.add).not.toHaveBeenCalled()
  })

  it("replaces the loading toast with a link to the posted message", () => {
    const open = vi.fn()
    vi.stubGlobal("window", { open })
    const toasts = fakeToasts()
    const feedback = slackSendToasts(toasts, copy)
    feedback.sent(
      "https://acme.slack.com/archives/C1/p1791445131867549",
      "toast-1"
    )

    expect(toasts.close).toHaveBeenCalledWith("toast-1")
    expect(toasts.add.mock.calls[0][0]).toMatchObject({
      title: "Message posté sur Slack",
      type: "success",
    })
    const action = actionOf(toasts, 0)
    expect(action?.children).toBe("Ouvrir dans Slack")
    action?.onClick()
    expect(open).toHaveBeenCalledWith(
      "https://acme.slack.com/archives/C1/p1791445131867549",
      "_blank",
      "noopener,noreferrer"
    )
  })

  it("offers no link when the agent returned none", () => {
    const toasts = fakeToasts()
    slackSendToasts(toasts, copy).sent(null)
    expect(toasts.close).not.toHaveBeenCalled()
    expect(actionOf(toasts, 0)).toBeUndefined()
  })

  it("keeps a failure on screen and sends the same message again on retry", () => {
    const toasts = fakeToasts()
    const retry = vi.fn()
    slackSendToasts(toasts, copy).failed(
      new Error("Slack n'a pas confirmé l'envoi"),
      retry,
      "loading"
    )

    expect(toasts.close).toHaveBeenCalledWith("loading")
    expect(toasts.add.mock.calls[0][0]).toMatchObject({
      title: "Message Slack non envoyé",
      description: "Slack n'a pas confirmé l'envoi",
      type: "error",
      timeout: 0,
    })
    const action = actionOf(toasts, 0)
    expect(action?.children).toBe("Réessayer")
    expect(retry).not.toHaveBeenCalled()

    action?.onClick()
    expect(toasts.close).toHaveBeenLastCalledWith("toast-1")
    expect(retry).toHaveBeenCalledOnce()
  })

  it("words an error without a message", () => {
    const toasts = fakeToasts()
    slackSendToasts(toasts, copy).failed("boom", vi.fn())
    expect(toasts.add.mock.calls[0][0].description).toBe("Erreur inconnue")
  })
})
