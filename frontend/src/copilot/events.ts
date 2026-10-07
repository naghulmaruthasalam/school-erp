/** Lets any page open the Copilot on a class/subject/chapter (and optionally a tool or a first message). */
export interface OpenCopilotDetail {
  classId?: string;
  subjectId?: string;
  chapter?: string;
  /** Tool key to open in the Tools tab (e.g. "explain", "homework_ideas"). Without it the Chat tab opens. */
  tool?: string;
  /** Text placed in the chat box for the user to review and send. */
  message?: string;
}

export const OPEN_COPILOT_EVENT = "copilot:open";

export function openCopilot(detail: OpenCopilotDetail): void {
  window.dispatchEvent(new CustomEvent<OpenCopilotDetail>(OPEN_COPILOT_EVENT, { detail }));
}
