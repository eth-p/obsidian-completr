import {Text} from "@codemirror/text";
import {Editor, EditorPosition} from "obsidian";
import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";

export function posFromIndex(doc: Text, offset: number): EditorPosition {
    let line = doc.lineAt(offset)
    return {line: line.number - 1, ch: offset - line.from}
}

export function indexFromPos(doc: Text, pos: EditorPosition): number {
    const ch = pos.ch;
    const line = doc.line(pos.line + 1);
    return Math.min(line.from + Math.max(0, ch), line.to)
}

export function editorToCodeMirrorState(editor: Editor): EditorState {
    return (editor as any).cm.state;
}

export function editorToCodeMirrorView(editor: Editor): EditorView {
    return (editor as any).cm;
}

export function matchWordBackwards(
    editor: Editor,
    cursor: EditorPosition,
    charValidator: (char: string) => boolean,
    maxLookBackDistance: number = 50
): { query: string, separatorChar: string } {
    let query = "", separatorChar = null;

    //Save some time for very long lines
    let lookBackEnd = Math.max(0, cursor.ch - maxLookBackDistance);
    //Find word in front of cursor
    for (let i = cursor.ch - 1; i >= lookBackEnd; i--) {
        const prevChar = editor.getRange({...cursor, ch: i}, {...cursor, ch: i + 1});
        if (!charValidator(prevChar)) {
            separatorChar = prevChar;
            break;
        }

        query = prevChar + query;
    }

    return {query, separatorChar};
}

export function isInFrontMatterBlock(editor: Editor, pos: EditorPosition): boolean {
    if (editor.getLine(0) !== "---" || editor.getLine(1) === "---" || pos.line === 0)
        return false;

    for (let i = 2; i < Math.max(30, editor.lastLine()); i++) {
        if (editor.getLine(i) === "---")
            return pos.line < i;
    }

    return false;
}

export function isInLatexBlock(editor: Editor, pos: EditorPosition): boolean {
    const enum BlockType {
        NONE,
        SINGLE,
        DOUBLE
    }

    let blockStartingLine = pos.line;
    let currentBlockType = BlockType.NONE;

    for (let i = pos.line; i >= 0; i--) {
        //Saves CPU for huge documents. Would break if a math block has more than 50 lines
        if (blockStartingLine - i > 50)
            return true;

        const line = editor.getLine(i);
        for (let j = pos.line == i ? pos.ch - 1 : line.length - 1; j >= 0; j--) {
            if (line.charAt(j) !== '$')
                continue;
            let isDouble = j != 0 && line.charAt(j - 1) === "$";
            if (isDouble)
                j--;

            blockStartingLine = 0;
            if (currentBlockType === BlockType.SINGLE && isDouble || currentBlockType === BlockType.DOUBLE && !isDouble) {
                return true;
            } else if (!isDouble && currentBlockType === BlockType.SINGLE) {
                currentBlockType = BlockType.NONE;
            } else if (isDouble && currentBlockType === BlockType.DOUBLE) {
                currentBlockType = BlockType.NONE;
            } else {
                blockStartingLine = i;
                currentBlockType = isDouble ? BlockType.DOUBLE : BlockType.SINGLE;
            }
        }

        //If the single block does not begin in the current line, then it is not closed meaning the cursor is inside
        // this block
        if (currentBlockType === BlockType.SINGLE)
            return true;
    }

    return currentBlockType !== BlockType.NONE;
}
