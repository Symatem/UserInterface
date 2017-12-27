import WiredPanels from '../WiredPanels/WiredPanels.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';
import NativeBackend from '../SymatemJS/NativeBackend.js';
import FuzzySearchIndex from './FuzzySearchIndex.js';

const backend = new NativeBackend(),
      symbolIndex = new Map(),
      labelIndex = new FuzzySearchIndex();

for(const name in BasicBackend.symbolByName)
    labelOfSymbol(BasicBackend.symbolByName[name], true);



function updateListHeight(leaf, heightDiff) {
    for(let ul = leaf; ul.classList.contains('ul'); ul = ul.parentNode.parentNode) {
        const height = parseInt(ul.getAttribute('height'))+heightDiff;
        ul.setAttribute('height', height);
        ul.style.height = height;
    }
}

function makeListCollapsable(ul) {
    for(const child of ul.getElementsByClassName('ul'))
        if(child.parentNode.parentNode === ul)
            makeListCollapsable(child);
    const parent = ul.parentNode, triangle = parent.getElementsByClassName('triangle')[0];
    if(!triangle || triangle.parentNode !== parent)
        return;
    ul.style.height = 'auto';
    const height = ul.offsetHeight;
    ul.setAttribute('height', height);
    ul.style.height = 0;
    function click(event) {
        let height = parseInt(ul.getAttribute('height'));
        const collapse = parent.classList.contains('open');
        if(collapse)
            parent.classList.remove('open');
        else
            parent.classList.add('open');
        ul.style.height = (collapse) ? 0 : height;
        if(collapse)
            height *= -1;
        updateListHeight(parent.parentNode, height);
        event.stopPropagation();
    };
    triangle.onclick = click;
    if(triangle.nextElementSibling)
        triangle.nextElementSibling.onclick = click;
}

function encodeHTML(element, dataValue) {
    if(dataValue instanceof Array) {
        const triangle = document.createElement('div');
        element.appendChild(triangle);
        triangle.classList.add('triangle');
        const span = document.createElement('span');
        element.appendChild(span);
        span.innerText = 'Composite';
        const cross = document.createElement('div');
        element.appendChild(cross);
        cross.classList.add('crossmark');
        cross.onclick = function(event) {
            if(element.classList.contains('open')) {
                const li = document.createElement('div');
                li.classList.add('li');
                ul.appendChild(li);
                encodeHTML(li, 'New Item');
                updateListHeight(ul, li.offsetHeight);
            } else if(element !== modalContent) {
                updateListHeight(element.parentNode, -span.offsetHeight);
                element.parentNode.removeChild(element);
            } else {
                element.classList.remove('marginForMarks');
                element.innerHTML = '';
                encodeHTML(element, 'New Item');
            }
        };
        const ul = document.createElement('div');
        ul.classList.add('ul');
        element.appendChild(ul);
        for(const child of dataValue) {
            const li = document.createElement('div');
            li.classList.add('li');
            ul.appendChild(li);
            encodeHTML(li, child);
        }
    } else {
        const span = document.createElement('span');
        element.appendChild(span);
        span.setAttribute('contentEditable', 'true');
        span.innerText = BasicBackend.encodeText(dataValue);
        if(element !== modalContent) {
            const cross = document.createElement('div');
            element.appendChild(cross);
            cross.classList.add('crossmark');
            cross.onclick = function(event) {
                updateListHeight(element.parentNode, -element.offsetHeight);
                element.parentNode.removeChild(element);
            };
        }
    }
}

function decodeHTML(element) {
    if(element.children[0].tagName === 'SPAN')
        return BasicBackend.decodeText(element.innerText);
    const dataValue = [];
    for(const li of element.children[3].children)
        dataValue.push(decodeHTML(li));
    return dataValue;
}



