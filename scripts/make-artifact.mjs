// Turns dist-single/index.html into dist-single/studypilot.html: the page
// content without <!doctype>/<html>/<head>/<body>, which is the shape the
// claude.ai Artifact publisher expects (it adds its own document skeleton).
import fs from 'node:fs'

const html = fs.readFileSync('dist-single/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1]
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1]

const grab = (re) => [...head.matchAll(re)].map((m) => m[0])
const title = grab(/<title>[\s\S]*?<\/title>/gi)
const metas = grab(/<meta name="description"[^>]*>/gi)
const fonts = grab(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi)
const styles = grab(/<style[^>]*>[\s\S]*?<\/style>/gi)
const scripts = grab(/<script[^>]*>[\s\S]*?<\/script>/gi)

const out = [...title, ...metas, ...fonts, ...styles, body.replace(/<script[\s\S]*?<\/script>/gi, '').trim(), ...scripts].join('\n')
fs.writeFileSync('dist-single/studypilot.html', out)
console.log(`dist-single/studypilot.html  ${(out.length / 1024 / 1024).toFixed(2)} MB`)
