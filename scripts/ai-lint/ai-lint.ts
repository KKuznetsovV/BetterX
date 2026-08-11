// @ts-nocheck
declare const require: NodeJS.Require
declare const process: NodeJS.Process

const { readFileSync } = require('fs')
const { resolve } = require('path')
const { spawnSync } = require('child_process')
const ts = require('typescript') as typeof import('typescript')

type AstCheck = 'USEEFFECT_FETCH' | 'CONTEXT_UNMEMO_VALUE' | 'HOOK_RETURN_TYPE' | 'ANY_TYPE' | 'ASYNC_USEEFFECT'

interface Rule {
    id: string
    k: string[]
    a: AstCheck
    l: string
}

interface LinterResponse {
    p: boolean
    r: string | null
    f: string | null
}

interface FileDiffInfo {
    file: string
    patch: string
    addedLines: Map<number, string>
    hunks: string[]
}

interface Trigger {
    file: string
    rule: Rule
    astLines: number[]
    snippet: string
}

const DEFAULT_MODEL = process.env.AI_LINT_MODEL ?? 'gpt-4o-mini'

function runGit(args: string[]): string {
    const proc = spawnSync('git', args, { encoding: 'utf8' })
    if (proc.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${proc.stderr || proc.stdout}`)
    }
    return proc.stdout ?? ''
}

function parseArgs(argv: string[]): { staged: boolean; rulesPath: string; model: string } {
    let staged = true
    let rulesPath = 'rules.json'
    let model = DEFAULT_MODEL

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--unstaged') staged = false
        if (a === '--staged') staged = true
        if (a === '--rules' && argv[i + 1]) rulesPath = argv[++i]
        if (a === '--model' && argv[i + 1]) model = argv[++i]
    }

    return { staged, rulesPath, model }
}

function getChangedTsFiles(staged: boolean): string[] {
    const args = ['diff', '--name-only', '--diff-filter=d']
    if (staged) args.push('--cached')

    return runGit(args)
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .filter((f: string) => f.endsWith('.ts') || f.endsWith('.tsx'))
}

function parsePatch(patch: string): { addedLines: Map<number, string>; hunks: string[] } {
    const addedLines = new Map<number, string>()
    const hunks: string[] = []
    const lines = patch.split(/\r?\n/)

    let inHunk = false
    let newLine = 0
    let hunkBuf: string[] = []

    const pushHunk = () => {
        if (hunkBuf.length) {
            hunks.push(hunkBuf.join('\n'))
            hunkBuf = []
        }
    }

    for (const line of lines) {
        if (line.startsWith('@@')) {
            pushHunk()
            inHunk = true
            hunkBuf.push(line)
            const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
            newLine = m ? Number(m[1]) : 0
            continue
        }
        if (!inHunk) continue

        if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLines.set(newLine, line.slice(1))
            hunkBuf.push(line)
            newLine += 1
            continue
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
            hunkBuf.push(line)
            continue
        }
        if (line.startsWith(' ')) {
            hunkBuf.push(line)
            newLine += 1
            continue
        }
        if (line.startsWith('\\ No newline at end of file')) {
            hunkBuf.push(line)
            continue
        }
    }

    pushHunk()
    return { addedLines, hunks }
}

function getFilePatch(file: string, staged: boolean): FileDiffInfo {
    const args = ['diff', '-U0']
    if (staged) args.push('--cached')
    args.push('--', file)
    const patch = runGit(args)
    const { addedLines, hunks } = parsePatch(patch)
    return { file, patch, addedLines, hunks }
}

function getFileText(file: string, staged: boolean): string {
    if (staged) {
        const stagedText = spawnSync('git', ['show', `:${file}`], { encoding: 'utf8' })
        if (stagedText.status === 0) return stagedText.stdout ?? ''
    }
    return readFileSync(resolve(file), 'utf8')
}

function nodeTouchesChanged(sf: import('typescript').SourceFile, node: import('typescript').Node, changed: Set<number>): boolean {
    const s = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    const e = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1
    for (let ln = s; ln <= e; ln++) {
        if (changed.has(ln)) return true
    }
    return false
}

function getNodeStartLine(sf: import('typescript').SourceFile, node: import('typescript').Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

function isUseEffectCall(node: import('typescript').CallExpression): boolean {
    const exp = node.expression
    if (ts.isIdentifier(exp)) return exp.text === 'useEffect'
    if (ts.isPropertyAccessExpression(exp)) return exp.name.text === 'useEffect'
    return false
}

function analyzeAst(file: string, text: string, changedSet: Set<number>): Record<AstCheck, number[]> {
    const sf = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    const found: Record<AstCheck, number[]> = {
        USEEFFECT_FETCH: [],
        CONTEXT_UNMEMO_VALUE: [],
        HOOK_RETURN_TYPE: [],
        ANY_TYPE: [],
        ASYNC_USEEFFECT: [],
    }

    const visit = (node: import('typescript').Node): void => {
        if (ts.isCallExpression(node) && isUseEffectCall(node) && nodeTouchesChanged(sf, node, changedSet)) {
            const cb = node.arguments[0]
            if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
                const cbText = cb.getText(sf)
                if (/\b(fetch\s*\(|axios\.)/.test(cbText)) {
                    found.USEEFFECT_FETCH.push(getNodeStartLine(sf, node))
                }
                if (/^\s*async\b/.test(cbText)) {
                    found.ASYNC_USEEFFECT.push(getNodeStartLine(sf, node))
                }
            }
        }

        if (ts.isJsxAttribute(node) && node.name.text === 'value' && nodeTouchesChanged(sf, node, changedSet)) {
            const opening = node.parent?.parent
            const tag = opening && ts.isJsxOpeningLikeElement(opening) ? opening.tagName.getText(sf) : ''
            const isProvider = tag.endsWith('.Provider') || tag === 'Provider'
            const init = node.initializer
            if (isProvider && init && ts.isJsxExpression(init) && init.expression && ts.isObjectLiteralExpression(init.expression)) {
                found.CONTEXT_UNMEMO_VALUE.push(getNodeStartLine(sf, node))
            }
        }

        if (ts.isFunctionDeclaration(node) && node.name && /^use[A-Z]/.test(node.name.text) && nodeTouchesChanged(sf, node, changedSet)) {
            if (!node.type) {
                found.HOOK_RETURN_TYPE.push(getNodeStartLine(sf, node))
            }
        }

        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^use[A-Z]/.test(node.name.text) && nodeTouchesChanged(sf, node, changedSet)) {
            if ((ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) && !node.type) {
                found.HOOK_RETURN_TYPE.push(getNodeStartLine(sf, node))
            }
        }

        if (ts.isKeywordTypeNode(node) && node.kind === ts.SyntaxKind.AnyKeyword && nodeTouchesChanged(sf, node, changedSet)) {
            found.ANY_TYPE.push(getNodeStartLine(sf, node))
        }

        ts.forEachChild(node, visit)
    }

    visit(sf)
    for (const k of Object.keys(found) as AstCheck[]) {
        found[k] = Array.from(new Set(found[k])).sort((a, b) => a - b)
    }
    return found
}

function loadRules(path: string): Rule[] {
    const raw = readFileSync(resolve(path), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('rules.json must be an array')

    for (const r of parsed) {
        if (!r?.id || !Array.isArray(r?.k) || !r?.a || !r?.l) {
            throw new Error(`invalid rule: ${JSON.stringify(r)}`)
        }
    }

    return parsed as Rule[]
}

function buildSnippet(hunks: string[], maxChars = 1800): string {
    const joined = hunks.join('\n')
    return joined.length <= maxChars ? joined : `${joined.slice(0, maxChars)}\n...`
}

function findTriggers(files: FileDiffInfo[], rules: Rule[], staged: boolean): Trigger[] {
    const triggers: Trigger[] = []

    for (const f of files) {
        if (f.addedLines.size === 0) continue

        const changedSet = new Set<number>(Array.from(f.addedLines.keys()))
        const addedJoinedLower = Array.from(f.addedLines.values()).join('\n').toLowerCase()
        const text = getFileText(f.file, staged)
        const ast = analyzeAst(f.file, text, changedSet)

        for (const rule of rules) {
            const keywordHit = rule.k.some((kw: string) => addedJoinedLower.includes(String(kw).toLowerCase()))
            const astLines = ast[rule.a] ?? []
            if (!keywordHit && astLines.length === 0) continue

            triggers.push({
                file: f.file,
                rule,
                astLines,
                snippet: buildSnippet(f.hunks),
            })
        }
    }

    const dedup = new Map<string, Trigger>()
    for (const t of triggers) dedup.set(`${t.file}::${t.rule.id}`, t)
    return Array.from(dedup.values())
}

async function evalWithLlm(model: string, trig: Trigger): Promise<LinterResponse> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required when Tier 2 is triggered')
    }

    const payload = {
        model,
        temperature: 0,
        max_tokens: 120,
        messages: [
            {
                role: 'system',
                content: 'Return strict JSON only: {"p":boolean,"r":string|null,"f":string|null}. No prose. No markdown.',
            },
            {
                role: 'user',
                content: JSON.stringify({ r: trig.rule, d: trig.snippet }),
            },
        ],
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const txt = await res.text()
        throw new Error(`LLM request failed (${res.status}): ${txt}`)
    }

    const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim() ?? ''

    try {
        const parsed = JSON.parse(content) as LinterResponse
        if (typeof parsed.p !== 'boolean') throw new Error('missing p')
        return {
            p: parsed.p,
            r: parsed.r ?? null,
            f: parsed.f ?? null,
        }
    } catch {
        return { p: false, r: trig.rule.id, f: 'Invalid JSON response from Tier 2 evaluator' }
    }
}

async function main(): Promise<void> {
    const { staged, rulesPath, model } = parseArgs(process.argv.slice(2))
    const rules = loadRules(rulesPath)
    const changed = getChangedTsFiles(staged)

    if (changed.length === 0) {
        console.log('ai-lint: no changed .ts/.tsx files')
        process.exit(0)
    }

    const fileDiffs = changed.map((file: string) => getFilePatch(file, staged))
    const triggers = findTriggers(fileDiffs, rules, staged)

    if (triggers.length === 0) {
        console.log('ai-lint: tier1 pass (0 token path)')
        process.exit(0)
    }

    const results: Array<{ trigger: Trigger; out: LinterResponse }> = []
    for (const t of triggers) {
        const out = await evalWithLlm(model, t)
        results.push({ trigger: t, out })
    }

    const fails = results.filter(x => !x.out.p)
    if (fails.length === 0) {
        console.log(`ai-lint: tier2 pass (${results.length} checks)`)
        process.exit(0)
    }

    console.error('ai-lint: violations detected')
    for (const f of fails) {
        console.error(`- ${f.trigger.file} :: ${f.out.r ?? f.trigger.rule.id}`)
        if (f.out.f) console.error(`  fix: ${f.out.f}`)
    }
    process.exit(1)
}

main().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`ai-lint: error: ${msg}`)
    process.exit(1)
})