function labelOfSymbol(symbol, forceUpdate) {
    let entry;
    if(!symbolIndex.has(symbol)) {
        entry = {'symbol': symbol};
        symbolIndex.set(symbol, entry);
    } else
        entry = symbolIndex.get(symbol);
    if(entry.label && forceUpdate != undefined)
        labelIndex.delete(entry);
    if(!entry.label || forceUpdate) {
        const data = backend.getData(symbol);
        if(data != undefined) {
            entry.label = BasicBackend.encodeText(data);
            labelIndex.add(entry);
        } else {
            const namespaceSymbol = BasicBackend.symbolInNamespace('Namespaces', BasicBackend.namespaceOfSymbol(symbol)),
                  namespaceData = backend.getData(namespaceSymbol);
            if(namespaceData)
                entry.label = BasicBackend.encodeText(namespaceData)+':'+BasicBackend.identityOfSymbol(symbol);
            else
                entry.label = BasicBackend.encodeText(symbol);
        }
        if(entry.label.length > 20)
            entry.label = entry.label.substr(0, 15)+'…'+entry.label.substr(-5);
    }
    return entry;
}

function updateLabels(symbol, updateGeometry=false) {
    const entry = labelOfSymbol(symbol, true),
          panels = new Set();
    for(const socket of entry.sockets) {
        socket.label.textContent = entry.label;
        panels.add(socket.panel);
    }
    if(updateGeometry)
        for(const panel of panels)
            wiredPanels.updatePanelGeometry(panel);
}

function setSocketVisibility(socket, visible) {
    if(visible) {
        let entry;
        if(!symbolIndex.has(socket.symbol)) {
            entry = {'symbol': socket.symbol, 'sockets': new Set()};
            symbolIndex.set(socket.symbol, entry);
        } else {
            entry = symbolIndex.get(socket.symbol);
            if(!entry.sockets)
                entry.sockets = new Set();
        }
        entry.sockets.add(socket);
    } else {
        const entry = symbolIndex.get(socket.symbol);
        entry.sockets.delete(socket);
        if(entry.sockets.size === 0)
            delete entry.sockets;
    }
}

function setPanelVisibility(panel, visible) {
    if(visible) {
        if(!symbolIndex.has(panel.symbol))
            symbolIndex.set(panel.symbol, {'symbol': symbol, 'panel': panel});
        else
            symbolIndex.get(panel.symbol).panel = panel;
    } else if(symbolIndex.has(panel.symbol))
        delete symbolIndex.get(panel.symbol).panel;
    for(const socket of panel.sockets)
        setSocketVisibility(socket, visible);
}

function setNodesVisibility(nodes, visibility) {
    for(const node of nodes)
        switch(node.type) {
            case 'socket':
                setSocketVisibility(node, visibility);
                break;
            case 'panel':
                setPanelVisibility(node, visibility);
                break;
        }
}

function addWireFromEntitySocket(nodesToAdd, socket) {
    const srcPanel = getPanel(socket.symbol);
    if(srcPanel) {
        const wire = wiredPanels.createWire();
        wire.srcSocket = srcPanel.entitySocket;
        wire.dstSocket = socket;
        nodesToAdd.add(wire);
    }
}

function getPanel(symbol) {
    if(!symbolIndex.has(symbol))
        return;
    return symbolIndex.get(symbol).panel;
}

function addPanel(nodesToAdd, symbol) {
    let panel = getPanel(symbol);
    if(panel)
        return panel;
    panel = wiredPanels.createPanel();
    panel.symbol = symbol;
    nodesToAdd.add(panel);

    const namespaceSocket = wiredPanels.createSocket();
    namespaceSocket.panel = panel;
    namespaceSocket.orientation = 'top';
    namespaceSocket.symbol = BasicBackend.symbolInNamespace('Namespaces', BasicBackend.namespaceOfSymbol(symbol));
    namespaceSocket.label.textContent = labelOfSymbol(namespaceSocket.symbol, true).label;
    nodesToAdd.add(namespaceSocket);

    const entitySocket = panel.entitySocket = wiredPanels.createSocket();
    entitySocket.panel = panel;
    entitySocket.orientation = 'top';
    entitySocket.symbol = panel.symbol;
    nodesToAdd.add(entitySocket);

    const entry = labelOfSymbol(entitySocket.symbol, true);
    entitySocket.label.textContent = entry.label;
    if(entry.sockets)
        for(const socket of entry.sockets) {
            const wire = wiredPanels.createWire();
            wire.srcSocket = entitySocket;
            wire.dstSocket = socket;
            nodesToAdd.add(wire);
        }

    setPanelVisibility(panel, true);
    addWireFromEntitySocket(nodesToAdd, namespaceSocket);
    for(const triple of backend.queryTriples(BasicBackend.queryMask.MVV, [panel.symbol, 0, 0]))
        setTripleVisibility(nodesToAdd, triple, panel, true);
    return panel;
}

