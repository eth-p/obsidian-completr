import {
    getSuggestionDisplayName,
    getSuggestionReplacement,
    Suggestion,
    SuggestionContext,
    SuggestionProvider
} from "./provider";
import {CompletrSettings} from "../settings";
import {isInLatexBlock, maybeLowerCase} from "../editor_helpers";
import {Notice, Vault} from "obsidian";
import {SuggestionBlacklist} from "./blacklist";

function substringUntil(str: string, delimiter: string): string {
    let index = str.indexOf(delimiter);
    if (index === -1)
        return str;

    return str.substring(0, index);
}

const LATEX_COMMANDS_PATH = ".obsidian/plugins/obsidian-completr/latex_commands.json";

class LatexSuggestionProvider implements SuggestionProvider {

    private loadedCommands: Suggestion[] = [];

    getSuggestions(context: SuggestionContext, settings: CompletrSettings): Suggestion[] {
        if (!settings.latexProviderEnabled || !context.query || context.query.length < settings.latexMinWordTriggerLength)
            return [];

        let editor = context.editor;

        //Check if we're in a LaTeX context
        if (!isInLatexBlock(editor, context.start, settings.latexTriggerInCodeBlocks))
            return [];

        const query = maybeLowerCase(context.query, settings.latexIgnoreCase);
        const isSeparatorBackslash = context.separatorChar === "\\";

        return this.loadedCommands.filter((s) => getSuggestionDisplayName(s, settings.latexIgnoreCase).contains(query))
            .map((s) => {
                const replacement = getSuggestionReplacement(s);
                return ({
                    displayName: getSuggestionDisplayName(s),
                    replacement: isSeparatorBackslash ? replacement.substring(1) : replacement,
                    priority: getSuggestionDisplayName(s, settings.latexIgnoreCase).indexOf(query),
                });
            })
            .sort((a, b) => {
                //This makes sure that matches like "\vee" are ranked before "\curlyvee" if the query is "\vee"
                let val = a.priority - b.priority;
                if (val == 0)
                    val = substringUntil(a.displayName, "{").length - substringUntil(b.displayName, "{").length;
                return val;
            });
    }

    async loadCommands(vault: Vault) {
        if (!(await vault.adapter.exists(LATEX_COMMANDS_PATH))) {
            const defaultCommands = generateDefaultLatexCommands();
            await vault.adapter.write(LATEX_COMMANDS_PATH, JSON.stringify(defaultCommands, null, 2));
            this.loadedCommands = defaultCommands;
        } else {
            const data = await vault.adapter.read(LATEX_COMMANDS_PATH);
            try {
                const commands: Suggestion[] = JSON.parse(data);
                const invalidCommand = commands.find(c => getSuggestionDisplayName(c).includes("\n"));
                if (invalidCommand)
                    throw new Error("Display name cannot contain a newline: " + getSuggestionDisplayName(invalidCommand));

                this.loadedCommands = commands;
            } catch (e) {
                console.log("Completr latex commands parse error:", e.message);
                new Notice("Failed to parse latex commands file " + LATEX_COMMANDS_PATH + ". Using default commands.", 3000);
                this.loadedCommands = generateDefaultLatexCommands();
            }
        }

        this.loadedCommands = SuggestionBlacklist.filter(this.loadedCommands);
    }
}

export const Latex = new LatexSuggestionProvider();

function generateEnvironments(environments: { name: string, paramCount: number, hasStarVersion: boolean }[]): Suggestion[] {
    const result = [];

    for (let i = 0; i < environments.length; i++) {
        const environment = environments[i];
        if (environment.hasStarVersion) {
            environments.push({...environment, name: environment.name + "*", hasStarVersion: false});
        }

        result.push({
            displayName: `\\begin{${environment.name}}...`,
            replacement:
                `\\begin{${environment.name}}${"{#}".repeat(environment.paramCount)}\n` +
                `${environment.paramCount < 1 ? "~\n" : ""}` +
                `\\end{${environment.name}}`
        });
    }

    return result;
}

/*
 * Generates the default latex commands. This is a method to avoid any unnecessary initialization
 */
