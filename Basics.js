import { vec2 } from './node_modules/SvgPanels/Panel.js';
import { PanePanel, TilingPanel, DropDownMenuPanel, ButtonPanel, ScrollViewPanel, IndexedListPanel } from './node_modules/SvgPanels/Containers.js';
import { LabelPanel, RectPanel, TextAreaPanel } from './node_modules/SvgPanels/Atoms.js';
import { Utils, SymbolInternals, RelocationTable, SymbolMap, JavaScriptBackend, Diff } from './node_modules/SymatemJS/SymatemJS.mjs';
export const backend = new JavaScriptBackend();
const symbolObservers = SymbolMap.create();

export function startObservingSymbol(observer, symbol) {
    SymbolMap.getOrInsert(symbolObservers, symbol, new Set()).add(observer);
}

export function stopObservingSymbol(observer, symbol) {
    SymbolMap.get(symbolObservers, symbol).delete(observer);
}

const recordingRelocation = RelocationTable.create();
RelocationTable.set(recordingRelocation, 2, 5);
const materializationRelocation = RelocationTable.inverse(recordingRelocation),
      repositoryNamespace = 4;
backend.manifestSymbol(SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, repositoryNamespace));
backend.manifestSymbol(SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, 5));

export function createDiff() {
    return new Diff(backend, repositoryNamespace, recordingRelocation);
}

export function applyDiff(diff, recorded=true, reverse=false) {
    if(recorded) {
        if(diff.isEmpty()) {
            diff.unlink();
            return;
        }
        diff.commit();
        diff.link();
    } else if(!diff.apply(reverse, materializationRelocation))
        return;
    const accumulator = SymbolMap.create();
    if(recorded) {
        SymbolMap.set(accumulator, SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, diff.repositoryNamespace), true);
        for(const [source, destination] of RelocationTable.entries(recordingRelocation)) {
            SymbolMap.set(accumulator, SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, source), true);
            SymbolMap.set(accumulator, SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, destination), true);
        }
    } else
        for(const [source, destination] of RelocationTable.entries(materializationRelocation))
            SymbolMap.set(accumulator, SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, destination), true);
    for(const [alpha, operationsOfSymbol] of SymbolMap.entries(diff.operationsBySymbol)) {
        const symbol = RelocationTable.relocateSymbol(materializationRelocation, alpha);
        SymbolMap.set(accumulator, symbol, true);
        if(operationsOfSymbol.tripleOperations)
            for(const [beta, gammaCollection] of SymbolMap.entries(operationsOfSymbol.tripleOperations)) {
                SymbolMap.set(accumulator, RelocationTable.relocateSymbol(materializationRelocation, beta), true);
                for(const [gamma, link] of SymbolMap.entries(gammaCollection))
                    SymbolMap.set(accumulator, RelocationTable.relocateSymbol(materializationRelocation, gamma), true);
            }
        if(operationsOfSymbol.manifestOrRelease)
            SymbolMap.set(accumulator, SymbolInternals.concatIntoSymbol(backend.metaNamespaceIdentity, SymbolInternals.namespaceOfSymbol(symbol)), true);
    }
    const observersToTrigger = new Set();
    for(const symbol of SymbolMap.keys(accumulator)) {
        const observers = SymbolMap.get(symbolObservers, symbol);
        if(observers)
            for(const observer of observers)
                observersToTrigger.add(observer);
    }
    for(const observer of observersToTrigger)
        observer.backendUpdate();
}

export class SymbolThumbnailPanel extends LabelPanel {
    constructor(position, symbol) {
        super(position);
        this._symbol = symbol;
        this.registerFocusEvent(this.node);
        this.registerDragEvent(() => {
            const panel = new SymbolThumbnailPanel(vec2.create(), this._symbol);
            panel.backendUpdate();
            return panel;
        });
        this.addEventListener('parentchange', (event) => {
            if(this.parent)
                startObservingSymbol(this, symbol);
            else
                stopObservingSymbol(this, symbol);
        });
    }