function getOppositeSocket(socket, triple) {
    let oppositeSocket;
    triple.push(socket.panel.symbol);
    if(socket.orientation === 'left') {
        const index = socket.panel.leftSockets.indexOf(socket);
        oppositeSocket = socket.panel.rightSockets[index];
        triple.push(socket.symbol);
        triple.push(oppositeSocket.symbol);
    } else {
        const index = socket.panel.rightSockets.indexOf(socket);
        oppositeSocket = socket.panel.leftSockets[index];
        triple.push(oppositeSocket.symbol);
        triple.push(socket.symbol);
    }
    return oppositeSocket;
}

function addTripleTemplate(panel, nodesToAdd) {
    const sockets = [];
    for(let i = 0; i < 2; ++i) {
        const socket = wiredPanels.createSocket();
        socket.panel = panel;
        socket.orientation = (i == 0) ? 'left' : 'right';
        nodesToAdd.add(socket);
        sockets.push(socket);
    }
    return sockets;
}

function replaceTripleTemplate(socket, prevSymbol, nextSymbol, forward) {
    if(!forward) {
        const swap = nextSymbol;
        nextSymbol = prevSymbol;
        prevSymbol = swap;
    }
    function setVisibility(triple, forward) {
        getOppositeSocket(socket, triple);
        setSocketVisibility(socket, forward);
        if(triple[1] != undefined && triple[2] != undefined)
            backend.setTriple(triple, forward);
    }
    const prevTriple = [], nextTriple = [];
    if(prevSymbol != undefined)
        setVisibility(prevTriple, false);
    if(nextSymbol != undefined) {
        socket.symbol = nextSymbol;
        socket.label.textContent = labelOfSymbol(nextSymbol).label;
        setVisibility(nextTriple, true);
    } else {
        delete socket.symbol;
        socket.label.textContent = '';
    }
    if(prevTriple[1] === BasicBackend.symbolByName.Encoding || nextTriple[1] === BasicBackend.symbolByName.Encoding)
        updateLabels(socket.panel.symbol, true);
    else
        wiredPanels.updatePanelGeometry(socket.panel);
}

function setTripleVisibility(nodesToAddOrRemove, triple, panel, forward) {
    if(!panel) {
        panel = getPanel(triple[0]);
        if(!panel)
            return;
    }
    if(forward)
        for(let i = 1; i < 3; ++i) {
            const socket = wiredPanels.createSocket();
            socket.panel = panel;
            socket.orientation = (i === 1) ? 'left' : 'right';
            socket.symbol = triple[i];
            socket.label.textContent = labelOfSymbol(socket.symbol).label;
            nodesToAddOrRemove.add(socket);
            addWireFromEntitySocket(nodesToAddOrRemove, socket);
        }
    else
        for(let i = 0; i < panel.leftSockets.length; ++i)
            if(panel.leftSockets[i].symbol === triple[1] && panel.rightSockets[i].symbol === triple[2]) {
                nodesToAddOrRemove.add(panel.leftSockets[i]);
                nodesToAddOrRemove.add(panel.rightSockets[i]);
                return;
            }
}

function linkSymbol(update, forward) {
    if(forward) {
        backend.manifestSymbol(update.symbol);
        backend.setRawData(update.symbol, update.data);
    }
    for(const triple of update.triples)
        backend.setTriple(triple, forward);
    if(!forward)
        backend.releaseSymbol(update.symbol);
}