function generateDefaultLatexCommands(): Suggestion[] {
    return [
        ...generateEnvironments([
            {name: "align", paramCount: 0, hasStarVersion: true},
            {name: "alignat", paramCount: 1, hasStarVersion: true},
            {name: "aligned", paramCount: 0, hasStarVersion: false},
            {name: "alignedat", paramCount: 1, hasStarVersion: false},
            {name: "array", paramCount: 1, hasStarVersion: false},
            {name: "bmatrix", paramCount: 0, hasStarVersion: true},
            {name: "Bmatrix", paramCount: 0, hasStarVersion: true},
            {name: "bsmallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "Bsmallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "cases", paramCount: 0, hasStarVersion: true},
            {name: "crampedsubarray", paramCount: 1, hasStarVersion: false},
            {name: "dcases", paramCount: 0, hasStarVersion: true},
            {name: "drcases", paramCount: 0, hasStarVersion: true},
            {name: "empheq", paramCount: 2, hasStarVersion: false},
            {name: "eqnarray", paramCount: 0, hasStarVersion: true},
            {name: "equation", paramCount: 0, hasStarVersion: true},
            {name: "flalign", paramCount: 0, hasStarVersion: true},
            {name: "gather", paramCount: 0, hasStarVersion: true},
            {name: "gathered", paramCount: 0, hasStarVersion: false},
            {name: "lgathered", paramCount: 0, hasStarVersion: false},
            {name: "matrix", paramCount: 0, hasStarVersion: true},
            {name: "multiline", paramCount: 0, hasStarVersion: true},
            {name: "multilined", paramCount: 0, hasStarVersion: false},
            {name: "numcases", paramCount: 1, hasStarVersion: false},
            {name: "pmatrix", paramCount: 0, hasStarVersion: true},
            {name: "prooftree", paramCount: 0, hasStarVersion: false},
            {name: "psmallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "rcases", paramCount: 0, hasStarVersion: true},
            {name: "rgathered", paramCount: 0, hasStarVersion: false},
            {name: "smallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "split", paramCount: 0, hasStarVersion: false},
            {name: "spreadlines", paramCount: 1, hasStarVersion: false},
            {name: "subarray", paramCount: 1, hasStarVersion: false},
            {name: "subnumcases", paramCount: 1, hasStarVersion: false},
            {name: "vmatrix", paramCount: 0, hasStarVersion: true},
            {name: "Vmatrix", paramCount: 0, hasStarVersion: true},
            {name: "vsmallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "Vsmallmatrix", paramCount: 0, hasStarVersion: true},
            {name: "xalignat", paramCount: 1, hasStarVersion: true},
            {name: "xxalignat", paramCount: 1, hasStarVersion: false},
        ]),
        "\\above{#}{#}",
        "\\verb|#|",
        "\\left\\",
        "\\right\\",
        "\\acute{#}",
        "\\aleph",
        "\\alpha",
        "\\amalg",
        "\\And",
        "\\angle",
        "\\approx",
        "\\approxeq",
        "\\arccos",
        "\\arcsin",
        "\\arctan",
        "\\arg",
        "\\array{#}",
        "\\arrowvert",
        "\\Arrowvert",
        "\\ast",
        "\\asymp",
        "\\atop",
        "\\backepsilon",
        "\\backprime",
        "\\backsim",
        "\\backsimeq",
        "\\backslash",
        "\\bar{#}",
        "\\barwedge",
        "\\Bbb{#}",
        "\\Bbbk",
        "\\bbFont",
        "\\bbox{#}",
        "\\bcancel{#}",
        "\\because",
        "\\beta",
        "\\beth",
        "\\between",
        "\\bf",
        "\\bigcap",
        "\\bigcirc",
        "\\bigcup",
        "\\bigodot",
        "\\bigoplus",
        "\\bigotimes",
        "\\bigsqcup",
        "\\bigstar",
        "\\bigtimes",
        "\\bigtriangledown",
        "\\bigtriangleup",
        "\\biguplus",
        "\\bigvee",
        "\\bigwedge",
        "\\binom{#}{#}",
        "\\blacklozenge",
        "\\blacksquare",
        "\\blacktriangle",
        "\\blacktriangledown",
        "\\blacktriangleleft",
        "\\blacktriangleright",
        "\\bmod",
        "\\boldsymbol{#}",
        "\\bot",
        "\\bowtie",
        "\\Box",
        "\\boxdot",
        "\\boxed{#}",
        "\\boxminus",
        "\\boxplus",
        "\\boxtimes",
        "\\bra{#}",
        "\\Bra{#}",
        "\\brace",
        "\\bracevert",
        "\\brack",
        "\\braket{#}",
        "\\Braket{#}",
        "\\breve{#}",
        "\\bullet",
        "\\bumpeq",
        "\\Bumpeq",
        "\\cal",
        "\\cancel{#}",
        "\\cancelto{#}{#}",
        "\\cap",
        "\\Cap",
        "\\cases{#}",
        "\\cdot",
        "\\cdotp",
        "\\cdots",
        "\\celsius",
        "\\centercolon",
        "\\centerdot",
        "\\centernot{#}",
        "\\centerOver{#}{#}",
        "\\cfrac{#}{#}",
        "\\check{#}",
        "\\checkmark",
        "\\chi",
        "\\choose",
        "\\circ",
        "\\circeq",
        "\\circlearrowleft",
        "\\circlearrowright",
        "\\circledast",
        "\\circledcirc",
        "\\circleddash",
        "\\circledR",
        "\\circledS",
        "\\clap{#}",
        "\\class{#}{#}",
        "\\clubsuit",
        "\\colon",
        "\\colonapprox",
        "\\Colonapprox",
        "\\coloneq",
        "\\Coloneq",
        "\\coloneqq",
        "\\Coloneqq",
        "\\colonsim",
        "\\Colonsim",
        "\\color{#}",
        "\\colorbox{#}{#}",
        "\\complement",
        "\\cong",
        "\\coprod",
        "\\cos",
        "\\cosh",
        "\\cot",
        "\\coth",
        "\\cramped{#}",
        "\\crampedclap{#}",
        "\\crampedllap{#}",
        "\\crampedrlap{#}",
        "\\crampedsubstack{#}",
        "\\csc",
        "\\cssId{#}{#}",
        "\\cup",
        "\\Cup",
        "\\curlyeqprec",
        "\\curlyeqsucc",
        "\\curlyvee",
        "\\curlywedge",
        "\\curvearrowleft",
        "\\curvearrowright",
        "\\dagger",
        "\\daleth",
        "\\dashleftarrow",
        "\\dashrightarrow",
        "\\dashv",
        "\\dbinom{#}{#}",
        "\\dblcolon",
        "\\ddagger",
        "\\ddddot{#}",
        "\\dddot{#}",
        "\\ddot{#}",
        "\\ddots",
        "\\DeclareMathOperator{#}{#}",
        "\\DeclarePairedDelimiters{#}{#}{#}",
        "\\DeclarePairedDelimitersX{#}{#}{#}{#}",
        "\\DeclarePairedDelimitersXPP{#}{#}{#}{#}{#}{#}",
        "\\deg",
        "\\degree",
        "\\delta",
        "\\Delta",
        "\\det",
        "\\dfrac{#}{#}",
        "\\diagdown",
        "\\diagup",
        "\\diamond",
        "\\Diamond",
        "\\diamondsuit",
        "\\digamma",
        "\\dim",
        "\\displaylines{#}",
        "\\displaystyle",
        "\\div",
        "\\divideontimes",
        "\\divsymbol",
        "\\dot{#}",
        "\\doteq",
        "\\Doteq",
        "\\doteqdot",
        "\\dotplus",
        "\\dots",
        "\\dotsb",
        "\\dotsc",
        "\\dotsi",
        "\\dotsm",
        "\\dotso",
        "\\doublebarwedge",
        "\\doublecap",
        "\\doublecup",
        "\\downarrow",
        "\\Downarrow",
        "\\downdownarrows",
        "\\downharpoonleft",
        "\\downharpoonright",
        "\\ell",
        "\\empheqbiglangle",
        "\\empheqbiglbrace",
        "\\empheqbiglbrack",
        "\\empheqbiglceil",
        "\\empheqbiglfloor",
        "\\empheqbiglparen",
        "\\empheqbiglvert",
        "\\empheqbiglVert",
        "\\empheqbigrangle",
        "\\empheqbigrbrace",
        "\\empheqbigrbrack",
        "\\empheqbigrceil",
        "\\empheqbigrfloor",
        "\\empheqbigrparen",
        "\\empheqbigrvert",
        "\\empheqbigrVert",
        "\\empheqlangle",
        "\\empheqlbrace",
        "\\empheqlbrack",
        "\\empheqlceil",
        "\\empheqlfloor",
        "\\empheqlparen",
        "\\empheqlvert",
        "\\empheqlVert",
        "\\empheqrangle",
        "\\empheqrbrace",
        "\\empheqrbrack",
        "\\empheqrceil",
        "\\empheqrfloor",
        "\\empheqrparen",
        "\\empheqrvert",
        "\\empheqrVert",
        "\\emptyset",
        "\\enclose{#}{#}",
        "\\enspace",
        "\\epsilon",
        "\\eqalign{#}",
        "\\eqalignno{#}",
        "\\eqcirc",
        "\\eqcolon",
        "\\Eqcolon",
        "\\eqqcolon",
        "\\Eqqcolon",
        "\\eqref{#}",
        "\\eqsim",
        "\\eqslantgtr",
        "\\eqslantless",
        "\\equiv",
        "\\eta",
        "\\eth",
        "\\exists",
        "\\exp",
        "\\fallingdotseq",
        "\\fbox{#}",
        "\\fCenter",
        "\\fcolorbox{#}{#}{#}",
        "\\Finv",
        "\\flat",
        "\\forall",
        "\\frac{#}{#}",
        "\\frak",
        "\\framebox{#}",
        "\\frown",
        "\\Game",
        "\\gamma",
        "\\Gamma",
        "\\gcd",
        "\\ge",
        "\\geq",
        "\\geqq",
        "\\geqslant",
        "\\gets",
        "\\gg",
        "\\ggg",
        "\\gggtr",
        "\\gimel",
        "\\gnapprox",
        "\\gneq",
        "\\gneqq",
        "\\gnsim",
        "\\grave{#}",
        "\\gt",
        "\\gtrapprox",
        "\\gtrdot",
        "\\gtreqless",
        "\\gtreqqless",
        "\\gtrless",
        "\\gtrsim",
        "\\gvertneqq",
        "\\hat{#}",
        "\\hbar",
        "\\hbox{#}",
        "\\heartsuit",
        "\\hline",
        "\\hom",
        "\\hookleftarrow",
        "\\hookrightarrow",
        "\\hphantom{#}",
        "\\href{#}{#}",
        "\\hslash",
        "\\huge",
        "\\Huge",
        "\\idotsint",
        "\\iff",
        "\\iiiint",
        "\\iiint",
        "\\iint",
        "\\Im",
        "\\imath",
        "\\impliedby",
        "\\implies",
        "\\in",
        "\\inf",
        "\\infty",
        "\\injlim",
        "\\int",
        "\\int^{#}_{#}",
        "\\intercal",
        "\\intop",
        "\\iota",
        "\\it",
        "\\jmath",
        "\\Join",
        "\\kappa",
        "\\ker",
        "\\ket{#}",
        "\\Ket{#}",
        "\\ketbra{#}{#}",
        "\\Ketbra{#}{#}",
        "\\label{#}",
        "\\lambda",
        "\\Lambda",
        "\\land",
        "\\langle",
        "\\large",
        "\\Large",
        "\\LARGE",
        "\\LaTeX",
        "\\lbrace",
        "\\lbrack",
        "\\lceil",
        "\\ldots",
        "\\ldotp",
        "\\le",
        "\\leadsto",
        "\\Leftarrow",
        "\\leftarrow",
        "\\leftarrowtail",
        "\\leftharpoondown",
        "\\leftharpoonup",
        "\\leftleftarrows",
        "\\Leftrightarrow",
        "\\leftrightarrow",
        "\\leftrightarrows",
        "\\leftrightharpoons",
        "\\leftrightsquigarrow",
        "\\leftthreetimes",
        "\\leq",
        "\\leqalignno{#}",
        "\\leqq",
        "\\leqslant",
        "\\lessapprox",
        "\\lessdot",
        "\\lesseqgtr",
        "\\lesseqqgtr",
        "\\lessgtr",
        "\\lesssim",
        "\\lfloor",
        "\\lg",
        "\\lgroup",
        "\\lhd",
        "\\lim",
        "\\lim_{#}",
        "\\liminf",
        "\\limsup",
        "\\ll",
        "\\llap{#}",
        "\\llcorner",
        "\\Lleftarrow",
        "\\lll",
        "\\llless",
        "\\lmoustache",
        "\\ln",
        "\\lnapprox",
        "\\lneq",
        "\\lneqq",
        "\\lnot",
        "\\lnsim",
        "\\log",
        "\\longleftarrow",
        "\\Longleftarrow",
        "\\Longleftrightarrow",
        "\\longleftrightarrow",
        "\\longleftrightarrows",
        "\\longLeftrightharpoons",
        "\\longmapsto",
        "\\longrightarrow",
        "\\Longrightarrow",
        "\\longrightleftharpoons",
        "\\longRightleftharpoons",
        "\\looparrowleft",
        "\\looparrowright",
        "\\lor",
        "\\lozenge",
        "\\lparen",
        "\\lrcorner",
        "\\Lsh",
        "\\lt",
        "\\ltimes",
        "\\lvert",
        "\\lVert",
        "\\lvertneqq",
        "\\maltese",
        "\\mapsto",
        "\\mathbb{#}",
        "\\mathbb{R}",
        "\\mathbb{N}",
        "\\mathbb{C}",
        "\\mathbb{Z}",
        "\\mathbb{Q}",
        "\\mathbf{#}",
        "\\mathbfcal{#}",
        "\\mathbffrak{#}",
        "\\mathbfit{#}",
        "\\mathbfscr{#}",
        "\\mathbfsf{#}",
        "\\mathbfsfit{#}",
        "\\mathbfsfup{#}",
        "\\mathbfup{#}",
        "\\mathbin{#}",
        "\\mathcal{#}",
        "\\mathchoice{#}{#}{#}{#}",
        "\\mathclap{#}",
        "\\mathclose{#}",
        "\\mathfrak{#}",
        "\\mathinner{#}",
        "\\mathit{#}",
        "\\mathllap{#}",
        "\\mathmakebox{#}",
        "\\mathmbox{#}",
        "\\mathnormal{#}",
        "\\mathop{#}",
        "\\mathopen{#}",
        "\\mathord{#}",
        "\\mathpunct{#}",
        "\\mathrel{#}",
        "\\mathring{#}",
        "\\mathrlap{#}",
        "\\mathrm{#}",
        "\\mathscr{#}",
        "\\mathsf{#}",
        "\\mathsfit{#}",
        "\\mathsfup{#}",
        "\\mathstrut",
        "\\mathtip{#}{#}",
        "\\mathtt{#}",
        "\\mathup{#}",
        "\\max",
        "\\mbox{#}",
        "\\measuredangle",
        "\\mho",
        "\\micro",
        "\\mid",
        "\\min",
        "\\mit",
        "\\mod{#}",
        "\\models",
        "\\mp",
        "\\MTThinColon",
        "\\mu",
        "\\multimap",
        "\\nabla",
        "\\natural",
        "\\ncong",
        "\\ndownarrow",
        "\\ne",
        "\\nearrow",
        "\\neg",
        "\\negmedspace",
        "\\negthickspace",
        "\\negthinspace",
        "\\neq",
        "\\newcommand{#}{#}",
        "\\newenvironment{#}{#}{#}",
        "\\newline",
        "\\newtagform{#}{#}{#}",
        "\\nexists",
        "\\ngeq",
        "\\ngeqq",
        "\\ngeqslant",
        "\\ngtr",
        "\\ni",
        "\\nleftarrow",
        "\\nLeftarrow",
        "\\nleftrightarrow",
        "\\nLeftrightarrow",
        "\\nleq",
        "\\nleqq",
        "\\nleqslant",
        "\\nless",
        "\\nmid",
        "\\nobreakspace",
        "\\nonscript",
        "\\nonumber",
        "\\normalsize",
        "\\not",
        "\\notag",
        "\\notChar",
        "\\notin",
        "\\nparallel",
        "\\nprec",
        "\\npreceq",
        "\\nrightarrow",
        "\\nRightarrow",
        "\\nshortmid",
        "\\nshortparallel",
        "\\nsim",
        "\\nsubseteq",
        "\\nsubseteqq",
        "\\nsucc",
        "\\nsucceq",
        "\\nsupseteq",
        "\\nsupseteqq",
        "\\ntriangleleft",
        "\\ntrianglelefteq",
        "\\ntriangleright",
        "\\ntrianglerighteq",
        "\\nu",
        "\\nuparrow",
        "\\nvdash",
        "\\nvDash",
        "\\nVdash",
        "\\nVDash",
        "\\nwarrow",
        "\\odot",
        "\\ohm",
        "\\oint",
        "\\oldstyle",
        "\\omega",
        "\\Omega",
        "\\omicron",
        "\\ominus",
        "\\operatorname{#}",
        "\\oplus",
        "\\ordinarycolon",
        "\\oslash",
        "\\otimes",
        "\\over",
        "\\overbrace{#}",
        "\\overbracket{#}",
        "\\overleftarrow{#}",
        "\\overleftrightarrow{#}",
        "\\overline{#}",
        "\\overparen{#}",
        "\\overrightarrow{#}",
        "\\overset{#}{#}",
        "\\overunderset{#}{#}{#}",
        "\\owns",
        "\\parallel",
        "\\partial",
        "\\perp",
        "\\perthousand",
        "\\phantom{#}",
        "\\phi",
        "\\Phi",
        "\\pi",
        "\\Pi",
        "\\pitchfork",
        "\\pm",
        "\\pmb{#}",
        "\\pmod{#}",
        "\\pod{#}",
        "\\Pr",
        "\\prec",
        "\\precapprox",
        "\\preccurlyeq",
        "\\preceq",
        "\\precnapprox",
        "\\precneqq",
        "\\precnsim",
        "\\precsim",
        "\\prescript{#}{#}{#}",
        "\\prime",
        "\\prod",
        "\\prod^{#}_{#}",
        "\\projlim",
        "\\propto",
        "\\psi",
        "\\Psi",
        "\\qquad",
        "\\quad",
        "\\rangle",
        "\\rbrace",
        "\\rbrack",
        "\\rceil",
        "\\Re",
        "\\ref{#}",
        "\\refeq{#}",
        "\\renewcommand{#}{#}",
        "\\renewenvironment{#}{#}{#}",
        "\\renewtagform{#}{#}{#}",
        "\\restriction",
        "\\rfloor",
        "\\rgroup",
        "\\rhd",
        "\\rho",
        "\\Rightarrow",
        "\\rightarrow",
        "\\rightarrowtail",
        "\\rightharpoondown",
        "\\rightharpoonup",
        "\\rightleftarrows",
        "\\rightleftharpoons",
        "\\rightrightarrows",
        "\\rightsquigarrow",
        "\\rightthreetimes",
        "\\risingdotseq",
        "\\rlap{#}",
        "\\rm",
        "\\rmoustache",
        "\\rparen",
        "\\Rrightarrow",
        "\\Rsh",
        "\\rtimes",
        "\\rvert",
        "\\rVert",
        "\\S",
        "\\scr",
        "\\scriptscriptstyle",
        "\\scriptsize",
        "\\scriptstyle",
        "\\searrow",
        "\\sec",
        "\\set{#}",
        "\\Set{#}",
        "\\setminus",
        "\\sf",
        "\\sharp",
        "\\shortmid",
        "\\shortparallel",
        "\\sideset{#}{#}{#}",
        "\\sigma",
        "\\Sigma",
        "\\sim",
        "\\simeq",
        "\\sin",
        "\\sinh",
        "\\skew{#}{#}{#}",
        "\\SkipLimits",
        "\\small",
        "\\smallfrown",
        "\\smallint",
        "\\smallsetminus",
        "\\smallsmile",
        "\\smash{#}",
        "\\smile",
        "\\space",
        "\\spadesuit",
        "\\sphericalangle",
        "\\splitdfrac{#}{#}",
        "\\splitfrac{#}{#}",
        "\\sqcap",
        "\\sqcup",
        "\\sqrt{#}",
        "\\sqsubset",
        "\\sqsubseteq",
        "\\sqsupset",
        "\\sqsupseteq",
        "\\square",
        "\\stackbin{#}{#}",
        "\\stackrel{#}{#}",
        "\\star",
        "\\strut",
        "\\style{#}{#}",
        "\\subset",
        "\\Subset",
        "\\subseteq",
        "\\subseteqq",
        "\\subsetneq",
        "\\subsetneqq",
        "\\substack{#}",
        "\\succ",
        "\\succapprox",
        "\\succcurlyeq",
        "\\succeq",
        "\\succnapprox",
        "\\succneqq",
        "\\succnsim",
        "\\succsim",
        "\\sum",
        "\\sum^{#}_{#}",
        "\\sup",
        "\\supset",
        "\\Supset",
        "\\supseteq",
        "\\supseteqq",
        "\\supsetneq",
        "\\supsetneqq",
        "\\surd",
        "\\swarrow",
        "\\symbb{#}",
        "\\symbf{#}",
        "\\symbfcal{#}",
        "\\symbffrak{#}",
        "\\symbfit{#}",
        "\\symbfscr{#}",
        "\\symbfsf{#}",
        "\\symbfsfit{#}",
        "\\symbfsfup{#}",
        "\\symbfup{#}",
        "\\symcal{#}",
        "\\symfrak{#}",
        "\\symit{#}",
        "\\symnormal{#}",
        "\\symrm{#}",
        "\\symscr{#}",
        "\\symsf{#}",
        "\\symsfit{#}",
        "\\symsfup{#}",
        "\\symtt{#}",
        "\\symup{#}",
        "\\tag{#}",
        "\\tan",
        "\\tanh",
        "\\tau",
        "\\tbinom{#}{#}",
        "\\TeX",
        "\\text{#}",
        "\\textacutedbl",
        "\\textasciiacute",
        "\\textasciibreve",
        "\\textasciicaron",
        "\\textasciicircum",
        "\\textasciidieresis",
        "\\textasciimacron",
        "\\textasciitilde",
        "\\textasteriskcentered",
        "\\textbackslash",
        "\\textbaht",
        "\\textbar",
        "\\textbardbl",
        "\\textbf{#}",
        "\\textbigcircle",
        "\\textblank",
        "\\textborn",
        "\\textbraceleft",
        "\\textbraceright",
        "\\textbrokenbar",
        "\\textbullet",
        "\\textcelsius",
        "\\textcent",
        "\\textcentoldstyle",
        "\\textcircledP",
        "\\textclap{#}",
        "\\textcolonmonetary",
        "\\textcolor{#}{#}",
        "\\textcompwordmark",
        "\\textcopyleft",
        "\\textcopyright",
        "\\textcurrency",
        "\\textdagger",
        "\\textdaggerdbl",
        "\\textdegree",
        "\\textdied",
        "\\textdiscount",
        "\\textdiv",
        "\\textdivorced",
        "\\textdollar",
        "\\textdollaroldstyle",
        "\\textdong",
        "\\textdownarrow",
        "\\texteightoldstyle",
        "\\textellipsis",
        "\\textemdash",
        "\\textendash",
        "\\textestimated",
        "\\texteuro",
        "\\textexclamdown",
        "\\textfiveoldstyle",
        "\\textflorin",
        "\\textfouroldstyle",
        "\\textfractionsolidus",
        "\\textgravedbl",
        "\\textgreater",
        "\\textguarani",
        "\\textinterrobang",
        "\\textinterrobangdown",
        "\\textit{#}",
        "\\textlangle",
        "\\textlbrackdbl",
        "\\textleftarrow",
        "\\textless",
        "\\textlira",
        "\\textllap{#}",
        "\\textlnot",
        "\\textlquill",
        "\\textmarried",
        "\\textmho",
        "\\textminus",
        "\\textmu",
        "\\textmusicalnote",
        "\\textnaira",
        "\\textnineoldstyle",
        "\\textnormal{#}",
        "\\textnumero",
        "\\textohm",
        "\\textonehalf",
        "\\textoneoldstyle",
        "\\textonequarter",
        "\\textonesuperior",
        "\\textopenbullet",
        "\\textordfeminine",
        "\\textordmasculine",
        "\\textparagraph",
        "\\textperiodcentered",
        "\\textpertenthousand",
        "\\textperthousand",
        "\\textpeso",
        "\\textpm",
        "\\textquestiondown",
        "\\textquotedblleft",
        "\\textquotedblright",
        "\\textquoteleft",
        "\\textquoteright",
        "\\textrangle",
        "\\textrbrackdbl",
        "\\textrecipe",
        "\\textreferencemark",
        "\\textregistered",
        "\\textrightarrow",
        "\\textrlap{#}",
        "\\textrm{#}",
        "\\textrquill",
        "\\textsection",
        "\\textservicemark",
        "\\textsevenoldstyle",
        "\\textsf{#}",
        "\\textsixoldstyle",
        "\\textsterling",
        "\\textstyle",
        "\\textsurd",
        "\\textthreeoldstyle",
        "\\textthreequarters",
        "\\textthreesuperior",
        "\\texttildelow",
        "\\texttimes",
        "\\texttip{#}{#}",
        "\\texttrademark",
        "\\texttt{#}",
        "\\texttwooldstyle",
        "\\texttwosuperior",
        "\\textunderscore",
        "\\textup{#}",
        "\\textuparrow",
        "\\textvisiblespace",
        "\\textwon",
        "\\textyen",
        "\\textzerooldstyle",
        "\\tfrac{#}{#}",
        "\\therefore",
        "\\theta",
        "\\Theta",
        "\\thickapprox",
        "\\thicksim",
        "\\thinspace",
        "\\tilde{#}",
        "\\times",
        "\\tiny",
        "\\Tiny",
        "\\to",
        "\\top",
        "\\triangle",
        "\\triangledown",
        "\\triangleleft",
        "\\trianglelefteq",
        "\\triangleq",
        "\\triangleright",
        "\\trianglerighteq",
        "\\tripledash",
        "\\tt",
        "\\twoheadleftarrow",
        "\\twoheadrightarrow",
        "\\ulcorner",
        "\\underbrace{#}",
        "\\underbracket{#}",
        "\\underleftarrow{#}",
        "\\underleftrightarrow{#}",
        "\\underline{#}",
        "\\underparen{#}",
        "\\underrightarrow{#}",
        "\\underset{#}{#}",
        "\\unicode{#}",
        "\\unlhd",
        "\\unrhd",
        "\\upalpha",
        "\\uparrow",
        "\\Uparrow",
        "\\upbeta",
        "\\upchi",
        "\\updelta",
        "\\Updelta",
        "\\updownarrow",
        "\\Updownarrow",
        "\\upepsilon",
        "\\upeta",
        "\\upgamma",
        "\\Upgamma",
        "\\upharpoonleft",
        "\\upharpoonright",
        "\\upiota",
        "\\upkappa",
        "\\uplambda",
        "\\Uplambda",
        "\\uplus",
        "\\upmu",
        "\\upnu",
        "\\upomega",
        "\\Upomega",
        "\\upomicron",
        "\\upphi",
        "\\Upphi",
        "\\uppi",
        "\\Uppi",
        "\\uppsi",
        "\\Uppsi",
        "\\uprho",
        "\\upsigma",
        "\\Upsigma",
        "\\upsilon",
        "\\Upsilon",
        "\\uptau",
        "\\uptheta",
        "\\Uptheta",
        "\\upuparrows",
        "\\upupsilon",
        "\\Upupsilon",
        "\\upvarepsilon",
        "\\upvarphi",
        "\\upvarpi",
        "\\upvarrho",
        "\\upvarsigma",
        "\\upvartheta",
        "\\upxi",
        "\\Upxi",
        "\\upzeta",
        "\\urcorner",
        "\\usetagform{#}",
        "\\varDelta",
        "\\varepsilon",
        "\\varGamma",
        "\\varinjlim",
        "\\varkappa",
        "\\varLambda",
        "\\varliminf",
        "\\varlimsup",
        "\\varnothing",
        "\\varOmega",
        "\\varphi",
        "\\varPhi",
        "\\varpi",
        "\\varPi",
        "\\varprojlim",
        "\\varpropto",
        "\\varPsi",
        "\\varrho",
        "\\varsigma",
        "\\varSigma",
        "\\varsubsetneq",
        "\\varsubsetneqq",
        "\\varsupsetneq",
        "\\varsupsetneqq",
        "\\vartheta",
        "\\varTheta",
        "\\vartriangle",
        "\\vartriangleleft",
        "\\vartriangleright",
        "\\varUpsilon",
        "\\varXi",
        "\\vcenter{#}",
        "\\vdash",
        "\\vDash",
        "\\Vdash",
        "\\vdots",
        "\\vec{#}",
        "\\vee",
        "\\veebar",
        "\\Vert",
        "\\vert",
        "\\vphantom{#}",
        "\\Vvdash",
        "\\wedge",
        "\\widehat{#}",
        "\\widetilde{#}",
        "\\wp",
        "\\wr",
        "\\xcancel{#}",
        "\\xhookleftarrow{#}",
        "\\xhookrightarrow{#}",
        "\\xi",
        "\\Xi",
        "\\xleftarrow{#}",
        "\\xLeftarrow{#}",
        "\\xleftharpoondown{#}",
        "\\xleftharpoonup{#}",
        "\\xleftrightarrow{#}",
        "\\xLeftrightarrow{#}",
        "\\xleftrightharpoons{#}",
        "\\xLeftrightharpoons{#}",
        "\\xlongequal{#}",
        "\\xmapsto{#}",
        "\\xmathstrut{#}",
        "\\xrightarrow{#}",
        "\\xRightarrow{#}",
        "\\xrightharpoondown{#}",
        "\\xrightharpoonup{#}",
        "\\xrightleftharpoons{#}",
        "\\xRightleftharpoons{#}",
        "\\xtofrom{#}",
        "\\xtwoheadleftarrow{#}",
        "\\xtwoheadrightarrow{#}",
        "\\yen",
        "\\zeta",
    ];
}
