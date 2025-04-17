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