function openModal(accept) {
    if(modalContent)
        modalContent.parentNode.removeChild(modalContent);
    modalContent = document.createElement('div');
    modalContent.setAttribute('id', 'modalContent');
    modal.children[0].appendChild(modalContent);
    modalPositive.onclick = accept;
    modal.removeAttribute('style');
    modal.classList.remove('fadeOut');
    modal.classList.add('fadeIn');
}

function closeModal() {
    modal.classList.remove('fadeIn');
    modal.classList.add('fadeOut');
}

function openSearch(socket) {
    let selection, searchInput;
    function accept() {
        closeModal();
        if(selection == undefined)
            return;
        const entry = results.children[selection].entry;
        let update;
        if(entry.symbol == undefined) {
            entry.symbol = backend.createSymbol(entry.namespace);
            backend.setData(entry.symbol, entry.data);
            update = {'symbol': entry.symbol, 'data': backend.getRawData(entry.symbol), 'triples': []};
            const encoding = backend.getSolitary(entry.symbol, BasicBackend.symbolByName.Encoding);
            if(encoding !== BasicBackend.symbolByName.Void)
                update.triples.push([entry.symbol, BasicBackend.symbolByName.Encoding, encoding]);
        } else
            backend.manifestSymbol(entry.symbol);
        const nodesToAdd = new Set(),
              panel = (socket) ? undefined : addPanel(nodesToAdd, entry.symbol),
              prevSymbol = (socket) ? socket.symbol : undefined,
              nextSymbol = entry.symbol;
        wiredPanels.changeGraphUndoable(nodesToAdd, [], function(forward) {
            if(update)
                linkSymbol(update, forward);
            if(socket)
                replaceTripleTemplate(socket, prevSymbol, nextSymbol, forward);
            else
                setPanelVisibility(panel, forward);
        });
    }
    openModal(accept);
    const searchBar = document.createElement('span'),
          results = document.createElement('div');
    modalContent.appendChild(searchBar);
    modalContent.appendChild(results);
    results.setAttribute('id', 'searchResults');
    searchBar.setAttribute('contentEditable', 'true');
    searchBar.onkeydown = function(event) {
        switch(event.keyCode) {
            case 13: // Enter
                accept();
            case 27: // Escape
                searchBar.blur();
                return;
            case 38: // Up
                if(selection < 0)
                    break;
                results.children[selection].classList.remove('selected');
                if(--selection < 0)
                    selection = results.children.length-1;
                results.children[selection].classList.add('selected');
                break;
            case 40: // Down
                if(selection < 0)
                    break;
                results.children[selection].classList.remove('selected');
                if(++selection >= results.children.length)
                    selection = 0;
                results.children[selection].classList.add('selected');
                break;
            default:
                return;
        }
        event.stopPropagation();
        event.preventDefault();
    };
    searchBar.onkeyup = function(event) {
        if(event) {
            switch(event.keyCode) {
                case 13: // Enter
                case 27: // Escape
                case 38: // Up
                case 40: // Down
                    return;
            }
            event.stopPropagation();
            event.preventDefault();
        }
        searchInput = searchBar.textContent.replace('\xA0', ' ');
        const items = labelIndex.get(searchInput),
              split = searchInput.split(':');
        if(split.length === 2) {
            const namespace = labelIndex.get(split[0])[0];
            if(namespace && BasicBackend.namespaceOfSymbol(namespace.entry.symbol) === BasicBackend.identityOfSymbol(BasicBackend.symbolByName.Namespaces)) {
                const entry = {};
                if(namespace.entry.symbol !== BasicBackend.symbolByName.Index) {
                    entry.label = `Create in ${namespace.entry.label}`;
                    entry.namespace = BasicBackend.identityOfSymbol(namespace.entry.symbol);
                    entry.data = BasicBackend.decodeText(split[1]);
                } else {
                    const index = parseInt(split[1]);
                    if(!isNaN(index)) {
                        entry.label = `Index:${index}`;
                        entry.symbol = BasicBackend.symbolInNamespace('Index', index);
                    }
                }
                if(entry.label)
                    items.unshift({'entry': entry});
            }
        }
        results.innerHTML = '';
        selection = (items.length > 0) ? 0 : undefined;
        for(let i = 0; i < items.length; ++i) {
            const element = document.createElement('div');
            results.appendChild(element);
            element.entry = items[i].entry;
            element.textContent = element.entry.label;
            element.addEventListener('mousemove', function(event) {
                results.children[selection].classList.remove('selected');
                selection = i;
                results.children[selection].classList.add('selected');
            });
            element.addEventListener('click', function(event) {
                selection = i;
                accept();
            });
            if(i === selection)
                element.classList.add('selected');
        }
    };
    searchBar.onkeyup();
    searchBar.focus();
}

