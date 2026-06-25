'use strict';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cymgsrlhoymaclvnhsed.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWdzcmxob3ltYWNsdm5oc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MjIzODAsImV4cCI6MjA4NDI5ODM4MH0.OPXpO9-LGRjaG_xWMWY744jxTjb8pShYePOlHKQEvrw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);