#!/usr/bin/env node

/* oxlint-disable no-console */
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import { buildContent } from './backpack-content.js'
import { deflateNode, readDat, readOtb, readSpr, writeOutput, writePack } from './backpack-node.js'
import { buildPack } from './backpack-pack.js'
import { buildSpriteSheet, extractSprites } from './backpack-sprites.js'

const program = new Command()

program
  .name('backpack')
  .description('Build Asset Packs, item content and sprite atlases from OTServer client files')

/** Runs a command, turning any error into a message and exit code 1. */
const run =
  <T>(action: (options: T) => Promise<void> | void) =>
  async (options: T): Promise<void> => {
    try {
      await action(options)
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }

const parseIds = (value: string): number[] =>
  value.split(',').flatMap((part) => {
    const [from, to] = part.split('-').map(Number)
    if (to === undefined) return [from!]
    return Array.from({ length: to - from! + 1 }, (_, index) => from! + index)
  })

const megabytes = (bytes: number): string => `${(bytes / 2 ** 20).toFixed(1)} MB`

program
  .command('build')
  .description('Asset Pack: pack.json, items.json, render.json and page-N.png')
  .requiredOption('--dat <path>', '.dat file')
  .requiredOption('--spr <path>', '.spr file')
  .option('--otb <path>', 'items.otb file (without it, sid = cid)')
  .requiredOption('--version <number>', 'client version, e.g. 772', Number)
  .option('--out <dir>', 'output directory', './pack')
  .option('--max-page-size <px>', 'largest page side', Number, 4096)
  .action(
    run(
      async (options: {
        dat: string
        spr: string
        otb?: string
        version: number
        out: string
        maxPageSize: number
      }) => {
        const start = performance.now()
        const dat = readDat(resolve(options.dat), options.version)
        const spr = readSpr(resolve(options.spr), options.version)
        const otb = options.otb === undefined ? undefined : readOtb(resolve(options.otb))
        const pack = await buildPack({
          dat,
          spr,
          deflate: deflateNode,
          maxPageSize: options.maxPageSize,
          ...(otb === undefined ? {} : { otb })
        })
        const out = resolve(options.out)
        writePack(out, pack)
        const { counts } = pack.manifest
        const pageBytes = pack.pages.reduce((sum, png) => sum + png.length, 0)
        console.log(
          `${out}: ${counts.items} items, ${counts.appearances} appearances, ${counts.frames} frames, ` +
            `${pack.pages.length} pages (${megabytes(pageBytes)}) in ${((performance.now() - start) / 1000).toFixed(1)} s`
        )
      }
    )
  )

program
  .command('content')
  .description('Item content by sid (DAT + OTB) as content.json')
  .requiredOption('--dat <path>', '.dat file')
  .option('--otb <path>', 'items.otb file (without it, sid = cid)')
  .requiredOption('--version <number>', 'client version, e.g. 772', Number)
  .option('--out <dir>', 'output directory', './output')
  .action(
    run((options: { dat: string; otb?: string; version: number; out: string }) => {
      const dat = readDat(resolve(options.dat), options.version)
      const otb = options.otb === undefined ? undefined : readOtb(resolve(options.otb))
      const content = buildContent(otb === undefined ? { dat } : { dat, otb })
      const path = join(resolve(options.out), 'content.json')
      writeOutput(path, JSON.stringify(content))
      console.log(
        `${path}: ${content.items.sid.length} items, ${content.appearances.cid.length} appearances`
      )
    })
  )

program
  .command('sprites')
  .description('Sprite atlas of a .spr: PNG pages and sprites.json')
  .requiredOption('--spr <path>', '.spr file')
  .requiredOption('--version <number>', 'client version, e.g. 772', Number)
  .option('--out <dir>', 'output directory', './output')
  .option('--ids <list>', 'sprite ids, e.g. 1-100,250', parseIds)
  .option('--trim', 'pack only the opaque rectangle of each sprite', false)
  .option('--max-page-size <px>', 'largest page side', Number, 4096)
  .action(
    run(
      async (options: {
        spr: string
        version: number
        out: string
        ids?: number[]
        trim: boolean
        maxPageSize: number
      }) => {
        const spr = readSpr(resolve(options.spr), options.version)
        const sheet = await buildSpriteSheet(spr, {
          deflate: deflateNode,
          trim: options.trim,
          maxPageSize: options.maxPageSize,
          ...(options.ids === undefined ? {} : { ids: options.ids })
        })
        const out = resolve(options.out)
        sheet.pages.forEach((png, index) => writeOutput(join(out, `sprites-${index}.png`), png))
        writeOutput(join(out, 'sprites.json'), JSON.stringify(sheet.json))
        console.log(`${out}: ${sheet.json.meta.sprites} sprites in ${sheet.pages.length} pages`)
      }
    )
  )

program
  .command('extract')
  .description('One PNG per sprite')
  .requiredOption('--spr <path>', '.spr file')
  .requiredOption('--version <number>', 'client version, e.g. 772', Number)
  .requiredOption('--ids <list>', 'sprite ids, e.g. 1-100,250', parseIds)
  .option('--out <dir>', 'output directory', './output')
  .action(
    run(async (options: { spr: string; version: number; ids: number[]; out: string }) => {
      const spr = readSpr(resolve(options.spr), options.version)
      const out = resolve(options.out)
      let count = 0
      for await (const { id, png } of extractSprites(spr, options.ids, deflateNode)) {
        writeOutput(join(out, `${id}.png`), png)
        count++
      }
      console.log(`${out}: ${count} sprites`)
    })
  )

await program.parseAsync()
