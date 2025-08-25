export const ERROR_CODES = {
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  ORG_LIMIT_EXCEEDED: 'ORG_LIMIT_EXCEEDED',
  TEAM_LIMIT_EXCEEDED: 'TEAM_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export function isUpgradeRequiredError(error: any): boolean {
  return error?.code === ERROR_CODES.UPGRADE_REQUIRED ||
         error?.errorCode === ERROR_CODES.UPGRADE_REQUIRED ||
         error?.message === ERROR_CODES.UPGRADE_REQUIRED;
}