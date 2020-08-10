import { SymbolInternals, SymbolMap, RelocationTable, Repository } from './node_modules/SymatemJS/SymatemJS.mjs';
import { PanePanel } from './node_modules/SvgPanels/Containers.js';
import { DagPanel } from './DAG.js';
import { backend, SymbolThumbnailPanel } from './Basics.js';

export class RepositoryPanel extends DagPanel {
    constructor(position, symbol) {
        super(
            position,
            symbol,
            (item) => item instanceof SymbolThumbnailPanel && SymbolInternals.namespaceOfSymbol(item.symbol) == backend.metaNamespaceIdentity
        );
        this.addEventListener('toolbarcontext', (event) => {
            this.root.toolBarPanel.setContext(event, {'content': 'Context', 'children': [
                {'content': 'Add Orphan Version', 'shortCut': 'O'},
                {'content': 'Add Branch Version', 'shortCut': 'B'},
                {'content': 'Add Diff', 'shortCut': 'D'},
                {'content': 'Apply Diff', 'shortCut': 'A'},
                {'content': 'Materialize', 'shortCut': 'M'},
                {'content': 'Three Way Merge', 'shortCut': 'T'},
                {'content': 'Commutation Merge', 'shortCut': 'C'},
                {'content': 'Rebase Diffs', 'shortCut': 'R'},
                {'content': 'Squash Versions', 'shortCut': 'S'},
                {'content': 'Delete Selected', 'shortCut': '⌫'}
            ]});
        });
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
}

PanePanel.registerPaneType(RepositoryPanel, 'Repository Panel', 'R');
