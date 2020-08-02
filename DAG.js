import { vec2 } from './node_modules/SvgPanels/Panel.js';
import { PolygonPanel, CirclePanel } from './node_modules/SvgPanels/Atoms.js';
import { ContainerPanel, ScrollViewPanel } from './node_modules/SvgPanels/Containers.js';
import { SymbolMap } from './node_modules/SymatemJS/SymatemJS.mjs';
import { backend, SymbolThumbnailPanel, BasicSymbolPanel } from './Basics.js';

function topologicalSort(vertices) {
    let layer = []
    const layers = [],
          vertexBySymbol = SymbolMap.create();
    for(const vertex of vertices) {
        vertex.predecessors = SymbolMap.create();
        vertex.successors = SymbolMap.create();
        for(const predecessorSlot of vertex.predecessorsByPort)
            for(const [edge, predecessor] of SymbolMap.entries(predecessorSlot))
                SymbolMap.set(vertex.predecessors, predecessor, true);
        for(const successorSlot of vertex.successorsByPort)
            for(const [edge, successor] of SymbolMap.entries(successorSlot))
                SymbolMap.set(vertex.successors, successor, true);
        vertex.discoveriesLeft = SymbolMap.count(vertex.predecessors);
        vertex.slotCount = Math.max(vertex.predecessorsByPort.length, vertex.successorsByPort.length);
        SymbolMap.set(vertexBySymbol, vertex.vertex, vertex);
        if(vertex.discoveriesLeft == 0)
            layer.push(vertex);
    }
    while(layer.length > 0) {
        layers.push(layer);
        let nextLayer = [];
        for(let i = 0; i < layer.length; ++i) {
            const predecessor = layer[i];
            for(const successorSymbol of SymbolMap.keys(predecessor.successors)) {
                const successor = SymbolMap.get(vertexBySymbol, successorSymbol);
                --successor.discoveriesLeft;
                if(successor.discoveriesLeft == 0) {
                    delete successor.discoveriesLeft;
                    nextLayer.push(successor);
                }
            }
        }
        layer = nextLayer;
    }
    return [layers, vertexBySymbol];
}

function* schematicLayout(layersAndVertices) {
    const [layers, vertexBySymbol] = layersAndVertices;
    if(layers.length == 0)
        return;
    const slots = [];
    function reserveSlots(vertex) {
        vertex.predecessorEdgesByPort = [];
        for(let predecessorSlot of vertex.predecessorsByPort)
            vertex.predecessorEdgesByPort.push([]);
        vertex.successorEdgesByPort = [];
        for(let successorSlot of vertex.successorsByPort)
            vertex.successorEdgesByPort.push([]);
        for(let i = vertex.slot; i < vertex.slot+vertex.slotCount; ++i)
            slots[i] = vertex;
    }
    for(let i = 0; i < layers[0].length; ++i) {
        layers[0][i].slot = i;
        reserveSlots(layers[0][i]);
    }
    for(let j = 0; j < layers.length; ++j) {
        const layer = layers[j];
        for(const vertex of layer) {
            vertex.layer = j;
            for(const edges of vertex.successorEdgesByPort)
                edges.sort((a, b) => {
                    const sideA = a.successorSlot > a.predecessorSlot,
                          sideB = b.successorSlot > b.predecessorSlot;
                    if(a.successor.layer == b.successor.layer || sideA != sideB)
                        return a.successorSlot-b.successorSlot;
                    else
                        return (sideA == 0) ? b.successor.layer-a.successor.layer : a.successor.layer-b.successor.layer;
                });
            for(const edges of vertex.predecessorEdgesByPort)
                edges.sort((a, b) => {
                    const sideA = a.predecessorSlot > a.successorSlot,
                          sideB = b.predecessorSlot > b.successorSlot;
                    if(a.predecessor.layer == b.predecessor.layer || sideA != sideB)
                        return a.predecessorSlot-b.predecessorSlot;
                    else
                        return (sideA == 0) ? b.predecessor.layer-a.predecessor.layer : a.predecessor.layer-b.predecessor.layer;
                });
        }
        yield layer;
        for(const vertex of layer)
            for(let i = vertex.slot; i < vertex.slot+vertex.slotCount; ++i)
                delete slots[i];
        for(const predecessor of layer)
            for(let successorPort = 0; successorPort < predecessor.successorsByPort.length; ++successorPort) {
                for(let [edge, successorSymbol] of SymbolMap.entries(predecessor.successorsByPort[successorPort])) {
                    let successor = SymbolMap.get(vertexBySymbol, successorSymbol);
                    if(successor.slot === undefined) {
                        let slotCount = 0;
                        for(let i = predecessor.slot; i >= 0; --i)
                            if(slots[i])
                                slotCount = 0;
                            else if(++slotCount == successor.slotCount) {
                                successor.slot = i;
                                break;
                            }
                        if(successor.slot == undefined) {
                            slotCount = 0;
                            for(let i = predecessor.slot+1; i < slots.length+successor.slotCount; ++i)
                                if(slots[i])
                                    slotCount = 0;
                                else if(++slotCount == successor.slotCount) {
                                    successor.slot = i-slotCount+1;
                                    break;
                                }
                        }
                        reserveSlots(successor);
                    }
                    edge = {
                        'edge': edge,
                        'predecessor': predecessor,
                        'predecessorPort': predecessor.successorsByPort.findIndex((successors) => SymbolMap.get(successors, edge)),
                        'successor': successor,
                        'successorPort': successorPort,
                        'successorSlot': successor.slot+successorPort
                    };
                    edge.predecessorSlot = predecessor.slot+edge.predecessorPort;
                    predecessor.successorEdgesByPort[edge.predecessorPort].push(edge);
                    successor.predecessorEdgesByPort[edge.successorPort].push(edge);
                }
            }
        for(let i = slots.length-1; i >= 0; --i)
            if(slots[i])
                break;
            else
                slots.length = i;
    }
}

