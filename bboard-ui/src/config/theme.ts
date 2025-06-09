// This file is part of midnightntwrk/example-counter.
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

import { createTheme, alpha } from '@mui/material';

const midnightGrey = alpha('#a8a8a8', 0.7);

export const theme = createTheme({
  typography: {
    fontFamily: 'Helvetica',
    allVariants: {
      color: 'white',
    },
  },
  palette: {
    primary: {
      main: midnightGrey,
      light: alpha(midnightGrey, 0.5),
      dark: alpha(midnightGrey, 0.9),
    },
    secondary: {
      main: '#8c8c8c',
    },
    background: {
      default: '#464655',
    },
  },
});