function toggleFullscreen() {
    let element = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
    if(element) {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        return;
    }
    element = document.documentElement;
    if(element.requestFullscreen)
        element.requestFullscreen();
    else if(element.mozRequestFullScreen)
        element.mozRequestFullScreen();
    else if(element.webkitRequestFullscreen)
        element.webkitRequestFullscreen();
}



const wiredPanels = new WiredPanels({}, {
    activate(node) {
        const nodesToAdd = new Set(),
              nodesToRemove = new Set(),
              updates = new Set();
        for(const node of wiredPanels.selection) {
            if(node.type === 'panel') {
                nodesToRemove.add(node);
                continue;
            } else if(node.type === 'wire' || wiredPanels.selection.has(node.panel))
                continue;
            if(node === node.panel.entitySocket)
                updates.add(node);
            else if(node.symbol == undefined)
                openSearch(node);
            else if(node.wiresPerPanel.size === 0)
                addPanel(nodesToAdd, node.symbol);
        }
        let update = {};
        function accept() {
            const nodesToAdd = new Set(), nodesToRemove = new Set();
            let prevEncoding = [update.symbol, BasicBackend.symbolByName.Encoding, undefined],
                nextEncoding = [update.symbol, BasicBackend.symbolByName.Encoding, undefined];
            prevEncoding[2] = backend.getSolitary(prevEncoding[0], prevEncoding[1]);
            backend.setData(update.symbol, decodeHTML(modalContent));
            nextEncoding[2] = backend.getSolitary(nextEncoding[0], nextEncoding[1]);
            update.next = backend.getRawData(update.symbol);
            if(update.next !== update.prev) {
                if(prevEncoding[2] != nextEncoding[2]) {
                    if(prevEncoding[2] != BasicBackend.symbolByName.Void)
                        setTripleVisibility(nodesToRemove, prevEncoding, update.panel, false);
                    if(nextEncoding[2] != BasicBackend.symbolByName.Void)
                        setTripleVisibility(nodesToAdd, nextEncoding, update.panel, true);
                }
                wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, function(forward) {
                    if(prevEncoding[2] != nextEncoding[2])
                        backend.setSolitary(forward ? nextEncoding : prevEncoding);
                    const dataBytes = forward ? update.next : update.prev;
                    backend.setRawData(update.symbol, dataBytes);
                    updateLabels(update.symbol, true);
                    setNodesVisibility(nodesToAdd, forward);
                    setNodesVisibility(nodesToRemove, !forward);
                });
            }
            closeModal();
        }
        if(updates.size === 1) {
            openModal(accept);
            update.panel = updates.values().next().value.panel;
            update.symbol = update.panel.symbol;
            update.prev = backend.getRawData(update.symbol);
            const content = backend.getData(update.symbol, update.prev);
            encodeHTML(modalContent, content);
            if(content instanceof Array) {
                modalContent.classList.add('marginForMarks');
                makeListCollapsable(modalContent.getElementsByClassName('ul')[0]);
            }
        }
        if(nodesToAdd.size > 0 || nodesToRemove.size > 0)
            wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, function(forward) {
                for(const node of nodesToAdd)
                    if(node.type === 'panel')
                        setPanelVisibility(node, forward);
                for(const node of nodesToRemove)
                    if(node.type === 'panel')
                        setPanelVisibility(node, !forward);
            });
    },
    remove() {
        const nodesToRemove = new Set(),
              nodesToHide = new Set(),
              tripleTemplates = new Set(),
              triples = new Set(),
              updates = new Set();
        for(const node of wiredPanels.selection)
            switch(node.type) {
                case 'wire':
                    wiredPanels.setNodeSelected(node, false);
                    break;
                case 'socket':
                    if(wiredPanels.selection.has(node.panel))
                        continue;
                    switch(node.orientation) {
                        case 'top':
                            wiredPanels.setNodeSelected(node, false);
                            break;
                        case 'left':
                        case 'right': {
                            const triple = [], oppositeSocket = getOppositeSocket(node, triple);
                            if(wiredPanels.selection.has(oppositeSocket)) {
                                if(node.symbol != undefined)
                                    nodesToHide.add(node);
                                if(triple[1] != undefined && triple[2] != undefined)
                                    triples.add(triple);
                            } else {
                                wiredPanels.setNodeSelected(node, false);
                                if(node.wiresPerPanel.size > 0) {
                                    const wire = node.wiresPerPanel.values().next().value.keys().next().value;
                                    nodesToHide.add(wire);
                                    nodesToRemove.add(wire);
                                }
                                tripleTemplates.add({'socket': node, 'symbol': node.symbol});
                            }
                        } break;
                    }
                    break;
                case 'panel':
                    const outerTriples = [
                        ...backend.queryTriples(BasicBackend.queryMask.VMV, [0, node.symbol, 0]),
                        ...backend.queryTriples(BasicBackend.queryMask.VVM, [0, 0, node.symbol])
                    ], update = {
                        'panel': node,
                        'symbol': node.symbol,
                        'data': backend.getRawData(node.symbol),
                        'triples': [...backend.queryTriples(BasicBackend.queryMask.MVV, [node.symbol, 0, 0]), ...outerTriples]
                    };
                    for(const triple of outerTriples)
                        setTripleVisibility(nodesToRemove, triple, undefined, false);
                    updates.add(update);
                    nodesToHide.add(node);
                    break;
            }
        if(wiredPanels.selection.size === 0 && nodesToHide.size === 0 && tripleTemplates.size === 0)
            return;
        wiredPanels.changeGraphUndoable([], new Set([...wiredPanels.selection, ...nodesToRemove]), function(forward) {
            setNodesVisibility(nodesToHide, !forward);
            for(const triple of triples) {
                backend.setTriple(triple, !forward);
                if(triple[1] === BasicBackend.symbolByName.Encoding)
                    updateLabels(triple[0], true);
            }
            for(const tripleTemplate of tripleTemplates)
                replaceTripleTemplate(tripleTemplate.socket, undefined, tripleTemplate.symbol, !forward);
            for(const update of updates)
                linkSymbol(update, !forward);
        });
    },
    wireDrag(socket) {
        return true;
    },
    wireConnect(node, wire) {
        let callback;
        const nodesToAdd = new Set([wire]), nodesToRemove = new Set();
        if(node.type === 'panel' && wire.srcSocket.orientation === 'top') {
            const rect = wiredPanels.boundingRectOfPanel(node),
                  diffX = wire.dstSocket.primaryElement.x-(rect[0]+rect[1])/2,
                  diffY = wire.dstSocket.primaryElement.y-(rect[2]+rect[3])/2,
                  sockets = addTripleTemplate(node, nodesToAdd);
            wire.dstSocket = (diffX < 0) ? sockets[0] : sockets[1];
            wire.dstSocket.symbol = wire.srcSocket.symbol;
            wire.dstSocket.label.textContent = labelOfSymbol(wire.dstSocket.symbol).label;
            callback = setSocketVisibility.bind(this, wire.dstSocket);
        } else {
            if(node.type === 'panel') {
                wire.dstSocket = wire.srcSocket;
                wire.srcSocket = node.entitySocket;
                node = wire.dstSocket;
            } else if(wire.srcSocket.orientation === 'top')
                wire.dstSocket = node;
            else {
                if(node.orientation !== 'top')
                    return false;
                wire.dstSocket = wire.srcSocket;
                wire.srcSocket = node;
                node = wire.dstSocket;
            }
            const prevSymbol = node.symbol,
                  nextSymbol = wire.srcSocket.symbol;
            if(node.orientation === 'top' || prevSymbol === nextSymbol)
                return false;
            if(node.wiresPerPanel.size > 0)
                nodesToRemove.add(node.wiresPerPanel.values().next().value.keys().next().value);
            callback = replaceTripleTemplate.bind(this, wire.dstSocket, prevSymbol, nextSymbol);
        }
        wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, callback);
        return true;
    },
    paste(files) {
        files = files.files;
        if(!files || files.length !== 1)
            return false;
        for(const file of files) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const nodesToRemove = new Set();
                for(const symbol of backend.decodeJson(event.target.result)) {
                    const panel = getPanel(symbol);
                    if(panel) {
                        nodesToRemove.add(panel);
                        setPanelVisibility(panel, false);
                    }
                    labelOfSymbol(symbol, true);
                }
                wiredPanels.changeGraph([], nodesToRemove);
                wiredPanels.resetActionStack();
            };
            reader.readAsText(file);
        }
        return true;
    },
    metaS(event) {
        const string = backend.encodeJson();
        BasicBackend.downloadAsFile(string, 'Symatem.json');
    },
    metaO(event) {
        openFiles.click();
    },
    metaF(event) {
        if(event.shiftKey)
            toggleFullscreen();
        else
            openSearch();
    }
});



