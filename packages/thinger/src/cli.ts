#!/usr/bin/env node
/* oxlint-disable no-console */
import { resolve } from 'node:path'
import { Command } from 'commander'
import { Thinger } from './thinger.js'
import { loadInputs, writeContent } from './thinger-io.js'

const program = new Command()

program.name('thinger').description('Convert DAT + OTB files into structured content JSON')

program
  .command('generate')
  .description('Generate content JSON from DAT and OTB inputs')
  .requiredOption('--dat <path>', 'Path to .dat file')
  .requiredOption('--otb <path>', 'Path to .otb file')
  .requiredOption('--version <number>', 'Client version (e.g. 772)', parseInt)
  .option('--out <dir>', 'Output directory', './output')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { dat: string; otb: string; version: number; out: string; pretty: boolean }) => {
    const loaded = loadInputs(resolve(opts.dat), resolve(opts.otb), opts.version)
    if (!loaded.ok) {
      console.error(`Error: ${loaded.error}`)
      process.exit(1)
    }

    const content = Thinger({ dat: loaded.dat, otb: loaded.otb }).build()

    const written = writeContent(content, resolve(opts.out), { pretty: opts.pretty })
    if (!written.ok) {
      console.error(`Error: ${written.error}`)
      process.exit(1)
    }

    const { counts } = content.meta
    console.log(`Written to ${written.path}`)
    console.log(`  items:     ${counts.items}`)
    console.log(`  creatures: ${counts.creatures}`)
    console.log(`  effects:   ${counts.effects}`)
    console.log(`  missiles:  ${counts.missiles}`)
  })

program.parse()
