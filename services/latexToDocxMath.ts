/**
 * LaTeX to docx Math converter
 * Converts LaTeX math expressions to docx.js Math objects for proper Word rendering.
 * Supports common constructs used in Vietnamese high school math exams (THPT).
 */
import {
    Math as DocxMath,
    MathRun,
    MathFraction,
    MathSuperScript,
    MathSubScript,
    MathSubSuperScript,
    MathRadical,
    MathRoundBrackets,
    MathSquareBrackets,
    MathCurlyBrackets,
    MathSum,
    MathAngledBrackets,
    type MathComponent,
} from "docx";

// ── Symbol Maps ──────────────────────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
    // Greek letters
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
    "\\epsilon": "ε", "\\varepsilon": "ε", "\\zeta": "ζ", "\\eta": "η",
    "\\theta": "θ", "\\vartheta": "ϑ", "\\iota": "ι", "\\kappa": "κ",
    "\\lambda": "λ", "\\mu": "μ", "\\nu": "ν", "\\xi": "ξ",
    "\\pi": "π", "\\rho": "ρ", "\\sigma": "σ", "\\tau": "τ",
    "\\upsilon": "υ", "\\phi": "φ", "\\varphi": "φ", "\\chi": "χ",
    "\\psi": "ψ", "\\omega": "ω",
    "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
    "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Upsilon": "Υ",
    "\\Phi": "Φ", "\\Psi": "Ψ", "\\Omega": "Ω",

    // Operators & Relations
    "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥",
    "\\neq": "≠", "\\ne": "≠", "\\approx": "≈", "\\equiv": "≡",
    "\\pm": "±", "\\mp": "∓", "\\times": "×", "\\cdot": "·", "\\div": "÷",
    "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
    "\\forall": "∀", "\\exists": "∃",
    "\\in": "∈", "\\notin": "∉", "\\ni": "∋",
    "\\subset": "⊂", "\\supset": "⊃", "\\subseteq": "⊆", "\\supseteq": "⊇",
    "\\cup": "∪", "\\cap": "∩", "\\emptyset": "∅", "\\varnothing": "∅",
    "\\setminus": "∖",
    "\\to": "→", "\\rightarrow": "→", "\\leftarrow": "←",
    "\\Rightarrow": "⇒", "\\Leftarrow": "⇐", "\\Leftrightarrow": "⇔",
    "\\iff": "⟺",
    "\\ldots": "…", "\\cdots": "⋯", "\\dots": "…",
    "\\angle": "∠", "\\triangle": "△", "\\perp": "⊥", "\\parallel": "∥",
    "\\circ": "∘", "\\degree": "°",
    "\\quad": "  ", "\\qquad": "    ", "\\,": " ", "\\;": " ", "\\:": " ", "\\ ": " ",
    "\\mid": "|",
    "\\lbrace": "{", "\\rbrace": "}",

    // Number sets
    "\\mathbb{R}": "ℝ", "\\mathbb{N}": "ℕ", "\\mathbb{Z}": "ℤ",
    "\\mathbb{Q}": "ℚ", "\\mathbb{C}": "ℂ",
};

// Function names that should be rendered upright
const FUNC_NAMES = ["sin", "cos", "tan", "cot", "sec", "csc",
    "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
    "log", "ln", "lg", "exp", "lim", "max", "min", "sup", "inf", "det", "gcd"];

// ── Tokenizer ────────────────────────────────────────────────────────

interface Token {
    type: "command" | "group" | "text" | "superscript" | "subscript" | "special";
    value: string;
    children?: Token[];
}

/**
 * Extract the next brace-delimited group from `latex` starting at position `pos`.
 * `pos` should point at the opening `{`. Returns [content, nextPos].
 */
function extractGroup(latex: string, pos: number): [string, number] {
    if (pos >= latex.length || latex[pos] !== "{") return ["", pos];
    let depth = 1;
    let i = pos + 1;
    while (i < latex.length && depth > 0) {
        if (latex[i] === "{") depth++;
        else if (latex[i] === "}") depth--;
        i++;
    }
    return [latex.substring(pos + 1, i - 1), i];
}

/**
 * Extract an optional bracket-delimited group `[...]` from `latex` starting at `pos`.
 */
