import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mybookshelf.app",
  appName: "MyBookshelf",
  webDir: "mobile/www",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0c0d0d",
  },
};

export default config;
