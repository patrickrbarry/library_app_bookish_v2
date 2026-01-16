import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ouiczkqxcbqriiefixsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aWN6a3F4Y2JxcmlpZWZpeHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzY1OTgsImV4cCI6MjA4NDAxMjU5OH0.2YvZmVt1HPwtWc6z-oTeXn8pNb-PP5J6Des1yPl5vGE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

