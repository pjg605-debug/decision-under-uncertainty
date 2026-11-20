export function isNewApproval(action: string | undefined, status: string): boolean;
export function hasNoPreviousApproval(
  admin: (path: string, init?: RequestInit) => Promise<unknown>,
  caseId: string,
): Promise<boolean>;
export function notifyCaseApproval(input: {
  webhookUrl?: string;
  title?: string;
  caseKey: string;
}): Promise<void>;
