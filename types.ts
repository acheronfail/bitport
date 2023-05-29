export interface BitwardenItem {
  object: string;
  id: string;
  organizationId: string | null;
  folderId: string | null;
  type: number;
  reprompt: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  fields: BitwardenField[];
  login: BitwardenLogin;
  collectionIds: unknown[];
  attachments: BitwardenAttachment[];
  revisionDate: string; // ISO
  creationDate: string; // ISO
  deletedDate: string | null;
}

export interface BitwardenLogin {
  uris: {
    match: unknown | null;
    uri: string;
  }[];
  username: string | null;
  password: string | null;
  totp: string | null;
  passwordRevisionDate: string | null;
}

export interface BitwardenField {
  name: string;
  value: string;
  type: number;
  linkedId: string | null;
}

export interface BitwardenAttachment {
  id: string;
  fileName: string;
  size: string; // bytes as a string
  sizeName: string; // display name for bytes
  url: string;
}
