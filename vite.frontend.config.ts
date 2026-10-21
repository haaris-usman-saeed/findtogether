import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Independent of the Cloudflare/Vinext build used by the existing backend.
export default defineConfig({plugins:[react()],build:{outDir:'dist-frontend'}});
