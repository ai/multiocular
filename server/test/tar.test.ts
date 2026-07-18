import { equal, match, rejects } from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import type {
  DependencyName,
  DependencyVersion,
  FilePath
} from '../../common/types.ts'
import { deleteTemporary, getNpmContent } from '../loader/npm.ts'

const EXECUTABLE_MODE = 0o755

let shimDir: string | undefined
let originalPath = process.env.PATH

afterEach(async () => {
  process.env.PATH = originalPath
  deleteTemporary()

  if (shimDir) {
    await rm(shimDir, { force: true, recursive: true })
    shimDir = undefined
  }
})

async function forbidAbsolutePathsInTar(): Promise<void> {
  let real = execSync('command -v tar').toString().trim()
  shimDir = await mkdtemp(join(tmpdir(), 'multiocular-shim-'))
  let shim = join(shimDir, 'tar')

  await writeFile(
    shim,
    `#!/bin/sh
    for arg in "$@"; do
      case "$arg" in
        /*)
          echo "tar: absolute path $arg is not portable" >&2
          exit 128
          ;;
      esac
    done
    exec "${real}" "$@"
    `
  )

  await chmod(shim, EXECUTABLE_MODE)
  process.env.PATH = `${shimDir}:${originalPath}`
}

async function makeTarFail(): Promise<string> {
  shimDir = await mkdtemp(join(tmpdir(), 'multiocular-shim-'))
  let shim = join(shimDir, 'tar')
  let cwdFile = join(shimDir, 'cwd')

  await writeFile(
    shim,
    `#!/bin/sh
    pwd > "${cwdFile}"
    echo "tar: simulating tar extraction failure" >&2
    exit 1
    `
  )

  await chmod(shim, EXECUTABLE_MODE)
  process.env.PATH = `${shimDir}:${originalPath}`

  return cwdFile
}

test(
  'extracts tarballs without absolute paths in tar arguments',
  { skip: process.platform === 'win32' },
  async () => {
    await forbidAbsolutePathsInTar()

    let dir = await getNpmContent(
      '.' as FilePath,
      'nanoid' as DependencyName,
      '5.1.5' as DependencyVersion
    )

    match(await readFile(join(dir, 'package.json'), 'utf8'), /"name": "nanoid"/)
    equal(existsSync(join(dir, 'package.tgz')), false)
  }
)

test(
  'removes temporary directory when tar extraction fails',
  { skip: process.platform === 'win32' },
  async () => {
    let cwdFile = await makeTarFail()

    await rejects(
      getNpmContent(
        '.' as FilePath,
        'nanoid' as DependencyName,
        '5.1.5' as DependencyVersion
      )
    )

    let tempDir = (await readFile(cwdFile, 'utf8')).trim()
    equal(existsSync(tempDir), false)
  }
)
