import "mocha/mocha";
import { dbName } from "./constant";
import { deleteDB } from "src/index";
mocha.setup("tdd");

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(Error("Script load error"));
    document.body.appendChild(script);
  });
}

(async function () {
  await loadScript("./main.js");
  await deleteDB(dbName);
  mocha.run();
})();