export class DagPanel extends BasicSymbolPanel {
    constructor(position, symbol, acceptsDrop) {
        super(position, symbol, acceptsDrop);
        this.cellWidth = 25;
        this.cellHeight = 25;
        this.vertexIndex = SymbolMap.create();
        this.edgeIndex = SymbolMap.create();
        this.dagLayers = [];
        this.scrollViewPanel = new ScrollViewPanel(vec2.create(), vec2.create());
        this.scrollViewPanel.enableSelectionRect = true;
        this.scrollViewPanel.contentPanel.padding[0] = this.scrollViewPanel.contentPanel.padding[1] = 10;
        this.headerSplit.insertChild(this.scrollViewPanel);
        this.linesPanel = new ContainerPanel(vec2.create(), vec2.create());
        this.scrollViewPanel.contentPanel.insertChild(this.linesPanel);
        this.symbol = symbol;
        this.addEventListener('focusnavigation', (event) => {
            if(event.direction == 'in')
                this.symbolPanel.dispatchEvent({'type': 'focus'});
            else if(this.root.focusedPanel == this.symbolPanel) {
                if(this.dagLayers[0] && this.dagLayers[0][0])
                    SymbolMap.get(this.vertexIndex, this.dagLayers[0][0].vertex).dispatchEvent({'type': 'focus'});
            } else {
                let target;
                if(this.root.focusedPanel.vertex) {
                    if(event.direction == 'left' || event.direction == 'right') {
                        const index = this.dagLayers[this.root.focusedPanel.vertex.layer].indexOf(this.root.focusedPanel.vertex);
                        target = this.dagLayers[this.root.focusedPanel.vertex.layer][index+((event.direction == 'left') ? -1 : 1)];
                    } else {
                        const slots = this.root.focusedPanel.vertex[((event.direction == 'up') ? 'predecessorEdgesByPort' : 'successorEdgesByPort')],
                              edges = slots[slots.length>>1];
                        target = edges && edges[edges.length>>1];
                    }
                } else if(this.root.focusedPanel.edge) {
                    if(event.direction == 'left' || event.direction == 'right') {
                        const predecessorEdges = this.root.focusedPanel.edge.successor.predecessorEdgesByPort[this.root.focusedPanel.edge.predecessorPort],
                              index = predecessorEdges.indexOf(this.root.focusedPanel.edge);
                        target = predecessorEdges[index+((event.direction == 'left') ? -1 : 1)];
                    } else
                        target = this.root.focusedPanel.edge[(event.direction == 'up') ? 'predecessor' : 'successor'];
                }
                if(target)
                    target.panel.dispatchEvent({'type': 'focus'});
            }
            return true;
        });
    }

