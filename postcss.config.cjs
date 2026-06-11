const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')
const postcssImport = require('postcss-import')

module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  }
}