const modal = document.getElementById('modal'),
      modalPositive = document.getElementById('modalPositive'),
      modalNegative = document.getElementById('modalNegative'),
      menu = document.getElementById('menu'),
      menuItems = menu.getElementsByClassName('li'),
      openFiles = document.createElement('input');
let modalContent;
openFiles.setAttribute('id', 'openFiles');
openFiles.setAttribute('type', 'file');
menu.appendChild(openFiles);
menu.removeAttribute('style');
menu.classList.add('fadeIn');
makeListCollapsable(menu.getElementsByClassName('ul')[0]);
document.body.insertBefore(wiredPanels.svg, modal);
document.body.addEventListener('keydown', function(event) {
    if(event.keyCode !== 27)
        return;
    closeModal();
    event.preventDefault();
    event.stopPropagation();
});

modalNegative.addEventListener('click', closeModal);
menuItems[0].addEventListener('click', wiredPanels.undo);
menuItems[1].addEventListener('click', wiredPanels.redo);
menuItems[2].addEventListener('click', function() {
    // TODO paste
});
menuItems[3].addEventListener('click', function() {
    // TODO copy
});
menuItems[4].addEventListener('click', function() {
    // TODO cut
});
menuItems[5].addEventListener('click', function() {
    wiredPanels.eventListeners.activate();
});
menuItems[6].addEventListener('click', wiredPanels.eventListeners.metaF);
menuItems[7].addEventListener('click', wiredPanels.deleteSelected);
menuItems[8].addEventListener('click', wiredPanels.eventListeners.metaS);
menuItems[8].setAttribute('draggable', 'true');
menuItems[8].addEventListener('dragstart', function(event) {
    const string = backend.encodeJson();
    event.dataTransfer.setData('text/plain', string);
    event.dataTransfer.setData('application/json', string);
    event.dataTransfer.effectAllowed = 'all';
});
openFiles.addEventListener('change', function(event) {
    wiredPanels.eventListeners.paste(event.target);
});
{
    const label = document.createElement('label'),
          li = menuItems[9];
    label.setAttribute('for', openFiles.getAttribute('id'));
    li.parentNode.insertBefore(label, li);
    label.appendChild(li);
}
menuItems[10].addEventListener('click', toggleFullscreen);