    backendUpdate() {
        super.backendUpdate();
        for(const [vertex, vertexPanel] of SymbolMap.entries(this.vertexIndex))
            vertexPanel.deletionFlag = true;
        for(const [edge, edgePanel] of SymbolMap.entries(this.edgeIndex))
            edgePanel.deletionFlag = true;
        this.dagLayers = [];
        for(const layer of schematicLayout(topologicalSort(this.getVertices()))) {
            for(const vertex of layer) {
                let vertexPanel = SymbolMap.get(this.vertexIndex, vertex.vertex);
                if(!vertexPanel) {
                    vertexPanel = new CirclePanel(vec2.create(), vec2.fromValues(10, 10));
                    vertexPanel.updateSize();
                    vertexPanel.node.classList.add('vcsDagNode');
                    vertexPanel.registerSelectEvent();
                    vertexPanel.registerFocusEvent(vertexPanel.node);
                    vertexPanel.vertex = vertex;
                    vertex.panel = vertexPanel;
                    this.scrollViewPanel.contentPanel.insertChild(vertexPanel);
                    SymbolMap.set(this.vertexIndex, vertex.vertex, vertexPanel);
                    vertexPanel.registerDragEvent(() => {
                        const panel = new SymbolThumbnailPanel(vec2.create(), vertex.vertex);
                        panel.backendUpdate();
                        return panel;
                    });
                } else
                    delete vertexPanel.deletionFlag;
                vertexPanel.position[0] = vertex.slot*this.cellWidth;
                vertexPanel.position[1] = vertex.layer*this.cellHeight;
                vertexPanel.updatePosition();
                for(const predecessorEdges of vertex.predecessorEdgesByPort)
                    for(const edge of predecessorEdges) {
                        let edgePanel = SymbolMap.get(this.edgeIndex, edge.edge);
                        if(!edgePanel) {
                            edgePanel = new PolygonPanel(vec2.fromValues(0, 0), vec2.create());
                            edgePanel.node.classList.add('vcsDagEdge');
                            edgePanel.registerSelectEvent(() => {
                                if(edgePanel.selected) {
                                    this.linesPanel.removeChild(edgePanel);
                                    this.linesPanel.insertChild(edgePanel);
                                }
                            });
                            edgePanel.registerFocusEvent(edgePanel.node);
                            edgePanel.edge = edge;
                            edge.panel = edgePanel;
                            this.linesPanel.insertChild(edgePanel);
                            SymbolMap.set(this.edgeIndex, edge.edge, edgePanel);
                            edgePanel.registerDragEvent(() => {
                                const panel = new SymbolThumbnailPanel(vec2.create(), edge.edge);
                                panel.backendUpdate();
                                return panel;
                            });
                        } else
                            delete edgePanel.deletionFlag;
                        edgePanel.vertices = [
                            vec2.fromValues(edge.predecessorSlot*this.cellWidth, edge.predecessor.layer*this.cellHeight),
                            vec2.fromValues(edge.successorSlot*this.cellWidth, (edge.predecessor.layer+1)*this.cellHeight),
                            vec2.fromValues(edge.successorSlot*this.cellWidth, edge.successor.layer*this.cellHeight)
                        ];
                    }
            }
        }
        for(const [vertex, vertexPanel] of SymbolMap.entries(this.vertexIndex))
            if(vertexPanel.deletionFlag) {
                this.scrollViewPanel.contentPanel.removeChild(vertexPanel);
                SymbolMap.remove(this.vertexIndex, vertex);
            }
        for(const [edge, edgePanel] of SymbolMap.entries(this.edgeIndex))
            if(edgePanel.deletionFlag) {
                this.linesPanel.removeChild(edgePanel);
                SymbolMap.remove(this.edgeIndex, edge);
            }
        vec2.scale(this.linesPanel.position, this.linesPanel.position, 0.0);
        this.scrollViewPanel.contentPanel.recalculateLayout();
        this.scrollViewPanel.recalculateLayout();
    }
}
