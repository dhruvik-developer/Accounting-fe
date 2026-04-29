import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography } from '@mui/material';

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            VyaparPro
          </Typography>
          <Outlet />
        </Paper>
      </Container>
    </Box>
  );
}
