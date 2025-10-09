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

import { VaultPlugin, VaultConfig, VaultRegistry } from "./types";

/**
 * Default implementation of VaultRegistry
 */
export class DefaultVaultRegistry implements VaultRegistry {
  private plugins: Map<string, VaultPlugin> = new Map();

  register(plugin: VaultPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): VaultPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  async createVault(config: VaultConfig): Promise<VaultPlugin> {
    const plugin = this.get(config.type);
    if (!plugin) {
      throw new Error(
        `Vault plugin '${config.type}' not found. Available plugins: ${this.list().join(", ")}`
      );
    }

    // Validate configuration
    if (!plugin.validateConfig(config.params)) {
      throw new Error(
        `Invalid configuration for vault plugin '${config.type}'`
      );
    }

    // Create a new instance (we'll need to modify plugins to support this)
    const vaultInstance = Object.create(Object.getPrototypeOf(plugin));
    Object.assign(vaultInstance, plugin);

    await vaultInstance.initialize(config.params);
    return vaultInstance;
  }
}

// Global registry instance
export const vaultRegistry = new DefaultVaultRegistry();
