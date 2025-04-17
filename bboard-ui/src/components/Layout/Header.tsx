import React from 'react';
import { AppBar, Box } from '@mui/material';

/**
 * A simple application level header for the bulletin board application.
 */
export const Header: React.FC = () => (
  <AppBar
    position="static"
    data-testid="header"
    sx={{
      backgroundColor: '#000',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        px: 10,
        py: 2.2,
        alignItems: 'center',
      }}
      data-testid="header-logo"
    >
      <img src="/midnight-logo.png" alt="logo-image" height={66} />
    </Box>
  </AppBar>
);
