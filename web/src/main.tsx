import { render } from "preact";
import { App } from "./App";
import "./app.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app is missing from index.html");
render(<App />, root);
