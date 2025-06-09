// This file is part of EXAMPLE-BBOARD.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const jsResolver = (path, options) => {
  const jsExtRegex = /\.js$/i;
  const resolver = options.defaultResolver;
  if (jsExtRegex.test(path) && !options.basedir.includes('node_modules') && !path.includes('node_modules')) {
    const newPath = path.replace(jsExtRegex, '.ts');
    try {
      return resolver(newPath, options);
    } catch {
      // use default resolver
    }
  }

  return resolver(path, options);
};

module.exports = jsResolver;
