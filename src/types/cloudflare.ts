export interface CfErrorItem {
  code?: number;
  message?: string;
}

export interface CfResponse<T> {
  success?: boolean;
  result: T;
  errors?: CfErrorItem[];
}

export interface CfUser {
  id?: string;
  email?: string;
}

export interface CfAccount {
  id: string;
  name: string;
}

export type CfWorkerScript =
  | string
  | { id?: string; script?: string; name?: string };
