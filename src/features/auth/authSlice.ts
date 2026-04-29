import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type User = { id: string; email: string; username: string } | null;

const slice = createSlice({
  name: 'auth',
  initialState: { user: null as User },
  reducers: {
    setUser: (s, a: PayloadAction<User>) => {
      s.user = a.payload;
    },
  },
});

export const { setUser } = slice.actions;
export default slice.reducer;
