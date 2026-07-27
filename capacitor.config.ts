import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lctarefas.app",
  appName: "LCTarefas",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#F2F2F7",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#F2F2F7",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
