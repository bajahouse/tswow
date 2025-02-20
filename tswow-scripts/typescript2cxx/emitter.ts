import * as path from 'path';
import * as ts from 'typescript';
import { CodeWriter } from './codewriter';
import { Helpers } from './helpers';
import { Preprocessor } from './preprocessor';
import { IdentifierResolver } from './resolvers';
import { handleClass, handleClassImpl } from './tswow/orm';
import { handleTSWoWOverride } from './tswow/override';
import { generateStringify } from './tswow/stringify';

let mainFile: string = undefined;
export class Emitter {
    public writer: CodeWriter;
    preprocessor: Preprocessor;
    resolver: IdentifierResolver;
    typeChecker: ts.TypeChecker;
    sourceFileName: string;
    scope: Array<ts.Node> = new Array<ts.Node>();
    opsMap: Map<number, string> = new Map<number, string>();
    embeddedCPPTypes: Array<string>;
    isWritingMain = false;
    // @tswow-begin: hack: const enums
    enumTypes: {[key:string]: string}
    // @tswow-end

    public constructor(
        typeChecker: ts.TypeChecker, private options: ts.CompilerOptions,
        cmdLineOptions: any, private singleModule: boolean,
        // @tswow-begin: hack: const enums
        enumTypes: {[key: string]: string},
        private rootFolder?: string,
        ) {
        this.enumTypes = enumTypes;
        // @tswow-end
        this.writer = new CodeWriter();
        this.resolver = new IdentifierResolver(typeChecker);
        this.preprocessor = new Preprocessor(this.resolver, this);
        this.typeChecker = typeChecker;

        this.opsMap[ts.SyntaxKind.EqualsToken] = '=';
        this.opsMap[ts.SyntaxKind.PlusToken] = '+';
        this.opsMap[ts.SyntaxKind.MinusToken] = '-';
        this.opsMap[ts.SyntaxKind.AsteriskToken] = '*';
        this.opsMap[ts.SyntaxKind.PercentToken] = '%';
        this.opsMap[ts.SyntaxKind.AsteriskAsteriskToken] = '__Math.pow';
        this.opsMap[ts.SyntaxKind.SlashToken] = '/';
        this.opsMap[ts.SyntaxKind.AmpersandToken] = '__std::bit_and()';
        this.opsMap[ts.SyntaxKind.BarToken] = '__std::bit_or()';
        this.opsMap[ts.SyntaxKind.CaretToken] = '__std::bit_xor()';
        this.opsMap[ts.SyntaxKind.LessThanLessThanToken] = '__bitwise::lshift';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanToken] = '__bitwise::rshift';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = '__bitwise::rshift_nosign';
        this.opsMap[ts.SyntaxKind.EqualsEqualsToken] = '==';
        this.opsMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
        this.opsMap[ts.SyntaxKind.LessThanToken] = '<';
        this.opsMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
        this.opsMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
        this.opsMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
        this.opsMap[ts.SyntaxKind.GreaterThanToken] = '>';
        this.opsMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';

