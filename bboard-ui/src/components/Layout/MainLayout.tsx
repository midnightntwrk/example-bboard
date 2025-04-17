import React from 'react';
import { Box } from '@mui/material';
import { Header } from './Header';

/**
 * Provides layout for the bulletin board application.
 */
export const MainLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', overflow: 'hidden' }}>
      <Header />
      <Box sx={{ px: 10, position: 'relative', height: '100%' }}>
        <img
          src="/logo-render.png"
          alt="logo-image"
          height={607}
          style={{ position: 'absolute', zIndex: 1, left: '2vw', top: '5vh' }}
        />
        <Box
          sx={{
            zIndex: 999,
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            gap: '5px',
            rowGap: '5px',
            alignItems: 'center',
            height: '100%',
            py: '10vh',
            px: '15vw',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
