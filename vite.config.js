import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Sem isso, o Vite escuta só em [::1] (IPv6) nesta máquina — ferramentas que
    // resolvem "localhost" para 127.0.0.1 primeiro (ex.: Chromium headless) travam
    // esperando a conexão em vez de cair pro IPv6.
    host: "127.0.0.1",
  },
})
