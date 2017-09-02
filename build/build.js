const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const pascalCase = require('pascal-case')
const rollup = require('rollup')
const sourcemaps = require('rollup-plugin-sourcemaps')
const babel = require('rollup-plugin-babel')
const minify = require('uglify-es').minify
const uglify = require('rollup-plugin-uglify')
const banner = require('./banner')
const pkg = require('../package.json')

const getDataSize = code => {
  return `${(code.length / 1024).toFixed(2)}kb`
}

const getRelativePath = p => path.relative(path.join(__dirname, '..'), p)

const writeFile = (dest, data) =>
  new Promise((resolve, reject) => {
    const finalDest = path.resolve(__dirname, dest)
    fs.writeFile(finalDest, data, err => {
      if (err) return reject(err)
      console.log(
        `${chalk.blue(getRelativePath(finalDest))} ${getDataSize(data)}`
      )
      resolve()
    })
  })

const writeCodeMap = async (dest, code, map) => {
  await Promise.all([
    writeFile(dest, code),
    writeFile(`${dest}.map`, JSON.stringify(map))
  ])
}

const rollupInputConfig = {
  input: path.resolve(__dirname, '../src/index.js'),
  plugins: [
    sourcemaps(),
    babel({
      exclude: 'node_modules/**',
      externalHelpersWhitelist: ['typeof']
    })
  ],
  external: Object.keys(pkg.dependencies || {})
}

const build = async () => {
  const bundle = await rollup.rollup(rollupInputConfig)

  /**
   * CommonJS build
   */
  {
    const { code, map } = await bundle.generate({
      format: 'cjs',
      sourcemap: true,
      sourcemapFile: `${pkg.name}.common.js`,
      banner
    })

    writeCodeMap(`../dist/${pkg.name}.common.js`, code, map)
  }

  /**
   * ES Module build
   */
  {
    const { code, map } = await bundle.generate({
      format: 'es',
      sourcemap: true,
      sourcemapFile: `${pkg.name}.esm.js`,
      banner
    })

    writeCodeMap(`../dist/${pkg.name}.esm.js`, code, map)
  }

  /**
   * UMD build
   */
  {
    const bannerRegex = new RegExp(`${pkg.name} v${pkg.version}`)
    rollupInputConfig.plugins.push(uglify({
      output: {
        // Preserve only the banner comment
        comments (node, { value: text, type }) {
          return (type === 'comment2') && bannerRegex.test(text)
        }
      }
    }, minify))

    const bundle = await rollup.rollup(rollupInputConfig)

    const { code, map } = await bundle.generate({
      format: 'umd',
      sourcemap: true,
      sourcemapFile: `${pkg.name}.umd.js`,
      name: pascalCase(pkg.name),
      banner
    })

    writeCodeMap(`../dist/${pkg.name}.umd.js`, code, map)
  }
}

build()