function extractOptionalGroup(latex: string, pos: number): [string | null, number] {
    if (pos >= latex.length || latex[pos] !== "[") return [null, pos];
    let depth = 1;
    let i = pos + 1;
    while (i < latex.length && depth > 0) {
        if (latex[i] === "[") depth++;
        else if (latex[i] === "]") depth--;
        i++;
    }
    return [latex.substring(pos + 1, i - 1), i];
}

/**
 * Extract the next "argument" — either a brace group or a single character.
 */
function extractArg(latex: string, pos: number): [string, number] {
    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;
    if (pos >= latex.length) return ["", pos];
    if (latex[pos] === "{") return extractGroup(latex, pos);
    // Single character (could be a command like \x)
    if (latex[pos] === "\\") {
        let j = pos + 1;
        while (j < latex.length && /[a-zA-Z]/.test(latex[j])) j++;
        if (j === pos + 1 && j < latex.length) j++; // single char command like \\
        return [latex.substring(pos, j), j];
    }
    return [latex[pos], pos + 1];
}

// ── Core Parser: LaTeX string → MathComponent[] ────────────────────

export function parseLatex(latex: string): MathComponent[] {
    const components: MathComponent[] = [];
    let i = 0;
    let textBuffer = "";

    const flushText = () => {
        if (textBuffer) {
            components.push(new MathRun(textBuffer));
            textBuffer = "";
        }
    };

    while (i < latex.length) {
        const ch = latex[i];

        // ── Superscript ──
        if (ch === "^") {
            flushText();
            i++;
            const [arg, nextPos] = extractArg(latex, i);
            i = nextPos;

            // Check if there's also a subscript right after (or before was subscript)
            const lastComp = components.length > 0 ? components[components.length - 1] : null;

            components.push(
                new MathSuperScript({
                    children: lastComp && !(lastComp instanceof MathSuperScript || lastComp instanceof MathSubScript)
                        ? (() => { components.pop(); return [lastComp]; })()
                        : [new MathRun("")],
                    superScript: parseLatex(arg),
                })
            );
            continue;
        }

        // ── Subscript ──
        if (ch === "_") {
            flushText();
            i++;
            const [arg, nextPos] = extractArg(latex, i);
            i = nextPos;

            // Check if followed by ^
            let superArg: string | null = null;
            if (i < latex.length && latex[i] === "^") {
                i++;
                const [sArg, sNext] = extractArg(latex, i);
                superArg = sArg;
                i = sNext;
            }

            const lastComp = components.length > 0 ? components[components.length - 1] : null;
            const base = lastComp && !(lastComp instanceof MathSuperScript || lastComp instanceof MathSubScript || lastComp instanceof MathSubSuperScript)
                ? (() => { components.pop(); return [lastComp]; })()
                : [new MathRun("")];

            if (superArg !== null) {
                components.push(
                    new MathSubSuperScript({
                        children: base,
                        subScript: parseLatex(arg),
                        superScript: parseLatex(superArg),
                    })
                );
            } else {
                components.push(
                    new MathSubScript({
                        children: base,
                        subScript: parseLatex(arg),
                    })
                );
            }
            continue;
        }

        // ── Commands ──
        if (ch === "\\") {
            flushText();

            // Check for multi-char commands in SYMBOL_MAP first (like \mathbb{R})
            let foundSymbol = false;

            // Try \mathbb{X} pattern
            if (latex.startsWith("\\mathbb", i)) {
                const afterCmd = i + 7;
                if (afterCmd < latex.length && latex[afterCmd] === "{") {
                    const [group, nextPos] = extractGroup(latex, afterCmd);
                    const key = `\\mathbb{${group}}`;
                    if (SYMBOL_MAP[key]) {
                        components.push(new MathRun(SYMBOL_MAP[key]));
                        i = nextPos;
                        foundSymbol = true;
                    }
                }
            }

            // Try \mathrm{...} — render text upright
            if (!foundSymbol && latex.startsWith("\\mathrm", i)) {
                const afterCmd = i + 7;
                if (afterCmd < latex.length && latex[afterCmd] === "{") {
                    const [group, nextPos] = extractGroup(latex, afterCmd);
                    components.push(new MathRun(group));
                    i = nextPos;
                    foundSymbol = true;
                }
            }

            // Try \text{...} — render text as-is
            if (!foundSymbol && latex.startsWith("\\text", i) && !latex.startsWith("\\textbf", i)) {
                let cmdEnd = i + 5;
                if (latex.startsWith("\\textrm", i)) cmdEnd = i + 7;
                if (cmdEnd < latex.length && latex[cmdEnd] === "{") {
                    const [group, nextPos] = extractGroup(latex, cmdEnd);
                    components.push(new MathRun(group));
                    i = nextPos;
                    foundSymbol = true;
                }
            }

            // Try \textbf{...}
            if (!foundSymbol && latex.startsWith("\\textbf", i)) {
                const afterCmd = i + 7;
                if (afterCmd < latex.length && latex[afterCmd] === "{") {
                    const [group, nextPos] = extractGroup(latex, afterCmd);
                    components.push(new MathRun(group));
                    i = nextPos;
                    foundSymbol = true;
                }
            }

            if (foundSymbol) continue;

            // Extract command name
            let j = i + 1;
            while (j < latex.length && /[a-zA-Z]/.test(latex[j])) j++;
            if (j === i + 1 && j < latex.length) j++; // single char command
            const cmd = latex.substring(i, j);
            i = j;

            // Check symbol map
            if (SYMBOL_MAP[cmd]) {
                components.push(new MathRun(SYMBOL_MAP[cmd]));
                continue;
            }

            // ── \frac{num}{den} ──
            if (cmd === "\\frac" || cmd === "\\dfrac" || cmd === "\\tfrac") {
                const [num, p1] = extractArg(latex, i);
                const [den, p2] = extractArg(latex, p1);
                i = p2;
                components.push(
                    new MathFraction({
                        numerator: parseLatex(num),
                        denominator: parseLatex(den),
                    })
                );
                continue;
            }

            // ── \sqrt[n]{x} ──
            if (cmd === "\\sqrt") {
                const [opt, p1] = extractOptionalGroup(latex, i);
                const [arg, p2] = extractArg(latex, p1);
                i = p2;
                components.push(
                    new MathRadical({
                        children: parseLatex(arg),
                        ...(opt ? { degree: parseLatex(opt) } : {}),
                    })
                );
                continue;
            }

            // ── \vec{AB} ──
            if (cmd === "\\vec" || cmd === "\\overrightarrow") {
                const [arg, nextPos] = extractArg(latex, i);
                i = nextPos;
                // Use combining right arrow above (U+20D7)
                components.push(new MathRun(arg + "\u20D7"));
                continue;
            }

            // ── \overline{X} ──
            if (cmd === "\\overline" || cmd === "\\bar") {
                const [arg, nextPos] = extractArg(latex, i);
                i = nextPos;
                // Use combining overline (U+0305) on each char
                const overlined = arg.split("").map(c => c + "\u0305").join("");
                components.push(new MathRun(overlined));
                continue;
            }

            // ── \sum, \prod ──
            if (cmd === "\\sum" || cmd === "\\prod") {
                // Check for _{}^{} limits
                let subArg: string | null = null;
                let supArg: string | null = null;

                // Parse limits
                for (let attempt = 0; attempt < 2; attempt++) {
                    if (i < latex.length && latex[i] === "_") {
                        i++;
                        const [a, p] = extractArg(latex, i);
                        subArg = a;
                        i = p;
                    } else if (i < latex.length && latex[i] === "^") {
                        i++;
                        const [a, p] = extractArg(latex, i);
                        supArg = a;
                        i = p;
                    }
                }

                if (cmd === "\\sum") {
                    components.push(
                        new MathSum({
                            children: [new MathRun("")],
                            ...(subArg ? { subScript: parseLatex(subArg) } : {}),
                            ...(supArg ? { superScript: parseLatex(supArg) } : {}),
                        })
                    );
                } else {
                    // \prod — use Π symbol with sub/super
                    const prodSymbol = new MathRun("∏");
                    if (subArg || supArg) {
                        if (subArg && supArg) {
                            components.push(new MathSubSuperScript({
                                children: [prodSymbol],
                                subScript: parseLatex(subArg),
                                superScript: parseLatex(supArg),
                            }));
                        } else if (subArg) {
                            components.push(new MathSubScript({
                                children: [prodSymbol],
                                subScript: parseLatex(subArg),
                            }));
                        } else if (supArg) {
                            components.push(new MathSuperScript({
                                children: [prodSymbol],
                                superScript: parseLatex(supArg!),
                            }));
                        }
                    } else {
                        components.push(prodSymbol);
                    }
                }
                continue;
            }

            // ── \int ──
            if (cmd === "\\int") {
                let subArg: string | null = null;
                let supArg: string | null = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    if (i < latex.length && latex[i] === "_") {
                        i++;
                        const [a, p] = extractArg(latex, i);
                        subArg = a;
                        i = p;
                    } else if (i < latex.length && latex[i] === "^") {
                        i++;
                        const [a, p] = extractArg(latex, i);
                        supArg = a;
                        i = p;
                    }
                }
                const intSymbol = new MathRun("∫");
                if (subArg || supArg) {
                    if (subArg && supArg) {
                        components.push(new MathSubSuperScript({
                            children: [intSymbol],
                            subScript: parseLatex(subArg),
                            superScript: parseLatex(supArg),
                        }));
                    } else if (subArg) {
                        components.push(new MathSubScript({
                            children: [intSymbol],
                            subScript: parseLatex(subArg),
                        }));
                    } else if (supArg) {
                        components.push(new MathSuperScript({
                            children: [intSymbol],
                            superScript: parseLatex(supArg!),
                        }));
                    }
                } else {
                    components.push(intSymbol);
                }
                continue;
            }

            // ── \lim ──
            if (cmd === "\\lim") {
                let subArg: string | null = null;
                if (i < latex.length && latex[i] === "_") {
                    i++;
                    const [a, p] = extractArg(latex, i);
                    subArg = a;
                    i = p;
                }
                const limRun = new MathRun("lim");
                if (subArg) {
                    components.push(new MathSubScript({
                        children: [limRun],
                        subScript: parseLatex(subArg),
                    }));
                } else {
                    components.push(limRun);
                }
                continue;
            }

            // ── \left( ... \right) brackets ──
            if (cmd === "\\left") {
                // Find the bracket char
                const bracketChar = i < latex.length ? latex[i] : "(";
                i++;
                // Find matching \right
                let depth = 1;
                let k = i;
                while (k < latex.length && depth > 0) {
                    if (latex.startsWith("\\left", k)) {
                        depth++;
                        k += 5;
                        if (k < latex.length) k++; // skip bracket char
                    } else if (latex.startsWith("\\right", k)) {
                        depth--;
                        if (depth === 0) break;
                        k += 6;
                        if (k < latex.length) k++; // skip bracket char
                    } else {
                        k++;
                    }
                }
                const innerContent = latex.substring(i, k);
                // Skip \right and the closing bracket
                i = k + 6; // skip \right
                if (i < latex.length) i++; // skip closing bracket char

                const innerComponents = parseLatex(innerContent);

                if (bracketChar === "(" || bracketChar === ")") {
                    components.push(new MathRoundBrackets({ children: innerComponents }));
                } else if (bracketChar === "[" || bracketChar === "]") {
                    components.push(new MathSquareBrackets({ children: innerComponents }));
                } else if (bracketChar === "\\{" || bracketChar === "{" || bracketChar === "\\lbrace") {
                    components.push(new MathCurlyBrackets({ children: innerComponents }));
                } else if (bracketChar === "|") {
                    // abs value — use round brackets with | as text fallback
                    components.push(new MathRun("|"));
                    components.push(...innerComponents);
                    components.push(new MathRun("|"));
                } else {
                    components.push(new MathRoundBrackets({ children: innerComponents }));
                }
                continue;
            }

            // Skip \right if encountered standalone (shouldn't happen with proper \left matching)
            if (cmd === "\\right") {
                if (i < latex.length) i++; // skip bracket char
                continue;
            }

            // ── Function names: \sin, \cos, \log, etc. ──
            const funcName = cmd.substring(1); // remove backslash
            if (FUNC_NAMES.includes(funcName)) {
                components.push(new MathRun(funcName));
                continue;
            }

            // ── Unrecognized command — render as text ──
            components.push(new MathRun(cmd.substring(1)));
            continue;
        }

        // ── Braces (group without command) ──
        if (ch === "{") {
            flushText();
            const [group, nextPos] = extractGroup(latex, i);
            i = nextPos;
            components.push(...parseLatex(group));
            continue;
        }

        // ── Regular characters ──
        textBuffer += ch;
        i++;
    }

    flushText();
    return components;
}

/**
 * Create a docx Math object from a LaTeX string.
 */
export function latexToMath(latex: string): DocxMath {
    const children = parseLatex(latex.trim());
    return new DocxMath({ children });
}
