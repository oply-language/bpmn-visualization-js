/**
 * Copyright 2022 Bonitasoft S.A.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mxgraph } from './mxgraph/initializer';

// WARN: this constant is automatically updated at release time by the 'manage-version-in-files.mjs' script.
// So, if you modify the name of this file or this constant, please update the script accordingly.
const libVersion = '0.29.0-post';

/**
 * @internal
 */
export const version = (): Version => {
  return { lib: libVersion, dependencies: new Map([['mxGraph', mxgraph.mxClient.VERSION]]) };
};

/**
 * Version of `bpmn-visualization` and its dependencies.
 * @category Initialization & Configuration
 */
export interface Version {
  /** The `bpmn-visualization` version. */
  lib: string;
  /** The version of the `bpmn-visualization` dependencies. This may **not** list all dependencies. */
  dependencies: Map<string, string>;
}
