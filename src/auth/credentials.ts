export interface CredentialSource {
  get(key: string): string | undefined;
}

export class StaticCredentialSource implements CredentialSource {
  constructor(private readonly secrets: Record<string, string>) {}

  get(key: string): string | undefined {
    return this.secrets[key];
  }
}

export class EnvCredentialSource implements CredentialSource {
  constructor(private readonly prefix: string) {}

  get(key: string): string | undefined {
    return process.env[`${this.prefix}${key.toUpperCase()}`];
  }
}