    get symbol() {
        return this._symbol;
    }

    set symbol(symbol) {
        stopObservingSymbol(this, this.symbol);
        startObservingSymbol(this, symbol);
        this._symbol = symbol;
        this.backendUpdate();
    }

    backendUpdate() {
        const data = backend.getData(this.symbol);
        this.text = (data) ? Utils.encodeText(data) : '#'+this.symbol;
    }
}

function acceptsDropDefault(item) {
    return item instanceof SymbolThumbnailPanel && this.symbol != item.symbol;
}

export class BasicSymbolPanel extends PanePanel {
    constructor(position, symbol, acceptsDrop) {
        super(position, vec2.create());
        this.addEventListener('parentchange', (event) => {
            if(this.parent)
                startObservingSymbol(this, this.symbol);
            else
                stopObservingSymbol(this, this.symbol);
        });
        this.headerSplit = new TilingPanel(vec2.create(), vec2.create());
        this.headerSplit.padding = vec2.fromValues(5, 5);
        this.headerSplit.axis = 1;
        this.headerSplit.sizeAlongAxis = 1;
        this.headerSplit.otherAxisAlignment = 'stretch';
        this.headerSplit.otherAxisSizeStays = true;
        this.headerSplit.interChildSpacing = 5;
        this.headerPanel = new TilingPanel(vec2.create(), vec2.create());
        this.headerPanel.axis = 0;
        this.headerPanel.sizeAlongAxis = 0;
        this.headerSplit.insertChild(this.headerPanel);
        this.symbolPanel = new SymbolThumbnailPanel(vec2.create(), symbol);
        this.symbolPanel.registerDropEvent(acceptsDrop || acceptsDropDefault.bind(this), (item) => {
            this.symbol = item.symbol;
        });
        this.headerPanel.insertChild(this.symbolPanel);
        this.headerPanel.recalculateLayout();
        this.insertChild(this.headerSplit);
    }

    get symbol() {
        return this.symbolPanel.symbol;
    }

    set symbol(symbol) {
        stopObservingSymbol(this, this.symbol);
        startObservingSymbol(this, symbol);
        this.symbolPanel.symbol = symbol;
    }

    backendUpdate() {
        this.symbolPanel.backendUpdate();
        this.headerPanel.recalculateLayout();
    }
}

const indexNames = ['EAV', 'AVE', 'VEA', 'EVA', 'AEV', 'VAE'],
      triplePermutation = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
    [0, 2, 1],
    [1, 0, 2],
    [2, 1, 0]
];

