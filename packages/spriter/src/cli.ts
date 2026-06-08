#!/usr/bin/env node
/* oxlint-disable no-console */
import { resolve } from "node:path";
import { Command } from "commander";
import { Spriter } from "./spriter.js";
import { loadSpr, writeSpritesheet } from "./spriter-io.js";

const program = new Command();

program.name("spriter").description("Pack .spr sprites into a PNG spritesheet and positions JSON");

program
  .command("generate")
  .description("Generate spritesheet from a .spr file")
  .requiredOption("--spr <path>", "Path to .spr file")
  .requiredOption("--version <number>", "Client version (e.g. 772)", parseInt)
  .option("--out <dir>", "Output directory", "./output")
  .option("--max-width <number>", "Max spritesheet width in pixels", parseInt, 4096)
  .option("--versioned", "Append version number to output filenames", false)
  .action(
    async (opts: {
      spr: string;
      version: number;
      out: string;
      maxWidth: number;
      versioned: boolean;
    }) => {
      const loaded = loadSpr(resolve(opts.spr), opts.version);
      if (!loaded.ok) {
        console.error(`Error: ${loaded.error}`);
        process.exit(1);
      }

      const output = await Spriter({ spr: loaded.spr, maxWidth: opts.maxWidth }).build();

      const written = writeSpritesheet(output, resolve(opts.out), { versioned: opts.versioned });
      if (!written.ok) {
        console.error(`Error: ${written.error}`);
        process.exit(1);
      }

      console.log(`spritesheet: ${written.png}`);
      console.log(`positions:   ${written.json}`);
      console.log(`sprites:     ${output.meta.sprites}`);
      console.log(`dimensions:  ${output.meta.width}x${output.meta.height}`);
    },
  );

program.parse();
