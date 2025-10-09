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

// Export vault system
export * from "./vaults";

// Export CLI utilities
export { parseCliArgs, getSecrets, runMcpServer } from "./cli";
export { default as main } from "./cli";

// Legacy exports for backward compatibility
export { AWSVaultPlugin as AWSSecretManager } from "./vaults";
export type { AWSVaultConfig as SecretManagerOptions } from "./vaults";