export class TriplePanel extends BasicSymbolPanel {
    constructor(position, symbol=backend.symbolByName.UTF8) {
        super(position, symbol);
        this.addEventListener('toolbarcontext', (event) => {
            this.root.toolBarPanel.setContext(event, {'content': 'Context', 'children': [
                {'content': 'Add Triple', 'shortCut': 'T', 'action': (event) => {
                    const diff = createDiff();
                    let createBeta = true;
                    for(const [beta, betaCollection] of SymbolMap.entries(this.betaIndex))
                        if(betaCollection.header.selected) {
                            diff.setTriple([this.symbol, beta, backend.symbolByName.Void], true);
                            createBeta = false;
                        }
                    if(createBeta)
                        diff.setTriple([this.symbol, backend.symbolByName.Void, backend.symbolByName.Void], true);
                    applyDiff(diff);
                }},
                {'content': 'Delete Selected', 'shortCut': '⌫', 'action': (event) => {
                    const diff = createDiff();
                    for(const [beta, betaCollection] of SymbolMap.entries(this.betaIndex))
                        for(const [gamma, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                            if(gammaRow.children[0].selected)
                                diff.setTriple([this.symbol, beta, gamma], false);
                    applyDiff(diff);
                }}
            ]});
        });
        const indexOptions = [];
        indexNames.forEach((name, index) => {
            const indexOption = new ButtonPanel(vec2.create(), 'toolbarMenuButton');
            indexOption.registerActionEvent((event) => {
                this.indexSelection.overlayPanel.root.closeModalOverlay(event);
                this.index = index;
            });
            indexOption.insertChild(new LabelPanel(vec2.create(), name));
            indexOptions.push(indexOption);
        });
        this.indexSelection = new DropDownMenuPanel(vec2.create(), new LabelPanel(vec2.create()), indexOptions);
        this.headerPanel.insertChild(this.indexSelection);
        this.indexedListPanel = new IndexedListPanel(vec2.create(), vec2.create());
        this.indexedListPanel.enableSelectionRect = true;
        this.indexedListPanel.contentPanel.registerFocusNavigationEvent();
        this.headerSplit.insertChild(this.indexedListPanel);
        this.betaIndex = SymbolMap.create();
        this.index = 0;
        this.addEventListener('focusnavigation', (event) => {
            switch(event.direction) {
                case 'in':
                case 'left':
                    this.symbolPanel.dispatchEvent({'type': 'focus'});
                    break;
                case 'right':
                    this.indexSelection.dispatchEvent({'type': 'focus'});
                    break;
                case 'down':
                    this.indexedListPanel.contentPanel.dispatchEvent({'type': 'focusnavigation', 'direction': 'in'});
                    break;
            }
            return true;
        });
    }

    get index() {
        return this._index;
    }

    set index(_index) {
        this._index = _index;
        this.indexSelection.contentPanel.text = indexNames[this.index];
        this.indexSelection.recalculateLayout();
        this.backendUpdate();
    }

    get symbol() {
        return super.symbol;
    }

    set symbol(symbol) {
        super.symbol = symbol;
        this.index = 0;
    }

    backendUpdate() {
        super.backendUpdate();
        let query;
        switch(this.index) {
            case 0:
            case 3:
                query = backend.queryTriples(backend.queryMasks.MVV, [this.symbol, backend.symbolByName.Void, backend.symbolByName.Void]);
                break;
            case 1:
            case 4:
                query = backend.queryTriples(backend.queryMasks.VMV, [backend.symbolByName.Void, this.symbol, backend.symbolByName.Void]);
                break;
            case 2:
            case 5:
                query = backend.queryTriples(backend.queryMasks.VVM, [backend.symbolByName.Void, backend.symbolByName.Void, this.symbol]);
                break;
        }
        const makeRow = (betaCollection, symbol, isHeader) => {
            const rowPanel = new TilingPanel(vec2.create(), vec2.fromValues(0, 20));
            rowPanel.axis = 1;
            rowPanel.sizeAlongAxis = 'centering';
            rowPanel.padding[0] = 25;
            const symbolPanel = new SymbolThumbnailPanel(vec2.create(), symbol);
            rowPanel.insertChild(symbolPanel);
            symbolPanel.registerSelectEvent();
            symbolPanel.backendUpdate();
            if(isHeader) {
                rowPanel.backgroundPanel = new RectPanel(vec2.create(), vec2.create());
                rowPanel.backgroundPanel.node.classList.add('indexedListHeader');
                symbolPanel.registerDropEvent(acceptsDropDefault.bind(symbolPanel), (item) => {
                    const diff = createDiff();
                    for(const [gamma, gammaRow] of SymbolMap.entries(betaCollection.gammaSet)) {
                        diff.setTriple([this.symbol, symbolPanel.symbol, gamma], false);
                        diff.setTriple([this.symbol, item.symbol, gamma], true);
                    }
                    applyDiff(diff);
                });
            } else {
                symbolPanel.registerDropEvent(acceptsDropDefault.bind(symbolPanel), (item) => {
                    const diff = createDiff();
                    diff.setTriple([this.symbol, rowPanel.parent.header.symbol, symbolPanel.symbol], false);
                    diff.setTriple([this.symbol, rowPanel.parent.header.symbol, item.symbol], true);
                    applyDiff(diff);
                });
            }
            rowPanel.recalculateLayout();
            rowPanel.otherAxisSizeStays = true;
            betaCollection.insertChild(rowPanel, 0);
            return rowPanel;
        }
        for(const [symbol, betaCollection] of SymbolMap.entries(this.betaIndex)) {
            betaCollection.deletionFlag = true;
            for(const [symbol, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                gammaRow.deletionFlag = true;
        }
        for(let triple of query) {
            triple = [triple[triplePermutation[this.index][0]], triple[triplePermutation[this.index][1]], triple[triplePermutation[this.index][2]]];
            let betaCollection = SymbolMap.get(this.betaIndex, triple[1]);
            if(!betaCollection) {
                betaCollection = new TilingPanel(vec2.create(), vec2.create());
                betaCollection.gammaSet = SymbolMap.create();
                betaCollection.reverse = true;
                betaCollection.header = makeRow(betaCollection, triple[1], true).children[0];
                betaCollection.header.parent.addEventListener('pointerstart', (event) => true);
                betaCollection.addEventListener('select', (event) => {
                    event.propagateTo = 'children';
                    if(event.bounds)
                        return;
                    for(const [symbol, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                        gammaRow.dispatchEvent(event);
                    betaCollection.header.dispatchEvent(event);
                });
                this.indexedListPanel.contentPanel.insertChild(betaCollection);
                SymbolMap.set(this.betaIndex, triple[1], betaCollection);
                betaCollection.registerFocusEvent(betaCollection.children[0].backgroundPanel.node);
                betaCollection.registerFocusNavigationEvent(1);
            } else
                delete betaCollection.deletionFlag;
            let gammaRow = SymbolMap.get(betaCollection.gammaSet, triple[2]);
            if(!gammaRow) {
                gammaRow = makeRow(betaCollection, triple[2], false);
                SymbolMap.set(betaCollection.gammaSet, triple[2], gammaRow);
            } else
                delete gammaRow.deletionFlag;
        }
        for(const [symbol, betaCollection] of SymbolMap.entries(this.betaIndex)) {
            if(betaCollection.deletionFlag) {
                this.indexedListPanel.contentPanel.removeChild(betaCollection);
                SymbolMap.remove(this.betaIndex, symbol);
            } else for(const [symbol, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                if(gammaRow.deletionFlag) {
                    betaCollection.removeChild(gammaRow);
                    SymbolMap.remove(betaCollection.gammaSet, symbol);
                }
        }
        for(const betaCollection of this.indexedListPanel.contentPanel.children) {
            betaCollection.axis = 1;
            betaCollection.otherAxisAlignment = 'stretch';
            betaCollection.recalculateLayout();
            betaCollection.otherAxisSizeStays = true;
        }
        this.indexedListPanel.contentPanel.recalculateLayout();
        this.indexedListPanel.recalculateLayout();
    }
}

PanePanel.registerPaneType(TriplePanel, 'Triple Panel', 'T');

export class SymbolDataContentPanel extends BasicSymbolPanel {
    constructor(position, symbol=backend.symbolByName.UTF8) {
        super(position, symbol);
        this.contentPanel = new TextAreaPanel(vec2.create(), vec2.create());
        this.contentPanel.recalculateLayout();
        this.contentPanel.addEventListener('change', (event) => {
            const data = Utils.decodeText(this.contentPanel.text);
            if(data && data != backend.getData(this.symbol)) {
                const diff = createDiff();
                diff.setData(this.symbol, data);
                applyDiff(diff);
            }
        });
        this.headerSplit.insertChild(this.contentPanel);
        this.backendUpdate();
        this.addEventListener('focusnavigation', (event) => {
            switch(event.direction) {
                case 'in':
                case 'up':
                    this.symbolPanel.dispatchEvent({'type': 'focus'});
                    break;
                case 'down':
                    this.contentPanel.dispatchEvent({'type': 'focus'});
                    break;
            }
            return true;
        });
    }

    get symbol() {
        return super.symbol;
    }

    set symbol(symbol) {
        super.symbol = symbol;
        this.backendUpdate();
    }

    backendUpdate() {
        super.backendUpdate();
        this.contentPanel.text = Utils.encodeText(backend.getData(this.symbol));
    }
}

PanePanel.registerPaneType(SymbolDataContentPanel, 'Symbol Data Panel', 'S');

export class NamespacePanel extends BasicSymbolPanel {
    constructor(position, symbol=backend.symbolByName.Namespaces) {
        super(position, symbol, (item) => item instanceof SymbolThumbnailPanel && SymbolInternals.namespaceOfSymbol(item.symbol) == backend.metaNamespaceIdentity);
        this.addEventListener('toolbarcontext', (event) => {
            this.root.toolBarPanel.setContext(event, {'content': 'Context', 'children': [
                {'content': 'Add Symbol', 'shortCut': 'S', 'action': (event) => {
                    const diff = createDiff();
                    diff.createSymbol(SymbolInternals.identityOfSymbol(this.symbol));
                    applyDiff(diff);
                }},
                {'content': 'Delete Selected', 'shortCut': '⌫', 'action': (event) => {
                    const diff = createDiff();
                    for(const [symbol, symbolPanel] of SymbolMap.entries(this.betaIndex))
                        if(symbolPanel.selected)
                            diff.unlinkSymbol(symbol);
                    applyDiff(diff);
                }}
            ]});
        });
        this.listPanel = new TilingPanel(vec2.create(), vec2.create());
        this.listPanel.axis = 1;
        this.listPanel.registerFocusNavigationEvent();
        this.scrollViewPanel = new ScrollViewPanel(vec2.create(), vec2.create(), this.listPanel);
        this.scrollViewPanel.enableSelectionRect = true;
        this.headerSplit.insertChild(this.scrollViewPanel);
        this.betaIndex = SymbolMap.create();
        this.backendUpdate();
        this.addEventListener('focusnavigation', (event) => {
            switch(event.direction) {
                case 'in':
                    this.symbolPanel.dispatchEvent({'type': 'focus'});
                    break;
                case 'down':
                    this.listPanel.dispatchEvent({'type': 'focusnavigation', 'direction': 'in'});
                    break;
            }
            return true;
        });
    }

    get symbol() {
        return super.symbol;
    }

    set symbol(symbol) {
        super.symbol = symbol;
        this.backendUpdate();
    }

    backendUpdate() {
        super.backendUpdate();
        const symbols = SymbolMap.create();
        for(const symbol of backend.querySymbols(SymbolInternals.identityOfSymbol(this.symbol))) {
            SymbolMap.set(symbols, symbol, true);
            let symbolPanel = SymbolMap.get(this.betaIndex, symbol);
            if(symbolPanel)
                continue;
            symbolPanel = new SymbolThumbnailPanel(vec2.create(), symbol);
            this.listPanel.insertChild(symbolPanel);
            symbolPanel.registerSelectEvent();
            symbolPanel.backendUpdate();
            SymbolMap.set(this.betaIndex, symbol, symbolPanel);
        }
        for(const [symbol, symbolPanel] of SymbolMap.entries(this.betaIndex)) {
            if(!SymbolMap.get(symbols, symbol)) {
                this.listPanel.removeChild(symbolPanel);
                SymbolMap.remove(this.betaIndex, symbol);
            }
        }
        this.listPanel.recalculateLayout();
        this.scrollViewPanel.recalculateLayout();
    }
}

PanePanel.registerPaneType(NamespacePanel, 'Namespace Panel', 'N');