        this.opsMap[ts.SyntaxKind.PlusEqualsToken] = '+=';
        this.opsMap[ts.SyntaxKind.MinusEqualsToken] = '-=';
        this.opsMap[ts.SyntaxKind.AsteriskEqualsToken] = '*=';
        this.opsMap[ts.SyntaxKind.PercentEqualsToken] = '%=';
        this.opsMap[ts.SyntaxKind.AsteriskAsteriskEqualsToken] = '**=';
        this.opsMap[ts.SyntaxKind.SlashEqualsToken] = '/=';
        this.opsMap[ts.SyntaxKind.AmpersandEqualsToken] = '&=';
        this.opsMap[ts.SyntaxKind.BarEqualsToken] = '|=';
        this.opsMap[ts.SyntaxKind.CaretEqualsToken] = '^=';
        this.opsMap[ts.SyntaxKind.LessThanLessThanEqualsToken] = '<<=';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanEqualsToken] = '>>=';
        this.opsMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken] = '__StrictNotEqualsAssign';

        this.opsMap[ts.SyntaxKind.TildeToken] = '__std::bit_not()';
        this.opsMap[ts.SyntaxKind.ExclamationToken] = '!';
        this.opsMap[ts.SyntaxKind.PlusPlusToken] = '++';
        this.opsMap[ts.SyntaxKind.MinusMinusToken] = '--';
        this.opsMap[ts.SyntaxKind.InKeyword] = '__in';

        this.opsMap[ts.SyntaxKind.AmpersandAmpersandToken] = '&&';
        this.opsMap[ts.SyntaxKind.BarBarToken] = '||';

        this.opsMap[ts.SyntaxKind.CommaToken] = ',';

        // embedded types
        this.embeddedCPPTypes = [
            'bool',
            'char',
            'signed char',
            'unsigned char',
            'short',
            'short int',
            'signed short',
            'signed short int',
            'unsigned short',
            'unsigned short int',
            'int',
            'signed',
            'signed int',
            'unsigned',
            'unsigned int',
            'long',
            'long int',
            'signed long',
            'signed long int',
            'unsigned long',
            'unsigned long int',
            'long long',
            'long long int',
            'signed long long',
            'signed long long int',
            'unsigned long long',
            'unsigned long long int',
            'float',
            'double',
            'long double',
            'int8_t',
            'int16_t',
            'int32_t',
            'int64_t',
            'int_fast8_t',
            'int_fast16_t',
            'int_fast32_t',
            'int_fast64_t',
            'int_least8_t',
            'int_least16_t',
            'int_least32_t',
            'int_least64_t',
            'intmax_t',
            'intptr_t',
            'uint8_t',
            'uint16_t',
            'uint32_t',
            'uint64_t',
            'uint_fast8_t',
            'uint_fast16_t',
            'uint_fast32_t',
            'uint_fast64_t',
            'uint_least8_t',
            'uint_least16_t',
            'uint_least32_t',
            'uint_least64_t',
            'uintmax_t',
            'uintptr_t',
            'wchar_t',
            'char16_t',
            'char32_t',
            'char8_t'
        ];
    }

    public HeaderMode: boolean;
    public SourceMode: boolean;

    public isHeader() {
        return this.HeaderMode;
    }

    public isSource() {
        return this.SourceMode;
    }

    public isHeaderWithSource() {
        return (this.HeaderMode && this.SourceMode) || (!this.HeaderMode && !this.SourceMode);
    }

    public get isGlobalScope() {
        return this.scope.length > 0 && this.scope[this.scope.length - 1].kind === ts.SyntaxKind.SourceFile;
    }

    public printNode(node: ts.Statement): string {
        const sourceFile = ts.createSourceFile(
            'noname', '', ts.ScriptTarget.ES2018, /*setParentNodes */ true, ts.ScriptKind.TS);

        (<any>sourceFile.statements) = [node];

        // debug output
        const emitter = ts.createPrinter({
            newLine: ts.NewLineKind.LineFeed,
        });

        const result = emitter.printNode(ts.EmitHint.SourceFile, sourceFile, sourceFile);
        return result;
    }

    public processNode(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
                this.processFile(<ts.SourceFile>node);
                break;
            case ts.SyntaxKind.Bundle:
                this.processBundle(<ts.Bundle>node);
                break;
            case ts.SyntaxKind.UnparsedSource:
                this.processUnparsedSource(<ts.UnparsedSource>node);
                break;
            default:
                // TODO: finish it
                throw new Error('Method not implemented.');
        }
    }

    isImportStatement(f: ts.Statement | ts.Declaration): boolean {
        if (f.kind === ts.SyntaxKind.ImportDeclaration
            || f.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
            return true;
        }

        return false;
    }

    isDeclarationStatement(f: ts.Statement | ts.Declaration): boolean {
        if (f.kind === ts.SyntaxKind.FunctionDeclaration
            || f.kind === ts.SyntaxKind.EnumDeclaration
            || f.kind === ts.SyntaxKind.ClassDeclaration
            || f.kind === ts.SyntaxKind.InterfaceDeclaration
            || f.kind === ts.SyntaxKind.ModuleDeclaration
            || f.kind === ts.SyntaxKind.NamespaceExportDeclaration
            || f.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            return true;
        }

        return false;
    }

    isVariableStatement(f: ts.Node): boolean {
        if (f.kind === ts.SyntaxKind.VariableStatement) {
            return true;
        }

        return false;
    }

    isNamespaceStatement(f: ts.Node): boolean {
        if (f.kind === ts.SyntaxKind.ModuleDeclaration
            || f.kind === ts.SyntaxKind.NamespaceExportDeclaration) {
            return true;
        }

        return false;
    }

    childrenVisitorNoScope(location: ts.Node, visit: (node: ts.Node) => boolean) {
        function checkChild(node: ts.Node): any {
            if (!visit(node)) {
                ts.forEachChild(node, checkChild);
            }
        }

        ts.forEachChild(location, checkChild);
    }

    childrenVisitor(location: ts.Node, visit: (node: ts.Node) => boolean) {
        let root = true;
        function checkChild(node: ts.Node): any {
            if (root) {
                root = false;
            } else {
                if (node.kind === ts.SyntaxKind.FunctionDeclaration
                    || node.kind === ts.SyntaxKind.ArrowFunction
                    || node.kind === ts.SyntaxKind.MethodDeclaration
                    || node.kind === ts.SyntaxKind.FunctionExpression
                    || node.kind === ts.SyntaxKind.FunctionType
                    || node.kind === ts.SyntaxKind.ClassDeclaration
                    || node.kind === ts.SyntaxKind.ClassExpression) {
                    return;
                }
            }

            if (!visit(node)) {
                ts.forEachChild(node, checkChild);
            }
        }

        ts.forEachChild(location, checkChild);
    }

    hasReturn(location: ts.Node): boolean {
        let hasReturnResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ReturnStatement) {
                hasReturnResult = true;
                return true;
            }

            return false;
        });

        return hasReturnResult;
    }

    hasReturnWithValue(location: ts.Node): boolean {
        let hasReturnResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ReturnStatement) {
                const returnStatement = <ts.ReturnStatement>node;
                if (returnStatement.expression) {
                    hasReturnResult = true;
                    return true;
                }
            }

            return false;
        });

        return hasReturnResult;
    }

    hasPropertyAccess(location: ts.Node, property: string): boolean {
        let hasPropertyAccessResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier && node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const identifier = <ts.Identifier>node;
                if (identifier.text === property) {
                    hasPropertyAccessResult = true;
                    return true;
                }
            }

            return false;
        });

        return hasPropertyAccessResult;
    }

    hasArguments(location: ts.Node): boolean {
        let hasArgumentsResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier && node.parent.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                const identifier = <ts.Identifier>node;
                if (identifier.text === 'arguments') {
                    hasArgumentsResult = true;
                    return true;
                }
            }

            return false;
        });

        return hasArgumentsResult;
    }

    requireCapture(location: ts.Node): boolean {
        let requireCaptureResult = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier
                && node.parent.kind !== ts.SyntaxKind.FunctionDeclaration
                && node.parent.kind !== ts.SyntaxKind.ClassDeclaration
                && node.parent.kind !== ts.SyntaxKind.MethodDeclaration
                && node.parent.kind !== ts.SyntaxKind.EnumDeclaration) {
                const data = this.resolver.isLocal(node);
                if (data) {
                    const isLocal = data[0];
                    if (isLocal !== undefined && !isLocal) {
                        requireCaptureResult = true;
                        return true;
                    }
                }
            }

            return false;
        });

        return requireCaptureResult;
    }

    markRequiredCapture(location: ts.Node): void {
        this.childrenVisitorNoScope(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.Identifier
                && node.parent.kind !== ts.SyntaxKind.FunctionDeclaration
                && node.parent.kind !== ts.SyntaxKind.ClassDeclaration
                && node.parent.kind !== ts.SyntaxKind.MethodDeclaration
                && node.parent.kind !== ts.SyntaxKind.EnumDeclaration) {
                const data = this.resolver.isLocal(node);
                if (data) {
                    const isLocal = data[0];
                    const resolvedSymbol = data[1];
                    if (isLocal !== undefined && !isLocal) {
                        (<any>resolvedSymbol).valueDeclaration.__requireCapture = true;
                    }
                }
            }

            return false;
        });
    }

    hasThis(location: ts.Node): boolean {
        let createThis = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ThisKeyword) {
                createThis = true;
                return true;
            }

            return false;
        });

        return createThis;
    }

    hasThisAsShared(location: ts.Node): boolean {
        let createThis = false;
        this.childrenVisitor(location, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ThisKeyword && node.parent.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                createThis = true;
                return true;
            }

            return false;
        });

        return createThis;
    }

    processFile(sourceFile: ts.SourceFile): void {
        this.scope.push(sourceFile);
        this.processFileInternal(sourceFile);
        this.scope.pop();
    }

    processFileInternal(sourceFile: ts.SourceFile): void {
        this.fixupParentReferences(sourceFile);

        this.sourceFileName = sourceFile.fileName;


        if (this.isHeader()) {
            // added header
            this.WriteHeader();

            sourceFile.referencedFiles.forEach(f => {
                this.writer.writeString('#include \"');
                this.writer.writeString(f.fileName.replace('.d.ts', ''));
                this.writer.writeStringNewLine('.h\"');
            });

            sourceFile.statements.filter(s => this.isImportStatement(s)).forEach(s => {
                this.processInclude(s);
            });

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine('');

            const position = this.writer.newSection();

            sourceFile.statements.filter(s => this.isDeclarationStatement(s)).forEach(s => {
                this.processInclude(s);
            });

            sourceFile.statements.filter(s => this.isDeclarationStatement(s)).forEach(s => {
                this.processForwardDeclaration(s);
            });

            if (this.writer.hasAnyContent(position)) {
                this.writer.writeStringNewLine();
            }

            sourceFile.statements
                .map(v => this.preprocessor.preprocessStatement(v))
                .filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s))
                .forEach(s => {
                    if (this.isVariableStatement(s)) {
                        this.processForwardDeclaration(s);
                    } else {
                        this.processStatement(s);
                    }
                });

            sourceFile.statements.filter(s => this.isDeclarationStatement(s) || this.isVariableStatement(s)).forEach(s => {
                this.processImplementation(s, true);
            });

            const newName = path.relative('./src', this.sourceFileName).split(/ |\\|\/|\.|\-/).join('_');
            this.writer.writeStringNewLine(`const struct ${newName} {${newName}();} _${newName};`);
        }

        if (this.isSource()) {
            // added header
            this.WriteHeader();

            sourceFile.statements.filter(s => this.isImportStatement(s)).forEach(s => {
                this.processImplementation(s);
            });

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine('');

            sourceFile.statements.filter(s => this.isDeclarationStatement(s)).forEach(s => {
                this.processImplementation(s);
            });

            const positionBeforeVars = this.writer.newSection();

            sourceFile.statements
                .map(v => this.preprocessor.preprocessStatement(v))
                .filter(s => this.isVariableStatement(s)
                    || this.isNamespaceStatement(s))
                .forEach(s => {
                    if (this.isNamespaceStatement(s)) {
                        this.isWritingMain = true;
                        this.processModuleVariableStatements(<ts.ModuleDeclaration>s);
                        this.isWritingMain = false;
                    } else {
                        this.processStatement(<ts.Statement>s);
                    }
                });

            const hasVarsContent = this.writer.hasAnyContent(positionBeforeVars);

            const rollbackPosition = this.writer.newSection();

            const newName = path.relative('./src', this.sourceFileName).split(/ |\\|\/|\.|\-/).join('_');

            this.writer.writeStringNewLine('');
            this.writer.writeStringNewLine(`${newName}::${newName}()`);
            this.writer.BeginBlock();

            this.isWritingMain = true;

            const position = this.writer.newSection();

            sourceFile.statements.filter(s => !this.isDeclarationStatement(s) && !this.isVariableStatement(s)
                || this.isNamespaceStatement(s)).forEach(s => {
                if (this.isNamespaceStatement(s)) {
                    this.processModuleImplementationInMain(<ts.ModuleDeclaration>s);
                } else {
                    this.processStatement(s);
                }
            });

            this.isWritingMain = false;

            // TODO: Replace this true check with not writing this in the header either.
            if (true || hasVarsContent || this.writer.hasAnyContent(position, rollbackPosition)) {
                this.writer.EndBlock();

                this.writer.writeStringNewLine('');
            }
        }

        if (this.isHeader()) {
            // end of header
            this.writer.writeStringNewLine(`#endif`);
        }
    }

    WriteHeader() {
        const filePath = Helpers.getSubPath(Helpers.cleanUpPath(this.sourceFileName), Helpers.cleanUpPath(this.rootFolder));
        if (this.isSource()) {
            // @tswow-begin
            const hfile = path.basename(this.sourceFileName);
            const includeStr = `#include "${hfile.replace(/\.ts$/, '.h')}"`;
            // @tswow-end
            this.writer.writeStringNewLine(includeStr);
        } else {
            const headerName = filePath.replace(/\.ts$/, '_h').replace(/[\\\/\.\-]/g, '_').toUpperCase();
            this.writer.writeStringNewLine(`#ifndef ${headerName}`);
            this.writer.writeStringNewLine(`#define ${headerName}`);
            this.writer.writeStringNewLine(`#include "TSAll.h"`);
        }
    }

    processBundle(bundle: ts.Bundle): void {
        throw new Error('Method not implemented.');
    }

    processUnparsedSource(unparsedSource: ts.UnparsedSource): void {
        throw new Error('Method not implemented.');
    }

    processStatement(node: ts.Statement | ts.Declaration): void {
        this.processStatementInternal(node);
    }

    processStatementInternal(nodeIn: ts.Statement | ts.Declaration, enableTypeAliases = false): void {
        const node = this.preprocessor.preprocessStatement(nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.EmptyStatement: return;
            case ts.SyntaxKind.VariableStatement: this.processVariableStatement(<ts.VariableStatement>node); return;
            case ts.SyntaxKind.FunctionDeclaration: this.processFunctionDeclaration(<ts.FunctionDeclaration>node); return;
            case ts.SyntaxKind.Block: this.processBlock(<ts.Block>node); return;
            case ts.SyntaxKind.ModuleBlock: this.processModuleBlock(<ts.ModuleBlock>node); return;
            case ts.SyntaxKind.ReturnStatement: this.processReturnStatement(<ts.ReturnStatement>node); return;
            case ts.SyntaxKind.IfStatement: this.processIfStatement(<ts.IfStatement>node); return;
            case ts.SyntaxKind.DoStatement: this.processDoStatement(<ts.DoStatement>node); return;
            case ts.SyntaxKind.WhileStatement: this.processWhileStatement(<ts.WhileStatement>node); return;
            case ts.SyntaxKind.ForStatement: this.processForStatement(<ts.ForStatement>node); return;
            case ts.SyntaxKind.ForInStatement: this.processForInStatement(<ts.ForInStatement>node); return;
            case ts.SyntaxKind.ForOfStatement: this.processForOfStatement(<ts.ForOfStatement>node); return;
            case ts.SyntaxKind.BreakStatement: this.processBreakStatement(<ts.BreakStatement>node); return;
            case ts.SyntaxKind.ContinueStatement: this.processContinueStatement(<ts.ContinueStatement>node); return;
            case ts.SyntaxKind.SwitchStatement: this.processSwitchStatement(<ts.SwitchStatement>node); return;
            case ts.SyntaxKind.ExpressionStatement: this.processExpressionStatement(<ts.ExpressionStatement>node); return;
            case ts.SyntaxKind.TryStatement: this.processTryStatement(<ts.TryStatement>node); return;
            case ts.SyntaxKind.ThrowStatement: this.processThrowStatement(<ts.ThrowStatement>node); return;
            case ts.SyntaxKind.DebuggerStatement: this.processDebuggerStatement(<ts.DebuggerStatement>node); return;
            case ts.SyntaxKind.EnumDeclaration: this.processEnumDeclaration(<ts.EnumDeclaration>node); return;
            case ts.SyntaxKind.ClassDeclaration: this.processClassDeclaration(<ts.ClassDeclaration>node); return;
            case ts.SyntaxKind.InterfaceDeclaration: this.processClassDeclaration(<ts.InterfaceDeclaration>node); return;
            case ts.SyntaxKind.ExportDeclaration: this.processExportDeclaration(<ts.ExportDeclaration>node); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleDeclaration(<ts.ModuleDeclaration>node); return;
            case ts.SyntaxKind.NamespaceExportDeclaration: this.processNamespaceDeclaration(<ts.NamespaceDeclaration>node); return;
            case ts.SyntaxKind.LabeledStatement: this.processLabeledStatement(<ts.LabeledStatement>node); return;
            case ts.SyntaxKind.ImportEqualsDeclaration: /*this.processImportEqualsDeclaration(<ts.ImportEqualsDeclaration>node);*/ return;
            case ts.SyntaxKind.ImportDeclaration:
                /*done in forward declaration*/ /*this.processImportDeclaration(<ts.ImportDeclaration>node);*/ return;
            case ts.SyntaxKind.TypeAliasDeclaration:
                /*done in forward Declaration*/
                if (enableTypeAliases) {
                    this.processTypeAliasDeclaration(<ts.TypeAliasDeclaration>node);
                }

                return;
            case ts.SyntaxKind.ExportAssignment: /*nothing to do*/ return;
        }

        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    processExpression(nodeIn: ts.Expression): void {
        const node = this.preprocessor.preprocessExpression(nodeIn);
        if (!node) {
            return;
        }

        // special null/undefined handler, sometimes read as "Identifier"
        try { // <-- hackfix, i don't know what causes this to fail
            if((node.getText() === 'undefined' || node.getText() == 'null')) {
                this.writer.writeString('TSNull()')
                return;
            }
        } catch(error) {}

        // we need to process it for statements only
        //// this.functionContext.code.setNodeToTrackDebugInfo(node, this.sourceMapGenerator);

        switch (node.kind) {
            case ts.SyntaxKind.NewExpression: this.processNewExpression(<ts.NewExpression>node); return;
            case ts.SyntaxKind.CallExpression: this.processCallExpression(<ts.CallExpression>node); return;
            case ts.SyntaxKind.PropertyAccessExpression: this.processPropertyAccessExpression(<ts.PropertyAccessExpression>node); return;
            case ts.SyntaxKind.PrefixUnaryExpression: this.processPrefixUnaryExpression(<ts.PrefixUnaryExpression>node); return;
            case ts.SyntaxKind.PostfixUnaryExpression: this.processPostfixUnaryExpression(<ts.PostfixUnaryExpression>node); return;
            case ts.SyntaxKind.BinaryExpression: this.processBinaryExpression(<ts.BinaryExpression>node); return;
            case ts.SyntaxKind.ConditionalExpression: this.processConditionalExpression(<ts.ConditionalExpression>node); return;
            case ts.SyntaxKind.DeleteExpression: this.processDeleteExpression(<ts.DeleteExpression>node); return;
            case ts.SyntaxKind.TypeOfExpression: this.processTypeOfExpression(<ts.TypeOfExpression>node); return;
            case ts.SyntaxKind.FunctionExpression: this.processFunctionExpression(<ts.FunctionExpression>node); return;
            case ts.SyntaxKind.ArrowFunction: this.processArrowFunction(<ts.ArrowFunction>node); return;
            case ts.SyntaxKind.ElementAccessExpression: this.processElementAccessExpression(<ts.ElementAccessExpression>node); return;
            case ts.SyntaxKind.ParenthesizedExpression: this.processParenthesizedExpression(<ts.ParenthesizedExpression>node); return;
            case ts.SyntaxKind.TypeAssertionExpression: this.processTypeAssertionExpression(<ts.TypeAssertion>node); return;
            case ts.SyntaxKind.VariableDeclarationList: this.processVariableDeclarationList(<ts.VariableDeclarationList><any>node); return;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword: this.processBooleanLiteral(<ts.BooleanLiteral>node); return;
            case ts.SyntaxKind.NumericLiteral: this.processNumericLiteral(<ts.NumericLiteral>node); return;
            case ts.SyntaxKind.StringLiteral: this.processStringLiteral(<ts.StringLiteral>node); return;
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                this.processNoSubstitutionTemplateLiteral(<ts.NoSubstitutionTemplateLiteral>node); return;
            case ts.SyntaxKind.ObjectLiteralExpression: this.processObjectLiteralExpression(<ts.ObjectLiteralExpression>node); return;
            case ts.SyntaxKind.TemplateExpression: this.processTemplateExpression(<ts.TemplateExpression>node); return;
            case ts.SyntaxKind.ArrayLiteralExpression: this.processArrayLiteralExpression(<ts.ArrayLiteralExpression>node); return;
            case ts.SyntaxKind.RegularExpressionLiteral: this.processRegularExpressionLiteral(<ts.RegularExpressionLiteral>node); return;
            case ts.SyntaxKind.ThisKeyword: this.processThisExpression(<ts.ThisExpression>node); return;
            case ts.SyntaxKind.SuperKeyword: this.processSuperExpression(<ts.SuperExpression>node); return;
            case ts.SyntaxKind.VoidExpression: this.processVoidExpression(<ts.VoidExpression>node); return;
            case ts.SyntaxKind.NonNullExpression: this.processNonNullExpression(<ts.NonNullExpression>node); return;
            case ts.SyntaxKind.AsExpression: this.processAsExpression(<ts.AsExpression>node); return;
            case ts.SyntaxKind.SpreadElement: this.processSpreadElement(<ts.SpreadElement>node); return;
            case ts.SyntaxKind.AwaitExpression: this.processAwaitExpression(<ts.AwaitExpression>node); return;
            case ts.SyntaxKind.Identifier: this.processIdentifier(<ts.Identifier>node); return;
            case ts.SyntaxKind.ComputedPropertyName: this.processComputedPropertyName(<ts.ComputedPropertyName><any>node); return;
        }

        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    processDeclaration(node: ts.Declaration): void {
        switch (node.kind) {
            case ts.SyntaxKind.PropertySignature: this.processPropertyDeclaration(<ts.PropertySignature>node); return;
            case ts.SyntaxKind.PropertyDeclaration: this.processPropertyDeclaration(<ts.PropertyDeclaration>node); return;
            case ts.SyntaxKind.Parameter: this.processPropertyDeclaration(<ts.ParameterDeclaration>node); return;
            case ts.SyntaxKind.MethodSignature: this.processMethodDeclaration(<ts.MethodSignature>node); return;
            case ts.SyntaxKind.MethodDeclaration: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.ConstructSignature: this.processMethodDeclaration(<ts.ConstructorDeclaration>node); return;
            case ts.SyntaxKind.Constructor: this.processMethodDeclaration(<ts.ConstructorDeclaration>node); return;
            case ts.SyntaxKind.SetAccessor: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.GetAccessor: this.processMethodDeclaration(<ts.MethodDeclaration>node); return;
            case ts.SyntaxKind.FunctionDeclaration: this.processFunctionDeclaration(<ts.FunctionDeclaration>node); return;
            case ts.SyntaxKind.IndexSignature: /*TODO: index*/ return;
            case ts.SyntaxKind.SemicolonClassElement: /*TODO: index*/ return;
        }

        // TODO: finish it
        throw new Error('Method not implemented.');
    }

    processInclude(nodeIn: ts.Declaration | ts.Statement): void {

        const node = this.preprocessor.preprocessStatement(<ts.Statement>nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.TypeAliasDeclaration: this.processTypeAliasDeclaration(<ts.TypeAliasDeclaration>node); return;
            case ts.SyntaxKind.ImportDeclaration: this.processImportDeclaration(<ts.ImportDeclaration>node); return;
            default:
                return;
        }
    }

    processForwardDeclaration(nodeIn: ts.Declaration | ts.Statement): void {

        const node = this.preprocessor.preprocessStatement(<ts.Statement>nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement: this.processVariablesForwardDeclaration(<ts.VariableStatement>node); return;
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration: this.processClassForwardDeclaration(<ts.ClassDeclaration>node); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleForwardDeclaration(<ts.ModuleDeclaration>node); return;
            case ts.SyntaxKind.EnumDeclaration: this.processEnumForwardDeclaration(<ts.EnumDeclaration>node); return;
            default:
                return;
        }
    }

    public isTemplate(declaration:
        ts.MethodDeclaration | ts.ConstructorDeclaration | ts.ClassDeclaration
        | ts.FunctionDeclaration | ts.FunctionExpression) {
        if (!declaration) {
            return false;
        }

        if (declaration.typeParameters && declaration.typeParameters.length > 0) {
            return true;
        }

        if (this.isMethodParamsTemplate(declaration)) {
            return true;
        }

        if (this.isClassMemberDeclaration(declaration)) {
            if (declaration.parent && declaration.parent.kind === ts.SyntaxKind.ClassDeclaration) {
                return this.isTemplate(<any>declaration.parent);
            }
        }

        return false;
    }

    isTemplateType(effectiveType: any): boolean {
        if (!effectiveType) {
            return false;
        }

        if (effectiveType.kind === ts.SyntaxKind.UnionType) {
            return this.resolver.checkUnionType(effectiveType);
        }

        if (effectiveType.typeName && effectiveType.typeName.text === 'ArrayLike') {
            return true;
        }

        if (effectiveType.typeArguments && effectiveType.typeArguments.length > 0) {
            if (effectiveType.typeArguments.some(t => this.isTemplateType(t))) {
                return true;
            }
        }

        if (effectiveType.kind === ts.SyntaxKind.FunctionType
            && this.resolver.isTypeParameter(effectiveType.type)) {
            return true;
        }

        if (this.resolver.isTypeAliasUnionType(effectiveType.typeName)) {
            return true;
        }
    }

    isMethodParamsTemplate(declaration: ts.MethodDeclaration | any): boolean {
        if (!declaration) {
            return false;
        }

        // if method has union type, it should be treated as generic method
        if (!this.isClassMemberDeclaration(declaration)
            && declaration.kind !== ts.SyntaxKind.FunctionDeclaration) {
            return false;
        }

        if (this.isTemplateType(declaration.type)) {
            return true;
        }

        for (const element of declaration.parameters) {
            if (element.dotDotDotToken || this.isTemplateType(element.type)) {
                return true;
            }
        }
    }

    processImplementation(nodeIn: ts.Declaration | ts.Statement, template?: boolean): void {

        const node = this.preprocessor.preprocessStatement(nodeIn);

        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration: this.processClassImplementation(<ts.ClassDeclaration>node, template); return;
            case ts.SyntaxKind.ModuleDeclaration: this.processModuleImplementation(<ts.ModuleDeclaration>node, template); return;
            case ts.SyntaxKind.PropertyDeclaration:
                if (!template && this.isStatic(node)) {
                    this.processPropertyDeclaration(<ts.PropertyDeclaration>node, true);
                }

                return;
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
                if ((template && this.isTemplate(<ts.MethodDeclaration>node))
                    || (!template && !this.isTemplate(<ts.MethodDeclaration>node))) {
                    this.processMethodDeclaration(<ts.MethodDeclaration>node, true);
                }

                return;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                if (!template) {
                    this.processImportEqualsDeclaration(<ts.ImportEqualsDeclaration>node);
                }

                return;
            default:
                return;
        }
    }

    processModuleImplementation(node: ts.ModuleDeclaration, template?: boolean) {
        this.scope.push(node);
        this.processModuleImplementationInternal(node, template);
        this.scope.pop();
    }

    processModuleImplementationInternal(node: ts.ModuleDeclaration, template?: boolean) {
        this.writer.writeString('namespace ');
        this.writer.writeString(node.name.text);
        this.writer.writeString(' ');
        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(element => {
                this.processImplementation(element, template);
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleImplementation(node.body, template);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    processClassImplementation(node: ts.ClassDeclaration, template?: boolean) {
        this.scope.push(node);
        this.processClassImplementationInternal(node, template);
        this.scope.pop();
    }

    processClassImplementationInternal(node: ts.ClassDeclaration, template?: boolean) {
        if(this.isSource()) {
            handleClassImpl(node,this.writer)
        }
        for (const member of node.members) {
            this.processImplementation(member, template);
        }
    }

    processExpressionStatement(node: ts.ExpressionStatement): void {
        this.processExpression(node.expression);
        this.writer.EndOfStatement();
    }

    fixupParentReferences<T extends ts.Node>(rootNode: T, setParent?: ts.Node): T {
        let parent: ts.Node = rootNode;
        if (setParent) {
            (rootNode as any).parent = setParent;
        }

        ts.forEachChild(rootNode, visitNode);

        return rootNode;

        function visitNode(n: ts.Node): void {
            // walk down setting parents that differ from the parent we think it should be.  This
            // allows us to quickly bail out of setting parents for sub-trees during incremental
            // parsing
            if (n.parent !== parent) {
                (n as any).parent = parent;

                const saveParent = parent;
                parent = n;
                ts.forEachChild(n, visitNode);

                parent = saveParent;
            }
        }
    }

    transpileTSNode(node: ts.Node, transformText?: (string) => string) {
        return this.transpileTSCode(node.getFullText(), transformText);
    }

    transpileTSCode(code: string, transformText?: (string) => string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const result = ts.transpileModule(code, { compilerOptions: opts });

        let jsText = result.outputText;
        if (transformText) {
            jsText = transformText(jsText);
        }

        return this.parseJSCode(jsText);
    }

    parseTSCode(jsText: string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile(
            this.sourceFileName, jsText, ts.ScriptTarget.ES5, /*setParentNodes */ true, ts.ScriptKind.TS);
        // needed to make typeChecker to work properly
        (<any>ts).bindSourceFile(sourceFile, opts);
        return sourceFile.statements;
    }

    bind(node: ts.Statement) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile(
            this.sourceFileName, '', ts.ScriptTarget.ES5, /*setParentNodes */ true, ts.ScriptKind.TS);

        (<any>sourceFile.statements) = [node];

        (<any>ts).bindSourceFile(sourceFile, opts);

        return sourceFile.statements[0];
    }

    parseJSCode(jsText: string) {

        const opts = {
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false,
            noImplicitUseStrict: true,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            target: ts.ScriptTarget.ES5
        };

        const sourceFile = ts.createSourceFile('partial', jsText, ts.ScriptTarget.ES5, /*setParentNodes */ true);
        this.fixupParentReferences(sourceFile);
        // needed to make typeChecker to work properly
        (<any>ts).bindSourceFile(sourceFile, opts);
        return sourceFile.statements;
    }

    processTSNode(node: ts.Node, transformText?: (string) => string) {
        const statements = this.transpileTSNode(node, transformText);

        if (statements && statements.length === 1 && (<any>statements[0]).expression) {
            this.processExpression((<any>statements[0]).expression);
            return;
        }

        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    processTSCode(code: string, parse?: any) {
        const statements = (!parse) ? this.transpileTSCode(code) : this.parseTSCode(code);
        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    processJSCode(code: string) {
        const statements = this.parseJSCode(code);
        statements.forEach(s => {
            this.processStatementInternal(s);
        });
    }

    processLabeledStatement(node: ts.LabeledStatement): void {
        this.processExpression(node.label);
        this.writer.writeStringNewLine(':');
        this.processStatement(node.statement);
    }

    processTryStatement(node: ts.TryStatement): void {
        let anyCase = false;

        if (node.finallyBlock) {
            this.writer.BeginBlock();

            const finallyName = `__finally${node.finallyBlock.getFullStart()}_${node.finallyBlock.getEnd()}`;
            this.writer.writeString(`utils::finally ${finallyName}(`);

            const newArrowFunctions =
                ts.createArrowFunction(
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    node.finallyBlock);

            (<any>newArrowFunctions).__lambda_by_reference = true;

            this.processFunctionExpression(newArrowFunctions);

            this.writer.cancelNewLine();
            this.writer.writeString(')');
            this.writer.EndOfStatement();
        }

        this.writer.writeStringNewLine('try');
        this.writer.BeginBlock();

        node.tryBlock.statements.forEach(element => this.processStatement(element));

        this.writer.EndBlock();

        if (node.catchClause) {
            this.writer.writeString('catch (const ');
            if (node.catchClause.variableDeclaration.type) {
                this.processType(node.catchClause.variableDeclaration.type);
            } else {
                this.error(
                      `Unable to resolve type of catch value, `
                    + `try writing it out explicitly`
                    , node)
            }

            this.writer.writeString('& ');

            if (node.catchClause.variableDeclaration.name.kind === ts.SyntaxKind.Identifier) {
                this.processVariableDeclarationOne(
                    <ts.Identifier>(node.catchClause.variableDeclaration.name),
                    node.catchClause.variableDeclaration.initializer,
                    node.catchClause.variableDeclaration.type);
            } else {
                throw new Error('Method not implemented.');
            }

            this.writer.writeStringNewLine(')');
            this.processStatement(node.catchClause.block);

            anyCase = true;
        }

        if (!anyCase) {
            this.writer.writeStringNewLine('catch (...)');
            this.writer.BeginBlock();
            this.writer.writeString('throw');
            this.writer.EndOfStatement();
            this.writer.EndBlock();
        }

        if (node.finallyBlock) {
            this.writer.EndBlock();
        }
    }

    processThrowStatement(node: ts.ThrowStatement): void {
        this.writer.writeString('throw');
        if (node.expression) {
            this.writer.writeString(' any(');
            this.processExpression(node.expression);
            this.writer.writeString(')');
        }

        this.writer.EndOfStatement();
    }

    processTypeOfExpression(node: ts.TypeOfExpression): void {
        this.writer.writeString('type_of(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    processDebuggerStatement(node: ts.DebuggerStatement): void {
        this.writer.writeString('__asm { int 3 }');
    }

    processEnumForwardDeclaration(node: ts.EnumDeclaration): void {
        this.scope.push(node);
        this.processEnumForwardDeclarationInternal(node);
        this.scope.pop();
    }

    processEnumForwardDeclarationInternal(node: ts.EnumDeclaration): void {

        if (!this.isHeader()) {
            return;
        }

        this.writer.writeString('enum struct ');
        this.processIdentifier(node.name);
        this.writer.EndOfStatement();
    }

    processEnumDeclaration(node: ts.EnumDeclaration): void {
        this.scope.push(node);
        this.processEnumDeclarationInternal(node);
        this.scope.pop();
    }

    processEnumDeclarationInternal(node: ts.EnumDeclaration): void {

        if (!this.isHeader()) {
            return;
        }

        /*
        const properties = [];
        let value = 0;
        for (const member of node.members) {
            if (member.initializer) {
                switch (member.initializer.kind) {
                    case ts.SyntaxKind.NumericLiteral:
                        value = parseInt((<ts.NumericLiteral>member.initializer).text, 10);
                        break;
                    default:
                        throw new Error('Not Implemented');
                }
            } else {
                value++;
            }

            const namedProperty = ts.createPropertyAssignment(
                member.name,
                ts.createNumericLiteral(value.toString()));

            const valueProperty = ts.createPropertyAssignment(
                ts.createNumericLiteral(value.toString()),
                ts.createStringLiteral((<ts.Identifier>member.name).text));

            properties.push(namedProperty);
            properties.push(valueProperty);
        }

        const enumLiteralObject = ts.createObjectLiteral(properties);
        const varDecl = ts.createVariableDeclaration(node.name, undefined, enumLiteralObject);
        const enumDeclare = ts.createVariableStatement([], [varDecl]);

        this.processStatement(this.fixupParentReferences(enumDeclare, node));
        */

        this.writer.writeString('enum struct ');
        this.processIdentifier(node.name);
        this.writer.writeString(' ');
        this.writer.BeginBlock();

        let next = false;
        for (const member of node.members) {
            if (next) {
                this.writer.writeString(', ');
            }

            if (member.name.kind === ts.SyntaxKind.Identifier) {
                this.processExpression(member.name);
            } else {
                throw new Error('Not Implemented');
            }

            if (member.initializer) {
                this.writer.writeString(' = ');
                this.processExpression(member.initializer);
            }

            next = true;
        }

        this.writer.EndBlock();
        this.writer.EndOfStatement();
    }

    hasAccessModifier(modifiers: ts.ModifiersArray) {
        if (!modifiers) {
            return false;
        }

        return modifiers
            .some(m => m.kind === ts.SyntaxKind.PrivateKeyword
                || m.kind === ts.SyntaxKind.ProtectedKeyword
                || m.kind === ts.SyntaxKind.PublicKeyword);
    }

    processVariablesForwardDeclaration(node: ts.VariableStatement) {
        this.processVariableDeclarationList(node.declarationList, true);

        this.writer.EndOfStatement();
    }

    processClassForwardDeclaration(node: ts.ClassDeclaration) {
        this.scope.push(node);
        this.processClassForwardDeclarationInternal(node);
        this.scope.pop();

        this.writer.EndOfStatement();
    }

    processClassForwardDeclarationInternal(node: ts.ClassDeclaration | ts.InterfaceDeclaration) {
        let next = false;
        if (node.typeParameters) {
            this.writer.writeString('template <');
            node.typeParameters.forEach(type => {
                if (next) {
                    this.writer.writeString(', ');
                }
                this.processType(type);
                next = true;
            });
            this.writer.writeStringNewLine('>');
        }
        this.writer.writeString('class ');
        this.processIdentifier(node.name);
    }

    processModuleForwardDeclaration(node: ts.ModuleDeclaration, template?: boolean) {
        this.scope.push(node);
        this.processModuleForwardDeclarationInternal(node, template);
        this.scope.pop();
    }

    processModuleForwardDeclarationInternal(node: ts.ModuleDeclaration, template?: boolean) {
        this.writer.writeString('namespace ');
        this.writer.writeString(node.name.text);
        this.writer.writeString(' ');
        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(element => {
                this.processForwardDeclaration(element);
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleForwardDeclaration(node.body, template);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    isInBaseClass(baseClass: ts.TypeNode, identifier: ts.Identifier): boolean {

        const effectiveSymbol = (<any>baseClass).symbol || ((<any>baseClass).exprName).symbol;

        if (!effectiveSymbol
            || !effectiveSymbol.valueDeclaration
            || !effectiveSymbol.valueDeclaration.heritageClauses) {
            return false;
        }

        const hasInBase = effectiveSymbol.valueDeclaration
            .heritageClauses.some(hc => hc.types.some(t => t.expression.text === identifier.text));

        return hasInBase;
    }

    processClassDeclaration(node: ts.ClassDeclaration | ts.InterfaceDeclaration) {
        this.scope.push(node);
        this.processClassDeclarationInternal(node);
        this.scope.pop();
    }

    processClassDeclarationInternal(node: ts.ClassDeclaration | ts.InterfaceDeclaration): void {
        if (!this.isHeader()) {
            return;
        }

        this.processClassForwardDeclarationInternal(node);

        let next = false;
        if (node.heritageClauses) {
            let baseClass;
            node.heritageClauses.forEach(heritageClause => {
                heritageClause.types.forEach(type => {
                    if (type.expression.kind === ts.SyntaxKind.Identifier) {
                        const identifier = <ts.Identifier>type.expression;

                        if (baseClass && this.isInBaseClass(baseClass, identifier)) {
                            return;
                        }

                        if (!baseClass) {
                            baseClass = this.resolver.getOrResolveTypeOfAsTypeNode(identifier);
                        }

                        if (next) {
                            this.writer.writeString(', ');
                        } else {
                            this.writer.writeString(' : ');
                        }

                        this.writer.writeString('public ');
                        this.writer.writeString(identifier.text);
                        this.processTemplateArguments(type, true);
                        // @tswow-end

                        next = true;
                    } else {
                        /* TODO: finish xxx.yyy<zzz> */
                    }

                });
            });
        } else {
            this.writer.writeString(' : public TSClass');
        }

        this.writer.writeString(', public std::enable_shared_from_this<');
        this.processIdentifier(node.name);
        this.processTemplateParameters(<ts.ClassDeclaration>node);
        this.writer.writeString('>');

        this.writer.writeString(' ');
        this.writer.BeginBlock();
        this.writer.DecreaseIntent();
        this.writer.writeString('public:');
        this.writer.IncreaseIntent();
        this.writer.writeStringNewLine();

        this.writer.writeString('using std::enable_shared_from_this<');
        this.processIdentifier(node.name);
        this.processTemplateParameters(<ts.ClassDeclaration>node);
        this.writer.writeStringNewLine('>::shared_from_this;');

        /*
        if (!node.heritageClauses) {
            // to make base class polymorphic
            this.writer.writeStringNewLine('virtual void dummy() {};');
        }
        */

        // declare all private parameters of constructors
        for (const constructor of <ts.ConstructorDeclaration[]>(<ts.ClassDeclaration>node)
            .members.filter(m => m.kind === ts.SyntaxKind.Constructor)) {
            for (const fieldAsParam of constructor.parameters.filter(p => this.hasAccessModifier(p.modifiers))) {
                this.processDeclaration(fieldAsParam);
            }
        }

        const propertyWithThis = (m: ts.Node) => {
            return m.kind === ts.SyntaxKind.PropertyDeclaration && this.hasThis(m);
        };

        for (const member of (<any[]><any>node.members).filter(m => !propertyWithThis(m))) {
            this.processDeclaration(member);
        }

        for (const member of (<any[]><any>node.members).filter(m => propertyWithThis(m))) {
            this.processDeclaration(member);
        }

        this.writer.cancelNewLine();
        this.writer.cancelNewLine();

        // @tswow-begin
        if(node.kind === ts.SyntaxKind.ClassDeclaration) {
            handleClass(node,this.writer);
            generateStringify(node, this.writer);
        }
        // @tswow-end

        this.writer.EndBlock();
        this.writer.EndOfStatement();

        this.writer.writeStringNewLine();

        if (node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
            this.writer.writeString('using _default = ');
            this.processIdentifier(node.name);
            this.processTemplateParameters(<ts.ClassDeclaration>node);
            this.writer.writeStringNewLine(';');
        }
    }

    processPropertyDeclaration(node: ts.PropertyDeclaration | ts.PropertySignature | ts.ParameterDeclaration,
        implementationMode?: boolean): void {
        if (!implementationMode) {
            this.processModifiers(node.modifiers);
        }

        const effectiveType = node.type
            || this.resolver.getOrResolveTypeOfAsTypeNode(node.initializer);
        this.processPredefineType(effectiveType);
        this.processType(effectiveType);
        this.writer.writeString(' ');

        if (node.name.kind === ts.SyntaxKind.Identifier) {
            if (implementationMode) {
                // write class name
                const classNode = this.scope[this.scope.length - 1];
                if (classNode.kind === ts.SyntaxKind.ClassDeclaration) {
                    this.writer.writeString((<ts.ClassDeclaration>classNode).name.text);
                    this.writer.writeString('::');
                } else {
                    throw new Error('Not Implemented');
                }
            }

            this.processExpression(node.name);
        } else {
            throw new Error('Not Implemented');
        }

        const isStatic = this.isStatic(node);
        if (node.initializer && (implementationMode && isStatic || !isStatic)) {
            this.writer.writeString(' = ');
            this.processExpression(node.initializer);
        }

        this.writer.EndOfStatement();

        this.writer.writeStringNewLine();
    }

    processMethodDeclaration(node: ts.MethodDeclaration | ts.MethodSignature | ts.ConstructorDeclaration,
        implementationMode?: boolean): void {
        const skip = this.processFunctionDeclaration(<ts.FunctionDeclaration><any>node, implementationMode);
        if (implementationMode) {
            if (!skip) {
                this.writer.writeStringNewLine();
            }
        } else {
            this.writer.EndOfStatement();
        }
    }

    processModifiers(modifiers: ts.NodeArray<ts.Modifier>) {
        if (!modifiers) {
            return;
        }

        modifiers.forEach(modifier => {
            switch (modifier.kind) {
                case ts.SyntaxKind.StaticKeyword:
                    this.writer.writeString('static ');
                    break;
            }
        });
    }

    processTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {

        if (node.type.kind === ts.SyntaxKind.ImportType) {
            const typeLiteral = <ts.ImportTypeNode>node.type;
            const argument = typeLiteral.argument;
            if (argument.kind === ts.SyntaxKind.LiteralType) {
                const literal = <ts.LiteralTypeNode>argument;
                this.writer.writeString('#include \"');
                this.writer.writeString((<any>literal.literal).text);
                this.writer.writeStringNewLine('.h\"');
            } else {
                throw new Error('Not Implemented');
            }

            return;
        }

        const name = node.name.text;
        // remove NULL from union types, do we need to remove "undefined" as well?
        let type = node.type;
        if (type.kind === ts.SyntaxKind.AnyKeyword
            || type.kind === ts.SyntaxKind.NumberKeyword && this.embeddedCPPTypes.some((e) => e === name)) {
            return;
        }

        this.processPredefineType(type);

        if (node.type.kind === ts.SyntaxKind.UnionType) {
            const unionType = <ts.UnionTypeNode>type;
            const filtered = unionType.types.filter(t => t.kind !== ts.SyntaxKind.NullKeyword && t.kind !== ts.SyntaxKind.UndefinedKeyword);
            if (filtered.length === 1) {
                type = filtered[0];
            }
        } else if (node.type.kind === ts.SyntaxKind.ConditionalType) {
            const conditionType = <ts.ConditionalTypeNode>type;
            type = conditionType.checkType;
        } else if (node.type.kind === ts.SyntaxKind.MappedType) {
            if (node.typeParameters && node.typeParameters[0]) {
                type = <any>{ kind: ts.SyntaxKind.TypeParameter, name: ts.createIdentifier((<any>(node.typeParameters[0])).symbol.name) };
            }
        }

        if (node.typeParameters) {
            this.processTemplateParams(node);
            this.writer.writeString('using ');
            this.processExpression(node.name);
            this.writer.writeString(' = ');
            this.processType(type, false, true, true);
        } else {
            // default typedef
            this.writer.writeString('typedef ');
            this.processType(type, false, true, true);
            this.writer.writeString(' ');
            this.processExpression(node.name);
        }

        this.writer.EndOfStatement();
        this.writer.writeStringNewLine();
    }

    processModuleDeclaration(node: ts.ModuleDeclaration): void {
        this.writer.writeString('namespace ');
        this.processExpression(node.name);
        this.writer.writeString(' ');

        this.writer.BeginBlock();

        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (this.isDeclarationStatement(s) || this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleDeclaration(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleDeclaration(node.body);
        } else {
            throw new Error('Not Implemented');
        }

        this.writer.EndBlock();
    }

    processNamespaceDeclaration(node: ts.NamespaceDeclaration): void {
        this.processModuleDeclaration(node);
    }

    processModuleImplementationInMain(node: ts.ModuleDeclaration | ts.NamespaceDeclaration): void {
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (!this.isDeclarationStatement(s) && !this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleImplementationInMain(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleImplementationInMain(node.body);
        } else {
            throw new Error('Not Implemented');
        }
    }

    processModuleVariableStatements(node: ts.ModuleDeclaration | ts.NamespaceDeclaration): void {
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            const block = <ts.ModuleBlock>node.body;
            block.statements.forEach(s => {
                if (this.isVariableStatement(s)) {
                    this.processStatement(s);
                } else if (this.isNamespaceStatement(s)) {
                    this.processModuleVariableStatements(<ts.ModuleDeclaration>s);
                }
            });
        } else if (node.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            this.processModuleVariableStatements(node.body);
        } else {
            throw new Error('Not Implemented');
        }
    }

    processImportEqualsDeclaration(node: ts.ImportEqualsDeclaration): void {

        const typeOfExpr = this.resolver.getOrResolveTypeOf(node.moduleReference);
        if (typeOfExpr && typeOfExpr.symbol &&
            (typeOfExpr.symbol.valueDeclaration.kind === ts.SyntaxKind.ModuleDeclaration
                || typeOfExpr.symbol.valueDeclaration.kind === ts.SyntaxKind.NamespaceExportDeclaration)) {
            this.writer.writeString('namespace ');
        } else {
            this.writer.writeString('using ');
        }

        this.processExpression(node.name);
        this.writer.writeString(' = ');
        this.processModuleReferenceOrEntityName(node.moduleReference);
        this.writer.EndOfStatement();
    }

    processModuleReferenceOrEntityName(node: ts.ModuleReference | ts.EntityName) {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier: this.processIdentifier(node); break;
            case ts.SyntaxKind.QualifiedName: this.processQualifiedName(node); break;
            case ts.SyntaxKind.ExternalModuleReference: this.processExpression(node.expression); break;
        }
    }

    processQualifiedName(node: ts.QualifiedName) {
        this.processModuleReferenceOrEntityName(node.left);
        this.writer.writeString('::');
        this.processExpression(node.right);
    }

    processExportDeclaration(node: ts.ExportDeclaration): void {
        /* TODO: */
    }

    processImportDeclaration(node: ts.ImportDeclaration): void {
        // tswow-workaround: Hackaround to not include npm modules (used for GetId/GetIdRange)
        // tswow-todo: better checking for non-relative modules. should we always ignore them?
        let text = node.moduleSpecifier.getText();
        text = text.substring(1, text.length - 1);
        if (!text.startsWith('.')) {
            return;
        }

        if (node.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) {
            return;
        }
        this.writer.writeString('#include \"');
        if (node.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
            const ident = <ts.StringLiteral>node.moduleSpecifier;
            this.writer.writeString(ident.text);
            this.writer.writeString('.h');
        }

        this.writer.writeStringNewLine('\"');

        if (node.importClause) {
            if (node.importClause.name && node.importClause.name.kind === ts.SyntaxKind.Identifier) {
                this.writer.writeString('using ');
                this.processExpression(node.importClause.name);
                this.writer.writeStringNewLine(' = _default;');
            }

            if (node.importClause.namedBindings
                && node.importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
                for (const binding of (<ts.NamedImports>node.importClause.namedBindings).elements.filter(e => e.propertyName)) {
                    this.writer.writeString('using ');
                    this.processExpression(binding.name);
                    this.writer.writeString(' = ');
                    this.processExpression(binding.propertyName);
                    this.writer.writeStringNewLine(';');
                }
            }
        }
    }

    error(message: string, node: ts.Node) {
        let fileStr = "<unknown>";
        let lineStr = "<unknown>";
        let charStr = "<unknown>";

        try {
            const file = node.getSourceFile().fileName;
            fileStr = file;
            const { line, character} = node
                .getSourceFile()
                .getLineAndCharacterOfPosition(node.pos);
            lineStr = `${line}`;
            charStr = `${character}`;
        } catch( err ) {}
        throw new Error(
              `TypeScript Error:`
            + ` ${message}\n    `
            + `(in source file ${fileStr}:${lineStr}:${charStr})`);
    }

    processVariableDeclarationList(declarationList: ts.VariableDeclarationList, forwardDeclaration?: boolean): boolean {
        const scopeItem = this.scope[this.scope.length - 1];
        const autoAllowed =
            scopeItem.kind !== ts.SyntaxKind.SourceFile
            && scopeItem.kind !== ts.SyntaxKind.ClassDeclaration
            && scopeItem.kind !== ts.SyntaxKind.ModuleDeclaration
            && scopeItem.kind !== ts.SyntaxKind.NamespaceExportDeclaration;

        const forceCaptureRequired = autoAllowed && declarationList.declarations.some(d => d && (<any>d).__requireCapture);
        if (!((<any>declarationList).__ignore_type)) {

            if (forwardDeclaration) {
                this.writer.writeString('extern ');
            }

            const firstType = declarationList.declarations.filter(d => d.type)[0]?.type;
            const firstInitializer = declarationList.declarations.filter(d => d.initializer)[0]?.initializer;

            // @tswow-begin: don't allow non-const non-literals outside of functions
            const type = this.resolver.getTypeAtLocation(firstInitializer);
            if(    !autoAllowed
                && !declarationList.getText().startsWith('const')
                && process.argv.includes('--no-globals')
              ) {
                this.error(`Non-const variable outside of function -> ${declarationList.getText()}`,declarationList);
            }
            if(    !autoAllowed
                && !type.isLiteral()
                && process.argv.includes('--no-globals')
              ) {
                this.error(`Non-literal variable outside of function -> ${declarationList.getText()}`,declarationList);
            }
            // @tswow-end

            const effectiveType = firstType || this.resolver.getOrResolveTypeOfAsTypeNode(firstInitializer);
            const useAuto = autoAllowed
                && !!(firstInitializer)
                && !firstType

            if(type.isNumberLiteral() && declarationList.getText().startsWith('const')) {
                this.writer.writeString('const ')
            }

            this.processPredefineType(effectiveType);
            if (!forceCaptureRequired) {
                this.processType(effectiveType, useAuto);
            } else {
                // TODO: Not sure if something needs to be done here
                if (useAuto) {
                    this.writer.writeString('auto');
                } else {
                    this.processType(effectiveType, useAuto);
                }
            }
            this.writer.writeString(' ');
        }


        const next = { next: false };
        let result = false;
        declarationList.declarations.forEach(d => {
                result =
                    this.processVariableDeclarationOne(
                        d.name, d.initializer, d.type, next, forwardDeclaration, forceCaptureRequired)
                    || result;
            } );

        return result;
    }

    processVariableDeclarationOne(
        name: ts.BindingName,
        initializer: ts.Expression,
        type: ts.TypeNode,
        next?: { next: boolean },
        forwardDeclaration?: boolean,
        forceCaptureRequired?: boolean): boolean {
        if (next && next.next) {
            this.writer.writeString(', ');
        }

        if (name.kind === ts.SyntaxKind.ArrayBindingPattern) {
            this.writer.writeString('[');
            let hasNext = false;
            name.elements.forEach(element => {
                if (hasNext) {
                    this.writer.writeString(', ');
                }

                hasNext = true;
                this.writer.writeString((<ts.Identifier>(<ts.BindingElement>element).name).text);
            });
            this.writer.writeString(']');
        } else if (name.kind === ts.SyntaxKind.Identifier) {
            this.writer.writeString(name.text);
        } else {
            throw new Error('Not implemented!');
        }

        if (!forwardDeclaration) {
            if (initializer) {
                this.writer.writeString(' = ');
                this.processExpression(initializer);
            } else {
                if (type && type.kind === ts.SyntaxKind.TupleType) {
                    this.processDefaultValue(type);
                }
            }
        }

        if (next) {
            next.next = true;
        }

        return true;
    }

    processVariableStatement(node: ts.VariableStatement): void {
        // tswow-workaround: fix namespaced variable declarations
        // tswow-todo: very ugly output (why didn't the original place these in the big namespace in the first place?)
        let namespaceCount = 0;
        if (node.parent.kind === ts.SyntaxKind.ModuleBlock) {
            if (this.isHeader()) {
                return;
            } else {
                // tswow-workaround: fix namespaced variable declarations
                let mod = node.declarationList.parent.parent;
                let str = ``;
                while ( mod.kind === ts.SyntaxKind.ModuleBlock) {
                    str = `namespace ${(mod.parent as ts.ModuleDeclaration).name.text} { ${str}`;
                    mod = mod.parent.parent;
                    ++namespaceCount;
                }
                this.writer.writeString(str);
            }
        }
        const anyVal = this.processVariableDeclarationList(node.declarationList);
        if (anyVal) {
            if (namespaceCount > 0) {
                this.writer.writeString(';');
            } else {
                this.writer.EndOfStatement();
            }
        }
        for (let i = 0 ; i < namespaceCount ; ++i) {
            this.writer.writeString('}');
        }
        if (namespaceCount > 0) {
            this.writer.EndOfStatement();
        }
    }

    processPredefineType(typeIn: ts.TypeNode | ts.ParameterDeclaration | ts.TypeParameterDeclaration | ts.Expression,
        auto: boolean = false): void {

        if (auto) {
            return;
        }

        let type = typeIn;
        if (typeIn && typeIn.kind === ts.SyntaxKind.LiteralType) {
            type = (<ts.LiteralTypeNode>typeIn).literal;
        }

        switch (type && type.kind) {
            case ts.SyntaxKind.ArrayType:
                const arrayType = <ts.ArrayTypeNode>type;
                this.processPredefineType(arrayType.elementType, false);

                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                (tupleType as any).elementTypes.forEach(element => {
                    this.processPredefineType(element, false);
                });

                break;
            case ts.SyntaxKind.TypeReference:
                const typeReference = <ts.TypeReferenceNode>type;

                if (typeReference.typeArguments) {
                    typeReference.typeArguments.forEach(element => {
                        this.processPredefineType(element, false);
                    });
                }

                break;
            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>type;
                if (parameter.name.kind === ts.SyntaxKind.Identifier) {
                    this.processPredefineType(parameter.type);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.FunctionType:
                const functionType = <ts.FunctionTypeNode>type;
                this.processPredefineType(functionType.type);
                if (functionType.parameters) {
                    functionType.parameters.forEach(element => {
                        this.processPredefineType(element);
                    });
                }
                break;
            case ts.SyntaxKind.UnionType:

                /*
                const unionType = <ts.UnionTypeNode>type;
                const unionTypes = unionType.types
                    .filter(f => f.kind !== ts.SyntaxKind.NullKeyword && f.kind !== ts.SyntaxKind.UndefinedKeyword);

                if (this.typesAreNotSame(unionTypes)) {
                    unionTypes.forEach((element, i) => {
                        this.processPredefineType(element);
                    });

                    this.processType(type, undefined, undefined, undefined, true);
                    this.writer.EndOfStatement();
                } else {
                    this.processPredefineType(unionTypes[0]);
                }
                */
                break;
        }
    }

    compareTypes(t1: ts.TypeNode, t2: ts.TypeNode): boolean {
        const kind1 = t1.kind === ts.SyntaxKind.LiteralType ? (<ts.LiteralTypeNode>t1).literal.kind : t1.kind;
        const kind2 = t2.kind === ts.SyntaxKind.LiteralType ? (<ts.LiteralTypeNode>t2).literal.kind : t2.kind;
        return kind1 === kind2;
    }

    typesAreNotSame(unionTypes: ts.TypeNode[]): boolean {
        if (unionTypes.length <= 1) {
            return false;
        }

        const firstType = unionTypes[0];
        const same = unionTypes.slice(1).every(t => this.compareTypes(t, firstType));
        return !same;
    }

    attemptResolveBrokenArrayType(type: ts.TypeNode | ts.ParameterDeclaration | ts.TypeParameterDeclaration | ts.Expression, node?: ts.Node) {
        const fail = () => this.error(
            `Cannot resolve TSArray type parameter, `
            + `try writing it out explicitly`
        ,type);

        if(node) {
            let type = this.resolver.getTypeAtLocation(node)
            if(this.resolver.isArrayType(type)) {
                let typenode = this.resolver.typeToTypeNode(type) as ts.ArrayTypeNode;
                if(typenode.elementType) {
                    try {
                        return this.processType(typenode.elementType);
                    } catch(err) {
                        fail();
                    }
                }
            }
            fail();
        }
    }

    processType(typeIn: ts.TypeNode | ts.ParameterDeclaration | ts.TypeParameterDeclaration | ts.Expression,
        auto: boolean = false, skipPointerInType: boolean = false, noTypeName: boolean = false,
        implementingUnionType: boolean = false, node?: ts.Node): void {

        if (auto) {
            this.writer.writeString('auto');
            return;
        }

        let type = typeIn;
        if (typeIn && typeIn.kind === ts.SyntaxKind.LiteralType) {
            type = (<ts.LiteralTypeNode>typeIn).literal;
        }

        let next;
        switch (type && type.kind) {
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.BooleanKeyword:
                this.writer.writeString('bool');
                break;
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.NumberKeyword:
                this.writer.writeString('double');
                break;
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.StringKeyword:
                this.writer.writeString('std::string');
                break;
            case ts.SyntaxKind.TypeLiteral:
            case ts.SyntaxKind.ObjectLiteralExpression:
                this.writer.writeString('object');
                break;
            case ts.SyntaxKind.ArrayType:
                const arrayType = <ts.ArrayTypeNode>type;
                this.writer.writeString('TSArray<');
                if (arrayType.elementType && arrayType.elementType.kind !== ts.SyntaxKind.UndefinedKeyword) {
                    this.processType(arrayType.elementType, false);
                } else {
                    this.attemptResolveBrokenArrayType(typeIn,node);
                }
                this.writer.writeString('>');
                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                this.writer.writeString('std::tuple<');

                next = false;
                (tupleType as any).elementTypes.forEach(element => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processType(element, false);
                    next = true;
                });

                this.writer.writeString('>');
                break;
            case ts.SyntaxKind.TypeReference:
                const typeReference = <ts.TypeReferenceNode>type;

                // Check for "GetObject"
                let start = type.pos == -1 ? 0 : Math.max(0,typeReference.getStart(typeReference.getSourceFile()));
                const getObjectPre = type.pos == -1 ? "" : typeReference.getSourceFile().text.substring(start-10,start-1);
                const onMessageIdPre = type.pos == -1 ? "" : typeReference.getSourceFile().text.substring(start-12,start-1);
                const DBContainerPre = type.pos == -1 ? "" : typeReference.getSourceFile().text.substring(start-12,start-1);

                const typeInfo = this.resolver.getOrResolveTypeOf(type);
                const isTypeAlias = ((typeInfo && this.resolver.checkTypeAlias(typeInfo.aliasSymbol))
                    || this.resolver.isTypeAlias((<any>type).typeName)) && !this.resolver.isThisType(typeInfo);

                // Detect if enum
                if(this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration))
                {
                    let enumType = this.enumTypes[typeReference.getText()]
                        || "uint32";
                    this.writer.writeString(enumType)
                    return;
                }

                // detect if pointer
                const isEnum = this.isEnum(typeReference);
                const isArray = this.resolver.isArrayType(typeInfo);

                const typeText = type.pos == -1 ? (type as any).typeName.escapedText : typeReference.getText();
                const isEventsStruct = typeText === 'TSEvents';

                const primitives = [
                    'uint8', 'uint16', 'uint32', 'uint64',
                    'int8', 'int16', 'int32', 'int64', 'float',
                    'double', 'float64', 'bool'
                ];
                const isPrimitive = primitives.includes(typeText);

                const skipPointerIf =
                    (typeInfo && (<any>typeInfo).symbol && (<any>typeInfo).symbol.name === '__type')
                    || (typeInfo && (<any>typeInfo).primitiveTypesOnly)
                    || (typeInfo && (<any>typeInfo).intrinsicName === 'number')
                    || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.TypeParameter)
                    || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumMember)
                    || this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration)
                    || this.resolver.isTypeFromSymbol((<any>type).typeName, ts.SyntaxKind.EnumDeclaration)
                    || isEnum
                    || skipPointerInType
                    || isTypeAlias
                    || isArray
                    || isEventsStruct
                    || isPrimitive
                    || getObjectPre == 'GetObject'
                    || onMessageIdPre == 'OnMessageID'
                    || DBContainerPre == 'DBContainer'
                    || (typeText.startsWith('TS') && (typeText !== 'TSDatabaseResult'))

                if(!skipPointerIf) {
                    this.writer.writeString('std::shared_ptr<');
                }

                // writing namespace
                if (this.isWritingMain) {
                    const symbol = (<any>typeReference.typeName).symbol || typeInfo && typeInfo.symbol;
                    if (symbol) {
                        const symbolDecl = symbol.valueDeclaration || symbol.declarations[0];
                        if (symbolDecl) {
                            let parent = symbolDecl.parent;
                            if (parent) {
                                parent = parent.parent;
                            }

                            if (parent) {
                                const symbolNamespace = parent.symbol;
                                if (symbolNamespace) {
                                    const valDeclNamespace = symbolNamespace.valueDeclaration;
                                    if (valDeclNamespace && valDeclNamespace.kind !== ts.SyntaxKind.SourceFile) {
                                        this.processType(valDeclNamespace);
                                        this.writer.writeString('::');
                                    }
                                }
                            }
                        }
                    }
                }

                if ((<any>typeReference.typeName).symbol
                    && (<any>typeReference.typeName).symbol.parent
                    && (<any>typeReference.typeName).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>typeReference.typeName).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                if (isArray) {
                    this.writer.writeString('TSArray');
                } else {
                    this.writeTypeName(typeReference);
                }

                if (typeReference.typeArguments) {
                    this.writer.writeString('<');

                    let next1 = false;
                    typeReference.typeArguments.forEach(element => {
                        if (next1) {
                            this.writer.writeString(', ');
                        }

                        this.processType(element, false);
                        next1 = true;
                    });

                    this.writer.writeString('>');
                }

                if(isEventsStruct) {
                    this.writer.writeString(' * ');
                } else if(!skipPointerIf) {
                    this.writer.writeString('>')
                }
                break;
            case ts.SyntaxKind.TypeParameter:
                const typeParameter = <ts.TypeParameterDeclaration>type;
                if (typeParameter.name.kind === ts.SyntaxKind.Identifier) {
                    if (!noTypeName) {
                        this.writer.writeString('typename ');
                    }

                    this.writer.writeString(typeParameter.name.text);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.Parameter:
                const parameter = <ts.ParameterDeclaration>type;
                if (parameter.name.kind === ts.SyntaxKind.Identifier) {
                    this.processType(parameter.type);
                } else {
                    throw new Error('Not Implemented');
                }

                break;
            case ts.SyntaxKind.FunctionType:
                const functionType = <ts.FunctionTypeNode>type;
                this.writer.writeString('std::function<');
                this.processType(functionType.type);
                this.writer.writeString('(');
                if (functionType.parameters) {
                    next = false;
                    functionType.parameters.forEach(element => {
                        if (next) {
                            this.writer.writeString(', ');
                        }

                        this.processType(element);
                        next = true;
                    });
                } else {
                    this.writer.writeString('void');
                }

                this.writer.writeString(')>');
                break;
            case ts.SyntaxKind.VoidKeyword:
                this.writer.writeString('void');
                break;
            case ts.SyntaxKind.AnyKeyword:
                this.error(
                      `'any' keyword is not permitted in C++`
                    , type);
                break;
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.UndefinedKeyword:
                this.writer.writeString('TSNull')
                break;
            case ts.SyntaxKind.UnionType:

                /*
                const unionType = <ts.UnionTypeNode>type;
                const unionTypes = unionType.types
                    .filter(f => f.kind !== ts.SyntaxKind.NullKeyword && f.kind !== ts.SyntaxKind.UndefinedKeyword);

                if (this.typesAreNotSame(unionTypes)) {
                    const pos = type.pos >= 0 ? type.pos : 0;
                    const end = type.end >= 0 ? type.end : 0;
                    const unionName = `__union${pos}_${end}`;
                    if (implementingUnionType) {
                        this.writer.writeString('union ');
                        this.writer.writeString(unionName);
                        this.writer.writeString(' ');
                        this.writer.BeginBlock();

                        this.writer.writeStringNewLine(`${unionName}(std::nullptr_t v_) {}`);

                        unionTypes.forEach((element, i) => {
                            this.processType(element);
                            this.writer.writeString(` v${i}`);
                            this.writer.EndOfStatement();
                            this.writer.cancelNewLine();
                            this.writer.writeString(` ${unionName}(`);
                            this.processType(element);
                            this.writer.writeStringNewLine(` v_) : v${i}(v_) {}`);
                        });

                        this.writer.EndBlock();
                        this.writer.cancelNewLine();
                    } else {
                        this.writer.writeString(unionName);
                    }
                } else {
                    this.processType(unionTypes[0]);
                }
                */

                if(!auto) {
                    this.error(
                        `Failed to write union type `
                      + `because 'auto' keyword is forbidden here.`
                    , type);
                }
                this.writer.writeString('auto');

                break;
            case ts.SyntaxKind.ModuleDeclaration:
                if ((<any>type).symbol
                    && (<any>type).symbol.parent
                    && (<any>type).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>type).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                const moduleDeclaration = <ts.ModuleDeclaration><any>type;
                this.writer.writeString(moduleDeclaration.name.text);
                break;
            case ts.SyntaxKind.TypeQuery:
                const exprName = (<any>type).exprName;

                if ((<any>exprName).symbol
                    && (<any>exprName).symbol.parent
                    && (<any>exprName).symbol.parent.valueDeclaration.kind !== ts.SyntaxKind.SourceFile) {
                    this.processType((<any>exprName).symbol.parent.valueDeclaration);
                    this.writer.writeString('::');
                }

                this.writer.writeString(exprName.text);
                break;
            default:
                if(!auto) {
                    this.error(
                        `Failed to write union type `
                      + `because 'auto' keyword is forbidden here.`
                    , type);
                }
                break;
        }
    }

    writeTypeName(typeReference: ts.TypeReferenceNode) {
        const entityProcess = (entity: ts.EntityName) => {
            if (entity.kind === ts.SyntaxKind.Identifier) {
                // @tswow-begin: hack: const enums
                let val = this.enumTypes[entity.text];
                if(val !== undefined) {
                    this.writer.writeString(val);
                } else {
                    this.writer.writeString(entity.text);
                }
                // @tswow-end
            } else if (entity.kind === ts.SyntaxKind.QualifiedName) {
                entityProcess(entity.left);
                if (!this.resolver.isTypeFromSymbol(entity.left, ts.SyntaxKind.EnumDeclaration)) {
                    this.writer.writeString('::');
                    this.writer.writeString(entity.right.text);
                }
            } else {
                throw new Error('Not Implemented');
            }
        };

        entityProcess(typeReference.typeName);
    }

    isEnum(typeReference: ts.TypeReferenceNode) {
        let isEnum = false;
        const entityProcessCheck = (entity: ts.EntityName) => {
            if (entity.kind === ts.SyntaxKind.QualifiedName) {
                entityProcessCheck(entity.left);
                isEnum = this.resolver.isTypeFromSymbol(entity.left, ts.SyntaxKind.EnumDeclaration);
            }
        };

        entityProcessCheck(typeReference.typeName);

        return isEnum;
    }

    processDefaultValue(type: ts.TypeNode): void {
        switch (type.kind) {
            case ts.SyntaxKind.BooleanKeyword:
                this.writer.writeString('false');
                break;
            case ts.SyntaxKind.NumberKeyword:
                this.writer.writeString('0');
                break;
            case ts.SyntaxKind.StringKeyword:
                this.writer.writeString('""');
                break;
            case ts.SyntaxKind.ArrayType:
                this.writer.writeString('{}');
                break;
            case ts.SyntaxKind.TupleType:
                const tupleType = <ts.TupleTypeNode>type;

                this.writer.writeString('{');

                let next = false;
                (tupleType as any).elementTypes.forEach(element => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processDefaultValue(element);
                    next = true;
                });

                this.writer.writeString('}');
                break;
            case ts.SyntaxKind.TypeReference:
                this.writer.writeString('{}');
                break;
            default:
                this.error(
                      `Cannot resolve type of default value, `
                    + `try writing it out explicitly.`
                , type);
                break;
        }
    }

    processFunctionExpression(
        node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration | ts.MethodDeclaration
            | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
        implementationMode?: boolean): boolean {

        this.scope.push(node);
        const result = this.processFunctionExpressionInternal(node, implementationMode);
        this.scope.pop();

        return result;
    }

    processFunctionExpressionInternal(
        node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration | ts.MethodDeclaration
            | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
        implementationMode?: boolean): boolean {
        if ( this.isHeader() && node.name && node.name.getText() === 'Main') {
            // we're checking if we're somehow trying to write main into two header files.
            let filename = node.getSourceFile().fileName;
            if(mainFile !== undefined) {
                throw new Error(`"Main" function found in both ${mainFile} and ${filename}, you can only have one function called "Main"`);
            }
            mainFile = filename;

            if ( node.typeParameters && node.typeParameters.length > 0) {
                throw new Error('"Main" function cannot have type parameters!');
            }

            if ( node.parameters.length !== 1 || node.parameters[0].type.getFullText().replace(' ', '') !== 'TSEvents') {
                throw new Error('"Main" function must take a single argument "TSEvents" (globally defined!)');
            }
        }

        // @tswow-begin
        const start = node.getFullStart();
        let cur = start;
        const filetext = node.getSourceFile().text;
        let passed = false

        while(cur >= 0 && (filetext[cur] != '.' || !passed)) {
            --cur;
            if(filetext[cur]==='(') {
                passed = true;
            }
        }
        const func = filetext.substring(cur,start);

        // TODO: same garbage with "kind" not working
        let isEvent = false;
        try {
            let pare = node.parent as ts.ExpressionStatement;
            let fsChild = pare.expression.getChildAt(0).getChildAt(0);
            let type = this.resolver.getTypeAtLocation(fsChild);
            let callDecl = this.resolver.getFirstDeclaration(type) as ts.ClassDeclaration;
            if(callDecl.name && callDecl.name.getText() === 'TSEvents') {
                isEvent = true;
            }
        } catch(err) {}

        // @tswow-end

        // skip function declaration as union
        let noBody = false;
        if (!node.body
            || ((<any>node).body.statements
                && (<any>node).body.statements.length === 0
                && ((<any>node).body.statements).isMissingList)) {
            // function without body;
            if ((<any>node).nextContainer
                && node.kind === (<any>node).nextContainer.kind
                && (<any>node).name.text === (<any>node).nextContainer.name.text) {
                return true;
            }

            noBody = true;
        }

        const isAbstract = this.isAbstract(node)
            || (<any>node).kind === ts.SyntaxKind.MethodSignature && node.parent.kind === ts.SyntaxKind.InterfaceDeclaration;
        if (implementationMode && isAbstract) {
            // ignore declarations
            return true;
        }

        const noReturnStatement = !this.hasReturn(node);
        const noReturn = !this.hasReturnWithValue(node);
        // const noParams = node.parameters.length === 0 && !this.hasArguments(node);
        // const noCapture = !this.requireCapture(node);

        // in case of nested function
        const isNestedFunction = node.parent && node.parent.kind === ts.SyntaxKind.Block;
        if (isNestedFunction) {
            implementationMode = true;
        }

        const isClassMemberDeclaration = this.isClassMemberDeclaration(node);
        const isClassMember = isClassMemberDeclaration || this.isClassMemberSignature(node);
        const isFunctionOrMethodDeclaration =
            (node.kind === ts.SyntaxKind.FunctionDeclaration || isClassMember)
            && !isNestedFunction;
        const isFunctionExpression = node.kind === ts.SyntaxKind.FunctionExpression;
        const isFunction = isFunctionOrMethodDeclaration || isFunctionExpression;
        const isArrowFunction = node.kind === ts.SyntaxKind.ArrowFunction || isNestedFunction;
        const writeAsLambdaCFunction = isArrowFunction || isFunction;

        if (implementationMode && node.parent && node.parent.kind === ts.SyntaxKind.ClassDeclaration && this.isTemplate(<any>node.parent)) {
            this.processTemplateParams(<any>node.parent);
        }

        this.processTemplateParams(node);

        if (implementationMode !== true) {
            this.processModifiers(node.modifiers);
        }

        const writeReturnType = () => {
            if (node.type) {
                if (this.isTemplateType(node.type)) {
                    this.writer.writeString('RET');
                } else {
                    this.processType(node.type);
                }
            } else {
                if (noReturn) {
                    this.writer.writeString('void');
                } else {
                    if (isClassMember && (<ts.Identifier>node.name).text === 'toString') {
                        this.writer.writeString('std::string');
                    } else {
                        // let's try our best to resolve it
                        const fail = () => this.error(
                              `Unable to resolve return type of function `
                            + `${node.name.getText()}, try writing it out explicitly`, node)

                        let t = this.resolver.typeToTypeNode(this.resolver.getTypeAtLocation(node)) as ts.FunctionTypeNode
                        if(t) {
                            try {
                                return this.processType(t.type)
                            } catch(err) {
                                fail();
                            }
                        } else {
                            fail();
                        }
                    }
                }
            }
        };

        let extraArgs = 0;
        if (writeAsLambdaCFunction) {
            if (isFunctionOrMethodDeclaration) {
                // type declaration
                if (node.kind !== ts.SyntaxKind.Constructor) {
                    const isVirtual = isClassMember
                        && !this.isStatic(node)
                        && !this.isTemplate(<ts.MethodDeclaration>node)
                        && implementationMode !== true;
                    if (isVirtual) {
                        this.writer.writeString('virtual ');
                    }

                    writeReturnType();

                    this.writer.writeString(' ');
                }

                if (isClassMemberDeclaration && implementationMode) {
                    // in case of constructor
                    this.writeClassName();

                    if (implementationMode
                        && node.parent
                        && node.parent.kind === ts.SyntaxKind.ClassDeclaration
                        && this.isTemplate(<any>node.parent)) {
                        this.processTemplateParameters(<any>node.parent);
                    }

                    this.writer.writeString('::');
                }

                // name
                if (node.name && node.name.kind === ts.SyntaxKind.Identifier) {
                    if (node.kind === ts.SyntaxKind.GetAccessor) {
                        this.writer.writeString('get_');
                    } else if (node.kind === ts.SyntaxKind.SetAccessor) {
                        this.writer.writeString('set_');
                    }

                    if (node.name.kind === ts.SyntaxKind.Identifier) {
                        this.processExpression(node.name);
                    } else {
                        throw new Error('Not implemented');
                    }
                } else {
                    // in case of constructor
                    this.writeClassName();
                }
            } else if (isArrowFunction || isFunctionExpression) {
                // Prepare extra arguments
                try { // doing try/catch here because "kind" seems to completely bug out when accessing parent elements
                    let arrowNode = node as ts.ArrowFunction;
                    let argsLength = arrowNode.parameters.length;
                    let index = -1;
                    (node.parent as ts.CallExpression).arguments.forEach((x,i)=>{
                        if(x === node) {
                            index = i;
                        }
                    });
                    if(index != -1) {
                        let paramLength: number;
                        let type = this.resolver.getTypeAtLocation(node.parent.getChildAt(0));
                        if(type && type.symbol && type.symbol.declarations) {
                            // hack: naively try all declarations until we find one.
                            // we can't really support overloaded callbacks this way, but it's better than nothing
                            for(let declaration of type.symbol.declarations) {
                                let tt = this.resolver.getTypeAtLocation((declaration as any as ts.CallSignatureDeclaration).parameters[index]);
                                let fnType = this.resolver.getFirstDeclaration(tt) as ts.FunctionTypeNode;
                                if(fnType == undefined) {
                                    continue;
                                }
                                paramLength = fnType.parameters.length;
                                break;
                            }
                        }
                        if(paramLength > argsLength) extraArgs = paramLength - argsLength;
                    }
                } catch(error) {
                    extraArgs = 0;
                }

                if (isNestedFunction) {
                    this.writer.writeString('auto ');
                    if (node.name.kind === ts.SyntaxKind.Identifier) {
                        this.processExpression(node.name);
                    } else {
                        throw new Error('Not implemented');
                    }

                    this.writer.writeString(' = ');
                }

                // lambda or noname function
                // @tswow-begin
                const byReference = isEvent  ? '' : '&';
                // @tswow-begin
                this.writer.writeString(`[${byReference}]`);
            }
        }

        this.writer.writeString('(');

        let defaultParams = false;
        let next = false;
        node.parameters.forEach((element, index) => {
            if (element.name.kind !== ts.SyntaxKind.Identifier) {
                throw new Error('Not implemented');
            }

            if (next) {
                this.writer.writeString(', ');
            }

            const effectiveType = element.type
                || this.resolver.getOrResolveTypeOfAsTypeNode(element.initializer);
            if (element.dotDotDotToken) {
                this.writer.writeString('Args...');
            } else if (this.isTemplateType(effectiveType)) {
                this.writer.writeString('P' + index);
            } else {
                this.processType(effectiveType, isArrowFunction);
            }

            this.writer.writeString(' ');
            this.processExpression(element.name);

            // extra symbol to change parameter name
            if (node.kind === ts.SyntaxKind.Constructor
                && this.hasAccessModifier(element.modifiers)
                || element.dotDotDotToken) {
                this.writer.writeString('_');
            }

            if (!implementationMode) {
                if (element.initializer) {
                    this.writer.writeString(' = ');
                    this.processExpression(element.initializer);
                    defaultParams = true;
                } else if (element.questionToken || defaultParams) {
                    switch (element.type && element.type.kind) {
                        case ts.SyntaxKind.FunctionType:
                            this.writer.writeString(' = nullptr');
                            break;
                        default:
                            this.writer.writeString(' = undefined');
                            break;
                    }
                }
            }

            next = true;
        });

        // add extra arguments
        if(extraArgs > 0) {
            if(node.parameters.length > 0) {
                this.writer.writeString(',');
            }

            for(let i=0;i<extraArgs;++i) {
                this.writer.writeString(`auto __tswow_extra_args${i}${i<extraArgs-1?',':''}`)
            }
        }

        // @tswow-begin
        if (!isEvent && (isArrowFunction || isFunctionExpression)) {
        // @tswow-end
            this.writer.writeStringNewLine(') mutable');
        } else {
            this.writer.writeStringNewLine(')');
        }

        // constructor init
        let skipped = 0;
        if (node.kind === ts.SyntaxKind.Constructor && implementationMode) {
            this.writer.cancelNewLine();

            next = false;
            node.parameters
                .filter(e => this.hasAccessModifier(e.modifiers))
                .forEach(element => {
                    if (next) {
                        this.writer.writeString(', ');
                    } else {
                        this.writer.writeString(' : ');
                    }

                    if (element.name.kind === ts.SyntaxKind.Identifier) {
                        this.processExpression(element.name);
                        this.writer.writeString('(');
                        this.processExpression(element.name);
                        this.writer.writeString('_)');
                    } else {
                        throw new Error('Not implemented');
                    }

                    next = true;
                });

            // process base constructor call
            let superCall = (<any>node.body).statements[0];
            if (superCall && superCall.kind === ts.SyntaxKind.ExpressionStatement) {
                superCall = (<ts.ExpressionStatement>superCall).expression;
            }

            if (superCall && superCall.kind === ts.SyntaxKind.CallExpression
                && (<ts.CallExpression>superCall).expression.kind === ts.SyntaxKind.SuperKeyword) {
                if (!next) {
                    this.writer.writeString(' : ');
                } else {
                    this.writer.writeString(', ');
                }

                this.processExpression(superCall);
                skipped = 1;
            }

            if (next) {
                this.writer.writeString(' ');
            }

            this.writer.writeString(' ');
        }

        if (!implementationMode && isAbstract) {
            // abstract
            this.writer.cancelNewLine();
            this.writer.writeString(' = 0');
        }

        if (!noBody && (isArrowFunction || isFunctionExpression || implementationMode)) {
            this.writer.BeginBlock();

            node.parameters
                .filter(e => e.dotDotDotToken)
                .forEach(element => {
                    this.processType(element.type, false);
                    this.writer.writeString(' ');
                    this.processExpression(<ts.Identifier>element.name);
                    this.writer.writeString(' = ');
                    this.processType(element.type, false);
                    this.writer.writeString('{');
                    this.processExpression(<ts.Identifier>element.name);
                    this.writer.writeStringNewLine('_...};');
                });

            if (node.kind === ts.SyntaxKind.Constructor && this.hasThisAsShared(node)) {
                // adding header to constructor
                this.processType(this.resolver.getOrResolveTypeOfAsTypeNode(node.parent));
                this.writer.writeStringNewLine(' _this(this, [] (auto&) {/*to be finished*/});');
            }

            this.markRequiredCapture(node);
            (<any>node.body).statements.filter((item, index) => index >= skipped).forEach(element => {
                this.processStatementInternal(element, true);
            });

            // add default return if no body
            if (noReturnStatement && node && node.type && node.type.kind !== ts.SyntaxKind.VoidKeyword) {
                this.writer.writeString('return ');
                writeReturnType();
                this.writer.writeString('()');
                this.writer.EndOfStatement();
            }

            this.writer.EndBlock();
        }
    }

    writeClassName() {
        const classNode = this.scope[this.scope.length - 2];
        if (classNode && classNode.kind === ts.SyntaxKind.ClassDeclaration) {
            this.processExpression((<ts.ClassDeclaration>classNode).name);
        } else {
            throw new Error('Not Implemented');
        }
    }

    processTemplateParams(node: ts.FunctionExpression | ts.ArrowFunction | ts.FunctionDeclaration | ts.MethodDeclaration
        | ts.MethodSignature | ts.ConstructorDeclaration | ts.TypeAliasDeclaration | ts.GetAccessorDeclaration
        | ts.SetAccessorDeclaration) {

        let types = <ts.TypeParameterDeclaration[]><any>node.typeParameters;
        if (types && node.parent && (<any>node.parent).typeParameters) {
            types = types.filter(t => (<any>node.parent).typeParameters.every(t2 => t.name.text !== t2.name.text));
        }

        const templateTypes = types && types.length > 0;
        const isParamTemplate = this.isMethodParamsTemplate(node);
        const isReturnTemplate = this.isTemplateType(node.type);

        let next = false;
        if (templateTypes || isParamTemplate || isReturnTemplate) {
            this.writer.writeString('template <');
            if (templateTypes) {
                types.forEach(type => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    this.processType(type);
                    next = true;
                });
            }

            if (isReturnTemplate) {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.writer.writeString('typename RET');
                next = true;
            }

            // add params
            if (isParamTemplate) {
                (<ts.MethodDeclaration>node).parameters.forEach((element, index) => {
                    if (this.isTemplateType(element.type)) {
                        if (next) {
                            this.writer.writeString(', ');
                        }

                        this.writer.writeString('typename P' + index);
                        next = true;
                    }

                    if (element.dotDotDotToken) {
                        this.writer.writeString('typename ...Args');
                        next = true;
                    }
                });
            }

            this.writer.writeStringNewLine('>');
        }

        return next;
    }

    processTemplateParameters(node: ts.ClassDeclaration) {
        let next = false;
        if (node.typeParameters) {
            this.writer.writeString('<');
            node.typeParameters.forEach(type => {
                if (next) {
                    this.writer.writeString(', ');
                }
                this.processType(type, undefined, undefined, true);
                next = true;
            });
            this.writer.writeString('>');
        }

        return next;
    }

    processTemplateArguments(node: ts.ExpressionWithTypeArguments | ts.CallExpression | ts.NewExpression,
        skipPointerInType?: boolean) {
        let next = false;
        if (node.typeArguments) {
            this.writer.writeString('<');
            node.typeArguments.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processType(element, undefined, skipPointerInType);
                next = true;
            });
            this.writer.writeString('>');
        } else {
            /*
            const typeInfo = this.resolver.getOrResolveTypeOf(node.expression);
            const templateParametersInfoFromType: ts.TypeParameter[] = typeInfo
                && typeInfo.symbol
                && typeInfo.symbol.valueDeclaration
                && (<any>typeInfo.symbol.valueDeclaration).typeParameters;

            if (templateParametersInfoFromType) {
                this.writer.writeString('<void>');
            }
            */
        }
    }

    processArrowFunction(node: ts.ArrowFunction): void {
        if (node.body.kind !== ts.SyntaxKind.Block) {
            // create body
            (node as any).body = ts.createBlock([ts.createReturn(<ts.Expression>node.body)]);
        }

        this.processFunctionExpression(<any>node);
    }

    isClassMemberDeclaration(node: ts.Node) {
        if (!node) {
            return false;
        }

        return node.kind === ts.SyntaxKind.Constructor
            || node.kind === ts.SyntaxKind.MethodDeclaration
            || node.kind === ts.SyntaxKind.PropertyDeclaration
            || node.kind === ts.SyntaxKind.GetAccessor
            || node.kind === ts.SyntaxKind.SetAccessor;
    }

    isClassMemberSignature(node: ts.Node) {
        if (!node) {
            return false;
        }

        return node.kind === ts.SyntaxKind.MethodSignature
            || node.kind === ts.SyntaxKind.PropertySignature;
    }

    isStatic(node: ts.Node) {
        return node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
    }

    isAbstract(node: ts.Node) {
        return node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.AbstractKeyword);
    }

    processFunctionDeclaration(node: ts.FunctionDeclaration | ts.MethodDeclaration, implementationMode?: boolean): boolean {

        if (!implementationMode) {
            this.processPredefineType(node.type);
            node.parameters.forEach((element) => {
                this.processPredefineType(element.type);
            });
        }

        const skip = this.processFunctionExpression(<ts.FunctionExpression><any>node, implementationMode);
        if (!skip && !this.isClassMemberDeclaration(node)) {
            this.writer.EndOfStatement();
            if (!this.isClassMemberSignature(node)) {
                this.writer.writeStringNewLine();
            }
        }

        return skip;
    }

    processReturnStatement(node: ts.ReturnStatement): void {
        const typeReturn = this.resolver.getOrResolveTypeOfAsTypeNode(node.expression);
        const functionDeclaration = (<ts.FunctionDeclaration>(this.scope[this.scope.length - 1]));
        let functionReturn = functionDeclaration.type || this.resolver.getOrResolveTypeOfAsTypeNode(functionDeclaration);
        if (functionReturn.kind === ts.SyntaxKind.FunctionType) {
            functionReturn = (<ts.FunctionTypeNode>functionReturn).type;
        } else if (!functionDeclaration.type) {
            // if it is not function then use "any"
            functionReturn = null;
        }

        this.writer.writeString('return');
        if (node.expression) {
            this.writer.writeString(' ');

            /*
            let theSame = (typeReturn && typeReturn.kind === ts.SyntaxKind.ThisKeyword)
                || this.resolver.typesAreTheSame(typeReturn, functionReturn);

            // TODO: hack
            if (typeReturn && typeReturn.kind === ts.SyntaxKind.ArrayType) {
                theSame = false;
            }

            // cast only if we have provided type
            if (!theSame && functionReturn) {
                this.writer.writeString('cast<');

                if (this.isTemplateType(functionReturn)) {
                    this.writer.writeString('RET');
                } else {
                    this.processType(functionReturn);
                }

                this.writer.writeString('>(');
            }
            */

            this.processExpression(node.expression);

            /*
            if (!theSame && functionReturn) {
                this.writer.writeString(')');
            }
            */
        } else {
            if (functionReturn && functionReturn.kind !== ts.SyntaxKind.VoidKeyword) {
                this.writer.writeString(' ');
                this.processType(functionReturn);
                this.writer.writeString('()');
            }
        }

        this.writer.EndOfStatement();
    }

    processIfStatement(node: ts.IfStatement): void {
        this.writer.writeString('if (');
        this.processExpression(node.expression);
        this.writer.writeString(') ');

        this.processStatement(node.thenStatement);

        if (node.elseStatement) {
            this.writer.cancelNewLine();
            this.writer.writeString(' else ');
            this.processStatement(node.elseStatement);
        }
    }

    processDoStatement(node: ts.DoStatement): void {
        this.writer.writeStringNewLine('do');
        this.processStatement(node.statement);
        this.writer.writeString('while (');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine(');');
    }

    processWhileStatement(node: ts.WhileStatement): void {
        this.writer.writeString('while (');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine(')');
        this.processStatement(node.statement);
    }

    processForStatement(node: ts.ForStatement): void {
        this.writer.writeString('for (');
        const initVar = <any>node.initializer;
        this.processExpression(initVar);
        this.writer.writeString('; ');
        this.processExpression(node.condition);
        this.writer.writeString('; ');
        this.processExpression(node.incrementor);
        this.writer.writeStringNewLine(')');
        this.processStatement(node.statement);
    }

    processForInStatement(node: ts.ForInStatement): void {
        this.processForInStatementNoScope(node);
    }

    processForInStatementNoScope(node: ts.ForInStatement): void {
        this.writer.writeString('for (auto& ');
        const initVar = <any>node.initializer;
        initVar.__ignore_type = true;
        this.processExpression(initVar);
        this.writer.writeString(' : keys_(');
        this.processExpression(node.expression);
        this.writer.writeStringNewLine('))');
        this.processStatement(node.statement);
    }

    processForOfStatement(node: ts.ForOfStatement): void {

        // if has Length access use iteration
        const hasLengthAccess = this.hasPropertyAccess(node.statement, 'length');
        if (!hasLengthAccess) {
            this.writer.writeString('for (auto& ');
            const initVar = <any>node.initializer;
            initVar.__ignore_type = true;
            this.processExpression(initVar);

            this.writer.writeString(' : ');

            this.processExpression(node.expression);

            this.writer.writeStringNewLine(')');
            this.processStatement(node.statement);
        } else {
            const arrayName = `__array${node.getFullStart()}_${node.getEnd()}`;
            const indexName = `__indx${node.getFullStart()}_${node.getEnd()}`;
            this.writer.writeString(`auto& ${arrayName} = `);
            this.processExpression(node.expression);
            this.writer.EndOfStatement();

            this.writer.writeStringNewLine(`for (auto ${indexName} = 0_N; ${indexName} < ${arrayName}->get_length(); ${indexName}++)`);
            this.writer.BeginBlock();
            this.writer.writeString(`auto& `);
            const initVar = <any>node.initializer;
            initVar.__ignore_type = true;
            this.processExpression(initVar);
            this.writer.writeStringNewLine(` = const_(${arrayName})[${indexName}]`);
            this.writer.EndOfStatement();

            this.processStatement(node.statement);
            this.writer.EndBlock();
        }
    }

    processBreakStatement(node: ts.BreakStatement) {
        this.writer.writeStringNewLine('break;');
    }

    processContinueStatement(node: ts.ContinueStatement) {
        this.writer.writeStringNewLine('continue;');
    }

    processSwitchStatement(node: ts.SwitchStatement) {
        const caseExpressions = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression);

        if (!caseExpressions || caseExpressions.length === 0) {
            this.processSwitchStatementForBasicTypesInternal(node);
            return;
        }

        const isAllStatic = caseExpressions
            .every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
                || expression.kind === ts.SyntaxKind.StringLiteral
                || expression.kind === ts.SyntaxKind.TrueKeyword
                || expression.kind === ts.SyntaxKind.FalseKeyword
                || this.resolver.isTypeFromSymbol(this.resolver.getOrResolveTypeOf(expression), ts.SyntaxKind.EnumMember));

        const firstExpression = caseExpressions[0];
        const firstType = this.resolver.getOrResolveTypeOf(firstExpression);
        const firstTypeNode = this.resolver.typeToTypeNode(firstType);
        const isTheSameTypes = caseExpressions.every(
            ce => this.resolver.typesAreTheSame(this.resolver.getOrResolveTypeOfAsTypeNode(ce), firstTypeNode));

        const areBothNumbers = caseExpressions.every(
            ce => this.resolver.getOrResolveTypeOf(ce).flags === firstType.flags
        )

        if (isTheSameTypes && isAllStatic && !this.resolver.isStringType(firstType)) {
            this.processSwitchStatementForBasicTypesInternal(node);
            return;
        }

        // hack: this could be a more serious issue with the type resolver
        if(areBothNumbers) {
            this.processSwitchStatementForBasicTypesInternal(node);
            return;
        }

        if(!this.resolver.isStringType(firstType)) {
            throw new Error(`Invalid type for switch: ${firstExpression.getText()}`);
        }

        this.processSwitchStatementForAnyInternal(node);
    }

    processSwitchStatementForBasicTypesInternal(node: ts.SwitchStatement) {
        const caseExpressions = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression);

        const isNumeric = this.resolver.isNumberType(this.resolver.getOrResolveTypeOf(node.expression));
        const isInteger = caseExpressions.every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
            && this.isInt((<ts.NumericLiteral>expression).text));

        this.writer.writeString(`switch (uint64(`);

        this.processExpression(node.expression);

        this.writer.writeStringNewLine('))');

        this.writer.BeginBlock();

        node.caseBlock.clauses.forEach(element => {
            this.writer.DecreaseIntent();
            if (element.kind === ts.SyntaxKind.CaseClause) {
                this.writer.writeString(`case `);
                (<any>element.expression).__skip_boxing = true;
                this.processExpression(element.expression);
            } else {
                this.writer.writeString('default');
            }

            this.writer.IncreaseIntent();

            this.writer.writeStringNewLine(':');
            element.statements.forEach(elementCase => {
                this.processStatement(elementCase);
            });
        });

        this.writer.EndBlock();
    }

    processSwitchStatementForAnyInternal(node: ts.SwitchStatement) {
        const switchName = `__switch${node.getFullStart()}_${node.getEnd()}`;
        const isAllStatic = node.caseBlock.clauses
            .filter(c => c.kind === ts.SyntaxKind.CaseClause)
            .map(element => (<ts.CaseClause>element).expression)
            .every(expression => expression.kind === ts.SyntaxKind.NumericLiteral
                || expression.kind === ts.SyntaxKind.StringLiteral
                || expression.kind === ts.SyntaxKind.TrueKeyword
                || expression.kind === ts.SyntaxKind.FalseKeyword);

        if (isAllStatic) {
            this.writer.writeString('static ');
        }

        this.writer.writeString(`TSDictionary<std::string,uint32>`
            +` ${switchName} = CreateDictionary<std::string,uint32>(`);
        this.writer.BeginBlock();

        let caseNumber = 0;
        node.caseBlock.clauses.filter(c => c.kind === ts.SyntaxKind.CaseClause).forEach(element => {
            if (caseNumber > 0) {
                this.writer.writeStringNewLine(',');
            }

            this.writer.BeginBlockNoIntent();
            this.writer.writeString('(');
            this.processExpression((<ts.CaseClause>element).expression);
            this.writer.writeString('), ');
            this.writer.writeString((++caseNumber).toString());
            this.writer.EndBlockNoIntent();
        });

        this.writer.EndBlock();
        this.writer.writeString(`)`);
        this.writer.EndOfStatement();


        this.writer.writeString(`switch (${switchName}[`);
        this.processExpression(node.expression);
        this.writer.writeStringNewLine('])');

        this.writer.BeginBlock();

        caseNumber = 0;
        node.caseBlock.clauses.forEach(element => {
            this.writer.DecreaseIntent();
            if (element.kind === ts.SyntaxKind.CaseClause) {
                this.writer.writeString(`case ${++caseNumber}`);
            } else {
                this.writer.writeString('default');
            }

            this.writer.IncreaseIntent();

            this.writer.writeStringNewLine(':');
            element.statements.forEach(elementCase => {
                this.processStatement(elementCase);
            });
        });

        this.writer.EndBlock();
    }

    processBlock(node: ts.Block): void {
        this.writer.BeginBlock();

        node.statements.forEach(element => {
            this.processStatement(element);
        });

        this.writer.EndBlock();
    }

    processModuleBlock(node: ts.ModuleBlock): void {
        node.statements.forEach(s => {
            this.processStatement(s);
        });
    }

    processBooleanLiteral(node: ts.BooleanLiteral): void {
        // find if you need to box value
        const boxing = (<any>node).__boxing;
        this.writer.writeString(`${node.kind === ts.SyntaxKind.TrueKeyword ? ('true' + (boxing ? '_t' : '')) : ('false' + (boxing ? '_t' : ''))}`);
    }

    isInt(valAsString: string) {
        const val = parseInt(valAsString, 10);
        return val.toString() === valAsString;
    }

    processNumericLiteral(node: ts.NumericLiteral): void {
        const boxing = (<any>node).__boxing;
        const val = parseInt(node.text, 10);
        const isInt = val.toString() === node.text;
        const isNegative = node.parent
            && node.parent.kind === ts.SyntaxKind.PrefixUnaryExpression
            && (<ts.PrefixUnaryExpression>node.parent).operator === ts.SyntaxKind.MinusToken;
        let suffix = '';
        if (isInt && val >= 2147483648) {
            suffix = 'll';
        }

        // find if you need to box value
        let currentNode: ts.Expression = node;
        if (isNegative) {
            currentNode = <ts.Expression>currentNode.parent;
        }

        while (currentNode && currentNode.parent && currentNode.parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
            currentNode = <ts.Expression>currentNode.parent;
        }

        this.writer.writeString(`${node.text}`);
        if (boxing) {
            this.writer.writeString(`_N`);
        } else {
            this.writer.writeString(`${suffix}`);
        }
    }

    processStringLiteral(node: ts.StringLiteral | ts.LiteralLikeNode
        | ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail): void {
        this.writer.writeString(`"${node.text.split('\\').join('\\\\').split('"').join('\\"').split('\n').join('\\n')}"`);
    }

    processNoSubstitutionTemplateLiteral(node: ts.NoSubstitutionTemplateLiteral): void {
        this.processStringLiteral(<ts.StringLiteral><any>node);
    }

    processTemplateExpression(node: ts.TemplateExpression): void {
        this.processStringLiteral(node.head);
        node.templateSpans.forEach(element => {
            this.writer.writeString(' + ');
            this.writer.writeString(' ToStr(');

            this.processExpression(element.expression);

            this.writer.writeString(')');

            this.writer.writeString(' + ');
            this.processStringLiteral(element.literal);
        });
    }

    processRegularExpressionLiteral(node: ts.RegularExpressionLiteral): void {
        this.writer.writeString('(new RegExp(');
        this.processStringLiteral(<ts.LiteralLikeNode>{ text: node.text.substring(1, node.text.length - 1) });
        this.writer.writeString('))');
    }

    processObjectLiteralExpression(node: ts.ObjectLiteralExpression): void {
        let next = false;

        const hasSpreadAssignment = node.properties.some(e => e.kind === ts.SyntaxKind.SpreadAssignment);

        if (hasSpreadAssignment) {
            this.writer.writeString('utils::assign(');
        }

        this.writer.writeString('');
        if (node.properties.length !== 0) {
            this.writer.BeginBlock();
            node.properties.forEach(element => {
                if (next && element.kind !== ts.SyntaxKind.SpreadAssignment) {
                    this.writer.writeStringNewLine(', ');
                }

                if (element.kind === ts.SyntaxKind.PropertyAssignment) {
                    const property = <ts.PropertyAssignment>element;

                    this.writer.writeString('std::pair{');

                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            /*|| property.name.kind === ts.SyntaxKind.NumericLiteral*/)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString(', ');
                    this.processExpression(property.initializer);
                    this.writer.writeString('}');
                } else if (element.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                    const property = <ts.ShorthandPropertyAssignment>element;

                    this.writer.writeString('std::pair{');

                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            || property.name.kind === ts.SyntaxKind.NumericLiteral)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString(', ');
                    if (property.name
                        && (property.name.kind === ts.SyntaxKind.Identifier
                            || property.name.kind === ts.SyntaxKind.NumericLiteral)) {
                        this.processExpression(ts.createStringLiteral(property.name.text));
                    } else {
                        this.processExpression(<ts.Expression>property.name);
                    }

                    this.writer.writeString('}');
                }

                next = true;
            });

            this.writer.EndBlock(true);
        } else {
            this.writer.writeString('{}');
        }

        if (hasSpreadAssignment) {
            node.properties.forEach(element => {
                if (element.kind === ts.SyntaxKind.SpreadAssignment) {
                    this.writer.writeString(', ');
                    const spreadAssignment = <ts.SpreadAssignment>element;
                    this.processExpression(spreadAssignment.expression);
                }
            });
            this.writer.writeString(')');
        }
    }

    processComputedPropertyName(node: ts.ComputedPropertyName): void {
        this.processExpression(node.expression);
    }

    processArrayLiteralExpression(node: ts.ArrayLiteralExpression): void {
        let next = false;

        const isDeconstruct = node.parent && node.parent.kind === ts.SyntaxKind.BinaryExpression
            && (<ts.BinaryExpression>node.parent).left === node;
        let isTuple = false;
        const type = this.resolver.typeToTypeNode(this.resolver.getOrResolveTypeOf(node));
        if (type && type.kind === ts.SyntaxKind.TupleType) {
            isTuple = true;
        }

        let elementsType = node.parent ? (<any>node).parent.type : undefined;
        if (!elementsType) {
            if (node.elements.length !== 0) {
                elementsType = this.resolver.typeToTypeNode(this.resolver.getTypeAtLocation(node.elements[0]));
            }
        } else {
            if (elementsType.elementType) {
                elementsType = elementsType.elementType;
            } else if (elementsType.typeArguments && elementsType.typeArguments[0]) {
                elementsType = elementsType.typeArguments[0];
            }
        }

        if (isDeconstruct) {
            this.writer.writeString('std::tie(');
            node.elements.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);

                next = true;
            });

            this.writer.writeString(')');
            return;
        }

        if (!isTuple) {
            let isCreateArray = node.parent && node.parent.getText().startsWith('CreateArray')
            if(!isCreateArray && !(node as any).__isIntLiteralArray) {
                this.writer.writeString('TSArray<');
                if (elementsType) {
                    this.processType(elementsType, false, false, false, false, node);
                } else {
                    this.attemptResolveBrokenArrayType(elementsType,node)
                }
                this.writer.writeString('>');
            }
        } else {
            this.processType(type);
        }

        if (node.elements.length !== 0) {
            this.writer.BeginBlockNoIntent();
            node.elements.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);

                next = true;
            });

            this.writer.EndBlockNoIntent();
        } else {
            this.writer.writeString('()');
        }
    }

    processElementAccessExpression(node: ts.ElementAccessExpression): void {

        const symbolInfo = this.resolver.getSymbolAtLocation(node.expression);
        const type = this.resolver.typeToTypeNode(this.resolver.getOrResolveTypeOf(node.expression));
        if (type && type.kind === ts.SyntaxKind.TupleType) {
            // tuple
            if (node.argumentExpression.kind !== ts.SyntaxKind.NumericLiteral) {
                throw new Error('Not implemented');
            }

            this.writer.writeString('std::get<');
            (<any>node.argumentExpression).__skip_boxing = true;
            this.processExpression(node.argumentExpression);
            this.writer.writeString('>(');
            this.processExpression(node.expression);
            this.writer.writeString(')');
        } else {
            let isWriting = false;
            let dereference = true;
            if (node.parent.kind === ts.SyntaxKind.BinaryExpression) {
                const binaryExpression = <ts.BinaryExpression>node.parent;
                isWriting = binaryExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken
                    && binaryExpression.left === node;
            }

            dereference = type
                && type.kind !== ts.SyntaxKind.TypeLiteral
                && type.kind !== ts.SyntaxKind.StringKeyword
                && type.kind !== ts.SyntaxKind.ArrayType
                && type.kind !== ts.SyntaxKind.ObjectKeyword
                && type.kind !== ts.SyntaxKind.AnyKeyword
                && symbolInfo
                && symbolInfo.valueDeclaration
                && (!(<ts.ParameterDeclaration>symbolInfo.valueDeclaration).dotDotDotToken)
                && (<any>symbolInfo.valueDeclaration).initializer
                && (<any>symbolInfo.valueDeclaration).initializer.kind !== ts.SyntaxKind.ObjectLiteralExpression;
            if (dereference) {
                this.writer.writeString('(');
            }

            this.processExpression(node.expression);

            if (dereference) {
                this.writer.writeString(')');
            }

            this.writer.writeString('[');
            this.processExpression(node.argumentExpression);
            this.writer.writeString(']');
        }
    }

    processParenthesizedExpression(node: ts.ParenthesizedExpression) {
        this.writer.writeString('(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    processTypeAssertionExpression(node: ts.TypeAssertion) {
        this.writer.writeString('static_cast<');
        this.processType(node.type);
        this.writer.writeString('>(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    processPrefixUnaryExpression(node: ts.PrefixUnaryExpression): void {

        const typeInfo = this.resolver.getOrResolveTypeOf(node.operand);
        const isEnum = this.resolver.isTypeFromSymbol(typeInfo, ts.SyntaxKind.EnumDeclaration);

        const op = this.opsMap[node.operator];
        const isFunction = op.substr(0, 2) === '__';
        if (isFunction) {
            this.writer.writeString(op.substr(2) + '(');
        } else {
            this.writer.writeString(op);
        }

        if (isEnum) {
            this.writer.writeString('double(');
        }

        this.processExpression(node.operand);

        if (isEnum) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(')');
        }
    }

    processPostfixUnaryExpression(node: ts.PostfixUnaryExpression): void {
        this.processExpression(node.operand);
        this.writer.writeString(this.opsMap[node.operator]);
    }

    processConditionalExpression(node: ts.ConditionalExpression): void {

        const whenTrueType = this.resolver.getOrResolveTypeOfAsTypeNode(node.whenTrue);
        const whenFalseType = this.resolver.getOrResolveTypeOfAsTypeNode(node.whenFalse);
        const equals = this.compareTypes(whenTrueType, whenFalseType);

        this.writer.writeString('(');
        this.processExpression(node.condition);
        this.writer.writeString(') ? ');

        this.processExpression(node.whenTrue);

        this.writer.writeString(' : ');

        this.processExpression(node.whenFalse);
    }

    processBinaryExpression(node: ts.BinaryExpression): void {
        const opCode = node.operatorToken.kind;
        if (opCode === ts.SyntaxKind.InstanceOfKeyword) {
            this.writer.writeString('is<');

            if (node.right.kind === ts.SyntaxKind.Identifier) {
                const identifier = <ts.Identifier>node.right;
                switch (identifier.text) {
                    case 'Number':
                    case 'String':
                        this.writer.writeString('std::string');
                        break;
                    case 'Boolean':
                        this.writer.writeString('js::');
                        this.writer.writeString(identifier.text.toLocaleLowerCase());
                        break;
                    default:
                        this.processExpression(node.right);
                        break;
                }
            } else {
                this.processExpression(node.right);
            }

            this.writer.writeString('>(');
            this.processExpression(node.left);
            this.writer.writeString(')');
            return;
        }

        let wrapIntoRoundBrackets =
               opCode === ts.SyntaxKind.AmpersandAmpersandToken
            || opCode === ts.SyntaxKind.BarBarToken
            || opCode === ts.SyntaxKind.PercentToken
            ;

        const op = this.opsMap[node.operatorToken.kind];
        const isFunction = op.substr(0, 2) === '__';
        if (isFunction) {
            this.writer.writeString(op.substr(2) + '(');
        }

        const leftType = this.resolver.getOrResolveTypeOf(node.left);
        const rightType = this.resolver.getOrResolveTypeOf(node.right);

        const isModulo = opCode === ts.SyntaxKind.PercentToken
        wrapIntoRoundBrackets = wrapIntoRoundBrackets || isModulo;

        const isLeftEnum = this.resolver.isTypeFromSymbol(leftType, ts.SyntaxKind.EnumDeclaration);
        const isRightEnum = this.resolver.isTypeFromSymbol(rightType, ts.SyntaxKind.EnumDeclaration);

        const leftSouldBePointer = isLeftEnum &&
            (opCode === ts.SyntaxKind.EqualsToken
            || opCode === ts.SyntaxKind.AmpersandToken
            || opCode === ts.SyntaxKind.BarEqualsToken
            || opCode === ts.SyntaxKind.CaretEqualsToken
            || opCode === ts.SyntaxKind.PercentEqualsToken);

        if (wrapIntoRoundBrackets) {
            if(isModulo) {
                this.writer.writeString('int64')
            }
            this.writer.writeString('(');
        }

        this.processExpression(node.left);

        if (wrapIntoRoundBrackets) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(', ');
        } else {
            this.writer.writeString(' ' + op + ' ');
        }

        if (wrapIntoRoundBrackets) {
            if(isModulo) {
                this.writer.writeString('int64')
            }
            this.writer.writeString('(');
        }

        this.processExpression(node.right);

        if (wrapIntoRoundBrackets) {
            this.writer.writeString(')');
        }

        if (isFunction) {
            this.writer.writeString(')');
        }
    }

    processDeleteExpression(node: ts.DeleteExpression): void {
        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propertyAccess = <ts.PropertyAccessExpression>node.expression;
            this.processExpression(propertyAccess.expression);
            this.writer.writeString('.Delete("');
            this.processExpression(<ts.Identifier>propertyAccess.name);
            this.writer.writeString('")');
        } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
            const elementAccessExpression = <ts.ElementAccessExpression>node.expression;
            this.processExpression(elementAccessExpression.expression);
            this.writer.writeString('.Delete(');
            this.processExpression(elementAccessExpression.argumentExpression);
            this.writer.writeString(')');
        } else {
            throw new Error('Method not implemented.');
        }
    }

    processNewExpression(node: ts.NewExpression): void {
        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            this.writer.writeString('(');
        }

        this.processCallExpression(node);

        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            this.writer.writeString(')');
        }
    }

    // @tswow-begin
    processGetData(node: ts.CallExpression) {
        let type = this.typeChecker.typeToString(
            this.resolver.getTypeOf(node.arguments[node.arguments.length-1]));
        this.processExpression(node.expression);
        this.writer.writeString(`<${type}>(ModID(),`);
        // field
        this.processExpression(node.arguments[0]);
        // db field
        this.writer.writeString(`,[](){ return `)
        this.processExpression(node.arguments[1]);
        this.writer.writeString(`;})`);
    }
    // @tswow-end

    processCallExpression(node: ts.CallExpression | ts.NewExpression): void {
        // @tswow-begin
        if(handleTSWoWOverride(this, node)) {
            return;
        }
        if(node.pos > 0 && node.getChildCount()>0) {
            let fsChild = node.getChildAt(0);
            if(fsChild.getChildCount()>0) {
                let lsGrandchild = fsChild.getChildAt(fsChild.getChildCount()-1);
                if(lsGrandchild.getText()=="GetObject") {
                    return this.processGetData(node as ts.CallExpression);
                }
            }
        }

        const isNew = node.kind === ts.SyntaxKind.NewExpression;
        const typeOfExpression = isNew && this.resolver.getOrResolveTypeOf(node.expression);
        const isArray = isNew && typeOfExpression && typeOfExpression.symbol && typeOfExpression.symbol.name === 'ArrayConstructor';

        if (node.kind === ts.SyntaxKind.NewExpression && !isArray) {
            this.writer.writeString('std::make_shared<');
        }

        if (isArray) {
            this.writer.writeString('TSArray');
        } else {

            this.processExpression(node.expression);
            this.processTemplateArguments(node);
        }

        if (node.kind === ts.SyntaxKind.NewExpression && !isArray) {
            // closing template
            this.writer.writeString('>');
        }

        this.writer.writeString('(');

        let next = false;
        if (node.arguments.length) {
            node.arguments.forEach(element => {
                if (next) {
                    this.writer.writeString(', ');
                }

                this.processExpression(element);
                next = true;
            });
        }

        this.writer.writeString(')');
    }

    processThisExpression(node: ts.ThisExpression): void {

        const method = this.scope[this.scope.length - 1];
        if (method
            && (this.isClassMemberDeclaration(method) || this.isClassMemberSignature(method))
            && this.isStatic(method)) {
            const classNode = <ts.ClassDeclaration>this.scope[this.scope.length - 2];
            if (classNode) {
                const identifier = classNode.name;
                this.writer.writeString(identifier.text);
                return;
            }
        }

        if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            this.writer.writeString('this');
        } else if (method.kind === ts.SyntaxKind.Constructor) {
            this.writer.writeString('_this');
        } else {
            this.writer.writeString('shared_from_this()');
        }
    }

    processSuperExpression(node: ts.SuperExpression): void {
        if (node.parent.kind === ts.SyntaxKind.CallExpression) {
            const classNode = <ts.ClassDeclaration>this.scope[this.scope.length - 2];
            if (classNode) {
                const heritageClause = classNode.heritageClauses[0];
                if (heritageClause) {
                    const firstType = heritageClause.types[0];
                    if (firstType.expression.kind === ts.SyntaxKind.Identifier) {
                        const identifier = <ts.Identifier>firstType.expression;
                        this.writer.writeString(identifier.text);
                        return;
                    }
                }
            }
        }

        this.writer.writeString('__super');
    }

    processVoidExpression(node: ts.VoidExpression): void {
        this.writer.writeString('Void(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    processNonNullExpression(node: ts.NonNullExpression): void {
        this.processExpression(node.expression);
    }

    processAsExpression(node: ts.AsExpression): void {
        this.writer.writeString('as<');
        this.processType(node.type);
        this.writer.writeString('>(');
        this.processExpression(node.expression);
        this.writer.writeString(')');
    }

    processSpreadElement(node: ts.SpreadElement): void {
        if (node.parent && node.parent.kind === ts.SyntaxKind.CallExpression) {
            const info = this.resolver.getSymbolAtLocation((<ts.CallExpression>node.parent).expression);
            const parameters = (<ts.FunctionDeclaration>info.valueDeclaration).parameters;
            if (parameters) {
                let next = false;
                parameters.forEach((item, index) => {
                    if (next) {
                        this.writer.writeString(', ');
                    }

                    const elementAccess = ts.createElementAccess(node.expression, index);
                    this.processExpression(this.fixupParentReferences(elementAccess, node.parent));
                    next = true;
                });
            }
        } else {
            this.processExpression(node.expression);
        }
    }

    processAwaitExpression(node: ts.AwaitExpression): void {
        this.writer.writeString('std::async([=]() { ');
        this.processExpression(node.expression);
        this.writer.writeString('; })');
    }

    processIdentifier(node: ts.Identifier): void {

        if (this.isWritingMain) {
            const isRightPartOfPropertyAccess = node.parent.kind === ts.SyntaxKind.QualifiedName
                || node.parent.kind === ts.SyntaxKind.PropertyAccessExpression
                    && (<ts.PropertyAccessExpression>(node.parent)).name === node;
            if (!isRightPartOfPropertyAccess) {
                const identifierSymbol = this.resolver.getSymbolAtLocation(node);
                const valDecl = identifierSymbol && identifierSymbol.valueDeclaration;
                if (valDecl) {
                    const containerParent = valDecl.parent.parent;
                    if (containerParent && this.isNamespaceStatement(containerParent)) {
                        const type = this.resolver.getOrResolveTypeOfAsTypeNode(containerParent);
                        if (type) {
                            this.processType(type);
                            this.writer.writeString('::');
                        }
                    }
                }
            }
        }

        // fix issue with 'continue'
        if (node.text === 'continue'
            || node.text === 'catch') {
            this.writer.writeString('_');
        }

        // @tswow-begin
        if(node.text === 'GetObject') {
            // todo: hack, we must support this for other calls too.
            this.writer.writeString('template GetObject');
        } else {
            this.writer.writeString(node.text);
        }
        // @tswow-end
    }

    processPropertyAccessExpression(node: ts.PropertyAccessExpression): void {
        // write constants directly (allows phantom const enums in declarations)
        try { // not sure if this can break, wrapping in try to be sure
            // resolve symbol fix: https://github.com/microsoft/TypeScript/issues/33203#issuecomment-527674536
            let symbol = this.typeChecker.getSymbolAtLocation(node);
            const constValue = this.typeChecker.getConstantValue(symbol.valueDeclaration as any);
            if(constValue!==undefined) {
                this.writer.writeString(`${constValue}`);
                return;
            }
        } catch(err) {}
        const typeInfo = this.resolver.getOrResolveTypeOf(node.expression);
        const symbolInfo = this.resolver.getSymbolAtLocation(node.name);
        const methodAccess = symbolInfo
            && symbolInfo.valueDeclaration.kind === ts.SyntaxKind.MethodDeclaration
            && !(node.parent.kind === ts.SyntaxKind.CallExpression && (<ts.CallExpression>node.parent).expression === node);
        const isStaticMethodAccess = symbolInfo && symbolInfo.valueDeclaration && this.isStatic(symbolInfo.valueDeclaration);

        const getAccess = symbolInfo
            && symbolInfo.declarations
            && symbolInfo.declarations.length > 0
            && (symbolInfo.declarations[0].kind === ts.SyntaxKind.GetAccessor
                || symbolInfo.declarations[0].kind === ts.SyntaxKind.SetAccessor)
            || node.name.text === 'length' && this.resolver.isArrayOrStringType(typeInfo);

        if (methodAccess) {
            if (isStaticMethodAccess) {
                this.writer.writeString('&');
                this.processExpression(<ts.Identifier>node.name);
            } else {
                this.writer.writeString('std::bind(&');
                const valueDeclaration = <ts.ClassDeclaration>symbolInfo.valueDeclaration.parent;
                this.processExpression(<ts.Identifier>valueDeclaration.name);
                this.writer.writeString('::');
                this.processExpression(<ts.Identifier>node.name);
                this.writer.writeString(', ');
                this.processExpression(node.expression);

                const methodDeclaration = <ts.MethodDeclaration>(symbolInfo.valueDeclaration);
                methodDeclaration.parameters.forEach((p, i) => {
                    this.writer.writeString(', std::placeholders::_' + (i + 1));
                });

                this.writer.writeString(')');
            }
        } else {
            if (node.expression.kind === ts.SyntaxKind.NewExpression
                || node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                this.writer.writeString('(');
            }

            // field access
            this.processExpression(node.expression);

            if (node.expression.kind === ts.SyntaxKind.NewExpression
                || node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                this.writer.writeString(')');
            }

            if (this.resolver.isAnyLikeType(typeInfo)) {
                this.writer.writeString('["');
                this.processExpression(<ts.Identifier>node.name);
                this.writer.writeString('"]');
                return;
            } else if (this.resolver.isStaticAccess(typeInfo)
                || node.expression.kind === ts.SyntaxKind.SuperKeyword
                || typeInfo && typeInfo.symbol && typeInfo.symbol.valueDeclaration
                && typeInfo.symbol.valueDeclaration.kind === ts.SyntaxKind.ModuleDeclaration) {
                this.writer.writeString('::');
            } else {
                this.writer.writeString('->');
            }

            if (getAccess) {
                if ((<any>node).__set === true) {
                    this.writer.writeString('set_');
                } else {
                    this.writer.writeString('get_');
                }
            }

            this.processExpression(<ts.Identifier>node.name);

            if (getAccess && (<any>node).__set !== true) {
                this.writer.writeString('()');
            }
        }
    }
}

