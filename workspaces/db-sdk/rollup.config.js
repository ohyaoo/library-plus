/* global process */
import { promises as fsp } from "fs";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import simpleTS from "./lib/simple-ts";
import { terser } from "rollup-plugin-terser";
import del from "del";

export default async function ({ watch }) {
  await del("build");

  const builds = [];
  // Main
  builds.push({
    input: ["src/index.ts"],
    output: [
      {
        dir: "build/esm/",
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
      {
        dir: "build/cjs/",
        format: "cjs",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
    ],
    plugins: [simpleTS("test", { watch })],
  });

  // iife
  builds.push({
    input: "build/esm/index.js",
    plugins: [
      terser({
        compress: { ecma: 2019 },
      }),
    ],
    output: {
      file: "build/iife/index-min.js",
      format: "iife",
      esModule: false,
      name: "db",
    },
  });

  // Test
  if (!process.env.PRODUCTION) {
    builds.push({
      input: ["test/index.ts", "test/main.ts"],
      output: {
        dir: "build/test",
        format: "esm",
      },
      plugins: [
        simpleTS("test", { noBuild: true }),
        resolve(),
        commonjs(),
        {
          async generateBundle() {
            this.emitFile({
              type: "asset",
              source: await fsp.readFile("test/index.html"),
              fileName: "index.html",
            });
            this.emitFile({
              type: "asset",
              source: await fsp.readFile("lib/mocha/mocha.css"),
              fileName: "lib/mocha/mocha.css",
            });
          },
        },
      ],
    });
  }

  return builds;
}
