import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { configureAmplify } from "./lib/amplify";
import "./assets/main.css";

configureAmplify();
createApp(App).use(router).mount("#app");
