import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Business = { id: string; name: string; gstin: string; state: string; state_code: string } | null;

const slice = createSlice({
  name: 'business',
  initialState: { current: null as Business },
  reducers: {
    setBusiness: (s, a: PayloadAction<Business>) => {
      s.current = a.payload;
      if (a.payload) localStorage.setItem('business_id', a.payload.id);
    },
  },
});

export const { setBusiness } = slice.actions;
export default slice.reducer;
