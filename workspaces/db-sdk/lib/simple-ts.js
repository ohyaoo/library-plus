/* global process */
import { spawn } from "child_process";
import { relative, join, parse } from "path";
import { promises as fsp } from "fs";
import { promisify } from "util";

import * as ts from "typescript";
import glob from "glob";

const globP = promisify(glob);

const extRe = /\.tsx?$/;

function loadConfig(mainPath) {
  const fileName = ts.findConfigFile(mainPath, ts.sys.fileExists);
  if (!fileName) throw Error("tsconfig not found");
  const text = ts.sys.readFile(fileName);
  const loadedConfig = ts.parseConfigFileTextToJson(fileName, text).config;
  const parsedTsConfig = ts.parseJsonConfigFileContent(
    loadedConfig,
    ts.sys,
    process.cwd(),
    undefined,
    fileName
  );
  return parsedTsConfig;
}

export default function simpleTS(mainPath, { noBuild, watch } = {}) {
  const config = loadConfig(mainPath);
  const args = ["-b", "-f", mainPath];

  let done = Promise.resolve();

  if (!noBuild) {
    done = new Promise((resolve) => {
      const proc = spawn("tsc", args, {
        stdio: "inherit",
      });

      proc.on("exit", (code) => {
        if (code !== 0) {
          throw Error("TypeScript build failed");
        }
        resolve();
      });
    });
  }

  if (!noBuild && watch) {
    done.then(() => {
      spawn("tsc", [...args, "--watch", "--preserveWatchOutput"], {
        stdio: "inherit",
      });
    });
  }

  return {
    name: "simple-ts",
    async buildStart() {
      await done;
      const matches = await globP(config.options.outDir + "/**/*.js");
      for (const match of matches) this.addWatchFile(match);
    },
    resolveId(id, importer) {
      if (!importer) return null;

      const tsResolve = ts.resolveModuleName(
        id,
        importer,
        config.options,
        ts.sys
      );

      if (
        !tsResolve.resolvedModule ||
        tsResolve.resolvedModule.extension === ".d.ts"
      ) {
        return null;
      }
      return tsResolve.resolvedModule.resolvedFileName;
    },
    async load(id) {
      if (!extRe.test(id)) return null;

      const basePath = join(
        config.options.outDir,
        relative(process.cwd(), id)
      ).replace(extRe, "");

      const srcP = fsp.readFile(basePath + ".js", { encoding: "utf8" });

      const assetExtensions = [".d.ts", ".js.map", ".d.ts.map"];

      await Promise.all(
        assetExtensions.map(async (extension) => {
          const fileName = basePath + extension;
          const source = await fsp.readFile(fileName);
          this.emitFile({
            type: "asset",
            source,
            fileName: parse(fileName).base,
          });
        })
      );

      return srcP;
    },
  };
}
