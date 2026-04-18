import { createApp } from "vue";
import App from "./App.vue";
import { configureAmplify } from "./lib/amplify";
import "./assets/main.css";

configureAmplify();
createApp(App).mount("#app");
