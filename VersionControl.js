import { SymbolInternals, SymbolMap, RelocationTable, Repository } from './node_modules/SymatemJS/SymatemJS.mjs';
import { DagPanel } from './DAG.js';
import { backend } from './Basics.js';

export class RepositoryPanel extends DagPanel {
    constructor(position, symbol) {
        super(
            position,
            symbol,
            undefined,
            (item) => item instanceof SymbolThumbnailPanel && SymbolInternals.namespaceOfSymbol(item.symbol) == backend.metaNamespaceIdentity
        );
    }

    getVertices() {
        return [...this.repository.getVersions()].map(version => ({
            'vertex': version,
            'predecessorsByPort': [this.repository.getRelatives(version, backend.symbolByName.Parent)],
            'successorsByPort': [this.repository.getRelatives(version, backend.symbolByName.Child)]
        }));
    }

    get symbol() {
        return super.symbol;
    }

    set symbol(symbol) {
        super.symbol = symbol;
        this.repository = new Repository(backend, SymbolInternals.identityOfSymbol(symbol));
        this.backendUpdate();
    }
};
