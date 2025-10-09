/*
 * Copyright 2025 Astrix Security
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from "@aws-sdk/client-secrets-manager";
import { VaultPlugin } from "../types";

export interface AWSVaultConfig {
  profile?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export class AWSVaultPlugin implements VaultPlugin {
  readonly name = "aws";
  readonly version = "1.0.0";
  readonly description = "AWS Secrets Manager vault implementation";
  readonly requiredParams: string[] = [];
  readonly optionalParams: string[] = [
    "profile",
    "region",
    "accessKeyId",
    "secretAccessKey",
    "sessionToken",
  ];

  private client?: SecretsManagerClient;
  private config?: AWSVaultConfig;

  async initialize(config: AWSVaultConfig): Promise<void> {
    this.config = config;

    const clientConfig: Record<string, unknown> = {};

    if (config.profile) {
      clientConfig.profile = config.profile;
    }

    if (config.region) {
      clientConfig.region = config.region;
    }

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...(config.sessionToken && { sessionToken: config.sessionToken }),
      };
    }

    this.client = new SecretsManagerClient(clientConfig);
  }

  async getSecret(secretId: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        "AWS vault plugin not initialized. Call initialize() first."
      );
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretId,
      });

      const response: GetSecretValueCommandOutput =
        await this.client.send(command);

      if (response.SecretString) {
        return response.SecretString;
      } else if (response.SecretBinary) {
        const buff = Buffer.from(response.SecretBinary).toString("utf-8");
        return buff;
      }

      throw new Error("Secret value is empty");
    } catch (error: unknown) {
      console.error(`Error retrieving secret ${secretId}:`, error);
      throw error;
    }
  }

  validateConfig(_config: Record<string, unknown>): boolean {
    // AWS Secrets Manager doesn't require any specific parameters
    // All parameters are optional
    return true;
  }

  getConfig(): AWSVaultConfig | undefined {
    return this.config;
  }
}
