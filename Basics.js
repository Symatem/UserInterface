import { vec2, Panel } from './node_modules/SvgPanels/Panel.js';
import { PanePanel, TilingPanel, DropDownMenuPanel, ButtonPanel, ScrollViewPanel, IndexedListPanel } from './node_modules/SvgPanels/Containers.js';
import { LabelPanel, RectPanel, TextAreaPanel } from './node_modules/SvgPanels/Atoms.js';
import { Utils, SymbolInternals, SymbolMap, JavaScriptBackend } from './node_modules/SymatemJS/SymatemJS.mjs';
export const backend = new JavaScriptBackend();
const symbolObservers = SymbolMap.create();

function startObservingSymbol(observer, symbol) {
    SymbolMap.getOrInsert(symbolObservers, symbol, new Set()).add(observer);
}

function stopObservingSymbol(observer, symbol) {
    SymbolMap.get(symbolObservers, symbol).delete(observer);
}

function triggerObservedSymbol(symbol) {
    const observers = SymbolMap.get(symbolObservers, symbol);
    if(observers)
        for(const observer of observers)
            observer.backendUpdate();
}

export class SymbolThumbnailPanel extends LabelPanel {
    constructor(position, symbol, onActivate) {
        super(position);
        this._symbol = symbol;
        if(onActivate)
            this.addEventListener('action', onActivate);
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
};

export class BasicSymbolPanel extends PanePanel {
    constructor(position, symbol, onClick, acceptsDrop=(item) => item instanceof SymbolThumbnailPanel) {
        super(position, vec2.create());
        this.addEventListener('parentchange', (event) => {
            if(this.parent)
                startObservingSymbol(this, symbol);
            else
                stopObservingSymbol(this, symbol);
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
        this.symbolPanel = new SymbolThumbnailPanel(vec2.create(), symbol, onClick);
        this.symbolPanel.registerDropEvent(acceptsDrop,
            (item) => {
                this.symbol = item.symbol;
            }
        );
        this.headerPanel.insertChild(this.symbolPanel);
        this.headerPanel.recalculateLayout();
        this.insertChild(this.headerSplit);
    }

    get symbol() {
        return this.symbolPanel.symbol;
    }

    set symbol(symbol) {
        stopObservingSymbol(this, this.symbolPanel.symbol);
        startObservingSymbol(this, symbol);
        this.symbolPanel.symbol = symbol;
    }

    backendUpdate() {
        this.symbolPanel.backendUpdate();
        this.headerPanel.recalculateLayout();
    }
};

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
        super(position, symbol, () => {
            this.symbolPanel.selected = !this.symbolPanel.selected;
            for(const [symbol, betaCollection] of SymbolMap.entries(this.betaIndex)) {
                betaCollection.children[0].children[0].selected = this.symbolPanel.selected;
                for(const [symbol, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                    gammaRow.children[0].selected = this.symbolPanel.selected;
            }
        });
        const indexOptions = [];
        indexNames.forEach((name, index) => {
            const indexOption = new ButtonPanel(vec2.create(), 'toolbarMenuButton');
            indexOption.addEventListener('action', (event) => {
                this.indexSelection.overlayPanel.root.closeModalOverlay(event);
                this.index = index;
            });
            indexOption.insertChild(new LabelPanel(vec2.create(), name));
            indexOptions.push(indexOption);
        });
        this.indexSelection = new DropDownMenuPanel(vec2.create(), new LabelPanel(vec2.create()), indexOptions);
        this.headerPanel.insertChild(this.indexSelection);
        this.indexedListPanel = new IndexedListPanel(vec2.create(), vec2.create());
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
            if(isHeader) {
                rowPanel.backgroundPanel = new RectPanel(vec2.create(), vec2.create());
                rowPanel.backgroundPanel.node.classList.add('indexedListHeader');
            }
            rowPanel.insertChild(new SymbolThumbnailPanel(vec2.create(), symbol, () => {
                rowPanel.children[0].selected = !rowPanel.children[0].selected;
            }));
            rowPanel.children[0].backendUpdate();
            rowPanel.recalculateLayout();
            rowPanel.otherAxisSizeStays = true;
            betaCollection.insertChild(rowPanel);
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
                this.indexedListPanel.contentPanel.insertChild(betaCollection);
                makeRow(betaCollection, triple[1], true);
                SymbolMap.set(this.betaIndex, triple[1], betaCollection);
                betaCollection.registerActionEvent(() => {
                    const header = betaCollection.children[0].children[0];
                    header.selected = !header.selected;
                    for(const [symbol, gammaRow] of SymbolMap.entries(betaCollection.gammaSet))
                        gammaRow.children[0].selected = header.selected;
                });
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
};

export class SymbolDataContentPanel extends BasicSymbolPanel {
    constructor(position, symbol=backend.symbolByName.UTF8) {
        super(position, symbol);
        this.contentPanel = new TextAreaPanel(vec2.create(), vec2.create());
        this.contentPanel.recalculateLayout();
        this.contentPanel.addEventListener('change', (event) => {
            const data = Utils.decodeText(this.contentPanel.text);
            if(data && data != backend.getData(this.symbol)) {
                backend.setData(this.symbol, data);
                triggerObservedSymbol(this.symbol);
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
};

export class NamespacePanel extends BasicSymbolPanel {
    constructor(position, symbol=backend.symbolByName.Namespaces) {
        super(position, symbol, undefined, (item) => item instanceof SymbolThumbnailPanel && SymbolInternals.namespaceOfSymbol(item.symbol) == backend.metaNamespaceIdentity);
        this.listPanel = new TilingPanel(vec2.create(), vec2.create());
        this.listPanel.axis = 1;
        this.listPanel.registerFocusNavigationEvent();
        this.scrollViewPanel = new ScrollViewPanel(vec2.create(), vec2.create(), this.listPanel);
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
            let entry = SymbolMap.get(this.betaIndex, symbol);
            if(entry)
                continue;
            entry = new SymbolThumbnailPanel(vec2.create(), symbol, () => {
                entry.selected = !entry.selected;
            });
            this.listPanel.insertChild(entry);
            entry.backendUpdate();
            SymbolMap.set(this.betaIndex, symbol, entry);
        }
        for(const [symbol, entry] of SymbolMap.entries(this.betaIndex)) {
            if(!SymbolMap.get(symbols, symbol)) {
                this.listPanel.removeChild(entry);
                SymbolMap.remove(this.betaIndex, symbol);
            }
        }
        this.listPanel.recalculateLayout();
        this.scrollViewPanel.recalculateLayout();
    }
};
